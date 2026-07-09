import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://hlytkepmrvuanenyruex.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_hRBXx6j9JMuLs6mdOTKbaQ_gcv2UDs0";

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});
