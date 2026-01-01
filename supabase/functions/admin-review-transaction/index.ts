import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, token, transactionId, reviewStatus, reviewNotes } = await req.json();

    console.log('Admin review transaction:', { action, transactionId, reviewStatus });

    // 验证管理员会话
    const { data: session } = await supabase
      .from('admin_sessions')
      .select('username')
      .eq('session_token', token)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 获取所有待审核的交易
    if (action === 'getPending') {
      const { data: transactions, error } = await supabase
        .from('crypto_transactions')
        .select('*')
        .eq('review_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch transactions:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch transactions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch profiles separately
      const userIds = [...new Set(transactions?.map(t => t.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const transactionsWithProfiles = transactions?.map(t => ({
        ...t,
        profiles: profileMap.get(t.user_id) || null
      })) || [];

      return new Response(
        JSON.stringify({ success: true, transactions: transactionsWithProfiles }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 获取所有交易（包括已审核）
    if (action === 'getAll') {
      const { data: transactions, error } = await supabase
        .from('crypto_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Failed to fetch transactions:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch transactions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch profiles separately
      const userIds = [...new Set(transactions?.map(t => t.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const transactionsWithProfiles = transactions?.map(t => ({
        ...t,
        profiles: profileMap.get(t.user_id) || null
      })) || [];

      return new Response(
        JSON.stringify({ success: true, transactions: transactionsWithProfiles }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 审核交易
    if (action === 'review') {
      if (!transactionId || !reviewStatus) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 获取交易信息
      const { data: transaction, error: fetchError } = await supabase
        .from('crypto_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (fetchError || !transaction) {
        console.error('Transaction not found:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Transaction not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (transaction.review_status !== 'pending') {
        return new Response(
          JSON.stringify({ error: 'Transaction already reviewed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 更新审核状态
      const { error: updateError } = await supabase
        .from('crypto_transactions')
        .update({
          review_status: reviewStatus,
          reviewed_by: session.username,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
          status: reviewStatus === 'approved' ? 'confirmed' : 'failed',
          confirmed_at: reviewStatus === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', transactionId);

      if (updateError) {
        console.error('Failed to update transaction:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update transaction' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 如果审核通过，更新用户钱包
      if (reviewStatus === 'approved') {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance, frozen_balance')
          .eq('user_id', transaction.user_id)
          .single();

        if (wallet) {
          const balanceBefore = Number(wallet.balance);
          const frozenBefore = Number(wallet.frozen_balance || 0);
          let newBalance = balanceBefore;
          let newFrozen = frozenBefore;
          let txType = transaction.type;
          let description = '';

          // 充值：增加余额
          if (transaction.type === 'deposit' || transaction.type === 'fiat_deposit') {
            newBalance = balanceBefore + Number(transaction.amount);
            txType = transaction.type === 'fiat_deposit' ? 'fiat_deposit' : 'recharge';
            description = transaction.type === 'fiat_deposit' ? '法币充值' : 'USDT充值';
          }
          // 提现：解冻金额
          else if (transaction.type === 'withdraw' || transaction.type === 'fiat_withdraw') {
            newFrozen = Math.max(0, frozenBefore - Number(transaction.amount));
            txType = transaction.type === 'fiat_withdraw' ? 'fiat_withdraw' : 'withdraw';
            description = transaction.type === 'fiat_withdraw' ? '法币提现完成' : 'USDT提现完成';
          }

          // 更新钱包余额
          await supabase
            .from('wallets')
            .update({ 
              balance: newBalance, 
              frozen_balance: newFrozen,
              updated_at: new Date().toISOString() 
            })
            .eq('user_id', transaction.user_id);

          // 创建交易记录 (充值时创建)
          if (transaction.type === 'deposit' || transaction.type === 'fiat_deposit') {
            await supabase
              .from('transactions')
              .insert({
                user_id: transaction.user_id,
                type: txType,
                amount: transaction.amount,
                balance_before: balanceBefore,
                balance_after: newBalance,
                description: description,
                reference_id: transaction.id,
                reference_type: 'crypto_transaction',
                status: 'completed'
              });
          }
        }

        // 发送审核通过通知
        await sendApprovalNotification(supabase, transaction.user_id, reviewNotes);
      }
      // 如果拒绝提现，解冻金额返还用户
      else if (reviewStatus === 'rejected') {
        if (transaction.type === 'withdraw' || transaction.type === 'fiat_withdraw') {
          const { data: wallet } = await supabase
            .from('wallets')
            .select('balance, frozen_balance')
            .eq('user_id', transaction.user_id)
            .single();

          if (wallet) {
            const balanceBefore = Number(wallet.balance);
            const frozenBefore = Number(wallet.frozen_balance || 0);
            const newBalance = balanceBefore + Number(transaction.amount);
            const newFrozen = Math.max(0, frozenBefore - Number(transaction.amount));

            // 返还金额到可用余额
            await supabase
              .from('wallets')
              .update({ 
                balance: newBalance, 
                frozen_balance: newFrozen,
                updated_at: new Date().toISOString() 
              })
              .eq('user_id', transaction.user_id);

            // 创建退款交易记录
            await supabase
              .from('transactions')
              .insert({
                user_id: transaction.user_id,
                type: 'refund',
                amount: transaction.amount,
                balance_before: balanceBefore,
                balance_after: newBalance,
                description: '提现申请被拒绝，金额已退回',
                reference_id: transaction.id,
                reference_type: 'crypto_transaction',
                status: 'completed'
              });
          }
        }

        // 发送审核拒绝通知
        await sendRejectionNotification(supabase, transaction.user_id, transaction.type, reviewNotes);
      }

      console.log('Review completed successfully');
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Admin review error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// 发送审核通过通知
async function sendApprovalNotification(supabase: any, userId: string, reviewNotes: string | null) {
  try {
    // 查找客服账号
    const { data: customerService } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', 'customer_service')
      .single();

    if (!customerService) return;

    // 创建或获取与用户的对话
    const { data: conversationId } = await supabase
      .rpc('create_direct_conversation', { friend_id: userId });

    if (conversationId) {
      // 发送系统消息
      const message = `您的充值/提现申请已通过审核。${reviewNotes ? `审核备注：${reviewNotes}` : ''}`;
      
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: customerService.id,
          content: message,
          type: 'text'
        });
    }
  } catch (error) {
    console.error('Failed to send approval notification:', error);
  }
}

// 发送审核拒绝通知
async function sendRejectionNotification(supabase: any, userId: string, txType: string, reviewNotes: string | null) {
  try {
    // 查找客服账号
    const { data: customerService } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', 'customer_service')
      .single();

    if (!customerService) return;

    // 创建或获取与用户的对话
    const { data: conversationId } = await supabase
      .rpc('create_direct_conversation', { friend_id: userId });

    if (conversationId) {
      // 发送系统消息
      const typeText = txType.includes('deposit') ? '充值' : '提现';
      const message = `您的${typeText}申请未通过审核。${reviewNotes ? `原因：${reviewNotes}` : ''}${txType.includes('withdraw') ? ' 金额已退回您的账户。' : ''}`;
      
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: customerService.id,
          content: message,
          type: 'text'
        });
    }
  } catch (error) {
    console.error('Failed to send rejection notification:', error);
  }
}
