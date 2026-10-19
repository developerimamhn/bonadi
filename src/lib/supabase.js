/** Supabase client + small data helpers. Keys come from .env (the anon key is safe in the browser; RLS protects data). */
import { createClient } from "@supabase/supabase-js";

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
const supabaseUrl = env.VITE_SUPABASE_URL || (typeof process !== "undefined" ? process.env.VITE_SUPABASE_URL : "");
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || (typeof process !== "undefined" ? process.env.VITE_SUPABASE_ANON_KEY : "");

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Insert one public-form row (contact message, newsletter). Returns { error }. */
export const saveRow = (table, row) => supabase.from(table).insert(row);

/** Visible products only; uses the saved catalogue when Supabase is unavailable. */
export async function fetchProducts() {
  try {
    const { data, error } = await supabase.from("products")
      .select("id,name,name_bn,size,description,price,compare_at_price,tag,image_url,image_credit,status").neq("status", "hidden").order("sort_order");
    if (!error && Array.isArray(data)) return { data, isFallback: false };
  } catch { /* use the saved catalogue below */ }

  try {
    const response = await fetch("/products/fallback.json");
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) return { data, isFallback: true };
    }
  } catch { /* leave the existing session cache in place */ }

  return { data: null, isFallback: false };
}
