import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '未授权' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get current user from auth header
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: '获取用户信息失败' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find AI assistant account
    const { data: aiAssistant, error: aiError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', 'ai_assistant')
      .maybeSingle()

    if (aiError || !aiAssistant) {
      return new Response(
        JSON.stringify({ error: 'AI助手账号不存在，请先创建AI助手账号' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create bidirectional friendship using upsert to handle duplicates
    const { error: error1 } = await supabaseAdmin
      .from('friendships')
      .upsert({
        user_id: user.id,
        friend_id: aiAssistant.id,
        status: 'accepted'
      }, {
        onConflict: 'user_id,friend_id',
        ignoreDuplicates: true
      })

    const { error: error2 } = await supabaseAdmin
      .from('friendships')
      .upsert({
        user_id: aiAssistant.id,
        friend_id: user.id,
        status: 'accepted'
      }, {
        onConflict: 'user_id,friend_id',
        ignoreDuplicates: true
      })

    if (error1 || error2) {
      console.error('Error creating friendships:', error1, error2)
      return new Response(
        JSON.stringify({ error: '添加好友失败' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: '已成功添加AI助手为好友'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
