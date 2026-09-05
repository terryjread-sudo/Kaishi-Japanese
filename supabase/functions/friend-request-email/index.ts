import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const appUrl = Deno.env.get("KAISHI_APP_URL")!;
    const fromEmail = Deno.env.get("KAISHI_FROM_EMAIL")!;

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData } = await caller.auth.getUser();
    const sender = userData.user;
    if (!sender) throw new Error("Not signed in");

    const { request_id } = await request.json();
    const { data: friendRequest, error: requestError } = await admin
      .from("kaishi_friend_requests")
      .select("id,sender_id,recipient_id,status")
      .eq("id", request_id)
      .single();
    if (requestError || !friendRequest) throw new Error("Friend request not found");
    if (friendRequest.sender_id !== sender.id || friendRequest.status !== "pending") {
      throw new Error("Friend request cannot be emailed");
    }

    const { data: pref } = await admin
      .from("kaishi_notification_preferences")
      .select("friend_request_email")
      .eq("user_id", friendRequest.recipient_id)
      .maybeSingle();
    if (pref?.friend_request_email === false) {
      return Response.json({ sent: false, reason: "disabled" }, { headers: cors });
    }

    const { data: recipientData } = await admin.auth.admin.getUserById(friendRequest.recipient_id);
    const recipientEmail = recipientData.user?.email;
    if (!recipientEmail) return Response.json({ sent: false, reason: "no-email" }, { headers: cors });

    const { data: senderProfile } = await admin
      .from("leaderboard_entries")
      .select("display_name,github_login")
      .eq("user_id", sender.id)
      .maybeSingle();
    const senderName = senderProfile?.display_name || senderProfile?.github_login || "A Kaishi Japanese learner";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: `${senderName} sent you a Kaishi Japanese friend request`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
          <h2>Learn Japanese together</h2>
          <p><strong>${senderName}</strong> has sent you a friend request in Kaishi Japanese.</p>
          <p>Accept it to encourage each other, see recent activity and keep your learning streaks moving.</p>
          <p><a href="${appUrl}#community" style="display:inline-block;background:#2563eb;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Open Kaishi Japanese</a></p>
          <p style="color:#64748b;font-size:13px">Friend-request emails are enabled by default. You can turn them off in Kaishi Japanese Settings.</p>
        </div>`,
      }),
    });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
    return Response.json({ sent: true }, { headers: cors });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 400, headers: cors });
  }
});
