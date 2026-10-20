/**
 * Steadfast → BONADI webhook. Steadfast POSTs here whenever a parcel changes; we verify the X-Signature
 * (HMAC-SHA256 of the raw body, keyed with STEADFAST_WEBHOOK_TOKEN), skip retries we already handled
 * (Idempotency-Key), and copy the courier status onto the matching order so the Track page shows it.
 *
 * Deploy with JWT verification OFF (Steadfast sends its own bearer token, not a Supabase one):
 *   supabase functions deploy steadfast-webhook --no-verify-jwt
 * Answers: 2xx = handled, 401 = bad signature (not retried), 5xx = our problem (Steadfast retries after 30 s and 2 min).
 */
import { adminDb, applyCourierUpdate, json, orderIdFromInvoice } from "../_shared/steadfast.ts";

const TOKEN = Deno.env.get("STEADFAST_WEBHOOK_TOKEN") ?? "";
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmacHex(key: string, body: Uint8Array) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, body));
}
/** Constant-time string compare, so the signature check does not leak timing. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
/** Steadfast sends "2025-03-02 12:45:30" in Bangladesh time. */
const toIso = (s: unknown) => {
  const d = typeof s === "string" && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(s) ? new Date(s.replace(" ", "T") + "+06:00") : new Date();
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ status: "error", message: "POST only" }, 405);
  if (!TOKEN) return json({ status: "error", message: "STEADFAST_WEBHOOK_TOKEN is not set" }, 500);

  const raw = new Uint8Array(await req.arrayBuffer());
  const given = (req.headers.get("x-signature") ?? "").trim().toLowerCase();
  if (!safeEqual(given, await hmacHex(TOKEN, raw))) return json({ status: "error", message: "invalid signature" }, 401);

  let ev: Record<string, unknown>;
  try { ev = JSON.parse(new TextDecoder().decode(raw)); } catch { return json({ status: "error", message: "invalid JSON" }, 400); }

  const db = adminDb();
  const key = req.headers.get("idempotency-key") || hex(await crypto.subtle.digest("SHA-256", raw));
  const cid = Number(ev.consignment_id) || null;
  const { error: seen } = await db.from("steadfast_events").insert({
    idempotency_key: key, notification_type: String(ev.notification_type ?? ""), consignment_id: cid, invoice: ev.invoice ?? null, payload: ev,
  });
  if (seen?.code === "23505") return json({ status: "success", message: "already handled" });
  if (seen) return json({ status: "error", message: seen.message }, 500);

  try {
    // Find the order: consignment id first (set when we booked the parcel), then our BON-<id> invoice.
    let q = db.from("orders").select("id,status,courier_updated_at");
    const byInvoice = orderIdFromInvoice(ev.invoice);
    q = cid ? q.or(`consignment_id.eq.${cid}${byInvoice ? `,id.eq.${byInvoice}` : ""}`) : byInvoice ? q.eq("id", byInvoice) : q.eq("id", -1);
    const { data: orders, error } = await q.limit(1);
    if (error) throw error;
    const order = orders?.[0];
    if (!order) return json({ status: "success", message: "no matching order" });   // parcel not booked from this site

    const at = toIso(ev.updated_at);
    // Retries can arrive late: never let an older event overwrite a newer one.
    if (order.courier_updated_at && new Date(order.courier_updated_at) > new Date(at)) return json({ status: "success", message: "older event ignored" });

    const message = (ev.tracking_message ?? ev.message ?? null) as string | null;
    const status = ev.notification_type === "delivery_status" ? String(ev.status ?? "") || null : null;
    if (status || message) {
      const patch: Record<string, unknown> = { courier_status: status, courier_message: message, courier_updated_at: at };
      if (cid) await db.from("orders").update({ consignment_id: cid, courier: "steadfast" }).eq("id", order.id).is("consignment_id", null);
      await applyCourierUpdate(db, order, patch as never);
    }
    return json({ status: "success" });
  } catch (e) {
    // Forget the event so Steadfast's retry is processed instead of being skipped as a duplicate.
    await db.from("steadfast_events").delete().eq("idempotency_key", key);
    return json({ status: "error", message: String((e as Error)?.message ?? e) }, 500);
  }
});
