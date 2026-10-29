import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dailyWordEmailContent, selectDailyWord, type DailyWord } from "../_shared/learner-email-personalization.ts";

type TemplateKey = "new_home" | "journey_waiting" | "learning_update" | "daily_word";

const templates: Record<Exclude<TemplateKey, "daily_word">, { subject: string; eyebrow: string; title: string; body: (name: string) => string; cta: string }> = {
  new_home: { subject: "Kaishi Japanese has a new home", eyebrow: "A note from Sensei", title: "Kaishi Japanese is now at a new address", body: (name) => `Hello ${name}, Kaishi Japanese now lives at <strong>www.kaishi.uk</strong>. Your account and learning progress are still here, ready whenever you are.`, cta: "Visit Kaishi Japanese" },
  journey_waiting: { subject: "Your Japanese journey is waiting", eyebrow: "A small nudge from Sensei", title: "A few Japanese words are waiting for you", body: (name) => `Hello ${name}, it has been a little while since you last visited. A short review is a lovely way to keep the words you have met feeling familiar.`, cta: "Continue my journey" },
  learning_update: { subject: "A learning update from Kaishi Japanese", eyebrow: "From Sensei", title: "Your next small step is ready", body: (name) => `Hello ${name}, your Kaishi Japanese journey is always ready to pick up where you left off. Even a few minutes of practice can make a real difference.`, cta: "Open my journey" },
};

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-kaishi-cron-secret" };
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));

function dailyWordHtml(word: DailyWord, logo: string, ctaUrl: string, unsubscribe: string): string {
  return `<div style="margin:0;padding:28px 14px;background:#f3f4f6;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="500" style="width:100%;max-width:500px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden"><tr><td style="padding:28px 20px;background:#1e3a2b;color:#fff;text-align:center"><img src="${escape(logo)}" width="54" height="36" alt="Kaishi Japanese" style="display:block;width:auto;height:36px;margin:0 auto 12px"><div style="letter-spacing:2px;text-transform:uppercase;font-size:11px;color:#d1d5db;font-weight:600">Japanese Word of the Day</div><div style="font-size:56px;font-weight:700;margin-top:8px;line-height:1">${escape(word.word)}</div></td></tr><tr><td style="padding:24px;background:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><div style="text-align:center;margin-bottom:24px"><div style="font-size:20px;font-weight:600;color:#111827">${escape(word.reading)} <span style="font-weight:400;color:#4b5563">(${escape(word.romaji)})</span></div><div style="font-size:16px;color:#4b5563;margin-top:4px">Meaning: <strong style="color:#111827">${escape(word.meaning)}</strong></div></div><div style="background:#f9fafb;border-left:4px solid #1e3a2b;padding:16px;border-radius:4px;margin-bottom:24px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:6px;font-weight:600">Example</div><div style="font-size:16px;font-weight:500;color:#111827;margin-bottom:4px">${escape(word.sentence)}</div><div style="font-size:14px;color:#4b5563">${escape(word.sentenceMeaning)}</div></div><div style="text-align:center"><a href="${escape(ctaUrl)}" style="display:inline-block;background:#2d6a4f;color:#fff;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px">Practise this word</a></div><p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.5;text-align:center">You are receiving this because you have a Kaishi Japanese account. <a href="${escape(unsubscribe)}" style="color:#176c52">Unsubscribe from learning emails</a> or manage your preferences in Settings.</p></td></tr></table></td></tr></table></div>`;
}

function validTemplate(value: unknown): value is TemplateKey {
  return value === "daily_word" || (typeof value === "string" && value in templates);
}

