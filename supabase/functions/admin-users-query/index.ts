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

    // Initialize Supabase client with service role key
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

    // Query all users with profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Failed to fetch profiles:', profilesError);
      throw profilesError;
    }

    const userIds = profiles?.map(p => p.id) || [];
    
    // Fetch memberships
    const { data: memberships } = await supabaseAdmin
      .from('user_memberships')
      .select(`
        user_id,
        tier_id,
        membership_tiers (name)
      `)
      .in('user_id', userIds)
      .eq('is_active', true);

    // Fetch points
    const { data: points } = await supabaseAdmin
      .from('user_points')
      .select('user_id, balance')
      .in('user_id', userIds);

    // Fetch wallets
    const { data: wallets } = await supabaseAdmin
      .from('wallets')
      .select('user_id, balance')
      .in('user_id', userIds);

    // 获取所有推荐人信息（通过invite_code）
    const referredByCodes = profiles?.filter(p => p.referred_by_code).map(p => p.referred_by_code) || [];
    const { data: referrers } = await supabaseAdmin
      .from('profiles')
      .select('invite_code, display_name, username')
      .in('invite_code', referredByCodes);

    // Merge data
    const usersWithDetails = profiles?.map(profile => {
      const membership = memberships?.find(m => m.user_id === profile.id);
      const userPoints = points?.find(p => p.user_id === profile.id);
      const userWallet = wallets?.find(w => w.user_id === profile.id);
      const referrer = referrers?.find(r => r.invite_code === profile.referred_by_code);
      
      return {
        ...profile,
        membership_tier: (membership?.membership_tiers as any)?.name || null,
        points: userPoints?.balance || 0,
        balance: userWallet?.balance || 0,
        referrer: referrer ? { display_name: referrer.display_name, username: referrer.username } : null,
      };
    }) || [];

    console.log(`Successfully fetched ${usersWithDetails.length} users`);

    return new Response(
      JSON.stringify({ users: usersWithDetails }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in admin-users-query:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});