import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '未授权访问' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create authenticated client to verify user
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '身份验证失败' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { conversationId } = await req.json();
    
    if (!conversationId) {
      throw new Error('对话ID为空');
    }

    // Verify user is a participant in the conversation
    const { data: participant } = await supabaseClient
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!participant) {
      return new Response(
        JSON.stringify({ error: '无权访问此对话' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get AI assistant user
    const { data: aiAssistant } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', 'ai_assistant')
      .single();

    if (!aiAssistant) {
      throw new Error('AI助手账号不存在');
    }

    // Fetch conversation history (last 10 messages)
    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('content, sender_id, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10);

    // Format messages for AI
    const chatMessages = (messages || []).map(msg => ({
      role: msg.sender_id === aiAssistant.id ? 'assistant' : 'user',
      content: msg.content
    }));

    // Use HuggingFace Inference API with Qwen model
    const HF_TOKEN = Deno.env.get('HF_TOKEN') || 'hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen2.5-72B-Instruct',
        messages: [
          {
            role: 'system',
            content: '你是一个友好、乐于助人的AI助手。请用简洁、专业的方式回答用户的问题。'
          },
          ...chatMessages
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HuggingFace API error:', response.status, errorText);
      throw new Error('AI服务暂时不可用');
    }

    const result = await response.json();
    const aiReply = result.choices[0].message.content;

    // Save AI response to messages
    const { error: insertError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: aiAssistant.id,
        content: aiReply,
        type: 'text'
      });

    if (insertError) {
      console.error('Error saving AI message:', insertError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: aiReply
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in ai-chat:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
