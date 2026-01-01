import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { token, searchQuery, limit = 200 } = await req.json();

    // Verify admin session
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from('admin_sessions')
      .select('username')
      .eq('session_token', token)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch messages with service role (bypasses RLS)
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (messagesError) {
      console.error('Messages fetch error:', messagesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch messages' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!messagesData || messagesData.length === 0) {
      return new Response(
        JSON.stringify({ data: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get sender and conversation info
    const senderIds = [...new Set(messagesData.map((msg) => msg.sender_id).filter(Boolean))];
    const conversationIds = [...new Set(messagesData.map((msg) => msg.conversation_id).filter(Boolean))];

    const [sendersRes, conversationsRes] = await Promise.all([
      senderIds.length > 0 
        ? supabase.from('profiles').select('id, username, display_name').in('id', senderIds)
        : { data: [] },
      conversationIds.length > 0
        ? supabase.from('conversations').select('id, name, type').in('id', conversationIds)
        : { data: [] },
    ]);

    const sendersMap = new Map((sendersRes.data || []).map((s) => [s.id, s]));
    const conversationsMap = new Map((conversationsRes.data || []).map((c) => [c.id, c]));

    const messagesWithDetails = messagesData.map((msg) => ({
      ...msg,
      sender: sendersMap.get(msg.sender_id) || null,
      conversation: conversationsMap.get(msg.conversation_id) || null,
    }));

    // Apply search filter if provided
    let filteredMessages = messagesWithDetails;
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredMessages = messagesWithDetails.filter(
        (msg) =>
          msg.content?.toLowerCase().includes(query) ||
          msg.sender?.username?.toLowerCase().includes(query) ||
          msg.sender?.display_name?.toLowerCase().includes(query)
      );
    }

    return new Response(
      JSON.stringify({ data: filteredMessages }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Admin messages list error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
