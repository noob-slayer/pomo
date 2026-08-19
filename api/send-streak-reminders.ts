// Vercel serverless function, triggered daily by the cron entry in vercel.json. Finds
// every subscribed user whose focus-session streak is still alive but at risk (they
// focused yesterday, nothing yet today) and sends them a real push notification, even
// with the app/tab fully closed.
//
// Runs at a single fixed UTC time (see vercel.json) -- "today"/"yesterday" here are UTC
// calendar days, not each user's own local day. That's a real, disclosed limitation: a
// user far from UTC may get nudged at an odd local hour, or the day boundary may not
// perfectly match their own. Fixing that properly would need a stored per-user timezone,
// which nothing in this app collects today.
//
// Requires three Vercel environment variables that do NOT already exist in this project
// (see the PR description / SOP for exactly how to set them):
//   SUPABASE_SERVICE_ROLE_KEY -- bypasses RLS entirely, needed to read every user's
//     history and every subscription, not just one signed-in caller's own row
//   VAPID_PRIVATE_KEY -- pairs with the public key hardcoded in
//     src/lib/pushNotifications.ts (public halves of VAPID keys are meant to be
//     embedded in client code; only the private half is secret)
//   CRON_SECRET -- any random string; Vercel Cron sends it back as
//     `Authorization: Bearer <value>`, checked below so this endpoint can't be triggered
//     by anyone who simply finds its URL
//
// VITE_SUPABASE_URL is reused as-is -- Vercel env vars are available to serverless
// functions regardless of the VITE_ prefix, which only controls client-bundle exposure.

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
// Vercel's Node.js runtime (Node 20, matching this project's own CI) has no native
// global WebSocket -- @supabase/supabase-js's createClient() throws synchronously without
// one (it eagerly constructs a Realtime client even though this function never uses
// realtime features), confirmed by actually invoking createClient() locally on Node 20.
// The `ws` package plugged in as the transport is supabase-js's own documented fix.
import WebSocket from "ws";

interface VercelLikeRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}
interface VercelLikeResponse {
  status(code: number): VercelLikeResponse;
  json(body: unknown): void;
}

const VAPID_PUBLIC_KEY = "BOKdU5GLtzpk4kaB3BoWc7dm2zLR_P0Y8sbYTX3UubKN7HNdEZa2VNo9CbG8HY8bmWYy895fM4CVadxJWJE_ISI";
const LOOKBACK_DAYS = 60;
const DAY_MS = 86400000;

function utcDayKey(iso: string): string {
  return iso.slice(0, 10); // "YYYY-MM-DD" in UTC, straight from the ISO timestamp
}

// consecutive-UTC-days streak ending yesterday, given a set of "YYYY-MM-DD" keys a user
// has at least one focus session on -- mirrors computeStreaks' logic (lib/statsExtras.ts)
// but over UTC days instead of the caller's local timezone, since this runs server-side
// with no per-user timezone on file
function streakEndingYesterday(dayKeys: Set<string>, todayUtcMs: number): number {
  if (dayKeys.has(new Date(todayUtcMs).toISOString().slice(0, 10))) return 0; // already active today -- not at risk
  let streak = 0;
  let cursor = todayUtcMs - DAY_MS;
  while (dayKeys.has(new Date(cursor).toISOString().slice(0, 10))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!supabaseUrl || !serviceRoleKey || !vapidPrivateKey) {
    res.status(500).json({ error: "missing required environment variables" });
    return;
  }

  // this runs unattended once a day with nobody watching -- a genuine network/runtime
  // error partway through (rather than a clean {error} result, which every call below
  // already handles explicitly) should still produce a normal JSON response for Vercel's
  // own cron logs, not an unhandled crash
  try {
    await run(res, supabaseUrl, serviceRoleKey, vapidPrivateKey);
  } catch (err) {
    res.status(500).json({ error: "unexpected failure", details: err instanceof Error ? err.message : String(err) });
  }
}

async function run(res: VercelLikeResponse, supabaseUrl: string, serviceRoleKey: string, vapidPrivateKey: string) {
  // ws's type signature doesn't line up exactly with the browser WebSocket constructor
  // shape realtime-js's types expect (this function never actually opens a realtime
  // connection, so the mismatch is cosmetic) -- same cast supabase-js's own docs use for
  // this exact fix
  const supabase = createClient(supabaseUrl, serviceRoleKey, { realtime: { transport: WebSocket as any } });
  webpush.setVapidDetails("https://pomo.site", VAPID_PUBLIC_KEY, vapidPrivateKey);

  const { data: subscriptions, error: subError } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");
  if (subError) {
    res.status(500).json({ error: "failed to load subscriptions", details: subError.message });
    return;
  }
  if (!subscriptions || subscriptions.length === 0) {
    res.status(200).json({ sent: 0, cleaned: 0, note: "no subscriptions" });
    return;
  }

  const userIds = [...new Set(subscriptions.map((s) => s.user_id as string))];
  const since = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS).toISOString();
  const { data: history, error: historyError } = await supabase
    .from("pomo_history")
    .select("user_id, completed_at")
    .in("user_id", userIds)
    .eq("phase", "focus")
    .gte("completed_at", since);
  if (historyError) {
    res.status(500).json({ error: "failed to load history", details: historyError.message });
    return;
  }

  const dayKeysByUser = new Map<string, Set<string>>();
  for (const row of history ?? []) {
    const uid = row.user_id as string;
    const set = dayKeysByUser.get(uid) ?? new Set<string>();
    set.add(utcDayKey(row.completed_at as string));
    dayKeysByUser.set(uid, set);
  }

  const todayUtcMs = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const streakByUser = new Map<string, number>();
  for (const uid of userIds) {
    const streak = streakEndingYesterday(dayKeysByUser.get(uid) ?? new Set(), todayUtcMs);
    if (streak > 0) streakByUser.set(uid, streak);
  }

  let sent = 0;
  const staleSubscriptionIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      const streak = streakByUser.get(sub.user_id as string);
      if (!streak) return; // not at risk -- already logged today, or no active streak at all

      const payload = JSON.stringify({
        title: "pomo",
        body: `your ${streak}-day streak ends today — do a session before midnight to keep it going`,
      });
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
          payload,
        );
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 404/410 = the push service itself says this subscription no longer exists
        // (uninstalled, permission revoked, etc) -- clean it up rather than retrying it
        // forever on every future run
        if (statusCode === 404 || statusCode === 410) staleSubscriptionIds.push(sub.id as string);
        else console.error("push send failed", sub.id, err);
      }
    }),
  );

  if (staleSubscriptionIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", staleSubscriptionIds);
  }

  res.status(200).json({ sent, cleaned: staleSubscriptionIds.length, atRiskUsers: streakByUser.size });
}
