import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...data } = await req.json();

    if (action === "create") {
      const { username, display_name, password, avatar_url, is_active, sort_order } = data;

      // Check if username already exists in customer_service_accounts
      const { data: existing } = await supabase
        .from("customer_service_accounts")
        .select("id")
        .eq("username", username)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({ success: false, error: "用户名已存在" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create auth user with email (using username as fake email for customer service)
      const fakeEmail = `${username}@cs.internal`;
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: fakeEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          username: username,
          display_name: display_name,
          is_customer_service: true,
        },
      });

      if (authError) {
        console.error("Auth error:", authError);
        return new Response(
          JSON.stringify({ success: false, error: authError.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update profile to mark as customer service
      await supabase
        .from("profiles")
        .update({
          username: username,
          display_name: display_name,
          avatar_url: avatar_url || null,
          is_customer_service: true,
        })
        .eq("id", authUser.user.id);

      // Create customer service account record
      const { data: csAccount, error: csError } = await supabase
        .from("customer_service_accounts")
        .insert({
          user_id: authUser.user.id,
          username: username,
          display_name: display_name,
          avatar_url: avatar_url || null,
          is_active: is_active ?? true,
          sort_order: sort_order ?? 0,
        })
        .select()
        .single();

      if (csError) {
        console.error("CS account error:", csError);
        // Cleanup auth user if CS account creation fails
        await supabase.auth.admin.deleteUser(authUser.user.id);
        return new Response(
          JSON.stringify({ success: false, error: csError.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, account: csAccount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      const { id, display_name, password, avatar_url, is_active } = data;

      // Get the customer service account
      const { data: csAccount, error: fetchError } = await supabase
        .from("customer_service_accounts")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !csAccount) {
        return new Response(
          JSON.stringify({ success: false, error: "客服账号不存在" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update auth user password if provided
      if (password && csAccount.user_id) {
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          csAccount.user_id,
          { password: password }
        );

        if (passwordError) {
          console.error("Password update error:", passwordError);
          return new Response(
            JSON.stringify({ success: false, error: passwordError.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Update profile
      if (csAccount.user_id) {
        await supabase
          .from("profiles")
          .update({
            display_name: display_name ?? csAccount.display_name,
            avatar_url: avatar_url ?? csAccount.avatar_url,
          })
          .eq("id", csAccount.user_id);
      }

      // Update customer service account
      const { error: updateError } = await supabase
        .from("customer_service_accounts")
        .update({
          display_name: display_name ?? csAccount.display_name,
          avatar_url: avatar_url ?? csAccount.avatar_url,
          is_active: is_active ?? csAccount.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      const { id } = data;

      // Get the customer service account
      const { data: csAccount, error: fetchError } = await supabase
        .from("customer_service_accounts")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !csAccount) {
        return new Response(
          JSON.stringify({ success: false, error: "客服账号不存在" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete customer service account first
      const { error: deleteError } = await supabase
        .from("customer_service_accounts")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("Delete CS account error:", deleteError);
        return new Response(
          JSON.stringify({ success: false, error: deleteError.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete auth user (will cascade to profile due to trigger)
      if (csAccount.user_id) {
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(csAccount.user_id);
        if (authDeleteError) {
          console.error("Delete auth user error:", authDeleteError);
          // Don't fail the whole operation if auth user deletion fails
          // The CS account is already deleted
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "无效的操作" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
