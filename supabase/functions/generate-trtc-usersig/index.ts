import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// TRTC credentials - MUST be set via environment variables
const SDKAPPID = parseInt(Deno.env.get("TRTC_SDKAPPID") || "", 10);
const SECRETKEY = Deno.env.get("TRTC_SECRETKEY") || "";
const EXPIRETIME = 604800; // 7 days in seconds

// Validate environment variables
if (!SDKAPPID || !SECRETKEY) {
  console.error("[generate-trtc-usersig] CRITICAL: TRTC_SDKAPPID or TRTC_SECRETKEY not configured!");
}

// Simple zlib deflate implementation for UserSig generation
function deflateSync(data: Uint8Array): Uint8Array {
  const output: number[] = [];
  
  // Add zlib header (CMF + FLG)
  output.push(0x78, 0x9c);
  
  // For small data, use stored blocks (no compression)
  const BLOCK_SIZE = 65535;
  let pos = 0;
  
  while (pos < data.length) {
    const remaining = data.length - pos;
    const blockSize = Math.min(remaining, BLOCK_SIZE);
    const isLast = pos + blockSize >= data.length;
    
    output.push(isLast ? 0x01 : 0x00);
    output.push(blockSize & 0xff);
    output.push((blockSize >> 8) & 0xff);
    output.push((~blockSize) & 0xff);
    output.push(((~blockSize) >> 8) & 0xff);
    
    for (let i = 0; i < blockSize; i++) {
      output.push(data[pos + i]);
    }
    
    pos += blockSize;
  }
  
  // Calculate Adler-32 checksum
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  const adler32 = (b << 16) | a;
  
  output.push((adler32 >> 24) & 0xff);
  output.push((adler32 >> 16) & 0xff);
  output.push((adler32 >> 8) & 0xff);
  output.push(adler32 & 0xff);
  
  return new Uint8Array(output);
}

function base64EncodeUrl(data: Uint8Array): string {
  return base64Encode(data)
    .replace(/\+/g, "*")
    .replace(/\//g, "-")
    .replace(/=/g, "_");
}

async function hmacSha256(key: string, data: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const dataData = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataData);
  return new Uint8Array(signature);
}

async function genUserSig(userID: string): Promise<string> {
  const currTime = Math.floor(Date.now() / 1000);
  
  const contentToSign = `TLS.identifier:${userID}
TLS.sdkappid:${SDKAPPID}
TLS.time:${currTime}
TLS.expire:${EXPIRETIME}
`;
  
  const sigBytes = await hmacSha256(SECRETKEY, contentToSign);
  const sig = base64Encode(sigBytes);
  
  const sigDoc = {
    "TLS.ver": "2.0",
    "TLS.identifier": userID,
    "TLS.sdkappid": SDKAPPID,
    "TLS.expire": EXPIRETIME,
    "TLS.time": currTime,
    "TLS.sig": sig,
  };
  
  const jsonStr = JSON.stringify(sigDoc);
  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(jsonStr);
  const compressed = deflateSync(jsonBytes);
  const userSig = base64EncodeUrl(compressed);
  
  return userSig;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate environment configuration
  if (!SDKAPPID || !SECRETKEY) {
    return new Response(JSON.stringify({
      success: false,
      error: "TRTC service not configured. Please contact administrator."
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: "Authorization required"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user's JWT token using Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("[generate-trtc-usersig] Auth error:", authError);
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid or expired token"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the authenticated user's ID as the TRTC userId
    // Normalize: remove hyphens to get 32-char hex string (Tencent limit)
    const trtcUserId = user.id.replace(/-/g, "");
    
    console.log("[generate-trtc-usersig] Generating UserSig for authenticated user:", trtcUserId);
    
    const userSig = await genUserSig(trtcUserId);
    
    return new Response(JSON.stringify({
      success: true,
      SDKAppID: SDKAPPID,
      userSig,
      expireTime: EXPIRETIME,
      userId: trtcUserId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[generate-trtc-usersig] Error:", error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Failed to generate UserSig"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
