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
    const { adminToken } = await req.json();
    
    if (!adminToken) {
      return new Response(
        JSON.stringify({ error: 'No admin token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from('admin_sessions')
      .select('*')
      .eq('session_token', adminToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !sessionData) {
      console.log('Invalid admin session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired admin token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      usersRes,
      conversationsRes,
      transactionsRes,
      walletsRes,
      todayUsersRes,
      todayTransactionsRes,
      pendingReviewsRes,
      pendingVerificationsRes,
      messagesRes,
      todayRechargeRes,
      todayWithdrawRes,
      redEnvelopeFixedRes,
      redEnvelopeRandomRes,
      redEnvelopeDesignatedRes,
      membershipTiersRes,
      userMembershipsRes,
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('conversations').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('wallets').select('balance'),
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today.toISOString()),
      supabaseAdmin
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today.toISOString()),
      supabaseAdmin
        .from('crypto_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('review_status', 'pending'),
      supabaseAdmin
        .from('real_name_verifications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabaseAdmin.from('messages').select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('transactions')
        .select('amount')
        .eq('type', 'recharge')
        .eq('status', 'completed')
        .gte('created_at', today.toISOString()),
      supabaseAdmin
        .from('transactions')
        .select('amount')
        .eq('type', 'withdraw')
        .eq('status', 'completed')
        .gte('created_at', today.toISOString()),
      supabaseAdmin
        .from('red_envelopes')
        .select('amount')
        .eq('type', 'fixed'),
      supabaseAdmin
        .from('red_envelopes')
        .select('amount')
        .eq('type', 'random'),
      supabaseAdmin
        .from('red_envelopes')
        .select('amount')
        .eq('type', 'designated'),
      supabaseAdmin
        .from('membership_tiers')
        .select('id, name')
        .eq('is_active', true),
      supabaseAdmin
        .from('user_memberships')
        .select('tier_id')
        .eq('is_active', true),
    ]);

    const totalBalance =
      walletsRes.data?.reduce((sum, wallet) => sum + Number(wallet.balance), 0) || 0;

    const todayRechargeAmount =
      todayRechargeRes.data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const todayWithdrawAmount =
      todayWithdrawRes.data?.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0;

    const redEnvelopeFixedTotal =
      redEnvelopeFixedRes.data?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;

    const redEnvelopeRandomTotal =
      redEnvelopeRandomRes.data?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;

    const redEnvelopeDesignatedTotal =
      redEnvelopeDesignatedRes.data?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;

    const tierIdToName: Record<string, string> = {};
    membershipTiersRes.data?.forEach((tier: any) => {
      tierIdToName[tier.id] = tier.name;
    });

    const membershipCounts: Record<string, number> = {
      '黄金会员': 0,
      '钻石会员': 0,
      '至尊会员': 0,
    };

    userMembershipsRes.data?.forEach((membership: any) => {
      const tierName = tierIdToName[membership.tier_id];
      if (tierName && membershipCounts[tierName] !== undefined) {
        membershipCounts[tierName]++;
      }
    });

    const stats = {
      totalUsers: usersRes.count || 0,
      totalConversations: conversationsRes.count || 0,
      totalTransactions: transactionsRes.count || 0,
      totalWalletBalance: totalBalance,
      todayNewUsers: todayUsersRes.count || 0,
      todayTransactions: todayTransactionsRes.count || 0,
      pendingReviews: pendingReviewsRes.count || 0,
      pendingVerifications: pendingVerificationsRes.count || 0,
      totalMessages: messagesRes.count || 0,
      todayRechargeAmount,
      todayWithdrawAmount,
      redEnvelopeFixed: redEnvelopeFixedTotal,
      redEnvelopeRandom: redEnvelopeRandomTotal,
      redEnvelopeDesignated: redEnvelopeDesignatedTotal,
      membershipGold: membershipCounts['黄金会员'],
      membershipDiamond: membershipCounts['钻石会员'],
      membershipSupreme: membershipCounts['至尊会员'],
    };

    console.log('Dashboard stats fetched successfully:', stats);

    return new Response(
      JSON.stringify({ stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in admin-dashboard-stats:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
