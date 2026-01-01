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
    const { adminToken, prefix, count, startNumber, password } = await req.json();
    
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

    // Validate input
    if (count > 100) {
      return new Response(
        JSON.stringify({ error: 'Maximum 100 accounts per batch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let created = 0;
    const errors: string[] = [];

    for (let i = 0; i < count; i++) {
      const num = startNumber + i;
      const username = `${prefix}${String(num).padStart(3, '0')}`;
      const email = `${username}@internal.test`;
      const displayName = `内部账户${num}`;

      try {
        // Create auth user
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: password || '123456',
          email_confirm: true,
          user_metadata: {
            username,
            display_name: displayName
          }
        });

        if (authError) {
          console.error(`Failed to create user ${username}:`, authError);
          errors.push(`${username}: ${authError.message}`);
          continue;
        }

        if (authUser?.user) {
          // Create profile with transaction password
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
              id: authUser.user.id,
              username,
              display_name: displayName,
              transaction_password_hash: password || '123456', // 设置交易密码与登录密码一致
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (profileError) {
            console.error(`Failed to create profile for ${username}:`, profileError);
            errors.push(`${username}: Profile creation failed`);
          } else {
            // Also create wallet for the user
            await supabaseAdmin
              .from('wallets')
              .upsert({
                user_id: authUser.user.id,
                balance: 0,
                frozen_balance: 0
              }, { onConflict: 'user_id' });
            
            created++;
          }
        }
      } catch (err: any) {
        console.error(`Error creating ${username}:`, err);
        errors.push(`${username}: ${err.message}`);
      }
    }

    console.log(`Batch registration complete: ${created}/${count} created`);

    return new Response(
      JSON.stringify({ 
        created, 
        total: count,
        errors: errors.length > 0 ? errors : undefined 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in admin-batch-register:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
