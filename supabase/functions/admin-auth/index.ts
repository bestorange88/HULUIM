import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import * as OTPAuth from 'https://esm.sh/otpauth@9.2.2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, username, password, token, newPassword, totpToken } = await req.json();

    // Login action
    if (action === 'login') {
      // 从数据库验证管理员账号
      const { data: adminData, error: adminError } = await supabase
        .from('admin_accounts')
        .select('*')
        .eq('username', username)
        .single();

      if (adminError || !adminData) {
        return new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 验证密码
      const { data: passwordCheck } = await supabase.rpc('verify_password', {
        p_username: username,
        p_password: password
      });

      if (!passwordCheck) {
        return new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 如果启用了 TOTP，验证令牌
      if (adminData.totp_enabled) {
        if (!totpToken) {
          return new Response(
            JSON.stringify({ error: 'TOTP token required', requireTotp: true }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const totp = new OTPAuth.TOTP({
          secret: adminData.totp_secret,
          digits: 6,
          period: 30,
        });

        const isValidTotp = totp.validate({ token: totpToken, window: 1 }) !== null;
        
        if (!isValidTotp) {
          return new Response(
            JSON.stringify({ error: 'Invalid TOTP token' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // 创建会话令牌
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error: sessionError } = await supabase
        .from('admin_sessions')
        .insert({
          username: adminData.username,
          session_token: sessionToken,
          expires_at: expiresAt.toISOString()
        });

      if (sessionError) {
        console.error('Session creation error:', sessionError);
        return new Response(
          JSON.stringify({ error: 'Failed to create session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 清理过期会话
      await supabase
        .from('admin_sessions')
        .delete()
        .lt('expires_at', new Date().toISOString());

      return new Response(
        JSON.stringify({ 
          success: true, 
          token: sessionToken,
          expiresAt: expiresAt.toISOString(),
          totpEnabled: adminData.totp_enabled
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify action
    if (action === 'verify') {
      if (!token) {
        return new Response(
          JSON.stringify({ valid: false }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: session, error } = await supabase
        .from('admin_sessions')
        .select('*')
        .eq('session_token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !session) {
        return new Response(
          JSON.stringify({ valid: false }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 更新最后活动时间
      await supabase
        .from('admin_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('session_token', token);

      return new Response(
        JSON.stringify({ valid: true, username: session.username }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Change password action
    if (action === 'changePassword') {
      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 验证会话
      const { data: session } = await supabase
        .from('admin_sessions')
        .select('username')
        .eq('session_token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!session) {
        return new Response(
          JSON.stringify({ error: 'Invalid session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 验证旧密码
      const { data: passwordCheck } = await supabase.rpc('verify_password', {
        p_username: session.username,
        p_password: password
      });

      if (!passwordCheck) {
        return new Response(
          JSON.stringify({ error: 'Current password is incorrect' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 更新密码
      const { error: updateError } = await supabase.rpc('update_admin_password', {
        p_username: session.username,
        p_new_password: newPassword
      });

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to update password' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Setup TOTP action
    if (action === 'setupTotp') {
      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: session } = await supabase
        .from('admin_sessions')
        .select('username')
        .eq('session_token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!session) {
        return new Response(
          JSON.stringify({ error: 'Invalid session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 生成 TOTP 密钥
      const secret = new OTPAuth.Secret({ size: 20 });
      const totp = new OTPAuth.TOTP({
        issuer: 'Alo生态',
        label: session.username,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: secret,
      });

      const otpauthUrl = totp.toString();
      
      // 暂存密钥（未启用）
      await supabase
        .from('admin_accounts')
        .update({ totp_secret: secret.base32 })
        .eq('username', session.username);

      return new Response(
        JSON.stringify({ 
          success: true,
          secret: secret.base32,
          qrCodeUrl: otpauthUrl
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify and enable TOTP action
    if (action === 'enableTotp') {
      if (!token || !totpToken) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: session } = await supabase
        .from('admin_sessions')
        .select('username')
        .eq('session_token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!session) {
        return new Response(
          JSON.stringify({ error: 'Invalid session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 获取密钥
      const { data: adminData } = await supabase
        .from('admin_accounts')
        .select('totp_secret')
        .eq('username', session.username)
        .single();

      if (!adminData?.totp_secret) {
        return new Response(
          JSON.stringify({ error: 'TOTP not set up' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 验证令牌
      const totp = new OTPAuth.TOTP({
        secret: adminData.totp_secret,
        digits: 6,
        period: 30,
      });

      const isValid = totp.validate({ token: totpToken, window: 1 }) !== null;
      
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'Invalid TOTP token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 启用 TOTP
      await supabase
        .from('admin_accounts')
        .update({ totp_enabled: true })
        .eq('username', session.username);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Disable TOTP action
    if (action === 'disableTotp') {
      if (!token || !password) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: session } = await supabase
        .from('admin_sessions')
        .select('username')
        .eq('session_token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!session) {
        return new Response(
          JSON.stringify({ error: 'Invalid session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 验证密码
      const { data: passwordCheck } = await supabase.rpc('verify_password', {
        p_username: session.username,
        p_password: password
      });

      if (!passwordCheck) {
        return new Response(
          JSON.stringify({ error: 'Invalid password' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 禁用 TOTP
      await supabase
        .from('admin_accounts')
        .update({ totp_enabled: false, totp_secret: null })
        .eq('username', session.username);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Logout action
    if (action === 'logout') {
      if (token) {
        await supabase
          .from('admin_sessions')
          .delete()
          .eq('session_token', token);
      }

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
    console.error('Admin auth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});