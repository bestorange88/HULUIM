import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { new_user_id, referrer_code } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get referrer by invite code
    const { data: referrer } = await supabase
      .from('profiles')
      .select('id')
      .eq('invite_code', referrer_code)
      .single();

    if (!referrer) {
      return new Response(
        JSON.stringify({ success: false, error: 'invalid_invite_code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get referral settings
    const { data: settings } = await supabase
      .from('referral_settings')
      .select('*')
      .eq('is_enabled', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!settings) {
      return new Response(
        JSON.stringify({ success: false, error: 'referral_disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rewards = [];

    // Create level 1 referral relationship and reward
    await supabase
      .from('referrals')
      .insert({ user_id: new_user_id, referrer_id: referrer.id, level: 1 })
      .select()
      .single();

    await supabase
      .from('referral_rewards')
      .insert({
        user_id: referrer.id,
        referred_user_id: new_user_id,
        amount: settings.level_1_reward,
        level: 1,
        status: settings.require_approval ? 'pending' : 'approved',
      });

    rewards.push({ level: 1, user_id: referrer.id, amount: settings.level_1_reward });

    // Find level 2 referrer
    const { data: level2Referral } = await supabase
      .from('referrals')
      .select('referrer_id')
      .eq('user_id', referrer.id)
      .eq('level', 1)
      .limit(1)
      .single();

    if (level2Referral) {
      await supabase
        .from('referrals')
        .insert({ user_id: new_user_id, referrer_id: level2Referral.referrer_id, level: 2 });

      await supabase
        .from('referral_rewards')
        .insert({
          user_id: level2Referral.referrer_id,
          referred_user_id: new_user_id,
          amount: settings.level_2_reward,
          level: 2,
          status: settings.require_approval ? 'pending' : 'approved',
        });

      rewards.push({ level: 2, user_id: level2Referral.referrer_id, amount: settings.level_2_reward });

      // Find level 3 referrer
      const { data: level3Referral } = await supabase
        .from('referrals')
        .select('referrer_id')
        .eq('user_id', level2Referral.referrer_id)
        .eq('level', 1)
        .limit(1)
        .single();

      if (level3Referral) {
        await supabase
          .from('referrals')
          .insert({ user_id: new_user_id, referrer_id: level3Referral.referrer_id, level: 3 });

        await supabase
          .from('referral_rewards')
          .insert({
            user_id: level3Referral.referrer_id,
            referred_user_id: new_user_id,
            amount: settings.level_3_reward,
            level: 3,
            status: settings.require_approval ? 'pending' : 'approved',
          });

        rewards.push({ level: 3, user_id: level3Referral.referrer_id, amount: settings.level_3_reward });
      }
    }

    // Update new user's referred_by_code
    await supabase
      .from('profiles')
      .update({ referred_by_code: referrer_code })
      .eq('id', new_user_id);

    // Create bidirectional friendship between referrer and new user
    await supabase
      .from('friendships')
      .insert([
        {
          user_id: referrer.id,
          friend_id: new_user_id,
          status: 'accepted'
        },
        {
          user_id: new_user_id,
          friend_id: referrer.id,
          status: 'accepted'
        }
      ]);

    return new Response(
      JSON.stringify({ success: true, rewards_created: rewards }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing referral:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
