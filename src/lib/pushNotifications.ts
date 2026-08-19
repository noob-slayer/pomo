import { supabase } from "./supabaseClient";

// pairs with VAPID_PRIVATE_KEY, set as a Vercel env var for api/send-streak-reminders.ts
// -- the public half of a VAPID keypair is meant to be embedded in client code (same
// design as a TLS certificate's public half); only the private key needs protecting.
const VAPID_PUBLIC_KEY = "BOKdU5GLtzpk4kaB3BoWc7dm2zLR_P0Y8sbYTX3UubKN7HNdEZa2VNo9CbG8HY8bmWYy895fM4CVadxJWJE_ISI";

export const PUSH_SUPPORTED =
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  typeof window !== "undefined" &&
  "PushManager" in window &&
  typeof Notification !== "undefined";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!PUSH_SUPPORTED) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (err) {
    console.error("service worker registration failed", err);
    return null;
  }
}

export async function getPushSubscriptionStatus(): Promise<boolean> {
  const registration = await getRegistration();
  if (!registration) return false;
  const sub = await registration.pushManager.getSubscription();
  return !!sub;
}

// requests notification permission (a real user gesture, e.g. a button click, must be on
// the call stack -- browsers refuse a bare unprompted permission request), subscribes via
// the service worker's PushManager, and persists the subscription so the daily cron job
// (api/send-streak-reminders.ts) can reach this browser later, even closed
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const registration = await getRegistration();
  if (!registration) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    // browser-permission grant doesn't guarantee subscribe() succeeds -- e.g. the OS-level
    // notification permission being separately denied, or a push service being briefly
    // unreachable -- catch it here so the caller gets a clean `false` to show an error for,
    // rather than an unhandled rejection out of a button's onClick handler
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    } catch (err) {
      console.error("pushManager.subscribe failed", err);
      return false;
    }
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
      { onConflict: "endpoint" },
    );
  if (error) {
    console.error("subscribeToPush: saving subscription failed", error);
    return false;
  }
  return true;
}

export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const registration = await getRegistration();
  if (!registration) return true; // no service worker -- nothing was ever subscribed
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
  if (error) console.error("unsubscribeFromPush: removing subscription failed", error);
  return true;
}