function londonParts() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts();
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function message(templateKey: TemplateKey, recipient: { id: string; name: string }, token: string, appUrl: string, unsubscribeBase: string, dailyWord?: DailyWord) {
  const daily = templateKey === "daily_word" ? dailyWordEmailContent(recipient.name, dailyWord || { id: "", word: "", reading: "", romaji: "", meaning: "", sentence: "", sentenceMeaning: "" }) : null;
  if (templateKey === "daily_word" && !dailyWord) throw new Error("The daily word is unavailable");
  const template = daily || templates[templateKey];
  const unsubscribe = `${unsubscribeBase.replace(/\/$/, "")}?unsubscribe=${encodeURIComponent(token)}`;
  const logo = `${appUrl.replace(/\/$/, "")}/media/branding/kaishi-japanese-mark.png`;
  const ctaUrl = dailyWord ? `${appUrl.replace(/\/?$/, "/")}?dailyWord=${encodeURIComponent(dailyWord.id)}` : appUrl;
  return {
    subject: template.subject,
    html: dailyWord ? dailyWordHtml(dailyWord, logo, ctaUrl, unsubscribe) : `<div style="margin:0;padding:28px 14px;background:#eef4f0;font-family:Georgia,'Hiragino Mincho ProN',serif;color:#173d32"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="560" style="max-width:560px;background:#fffdf7;border-radius:22px;overflow:hidden;border:1px solid #d7e5dc"><tr><td style="padding:28px 34px 18px;background:#173d32;color:#fff"><img src="${logo}" width="54" height="54" alt="Kaishi Japanese" style="display:block;margin-bottom:12px"><div style="font-size:12px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:#f7d676">${escape(template.eyebrow)}</div><h1 style="margin:8px 0 0;font-size:28px;line-height:1.15;color:#fff">${escape(template.title)}</h1></td></tr><tr><td style="padding:30px 34px;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#25352f"><p style="margin-top:0">${template.body(escape(recipient.name))}</p><p style="margin:26px 0"><a href="${escape(ctaUrl)}" style="display:inline-block;padding:13px 20px;border-radius:12px;background:#16835f;color:#fff;text-decoration:none;font-weight:bold">${escape(template.cta)}</a></p><p style="margin-bottom:0;color:#64736d;font-size:13px">You are receiving this because you have a Kaishi Japanese account. <a href="${unsubscribe}" style="color:#176c52">Unsubscribe from learning emails</a> or manage your preferences in Settings.</p></td></tr></table></td></tr></table></div>`,
    text: `${template.title}\n\n${daily ? template.body : template.body(recipient.name).replace(/<[^>]+>/g, "")}\n\n${ctaUrl}\n\nUnsubscribe: ${unsubscribe}`,
  };
}

async function dailyWordFor(appUrl: string): Promise<DailyWord | null> {
  const [vocabularyResponse, ankiResponse] = await Promise.all([
    fetch(new URL("data/vocabulary.json", appUrl)),
    fetch(new URL("data/anki-content-v72.json", appUrl)),
  ]);
  const vocabulary = await vocabularyResponse.json();
  const anki = await ankiResponse.json();
  const romajiByWord = new Map(Array.isArray(anki?.records)
    ? anki.records.filter((record: Record<string, unknown>) => typeof record?.word === "string" && typeof record?.romaji === "string").map((record: Record<string, string>) => [record.word, record.romaji])
    : []);
  const words = Array.isArray(vocabulary) ? vocabulary.map((word) => ({
    ...word,
    romaji: typeof word?.romaji === "string" ? word.romaji : romajiByWord.get(word?.word) || romajiByWord.get(word?.reading) || "",
  })).filter((word): word is DailyWord => typeof word?.id === "string" && typeof word?.word === "string" && typeof word?.reading === "string" && typeof word?.romaji === "string" && typeof word?.meaning === "string" && typeof word?.sentence === "string" && typeof word?.sentenceMeaning === "string") : [];
  const now = londonParts();
  return selectDailyWord(words, `${now.year}-${now.month}-${now.day}`);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY")!;
  const appUrl = Deno.env.get("KAISHI_APP_URL") || "https://www.kaishi.uk/";
  const from = Deno.env.get("KAISHI_FROM_EMAIL")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const unsubscribe = new URL(request.url).searchParams.get("unsubscribe");
    if (request.method === "GET" && unsubscribe) {
      const { data: token } = await admin.from("kaishi_email_unsubscribe_tokens").select("user_id").eq("token", unsubscribe).maybeSingle();
      if (!token) return new Response("This unsubscribe link is invalid or has expired.", { status: 404 });
      await admin.from("kaishi_notification_preferences").upsert({ user_id: token.user_id, learning_email: false, updated_at: new Date().toISOString() });
      await admin.from("kaishi_email_unsubscribe_tokens").update({ used_at: new Date().toISOString() }).eq("token", unsubscribe);
      return Response.redirect(`${appUrl.replace(/\/$/, "")}/?email=unsubscribed`, 302);
    }

    const cronSecret = request.headers.get("x-kaishi-cron-secret");
    const isCron = cronSecret && cronSecret === Deno.env.get("KAISHI_EMAIL_CRON_SECRET");
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");
    let senderId: string | null = null;
    if (!isCron) {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader) throw new Error("Authentication required");
      const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: auth } = await caller.auth.getUser();
      senderId = auth.user?.id || null;
      if (!senderId) throw new Error("Authentication required");
      const { data: owner } = await admin.from("app_admins").select("user_id").eq("user_id", senderId).maybeSingle();
      if (!owner) throw new Error("Owner access required");
    }

    if (action === "runReengagement") {
      if (!isCron) throw new Error("Cron authorization required");
      const now = londonParts();
      if (now.weekday !== "Fri" || now.hour !== "17") return Response.json({ skipped: "outside-schedule" }, { headers: cors });
      const week = `${now.year}-${now.month}-${now.day}`;
      const { data: claimed } = await admin.rpc("claim_kaishi_reengagement_run", { run_week: week });
      if (!claimed) return Response.json({ skipped: "disabled-or-already-run" }, { headers: cors });
      const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
      let page = 1, sent = 0, failures = 0;
      for (;;) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        const users = (data?.users || []).filter((user) => user.email && user.last_sign_in_at && user.last_sign_in_at <= cutoff);
        for (const user of users) {
          const { data: pref } = await admin.from("kaishi_notification_preferences").select("learning_email").eq("user_id", user.id).maybeSingle();
          if (pref?.learning_email === false) continue;
          const cooldown = new Date(Date.now() - 30 * 86400000).toISOString();
          const { data: recent } = await admin.from("kaishi_email_send_log").select("id").eq("recipient_id", user.id).eq("template_key", "journey_waiting").eq("status", "sent").gte("sent_at", cooldown).limit(1);
          if (recent?.length) continue;
          const result = await sendEmail(admin, resendKey, from, appUrl, `${supabaseUrl}/functions/v1/admin-email`, user.id, user.email!, user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.user_name || "learner", "journey_waiting", null, `reengagement:${week}`);
          if (result.sent) sent++; else if (!result.skipped) failures++;
        }
        if ((data?.users || []).length < 200) break;
        page++;
      }
      await admin.rpc("finish_kaishi_reengagement_run", { sent_count: sent, result: failures ? `Completed with ${failures} failed delivery attempt(s).` : "Completed successfully." });
      return Response.json({ sent, failures }, { headers: cors });
    }

    if (action === "history") {
      const { data } = await admin.from("kaishi_email_send_log").select("template_key,status,created_at,sent_at,error_message").eq("recipient_id", body.userId).order("created_at", { ascending: false }).limit(8);
      return Response.json({ history: data || [] }, { headers: cors });
    }

    if (!validTemplate(body.templateKey) || typeof body.userId !== "string") throw new Error("Choose a valid recipient and template");
    const { data: recipient } = await admin.auth.admin.getUserById(body.userId);
    const email = recipient.user?.email;
    if (!email) throw new Error("This user has no email address available for delivery");
    const { data: pref } = await admin.from("kaishi_notification_preferences").select("learning_email").eq("user_id", body.userId).maybeSingle();
    if (pref?.learning_email === false) throw new Error("This learner has opted out of Kaishi learning emails");
    const recipientName = recipient.user?.user_metadata?.full_name || recipient.user?.user_metadata?.name || recipient.user?.user_metadata?.user_name || "learner";
    const token = await unsubscribeToken(admin, body.userId);
    const dailyWord = body.templateKey === "daily_word" ? await dailyWordFor(appUrl) : undefined;
    if (action === "preview") return Response.json({ ...message(body.templateKey, { id: body.userId, name: recipientName }, token, appUrl, `${supabaseUrl}/functions/v1/admin-email`, dailyWord), recipient: { name: recipientName } }, { headers: cors });
    if (action !== "send") throw new Error("Unsupported action");
    const result = await sendEmail(admin, resendKey, from, appUrl, `${supabaseUrl}/functions/v1/admin-email`, body.userId, email, recipientName, body.templateKey, senderId, null, body.idempotencyKey, dailyWord);
    return Response.json(result, { headers: cors });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 400, headers: cors });
  }
});

