import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UNIVERSAL_CODE = "911522"; // Universal test code for development

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { phone, code, newPassword } = await req.json();

    if (!phone || !code || !newPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'missing_required_fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

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
        .eq('purpose', 'reset_password')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (codeError || !codeData) {
        console.error('SMS code verification failed:', codeError);
        return new Response(
          JSON.stringify({ success: false, error: 'invalid_code' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      // Mark code as used
      await supabase
        .from('sms_verification_codes')
        .update({ is_valid: false, used_at: new Date().toISOString() })
        .eq('id', codeData.id);
    }

    // Find user by phone
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('User not found:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'user_not_found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Update user password
    const email = `${phone}@phone.local`;
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Failed to update password:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'failed_to_update_password' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Password reset successfully for user:', profile.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Password reset successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Reset password error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});