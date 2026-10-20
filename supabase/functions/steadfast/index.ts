/**
 * Admin-only Steadfast actions, called from the Admin panel (supabase.functions.invoke("steadfast")).
 *   { action: "create",  order_id } → books the parcel (Cash on Delivery = order total), saves consignment id + tracking code.
 *   { action: "refresh", order_id } → asks Steadfast for the latest status (useful if a webhook was missed).
 * Secrets: STEADFAST_API_KEY, STEADFAST_SECRET_KEY (Steadfast portal → API). Deploy normally (JWT verification ON).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { STEADFAST_API, adminDb, applyCourierUpdate, invoiceFor, json } from "../_shared/steadfast.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => json(body, status, CORS);
const fail = (message: string, status = 400) => reply({ ok: false, message }, status);

const keys = () => ({ "Api-Key": Deno.env.get("STEADFAST_API_KEY") ?? "", "Secret-Key": Deno.env.get("STEADFAST_SECRET_KEY") ?? "", "Content-Type": "application/json" });
/** Steadfast wants an 11-digit local number (01XXXXXXXXX). */
const localPhone = (p: string) => { const d = p.replace(/\D/g, ""); return d.startsWith("88") ? d.slice(2) : d; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("POST only", 405);
  if (!Deno.env.get("STEADFAST_API_KEY") || !Deno.env.get("STEADFAST_SECRET_KEY")) return fail("Steadfast API keys are not set on the server.", 500);

  // Only admins: check the caller's session, then their profile role.
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return fail("Please log in.", 401);
  const db = adminDb();
  const { data: me } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return fail("Admin access only.", 403);

  const { action, order_id } = await req.json().catch(() => ({}));
  const { data: order, error } = await db.from("orders").select("*").eq("id", Number(order_id)).single();
  if (error || !order) return fail("Order not found.", 404);

  if (action === "create") {
    if (order.consignment_id) return reply({ ok: true, message: "Already booked.", tracking_code: order.tracking_code });
    if (order.status === "cancelled") return fail("This order is cancelled.");
    const items = (order.items ?? []).map((i: { name: string; size?: string; qty: number }) => `${i.name} ${i.size ?? ""} x${i.qty}`).join(", ");
    const res = await fetch(`${STEADFAST_API}/create_order`, { method: "POST", headers: keys(), body: JSON.stringify({
      invoice: invoiceFor(order.id),
      recipient_name: String(order.name).slice(0, 100),
      recipient_phone: localPhone(String(order.phone)),
      recipient_address: String(order.address).slice(0, 250),
      cod_amount: Number(order.subtotal),
      item_description: items.slice(0, 250),
      note: `BONADI order #${order.id}`,
    }) });
    const j = await res.json().catch(() => ({}));
    const c = j?.consignment;
    if (j?.status !== 200 || !c?.consignment_id) {
      const why = j?.errors ? Object.values(j.errors).flat().join(" ") : j?.message;
      return fail(`Steadfast: ${why || `HTTP ${res.status}`}`, 502);
    }
    const { error: e1 } = await db.from("orders").update({ courier: "steadfast", consignment_id: c.consignment_id, tracking_code: c.tracking_code }).eq("id", order.id);
    if (e1) return fail(e1.message, 500);
    await applyCourierUpdate(db, order, { courier_status: c.status ?? "in_review", courier_message: "Parcel booked with Steadfast." });
    return reply({ ok: true, consignment_id: c.consignment_id, tracking_code: c.tracking_code });
  }

  if (action === "refresh") {
    if (!order.consignment_id) return fail("This order has not been sent to Steadfast yet.");
    const res = await fetch(`${STEADFAST_API}/status_by_cid/${order.consignment_id}`, { headers: keys() });
    const j = await res.json().catch(() => ({}));
    if (j?.status !== 200 || !j?.delivery_status) return fail(`Steadfast: ${j?.message || `HTTP ${res.status}`}`, 502);
    const update = await applyCourierUpdate(db, order, { courier_status: j.delivery_status });
    return reply({ ok: true, courier_status: j.delivery_status, status: update.status ?? order.status });
  }

  return fail("Unknown action.");
});
