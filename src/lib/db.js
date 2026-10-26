/**
 * Light data layer for the first screen. Products come over plain REST (no SDK needed), and the Supabase SDK
 * (~58 KB gzip) is downloaded only when something needs it (login, reviews, orders…) — after the page is visible.
 */
const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
const URL = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;

let sdk;
/** The full Supabase client, loaded once on first use. */
export const db = () => (sdk ||= import("./supabase.js").then((m) => m.supabase));

/** Insert one public-form row (contact message, newsletter). Returns { error }. */
export const saveRow = async (table, row) => (await db()).from(table).insert(row);

/** Visible products only; uses the saved catalogue when Supabase is unavailable. */
export async function fetchProducts() {
  try {
    const q = "select=id,name,name_bn,size,description,price,compare_at_price,tag,image_url,image_credit,status&status=neq.hidden&order=sort_order";
    const res = await fetch(`${URL}/rest/v1/products?${q}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (res.ok) { const data = await res.json(); if (Array.isArray(data)) return { data, isFallback: false }; }
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
