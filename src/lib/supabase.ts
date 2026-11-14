
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Supabase URL অথবা Publishable Key পাওয়া যায়নি। .env ফাইল চেক করো।"
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from("pan_arot_settings")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Supabase Connection Error:", error);
    return false;
  }

  console.log("Supabase Connection Successful:", data);
  return true;
}