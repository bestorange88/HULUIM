/**
 * 统一 AI 服务 Edge Function
 * 
 * 整合所有 AI 相关功能到单一端点，避免拖累实时消息性能
 * 支持：
 * - AI 对话
 * - 消息翻译
 * - 语音转文字
 * 
 * 使用方法：
 * const { data } = await supabase.functions.invoke('ai-service-unified', {
 *   body: { action: 'translate', params: { text: '你好', targetLang: 'en' } }
 * });
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AI Gateway 配置
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

/**
 * AI 对话处理
 */
async function handleAIChat(params: any) {
  const { message, conversationHistory = [] } = params;
  
  console.log('AI Chat request:', { messageLength: message?.length });
  
  try {
    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: '你是一个智能助手，帮助用户解答问题。请用简洁、友好的语气回复。'
          },
          ...conversationHistory,
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '抱歉，我暂时无法回答这个问题。';
    
    console.log('AI Chat response generated');
    
    return {
      success: true,
      response: aiResponse,
      model: 'gemini-2.5-flash',
    };
  } catch (error: any) {
    console.error('AI Chat error:', error);
    return {
      success: false,
      error: error.message,
      response: '抱歉，AI 服务暂时不可用，请稍后再试。',
    };
  }
}

/**
 * 消息翻译处理
 */
async function handleTranslate(params: any) {
  const { text, targetLang = 'en', sourceLang = 'auto' } = params;
  
  console.log('Translate request:', { textLength: text?.length, targetLang });
  
  try {
    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `你是一个专业翻译，将文本翻译成${targetLang === 'zh' ? '中文' : '英文'}。只返回翻译结果，不要添加任何解释。`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Translation error: ${response.statusText}`);
    }

    const data = await response.json();
    const translatedText = data.choices[0]?.message?.content || text;
    
    console.log('Translation completed');
    
    return {
      success: true,
      translatedText: translatedText.trim(),
      sourceLang,
      targetLang,
    };
  } catch (error: any) {
    console.error('Translation error:', error);
    return {
      success: false,
      error: error.message,
      translatedText: text, // 失败时返回原文
    };
  }
}

/**
 * 语音转文字处理
 */
async function handleTranscribe(params: any) {
  const { audioData, format = 'webm' } = params;
  
  console.log('Transcribe request:', { format, dataLength: audioData?.length });
  
  try {
    // 使用 Lovable AI Gateway 的多模态能力
    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '请转录这段音频的内容，只返回文字内容，不要添加任何解释。'
              },
              {
                type: 'audio',
                audio: audioData, // Base64 编码的音频
              }
            ]
          }
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`Transcription error: ${response.statusText}`);
    }

    const data = await response.json();
    const transcribedText = data.choices[0]?.message?.content || '';
    
    console.log('Transcription completed');
    
    return {
      success: true,
      text: transcribedText.trim(),
      format,
    };
  } catch (error: any) {
    console.error('Transcription error:', error);
    return {
      success: false,
      error: error.message,
      text: '[语音转文字失败]',
    };
  }
}

/**
 * 主处理函数
 */
serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();
    
    console.log('AI Service request:', { action, timestamp: new Date().toISOString() });

    let result;
    
    switch (action) {
      case 'chat':
        result = await handleAIChat(params);
        break;
        
      case 'translate':
        result = await handleTranslate(params);
        break;
        
      case 'transcribe':
        result = await handleTranscribe(params);
        break;
        
      default:
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Unknown action: ${action}. Supported actions: chat, translate, transcribe` 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    console.error('AI Service error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
