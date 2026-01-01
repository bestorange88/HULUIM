import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  // Allow CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Check if customer service already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', 'customer_service')
      .maybeSingle()

    if (existingUser) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: '客服账号已存在',
          user_id: existingUser.id 
        }),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          } 
        }
      )
    }

    // Generate a strong random password
    const passwordBytes = new Uint8Array(32);
    crypto.getRandomValues(passwordBytes);
    const randomPassword = Array.from(passwordBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Create customer service user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'customer_service@system.local',
      password: randomPassword,
      email_confirm: true,
      user_metadata: {
        username: 'customer_service',
        display_name: '官方客服'
      }
    })
    
    console.log('Customer service account created. Store this password securely:', randomPassword)

    if (authError) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: authError.message }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: authData.user.id,
        message: '客服账号创建成功'
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )
  }
})
