import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioBase64, targetLanguage } = await req.json();
    
    if (!audioBase64) {
      throw new Error('No audio data provided');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Starting audio transcription with Gemini...');
    console.log('Audio base64 length:', audioBase64.length);

    // Use Google Gemini via Lovable AI Gateway for audio transcription
    // Format audio as data URL for multimodal input
    const audioDataUrl = `data:audio/webm;base64,${audioBase64}`;
    
    const transcribeResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                text: targetLanguage === 'Chinese' 
                  ? '请将这段音频准确地转录成中文文字。只返回转录的文字内容，不要添加任何解释。如果音频中是其他语言，请翻译成中文。'
                  : '请将这段音频准确地转录成文字。只返回转录的文字内容，不要添加任何解释。保持原始语言。'
              },
              {
                type: 'image_url',
                image_url: {
                  url: audioDataUrl
                }
              }
            ]
          }
        ],
      }),
    });

    console.log('Gemini response status:', transcribeResponse.status);

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error('Gemini transcription error:', transcribeResponse.status, errorText);
      
      // Check for rate limit
      if (transcribeResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'rate_limited',
            message: '请求过于频繁，请稍后再试'
          }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      if (transcribeResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'payment_required',
            message: '服务额度不足，请联系管理员'
          }),
          {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      throw new Error(`Transcription failed: ${errorText}`);
    }

    const result = await transcribeResponse.json();
    console.log('Gemini response:', JSON.stringify(result).substring(0, 500));
    
    const text = result.choices?.[0]?.message?.content || '';
    
    if (!text) {
      throw new Error('No transcription result returned');
    }
    
    console.log('Transcription successful, text:', text.substring(0, 100));

    return new Response(
      JSON.stringify({ 
        text,
        originalText: text 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in transcribe-audio:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
