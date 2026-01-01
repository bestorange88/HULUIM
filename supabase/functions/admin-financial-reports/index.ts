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

    const { action, token, period } = await req.json();

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

    // 获取统计数据
    if (action === 'getStats') {
      // Load all crypto transactions
      const { data: cryptoData, error } = await supabase
        .from('crypto_transactions')
        .select('type, amount, status, review_status, created_at')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch transactions:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch transactions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calculate summary
      const deposits = cryptoData?.filter(t => t.type === 'deposit' || t.type === 'fiat_deposit') || [];
      const withdrawals = cryptoData?.filter(t => t.type === 'withdraw' || t.type === 'fiat_withdraw') || [];

      const summary = {
        total_deposits: deposits
          .filter(t => t.review_status === 'approved')
          .reduce((sum, t) => sum + Number(t.amount), 0),
        total_withdrawals: withdrawals
          .filter(t => t.review_status === 'approved')
          .reduce((sum, t) => sum + Number(t.amount), 0),
        deposit_count: deposits.filter(t => t.review_status === 'approved').length,
        withdrawal_count: withdrawals.filter(t => t.review_status === 'approved').length,
        pending_deposits: deposits.filter(t => t.review_status === 'pending').length,
        pending_withdrawals: withdrawals.filter(t => t.review_status === 'pending').length,
      };

      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;
      let groupFormat: string;

      if (period === 'daily') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupFormat = 'day';
      } else if (period === 'weekly') {
        startDate = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
        groupFormat = 'week';
      } else {
        startDate = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000);
        groupFormat = 'month';
      }

      // Filter and group transactions
      const filteredData = cryptoData?.filter(
        t => t.review_status === 'approved' && new Date(t.created_at) >= startDate
      ) || [];

      const groups: Record<string, any> = {};

      filteredData.forEach((tx) => {
        const date = new Date(tx.created_at);
        let key: string;

        if (groupFormat === 'day') {
          key = date.toISOString().split('T')[0];
        } else if (groupFormat === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!groups[key]) {
          groups[key] = {
            date: key,
            deposits: 0,
            withdrawals: 0,
            deposit_count: 0,
            withdrawal_count: 0,
          };
        }

        const amount = Number(tx.amount);
        if (tx.type === 'deposit' || tx.type === 'fiat_deposit') {
          groups[key].deposits += amount;
          groups[key].deposit_count += 1;
        } else if (tx.type === 'withdraw' || tx.type === 'fiat_withdraw') {
          groups[key].withdrawals += amount;
          groups[key].withdrawal_count += 1;
        }
      });

      const chartData = Object.values(groups).sort((a: any, b: any) => a.date.localeCompare(b.date));

      return new Response(
        JSON.stringify({ success: true, summary, chartData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Financial reports error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
