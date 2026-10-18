/** Supabase client + small data helpers. Keys come from .env (the anon key is safe in the browser; RLS protects data). */
import { createClient } from "@supabase/supabase-js";

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
const supabaseUrl = env.VITE_SUPABASE_URL || (typeof process !== "undefined" ? process.env.VITE_SUPABASE_URL : "");
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || (typeof process !== "undefined" ? process.env.VITE_SUPABASE_ANON_KEY : "");

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Insert one public-form row (contact message, newsletter). Returns { error }. */
export const saveRow = (table, row) => supabase.from(table).insert(row);

/** Visible products only; selects just the columns the storefront needs (faster). */
export async function fetchProducts() {
  const { data, error } = await supabase.from("products")
    .select("id,name,size,description,price,tag,image_url,image_credit,status").neq("status", "hidden").order("sort_order");
  return error ? null : data;
}
