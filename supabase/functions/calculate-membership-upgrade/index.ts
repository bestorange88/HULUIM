import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpgradeResult {
  currentTierId: string | null;
  currentTierName: string | null;
  currentPrice: number;
  targetTierId: string;
  targetTierName: string;
  targetPrice: number;
  payableAmount: number;
  isUpgrade: boolean;
  message: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targetTierId } = await req.json();

    if (!targetTierId) {
      return new Response(
        JSON.stringify({ error: '请选择目标会员等级' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '未授权' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: '用户验证失败' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Get target tier info
    const { data: targetTier, error: targetError } = await supabase
      .from('membership_tiers')
      .select('id, name, price, sort_order')
      .eq('id', targetTierId)
      .eq('is_active', true)
      .single();

    if (targetError || !targetTier) {
      return new Response(
        JSON.stringify({ error: '目标会员等级不存在或已下架' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get user's current highest membership
    const { data: userMemberships, error: membershipError } = await supabase
      .from('user_memberships')
      .select('tier_id, membership_tiers(id, name, price, sort_order)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    let currentTierId: string | null = null;
    let currentTierName: string | null = null;
    let currentPrice = 0;
    let currentSortOrder = 0;

    if (userMemberships && userMemberships.length > 0) {
      // Find the highest tier the user owns (by sort_order or price)
      let highestTier: any = null;
      for (const membership of userMemberships) {
        const tier = membership.membership_tiers as any;
        if (tier && (!highestTier || tier.sort_order > highestTier.sort_order)) {
          highestTier = tier;
        }
      }

      if (highestTier) {
        currentTierId = highestTier.id;
        currentTierName = highestTier.name;
        currentPrice = Number(highestTier.price);
        currentSortOrder = highestTier.sort_order;
      }
    }

    const targetPrice = Number(targetTier.price);

    // 3. Calculate payable amount
    let payableAmount = targetPrice - currentPrice;
    let isUpgrade = true;
    let message = '';

    if (targetTier.sort_order <= currentSortOrder && currentTierId) {
      // Target tier is same or lower than current
      payableAmount = 0;
      isUpgrade = false;
      message = '您当前已是该等级或更高等级，无需重复购买';
    } else if (payableAmount <= 0) {
      // Price is same or lower (shouldn't happen if sort_order is correct)
      payableAmount = 0;
      isUpgrade = false;
      message = '目标等级价格不高于当前等级，无法升级';
    } else if (currentTierId) {
      message = `从${currentTierName}升级到${targetTier.name}，需补差价 ¥${payableAmount.toFixed(2)}`;
    } else {
      message = `开通${targetTier.name}，需支付 ¥${payableAmount.toFixed(2)}`;
    }

    const result: UpgradeResult = {
      currentTierId,
      currentTierName,
      currentPrice,
      targetTierId: targetTier.id,
      targetTierName: targetTier.name,
      targetPrice,
      payableAmount,
      isUpgrade,
      message,
    };

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error calculating membership upgrade:', err);
    return new Response(
      JSON.stringify({ error: '计算升级价格失败' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
