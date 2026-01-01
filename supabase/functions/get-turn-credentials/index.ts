import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Metered TURN servers with correct domain and credentials
const iceServers = [
  // Metered TURN servers - using shanhai.metered.live domain
  {
    urls: 'turn:shanhai.metered.live:80',
    username: 'b99f4f52f9b48d9b779775d1',
    credential: 'gUkpKuAIM09KZsu1'
  },
  {
    urls: 'turn:shanhai.metered.live:80?transport=tcp',
    username: 'b99f4f52f9b48d9b779775d1',
    credential: 'gUkpKuAIM09KZsu1'
  },
  {
    urls: 'turn:shanhai.metered.live:443',
    username: 'b99f4f52f9b48d9b779775d1',
    credential: 'gUkpKuAIM09KZsu1'
  },
  {
    urls: 'turn:shanhai.metered.live:443?transport=tcp',
    username: 'b99f4f52f9b48d9b779775d1',
    credential: 'gUkpKuAIM09KZsu1'
  },
  {
    urls: 'turns:shanhai.metered.live:443?transport=tcp',
    username: 'b99f4f52f9b48d9b779775d1',
    credential: 'gUkpKuAIM09KZsu1'
  }
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[get-turn-credentials] Returning Metered TURN credentials for shanhai.metered.live');

    return new Response(JSON.stringify({
      success: true,
      iceServers,
      source: 'metered-shanhai'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[get-turn-credentials] Error:', error);
    
    return new Response(JSON.stringify({
      success: true,
      iceServers,
      source: 'metered-shanhai'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
