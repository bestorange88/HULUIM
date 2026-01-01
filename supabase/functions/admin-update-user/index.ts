import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      adminToken, 
      userId, 
      displayName, 
      bio, 
      gender, 
      birthDate,
      loginPassword,
      transactionPassword 
    } = await req.json();
    
    if (!adminToken) {
      return new Response(
        JSON.stringify({ error: 'No admin token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
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

    const updates: string[] = [];

    // Update profile fields
    const profileUpdate: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (displayName !== undefined) {
      profileUpdate.display_name = displayName;
      updates.push('昵称');
    }
    if (bio !== undefined) {
      profileUpdate.bio = bio;
      updates.push('个性签名');
    }
    if (gender !== undefined) {
      profileUpdate.gender = gender || null;
      updates.push('性别');
    }
    if (birthDate !== undefined) {
      profileUpdate.birth_date = birthDate || null;
      updates.push('出生日期');
    }

    // Hash and update transaction password if provided
    if (transactionPassword) {
      profileUpdate.transaction_password_hash = await hashPassword(transactionPassword);
      updates.push('交易密码');
    }

    // Update profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId);

    if (profileError) {
      console.error('Profile update error:', profileError);
      return new Response(
        JSON.stringify({ error: '更新用户资料失败: ' + profileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update login password if provided (using Supabase Auth Admin API)
    if (loginPassword) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: loginPassword }
      );

      if (authError) {
        console.error('Auth password update error:', authError);
        return new Response(
          JSON.stringify({ 
            error: '更新登录密码失败: ' + authError.message,
            partialSuccess: updates.length > 0,
            updatedFields: updates
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      updates.push('登录密码');
    }

    // Log admin action
    try {
      await supabaseAdmin.rpc('log_admin_action', {
        p_admin_username: sessionData.username,
        p_action: 'update_user',
        p_resource_type: 'user',
        p_resource_id: userId,
        p_details: { 
          updated_fields: updates,
          has_login_password: !!loginPassword,
          has_transaction_password: !!transactionPassword
        }
      });
    } catch (logError) {
      console.error('Failed to log admin action:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `已更新: ${updates.join(', ')}`,
        updatedFields: updates
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in admin-update-user:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
