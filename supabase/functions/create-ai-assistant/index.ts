import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Check if AI assistant already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', 'ai_assistant')
      .maybeSingle()

    if (existingUser) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'AI助手账号已存在',
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

    // Create AI assistant user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'ai_assistant@system.local',
      password: randomPassword,
      email_confirm: true,
      user_metadata: {
        username: 'ai_assistant',
        display_name: 'AI助手'
      }
    })
    
    console.log('AI assistant account created. Store this password securely:', randomPassword)

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
        message: 'AI助手账号创建成功'
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
}
