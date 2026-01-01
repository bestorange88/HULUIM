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

    const { token, searchQuery } = await req.json();

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

    // Fetch moments with service role (bypasses RLS)
    const { data: momentsData, error: momentsError } = await supabase
      .from('moments')
      .select('*')
      .order('created_at', { ascending: false });

    if (momentsError) {
      console.error('Moments fetch error:', momentsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch moments' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!momentsData || momentsData.length === 0) {
      return new Response(
        JSON.stringify({ data: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique user IDs
    const userIds = [...new Set(momentsData.map(m => m.user_id).filter(Boolean))];

    // Fetch profiles for these users
    const { data: profilesData, error: profilesError } = userIds.length > 0
      ? await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', userIds)
      : { data: [], error: null };

    if (profilesError) {
      console.error('Profiles fetch error:', profilesError);
    }

    // Create a map for quick lookup
    const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

    // Combine moments with profiles
    const momentsWithProfiles = momentsData.map(moment => ({
      ...moment,
      profiles: profilesMap.get(moment.user_id) || null
    }));

    // Apply search filter if provided
    let filteredMoments = momentsWithProfiles;
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredMoments = momentsWithProfiles.filter(
        (moment) =>
          moment.content?.toLowerCase().includes(query) ||
          moment.profiles?.display_name?.toLowerCase().includes(query) ||
          moment.profiles?.username?.toLowerCase().includes(query)
      );
    }

    return new Response(
      JSON.stringify({ data: filteredMoments }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Admin moments list error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
