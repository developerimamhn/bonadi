/** Shared order helpers — used by BOTH the normal cart drawer and the 3D store, so there is one order system (place_order RPC). */
import { supabase } from "./supabase.js";
import { getRef } from "./ref.js";

export const validOrder = (f) =>
  f.name.trim().length >= 2 && /^(\+?88)?01[3-9]\d{8}$/.test(f.phone.replace(/[\s-]/g, "")) && f.address.trim().length >= 8;

/** Places a Cash-on-Delivery order and triggers the server-side order email notification if the edge function exists. */
export const submitOrder = async (f, cart, dropship = false) => {
  const { data, error } = await supabase.rpc("place_order", {
    p_name: f.name,
    p_phone: f.phone,
    p_address: f.address,
    p_items: cart.map(({ id, qty }) => ({ id, qty })),
    p_ref: getRef(),
    p_dropship: dropship,
  });

  if (error) return { data: null, error };

  try {
    if (supabase?.functions?.invoke) {
      const payload = {
        order_id: data,
        customer: {
          name: f.name.trim(),
          phone: f.phone.trim(),
          address: f.address.trim(),
        },
        items: cart.map(({ id, name, qty, size, price }) => ({ id, name, qty, size, price })),
        dropship,
      };
      const mail = await supabase.functions.invoke("send-order-email", { body: payload });
      if (mail?.error) console.warn("Order email notification failed", mail.error);
    }
  } catch (e) {
    console.warn("Order email notification failed", e);
  }

  return { data, error: null };
};
