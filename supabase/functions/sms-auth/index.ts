import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

const UNIVERSAL_CODE = "911522"; // Universal test code for development

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { phone, code, action, username, displayName, inviteCode, password } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check if using universal test code (bypasses SMS verification)
    const isUniversalCode = code === UNIVERSAL_CODE;
    
    if (!isUniversalCode) {
      // Verify SMS code from database
      const { data: codeData, error: codeError } = await supabase
        .from('sms_verification_codes')
        .select('*')
        .eq('phone', phone)
        .eq('code', code)
        .eq('is_valid', true)
        .eq('purpose', action)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (codeError || !codeData) {
        return new Response(
          JSON.stringify({ success: false, error: 'invalid_code', detail: '验证码错误或已过期，请重新获取' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      // Mark code as used
      await supabase
        .from('sms_verification_codes')
        .update({ is_valid: false, used_at: new Date().toISOString() })
        .eq('id', codeData.id);
    }

    if (action === 'login') {
      // Find user by phone
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ success: false, error: 'user_not_found', detail: '该手机号尚未注册，请先注册' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Generate magic link for user to auto-login
      const email = `${phone}@phone.local`;
      const { data, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
      });

      if (linkError || !data) {
        console.error('Failed to generate link:', linkError);
        return new Response(
          JSON.stringify({ success: false, error: 'failed_to_generate_link', detail: '登录链接生成失败，请稍后重试' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          email: email,
          properties: data.properties
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'register') {
      console.log('Processing registration for phone:', phone, 'username:', username);
      
      // Validate required fields
      if (!username || !displayName || !inviteCode) {
        console.log('Missing required fields:', { username: !!username, displayName: !!displayName, inviteCode: !!inviteCode });
        return new Response(
          JSON.stringify({ success: false, error: 'missing_required_fields', detail: '请填写所有必填字段（用户名、显示名称、邀请码）' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Validate invite code - must be a valid referrer code
      console.log('Validating invite code:', inviteCode);
      const { data: referrer, error: referrerError } = await supabase
        .from('profiles')
        .select('id')
        .eq('invite_code', inviteCode)
        .maybeSingle();

      if (referrerError) {
        console.error('Error checking invite code:', referrerError);
        return new Response(
          JSON.stringify({ success: false, error: 'invite_code_check_failed', detail: '验证邀请码时出错，请稍后重试' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      if (!referrer) {
        console.log('Invalid invite code - not found');
        return new Response(
          JSON.stringify({ success: false, error: 'invalid_invite_code', detail: '邀请码不存在或已失效，请确认后重新输入' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Check if phone already registered
      console.log('Checking if phone is already registered:', phone);
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (profileCheckError) {
        console.error('Error checking phone:', profileCheckError);
        return new Response(
          JSON.stringify({ success: false, error: 'phone_check_failed', detail: '验证手机号时出错，请稍后重试' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      if (existingProfile) {
        console.log('Phone already registered');
        return new Response(
          JSON.stringify({ success: false, error: 'phone_already_registered', detail: '该手机号已被注册，请直接登录' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Check if username already exists
      console.log('Checking if username is already taken:', username);
      const { data: existingUsername, error: usernameCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (usernameCheckError) {
        console.error('Error checking username:', usernameCheckError);
        return new Response(
          JSON.stringify({ success: false, error: 'username_check_failed', detail: '验证用户名时出错，请稍后重试' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      if (existingUsername) {
        console.log('Username already taken');
        return new Response(
          JSON.stringify({ success: false, error: 'username_already_exists', detail: '该用户名已被使用，请更换一个' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Generate unique 5-character invite code (uppercase letters + numbers)
      const generateInviteCode = (): string => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let code = "";
        for (let i = 0; i < 5; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      // Generate unique invite code with collision check
      let newInviteCode = generateInviteCode();
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        const { data: existingCode } = await supabase
          .from('profiles')
          .select('id')
          .eq('invite_code', newInviteCode)
          .maybeSingle();
        
        if (!existingCode) {
          break; // Code is unique
        }
        
        newInviteCode = generateInviteCode();
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        console.error('Failed to generate unique invite code after max attempts');
        return new Response(
          JSON.stringify({ success: false, error: 'failed_to_generate_invite_code', detail: '系统繁忙，请稍后重试' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      const email = `${phone}@phone.local`;
      
      // Use provided password or generate a random one
      const userPassword = password || `SMS_${Date.now()}_${Math.random().toString(36)}`;

      console.log('Creating user with email:', email);
      
      // Create user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: userPassword,
        email_confirm: true,
        user_metadata: {
          username,
          display_name: displayName,
          phone,
          invite_code: newInviteCode,
        }
      });

      if (authError || !authData.user) {
        console.error('Failed to create user:', authError);
        // Check for specific error types
        if (authError) {
          const errorCode = 'code' in authError ? authError.code : '';
          const errorMsg = authError.message || '';
          
          if (errorCode === 'email_exists' || errorMsg.includes('already registered')) {
            return new Response(
              JSON.stringify({ success: false, error: 'phone_already_registered', detail: '该手机号已被注册' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }
          
          if (errorMsg.includes('password')) {
            return new Response(
              JSON.stringify({ success: false, error: 'invalid_password', detail: '密码格式不正确，请使用6位以上字符' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }
          
          return new Response(
            JSON.stringify({ success: false, error: 'failed_to_create_user', detail: `创建账号失败：${errorMsg}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: 'failed_to_create_user', detail: '创建账号失败，请稍后重试' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      console.log('User created successfully:', authData.user.id);

      // Process referral
      try {
        await fetch(`${supabaseUrl}/functions/v1/process-referral`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            new_user_id: authData.user.id,
            referrer_code: inviteCode,
          })
        });
      } catch (error) {
        console.error('Failed to process referral:', error);
      }

      // Generate magic link for auto-login
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
      });

      if (linkError || !linkData) {
        console.error('Failed to generate link:', linkError);
        return new Response(
          JSON.stringify({ success: false, error: 'failed_to_generate_link', detail: '账号已创建，但登录链接生成失败，请尝试手动登录' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          email: email,
          properties: linkData.properties
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'invalid_action', detail: '无效的操作类型' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('SMS auth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Error stack:', errorStack);
    
    // Return a more user-friendly error response
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'server_error', 
        detail: `服务器处理请求时发生错误：${errorMessage}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
