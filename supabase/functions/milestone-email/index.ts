import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ProgramKey = "milestone_first_lesson" | "milestone_ten_mastered" | "milestone_chapter_complete" | "milestone_streak";
type MilestoneEvent = { programKey: ProgramKey; eventKey: string; cycle: number; chapter?: number; title?: string; days?: number };

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
const validPrograms = new Set<ProgramKey>(["milestone_first_lesson", "milestone_ten_mastered", "milestone_chapter_complete", "milestone_streak"]);

function validEvent(value: unknown): value is MilestoneEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return validPrograms.has(event.programKey as ProgramKey) && typeof event.eventKey === "string" && /^[a-z0-9-]{1,80}$/.test(event.eventKey) && Number.isInteger(event.cycle) && Number(event.cycle) >= 0 && Number(event.cycle) < 100000;
}

function content(event: MilestoneEvent) {
  if (event.programKey === "milestone_first_lesson") return { templateKey: "milestone_first_lesson", subject: "Your first Kaishi lesson is complete", eyebrow: "A first step with Sensei", title: "Your Japanese journey has begun", body: "You completed your first lesson. That first step matters — your next words are ready whenever you are." };
  if (event.programKey === "milestone_ten_mastered") return { templateKey: "milestone_ten_mastered", subject: "10 Japanese words are yours", eyebrow: "A milestone with Sensei", title: "10 words mastered", body: "Ten Japanese words are now part of your growing knowledge. Keep returning to them, one small practice at a time." };
  if (event.programKey === "milestone_chapter_complete") return { templateKey: "milestone_chapter_complete", subject: "A Kaishi chapter is complete", eyebrow: "A chapter with Sensei", title: `${event.title || `Lesson ${event.chapter || ""}`} is complete`, body: "You completed another chapter of your journey. Take a moment to enjoy how far your Japanese has already come." };
  return { templateKey: "milestone_streak", subject: "Your Kaishi rhythm is growing", eyebrow: "A rhythm milestone", title: `${event.days || ""}-day learning rhythm`, body: "Your steady practice is building a meaningful Japanese rhythm. Thank you for showing up for your learning." };
}

function message(name: string, event: MilestoneEvent, token: string, appUrl: string, unsubscribeBase: string) {
  const template = content(event), unsubscribe = `${unsubscribeBase}?unsubscribe=${encodeURIComponent(token)}`, logo = `${appUrl.replace(/\/$/, "")}/media/branding/kaishi-japanese-mark.png`;
  return { subject: template.subject, html: `<div style="margin:0;padding:28px 14px;background:#eef4f0;font-family:Georgia,serif;color:#173d32"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="560" style="max-width:560px;background:#fffdf7;border-radius:22px;overflow:hidden;border:1px solid #d7e5dc"><tr><td style="padding:28px 34px 18px;background:#173d32;color:#fff"><img src="${logo}" width="54" height="54" alt="Kaishi Japanese" style="display:block;margin-bottom:12px"><div style="font:700 12px Arial,sans-serif;letter-spacing:1.4px;text-transform:uppercase;color:#f7d676">${template.eyebrow}</div><h1 style="margin:8px 0 0;font-size:28px;line-height:1.15;color:#fff">${escape(template.title)}</h1></td></tr><tr><td style="padding:30px 34px;font:16px/1.6 Arial,sans-serif;color:#25352f"><p style="margin-top:0">Hello ${escape(name)}, ${template.body}</p><p style="margin:26px 0"><a href="${appUrl}" style="display:inline-block;padding:13px 20px;border-radius:12px;background:#16835f;color:#fff;text-decoration:none;font-weight:bold">Continue my journey</a></p><p style="margin-bottom:0;color:#64736d;font-size:13px">You are receiving this because you have a Kaishi Japanese account. <a href="${unsubscribe}" style="color:#176c52">Unsubscribe from learning emails</a> or manage your preferences in Settings.</p></td></tr></table></td></tr></table></div>` };
}

async function tokenFor(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: existing } = await admin.from("kaishi_email_unsubscribe_tokens").select("token").eq("user_id", userId).maybeSingle();
  if (existing?.token) return existing.token;
  const token = crypto.randomUUID();
  await admin.from("kaishi_email_unsubscribe_tokens").insert({ token, user_id: userId });
  return token;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!, anonKey = Deno.env.get("SUPABASE_ANON_KEY")!, serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) throw new Error("Authentication required");
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: auth } = await caller.auth.getUser();
    if (!auth.user?.id || !auth.user.email) throw new Error("Authentication required");
    const events = ((await request.json()).events || []).filter(validEvent).slice(0, 40) as MilestoneEvent[];
    if (!events.length) return Response.json({ sent: 0, skipped: 0 }, { headers: cors });
    const admin = createClient(supabaseUrl, serviceKey), appUrl = Deno.env.get("KAISHI_APP_URL") || "https://www.kaishi.uk/", from = Deno.env.get("KAISHI_FROM_EMAIL")!, resendKey = Deno.env.get("RESEND_API_KEY")!;
    const { data: preference } = await admin.from("kaishi_notification_preferences").select("learning_email,progress_celebrations").eq("user_id", auth.user.id).maybeSingle();
    if (preference?.learning_email === false || preference?.progress_celebrations === false) return Response.json({ sent: 0, skipped: events.length }, { headers: cors });
    const { data: enabled } = await admin.from("kaishi_email_automation_programs").select("program_key").eq("enabled", true).in("program_key", [...validPrograms]);
    const enabledPrograms = new Set((enabled || []).map(row => row.program_key));
    let sent = 0, skipped = 0;
    for (const event of events) {
      if (!enabledPrograms.has(event.programKey)) { skipped++; continue; }
      const campaignKey = `milestone:${event.cycle}:${event.eventKey}`, template = content(event);
      const { data: log, error } = await admin.from("kaishi_email_send_log").insert({ recipient_id: auth.user.id, template_key: template.templateKey, campaign_key: campaignKey }).select("id").maybeSingle();
      if (error || !log) { skipped++; continue; }
      const token = await tokenFor(admin, auth.user.id), rendered = message(auth.user.user_metadata?.full_name || auth.user.user_metadata?.name || auth.user.user_metadata?.user_name || "learner", event, token, appUrl, `${supabaseUrl}/functions/v1/admin-email`);
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [auth.user.email], ...rendered }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) await admin.from("kaishi_email_send_log").update({ status: "failed", error_message: `Resend ${response.status}` }).eq("id", log.id);
      else { await admin.from("kaishi_email_send_log").update({ status: "sent", resend_message_id: payload.id || null, sent_at: new Date().toISOString() }).eq("id", log.id); sent++; }
    }
    return Response.json({ sent, skipped }, { headers: cors });
  } catch (error) { return Response.json({ error: String(error?.message || error) }, { status: 400, headers: cors }); }
});
