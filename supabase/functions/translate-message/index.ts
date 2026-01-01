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
    const { text, targetLanguage, sourceLanguage, autoDetect } = await req.json();
    
    // Validate input text
    if (!text || typeof text !== 'string') {
      throw new Error('Text is required and must be a string');
    }
    
    if (text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }
    
    if (text.length > 5000) {
      throw new Error('Text is too long (max 5000 characters)');
    }

    // Validate targetLanguage if provided
    if (targetLanguage && typeof targetLanguage !== 'string') {
      throw new Error('Target language must be a string');
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log('Translating text:', text);
    console.log('Target language:', targetLanguage);
    console.log('Source language:', sourceLanguage);
    console.log('Auto detect:', autoDetect);

    let systemPrompt: string;
    
    if (autoDetect) {
      // Auto-detect language and translate to the opposite
      // If Chinese → English, If English/other → Chinese
      systemPrompt = `You are a professional translator. 
Detect the language of the input text:
- If the text is primarily in Chinese (Simplified or Traditional), translate it to English.
- If the text is primarily in English or any other non-Chinese language, translate it to Simplified Chinese.

Only return the translated text, nothing else. Do not include any explanation or original text.`;
    } else if (sourceLanguage) {
      systemPrompt = `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Only return the translated text, nothing else.`;
    } else {
      systemPrompt = `You are a professional translator. Translate the following text to ${targetLanguage}. Only return the translated text, nothing else.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Translation service error");
    }

    const data = await response.json();
    const translatedText = data.choices[0]?.message?.content?.trim();

    if (!translatedText) {
      throw new Error("No translation result");
    }

    console.log('Translation result:', translatedText);

    return new Response(
      JSON.stringify({ translatedText }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Translation failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