async function unsubscribeToken(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: existing } = await admin.from("kaishi_email_unsubscribe_tokens").select("token").eq("user_id", userId).maybeSingle();
  if (existing?.token) return existing.token;
  const token = crypto.randomUUID();
  await admin.from("kaishi_email_unsubscribe_tokens").insert({ token, user_id: userId });
  return token;
}

async function sendEmail(admin: ReturnType<typeof createClient>, resendKey: string, from: string, appUrl: string, unsubscribeBase: string, recipientId: string, email: string, name: string, templateKey: TemplateKey, senderId: string | null, campaignKey: string | null, idempotencyKey?: string, dailyWord?: DailyWord | null) {
  const { data: log, error: claimError } = await admin.from("kaishi_email_send_log").insert({ recipient_id: recipientId, sent_by: senderId, template_key: templateKey, campaign_key: campaignKey, idempotency_key: idempotencyKey || null }).select("id").maybeSingle();
  if (claimError || !log) return { sent: false, skipped: true, reason: "already-claimed" };
  const token = await unsubscribeToken(admin, recipientId);
  const rendered = message(templateKey, { id: recipientId, name }, token, appUrl, unsubscribeBase, dailyWord || undefined);
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [email], ...rendered }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    await admin.from("kaishi_email_send_log").update({ status: "failed", error_message: `Resend ${response.status}` }).eq("id", log.id);
    return { sent: false, skipped: false, error: "Delivery failed" };
  }
  await admin.from("kaishi_email_send_log").update({ status: "sent", resend_message_id: payload.id || null, sent_at: new Date().toISOString() }).eq("id", log.id);
  return { sent: true };
}
