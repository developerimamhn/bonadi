/** Referral tracking: ?ref=CODE is remembered for 30 days (last link wins) and attached to the order. Link visits are counted for the owner's stats. */
const KEY = "bonadi-ref", DAYS = 30;

export function captureRef() {
  const raw = new URLSearchParams(window.location.search).get("ref"); if (!raw) return;
  const code = raw.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20); if (!code) return;
  try { localStorage.setItem(KEY, JSON.stringify({ code, ts: Date.now() })); } catch { /* private mode */ }
  const k = "bonadi-ref-seen-" + code;
  if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, "1"); import("./supabase.js").then(({ supabase }) => supabase.rpc("track_ref", { p_code: code })).then(() => {}, () => {}); }
}
/** Active referral code (or null if none / older than 30 days) */
export function getRef() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && Date.now() - v.ts < DAYS * 864e5) return v.code; } catch { /* old format */ }
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return null;
}
