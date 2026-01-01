import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { adminToken, userId, operation, amount, note } = await req.json();
    
    if (!adminToken) {
      return new Response(
        JSON.stringify({ error: 'No admin token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId || !operation || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify admin token
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from('admin_sessions')
      .select('username')
      .eq('session_token', adminToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !sessionData) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired admin token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current wallet
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    const currentBalance = wallet?.balance || 0;
    const adjustAmount = parseFloat(amount);
    const newBalance = operation === 'add' 
      ? currentBalance + adjustAmount 
      : Math.max(0, currentBalance - adjustAmount);

    if (wallet) {
      // Update existing wallet
      const { error: updateError } = await supabaseAdmin
        .from('wallets')
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;
    } else {
      // Create wallet if doesn't exist
      if (operation === 'add') {
        const { error: insertError } = await supabaseAdmin
          .from('wallets')
          .insert({
            user_id: userId,
            balance: adjustAmount
          });

        if (insertError) throw insertError;
      } else {
        return new Response(
          JSON.stringify({ error: '该用户还没有钱包' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create transaction record
    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      type: operation === 'add' ? 'admin_add' : 'admin_subtract',
      amount: operation === 'add' ? adjustAmount : -adjustAmount,
      balance_before: currentBalance,
      balance_after: newBalance,
      description: note || (operation === 'add' ? '管理员加款' : '管理员扣款'),
      status: 'completed'
    });

    // Log admin action
    await supabaseAdmin.rpc('log_admin_action', {
      p_admin_username: sessionData.username,
      p_action: operation === 'add' ? 'add_balance' : 'subtract_balance',
      p_resource_type: 'user',
      p_resource_id: userId,
      p_details: { amount: adjustAmount, note, new_balance: newBalance }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        newBalance,
        message: `${operation === 'add' ? '加款' : '扣款'}成功`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in admin-adjust-balance:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
