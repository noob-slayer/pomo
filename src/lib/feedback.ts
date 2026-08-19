import { supabase } from "./supabaseClient";

export async function submitFeedback(message: string, contact: string | null, identityKey: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("feedback").insert({ message, contact, identity_key: identityKey });
  if (error) {
    console.error("submitFeedback failed", error);
    return false;
  }
  return true;
}
