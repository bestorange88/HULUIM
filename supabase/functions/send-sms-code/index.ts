import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limit constants
const RATE_LIMIT_SECONDS = 60; // 1 SMS per minute per phone
const DAILY_LIMIT = 10; // Max 10 SMS per day per phone

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, purpose } = await req.json();

    if (!phone || !purpose) {
      return new Response(
        JSON.stringify({ success: false, error: 'missing_parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Clean phone number
    const cleanPhone = phone.replace(/^\+?86/, '').replace(/\s/g, '');

    // Rate limiting: Check for recent SMS sent to this phone
    const oneMinuteAgo = new Date(Date.now() - RATE_LIMIT_SECONDS * 1000).toISOString();
    const { data: recentCodes, error: recentError } = await supabase
      .from('sms_verification_codes')
      .select('id')
      .eq('phone', cleanPhone)
      .gt('created_at', oneMinuteAgo);

    if (recentError) {
      console.error('Failed to check rate limit:', recentError);
    } else if (recentCodes && recentCodes.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'rate_limit_exceeded', message: '请求过于频繁，请稍后再试' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    // Daily limit: Check for SMS sent today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: dailyCodes, error: dailyError } = await supabase
      .from('sms_verification_codes')
      .select('id')
      .eq('phone', cleanPhone)
      .gt('created_at', todayStart.toISOString());

    if (dailyError) {
      console.error('Failed to check daily limit:', dailyError);
    } else if (dailyCodes && dailyCodes.length >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({ success: false, error: 'daily_limit_exceeded', message: '今日验证码发送次数已达上限' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store verification code in database
    const { error: insertError } = await supabase
      .from('sms_verification_codes')
      .insert({
        phone: cleanPhone,
        code,
        purpose,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      });

    if (insertError) {
      console.error('Failed to store verification code:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'failed_to_store_code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Send SMS via 短信宝 API
    const username = Deno.env.get('SMSBAO_USERNAME');
    const apiKey = Deno.env.get('SMSBAO_API_KEY');

    if (!username || !apiKey) {
      console.error('SMS service not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'sms_service_not_configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    // 使用审核通过的短信签名（请确保在短信宝后台已审核通过）
    const message = `【福建益品康丰集团】您的验证码是${code}。有效期为10分钟，请尽快验证。`;
    const smsUrl = `https://api.smsbao.com/sms?u=${username}&p=${apiKey}&m=${cleanPhone}&c=${encodeURIComponent(message)}`;

    console.log('Attempting to send SMS to:', cleanPhone);

    const smsResponse = await fetch(smsUrl);
    const result = await smsResponse.text();

    console.log('SMS API response:', result);

    // 短信宝返回码解析
    const smsResultCode = result.trim();
    const smsErrorMessages: Record<string, string> = {
      '0': 'success',
      '30': '密码错误',
      '40': '账户余额不足',
      '41': '账户未激活',
      '43': 'IP地址受限',
      '50': '内容含有敏感词',
      '51': '签名不正确或未审核',
    };

    console.log('SMS result code:', smsResultCode, 'message:', smsErrorMessages[smsResultCode] || 'unknown');

    if (smsResultCode === '0') {
      return new Response(
        JSON.stringify({ success: true, message: 'verification_code_sent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const errorDetail = smsErrorMessages[smsResultCode] || `未知错误(${smsResultCode})`;
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'sms_send_failed', 
          code: smsResultCode,
          detail: errorDetail
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  } catch (error) {
    console.error('Error sending SMS:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});