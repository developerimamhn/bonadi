/** Shared Steadfast helpers for the `steadfast` (admin) and `steadfast-webhook` edge functions. */
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const STEADFAST_API = "https://portal.packzy.com/api/v1";

/** Invoice sent to Steadfast for an order, and the way back from an invoice to our order id. */
export const invoiceFor = (orderId: number) => `BON-${orderId}`;
export const orderIdFromInvoice = (invoice: unknown) => {
  const m = /^BON-(\d+)$/.exec(String(invoice ?? ""));
  return m ? Number(m[1]) : null;
};

/** Service-role client: bypasses RLS, so only use it after the caller has been checked. */
export const adminDb = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const EARLY = ["pending", "confirmed", "sent_to_supplier"];
/**
 * Our order status after Steadfast reports `courier`. Returns null when the order should stay as it is.
 * delivered → delivered, cancelled → cancelled (parcel came back). partial_delivered and *_approval_pending are left
 * for the admin to decide. Any other live parcel status moves an early order to "shipped". A finished order is never reopened.
 */
export function orderStatusFor(courier: string | null | undefined, current: string): string | null {
  if (!courier || current === "delivered" || current === "cancelled") return null;
  if (courier === "delivered") return "delivered";
  if (courier === "cancelled") return "cancelled";
  if (courier.includes("approval_pending") || courier === "partial_delivered" || courier === "unknown") return null;
  return EARLY.includes(current) ? "shipped" : null;
}

/** Writes courier fields (and the mapped order status) onto an order. */
export async function applyCourierUpdate(
  db: SupabaseClient,
  order: { id: number; status: string },
  patch: { courier_status?: string | null; courier_message?: string | null; courier_updated_at?: string },
) {
  const update: Record<string, unknown> = { courier_updated_at: patch.courier_updated_at ?? new Date().toISOString() };
  if (patch.courier_status) update.courier_status = patch.courier_status;
  if (patch.courier_message) update.courier_message = patch.courier_message;
  const next = orderStatusFor(patch.courier_status, order.status);
  if (next && next !== order.status) update.status = next;
  const { error } = await db.from("orders").update(update).eq("id", order.id);
  if (error) throw error;
  return update;
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
