/** Supabase client. Keys come from .env (the anon key is safe in the browser; RLS protects data).
 *  The storefront loads this lazily through db() in ./db.js, so the SDK is not on the first-paint path. */
import { createClient } from "@supabase/supabase-js";

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
const supabaseUrl = env.VITE_SUPABASE_URL || (typeof process !== "undefined" ? process.env.VITE_SUPABASE_URL : "");
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || (typeof process !== "undefined" ? process.env.VITE_SUPABASE_ANON_KEY : "");

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
