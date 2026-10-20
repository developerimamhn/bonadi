/** Admin panel: orders, products (incl. supplier/cost for dropshipping), users, commission rates, messages. Protected by RLS, not just UI. */
import React, { useEffect, useState, useCallback } from "react";
import { supabase as db } from "./lib/supabase.js";

const ORDER_ST = ["pending", "confirmed", "sent_to_supplier", "shipped", "delivered", "cancelled"];
const COMM_ST = ["pending", "payable", "paid", "void"];
const Sel = ({ v, opts, on }) => <select className="field !w-auto !py-1 !text-sm" value={v} onChange={(e) => on(e.target.value)}>{opts.map((o) => <option key={o}>{o}</option>)}</select>;
/** Shows the database error instead of failing silently (e.g. when a rule blocks the change). Returns true on success. */
const ok = (res) => { if (res?.error) { alert("Not saved: " + res.error.message); return false; } return true; };
const Th = ({ c }) => <tr className="text-xs uppercase text-muted">{c.map((h) => <th key={h} className="pb-2 pr-3">{h}</th>)}</tr>;

function Orders() {
  const [rows, setRows] = useState([]);
  const load = useCallback(() => db.from("orders").select("*").order("id", { ascending: false }).limit(200).then(({ data }) => setRows(data || [])), []);
  useEffect(() => { load(); }, [load]);
  const upd = async (id, patch) => { ok(await db.from("orders").update(patch).eq("id", id)); load(); };
  const [busy, setBusy] = useState(null);
  /** Books the parcel with Steadfast (or refreshes its status) through the admin-only `steadfast` edge function. */
  const courier = async (o, action) => {
    if (action === "create" && !confirm(`Send order #${o.id} to Steadfast?\nCash on Delivery: ৳${o.subtotal}\n${o.name}, ${o.phone}\n${o.address}`)) return;
    setBusy(o.id);
    const { data, error } = await db.functions.invoke("steadfast", { body: { action, order_id: o.id } });
    setBusy(null);
    const msg = data?.message || (error && (await error.context?.json?.().catch(() => null))?.message) || error?.message;
    if (error || data?.ok === false) alert("Steadfast: " + (msg || "failed")); else if (action === "create") alert(`Booked ✓ Tracking code: ${data.tracking_code}`);
    load();
  };
  return <div className="card overflow-x-auto p-4"><table className="w-full text-left text-sm"><thead><Th c={["Order", "Customer", "Items", "Status", "Courier", "Commission"]} /></thead><tbody>
    {rows.map((o) => <tr key={o.id} className="border-t border-gold/20 align-top">
      <td className="py-2 pr-3">#{o.id}<br />{new Date(o.created_at).toLocaleDateString()}</td>
      <td className="pr-3">{o.name}<br />{o.phone}<br />{o.address}</td>
      <td className="pr-3">{o.items.map((i) => `${i.name} ${i.size || ""} ×${i.qty}`).join(", ")}<br /><b>৳{o.subtotal}</b> {o.is_dropship && "· dropship"}</td>
      <td className="pr-3"><Sel v={o.status} opts={ORDER_ST} on={(v) => upd(o.id, { status: v })} /></td>
      <td className="min-w-40 pr-3">{o.tracking_code ? <>
          <a className="font-semibold text-gold underline" href={`https://steadfast.com.bd/t/${o.tracking_code}`} target="_blank" rel="noreferrer">{o.tracking_code}</a>
          <br /><span className="text-xs text-muted">{o.courier_status || "—"}{o.courier_message ? ` · ${o.courier_message}` : ""}</span>
          <br /><button className="text-xs underline" disabled={busy === o.id} onClick={() => courier(o, "refresh")}>{busy === o.id ? "…" : "Refresh"}</button></>
        : o.status !== "cancelled" && o.status !== "delivered"
          ? <button className="btn !px-3 !py-1 text-xs" disabled={busy === o.id} onClick={() => courier(o, "create")}>{busy === o.id ? "Sending…" : "Send to Steadfast"}</button> : "—"}</td>
      <td>{o.beneficiary_id ? <>৳{o.commission_amount} ({o.commission_rate}%)<br /><Sel v={o.commission_status} opts={COMM_ST} on={(v) => upd(o.id, { commission_status: v })} /></> : "—"}</td></tr>)}
  </tbody></table></div>;
}

function Products() {
  const [rows, setRows] = useState([]);
  const load = useCallback(async () => {
    const [{ data: p }, { data: s }] = await Promise.all([db.from("products").select("*").order("sort_order"), db.from("product_private").select("*")]);
    setRows((p || []).map((x) => ({ ...x, ...(s || []).find((y) => y.product_id === x.id) })));
  }, []);
  useEffect(() => { load(); }, [load]);
  const set = (id, k, v) => setRows((r) => r.map((x) => (x.id === id ? { ...x, [k]: v } : x)));
  const save = async (x) => {
    const num = (v) => (v === "" || v == null ? null : +v);
    if (!ok(await db.from("products").update({ name: x.name, name_bn: x.name_bn || null, size: x.size, tag: x.tag || null, description: x.description || null, price: +x.price,
      compare_at_price: num(x.compare_at_price), sort_order: num(x.sort_order) ?? 99, status: x.status, image_url: x.image_url }).eq("id", x.id))) return;
    if (!ok(await db.from("product_private").upsert({ product_id: x.id, cost_price: num(x.cost_price), supplier_name: x.supplier_name, supplier_url: x.supplier_url }))) return;
    alert("Saved");
  };
  const add = async () => { ok(await db.from("products").insert({ name: "New product", price: 100, status: "hidden", sort_order: 99 })); load(); };
  const del = async (x) => { if (confirm(`Delete ${x.name}?`)) { ok(await db.from("products").delete().eq("id", x.id)); load(); } };
  const I = (x, k, ph, cls = "") => <input className={`field !py-1.5 !text-sm ${cls}`} placeholder={ph} value={x[k] ?? ""} onChange={(e) => set(x.id, k, e.target.value)} />;
  return <div className="space-y-4"><button className="btn" onClick={add}>+ Add product</button>
    {rows.map((x) => <div key={x.id} className="card grid gap-2 p-4 md:grid-cols-4">
      {I(x, "name", "Name (English)", "md:col-span-2")}{I(x, "name_bn", "নাম (বাংলা)", "md:col-span-2")}
      {I(x, "size", "Size")}{I(x, "price", "Price ৳")}{I(x, "compare_at_price", "Old price ৳ (optional)")}{I(x, "sort_order", "Sort order")}
      {I(x, "description", "Description", "md:col-span-4")}
      {I(x, "image_url", "Image URL (/products/… or https://…)", "md:col-span-2")}{I(x, "tag", "Tag")}
      <Sel v={x.status} opts={["active", "coming_soon", "hidden"]} on={(v) => set(x.id, "status", v)} />
      {I(x, "cost_price", "Cost ৳ (private)")}{I(x, "supplier_name", "Supplier")}{I(x, "supplier_url", "Supplier link", "md:col-span-2")}
      <p className="self-center text-sm text-muted">Profit: ৳{x.cost_price ? x.price - x.cost_price : "—"}</p>
      <div className="flex gap-2 md:col-span-2"><button className="btn !py-1.5 text-sm" onClick={() => save(x)}>Save</button><button className="btn btn-ghost !py-1.5 text-sm" onClick={() => del(x)}>Delete</button></div>
    </div>)}</div>;
}

function Users() {
  const [rows, setRows] = useState([]);
  const load = useCallback(() => db.from("profiles").select("*").order("created_at", { ascending: false }).then(({ data }) => setRows(data || [])), []);
  useEffect(() => { load(); }, [load]);
  const upd = async (id, status) => { ok(await db.from("profiles").update({ status }).eq("id", id)); load(); };
  return <div className="card overflow-x-auto p-4"><table className="w-full text-left text-sm"><thead><Th c={["Name", "Phone", "Role", "Payout", "Ref", "Status"]} /></thead><tbody>
    {rows.map((u) => <tr key={u.id} className="border-t border-gold/20"><td className="py-2 pr-3">{u.full_name}</td><td className="pr-3">{u.phone}</td><td className="pr-3">{u.role}</td>
      <td className="pr-3">{u.payout_method} {u.payout_number}</td><td className="pr-3">{u.ref_code}</td><td><Sel v={u.status} opts={["pending", "approved", "rejected"]} on={(v) => upd(u.id, v)} /></td></tr>)}
  </tbody></table></div>;
}

function Payouts() {
  const [rows, setRows] = useState([]);
  const load = useCallback(() => db.from("affiliate_summary").select("*").order("payable", { ascending: false }).then(({ data }) => setRows(data || [])), []);
  useEffect(() => { load(); }, [load]);
  const pay = async (u) => { if (!confirm(`Mark ৳${u.payable} as PAID to ${u.full_name || "this user"} (${u.payout_method || "?"} ${u.payout_number || ""})? Send the money first.`)) return; ok(await db.from("orders").update({ commission_status: "paid" }).eq("beneficiary_id", u.id).eq("commission_status", "payable")); load(); };
  return <div className="card overflow-x-auto p-4"><p className="mb-3 text-sm text-muted">Send the “Payable” amount by bKash/Nagad/bank first, then press “Mark paid”. Payable = commission on delivered orders.</p>
    {rows.length === 0 ? <p>No commissions yet.</p> : <table className="w-full text-left text-sm"><thead><Th c={["Name", "Type", "Pay to", "Orders", "Pending", "Payable", "Paid", ""]} /></thead><tbody>
      {rows.map((u) => <tr key={u.id} className="border-t border-gold/20"><td className="py-2 pr-3">{u.full_name}<br /><span className="text-xs text-muted">{u.phone}</span></td><td className="pr-3">{u.role}</td><td className="pr-3">{u.payout_method} {u.payout_number || <b className="text-red-500">missing</b>}</td>
        <td className="pr-3">{u.orders}</td><td className="pr-3">৳{u.pending}</td><td className="pr-3 font-bold text-gold">৳{u.payable}</td><td className="pr-3">৳{u.paid}</td><td>{u.payable > 0 && <button className="btn !py-1 text-xs" onClick={() => pay(u)}>Mark paid</button>}</td></tr>)}</tbody></table>}</div>;
}

function Reviews() {
  const [rows, setRows] = useState([]);
  const load = useCallback(() => db.from("reviews").select("*").order("id", { ascending: false }).then(({ data }) => setRows(data || [])), []);
  useEffect(() => { load(); }, [load]);
  const set = async (id, status) => { ok(await db.from("reviews").update({ status }).eq("id", id)); load(); };
  const del = async (id) => { if (confirm("Delete this review?")) { ok(await db.from("reviews").delete().eq("id", id)); load(); } };
  return <div className="space-y-3">{rows.length === 0 && <p className="card p-4">No reviews yet. Customers can review after an order is delivered (Track page).</p>}
    {rows.map((r) => <div key={r.id} className="card flex flex-wrap items-start justify-between gap-3 p-4"><div className="text-sm"><p><b>{"★".repeat(r.rating)}</b> {r.name} · order #{r.order_id} · {r.product_name}</p>{r.comment && <p className="mt-1">{r.comment}</p>}</div>
      <div className="flex items-center gap-2"><Sel v={r.status} opts={["pending", "approved", "hidden"]} on={(v) => set(r.id, v)} /><button className="btn btn-ghost !py-1 text-xs" onClick={() => del(r.id)}>Delete</button></div></div>)}</div>;
}

function Settings() {
  const [s, setS] = useState({ affiliate_rate: 10, dropship_rate: 7 }), [m, setM] = useState("");
  useEffect(() => { db.from("settings").select("*").then(({ data }) => data && setS(Object.fromEntries(data.map((r) => [r.key, r.value])))); }, []);
  const save = async () => { for (const k of ["affiliate_rate", "dropship_rate"]) if (!ok(await db.from("settings").update({ value: +s[k] }).eq("key", k))) return setM(""); setM("Saved ✓ (applies to new orders)"); };
  return <div className="card max-w-md space-y-3 p-6">
    {[["affiliate_rate", "Referral commission %"], ["dropship_rate", "Dropshipper commission %"]].map(([k, l]) => <label key={k} className="block text-sm">{l}
      <input className="field mt-1" type="number" min="0" max="100" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></label>)}
    <button className="btn" onClick={save}>Save rates</button><p className="text-sm text-gold">{m}</p></div>;
}

function Messages() {
  const [msgs, setMsgs] = useState([]), [subs, setSubs] = useState([]);
  useEffect(() => { db.from("contact_messages").select("*").order("id", { ascending: false }).then(({ data }) => setMsgs(data || [])); db.from("newsletter_subscribers").select("email").then(({ data }) => setSubs(data || [])); }, []);
  return <div className="grid gap-4 md:grid-cols-2">
    <div className="card p-4"><h3 className="mb-2 font-bold">Messages ({msgs.length})</h3>{msgs.map((m) => <p key={m.id} className="border-t border-gold/20 py-2 text-sm"><b>{m.name}</b> · {m.email}<br />{m.message}</p>)}</div>
    <div className="card p-4"><h3 className="mb-2 font-bold">Subscribers ({subs.length})</h3>{subs.map((s) => <p key={s.email} className="text-sm">{s.email}</p>)}</div></div>;
}

export default function Admin({ profile }) {
  const [tab, setTab] = useState("Orders");
  if (profile?.role !== "admin") return <p className="px-5 pt-40 text-center">Admin access only.</p>;
  const T = { Orders, Products, Users, Payouts, Reviews, Settings, Messages }[tab];
  return (<>
    <div className="page-head pb-12 pt-36 text-center text-white"><h1 className="text-4xl font-bold">Admin Panel</h1></div>
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex flex-wrap gap-2">{["Orders", "Products", "Users", "Payouts", "Reviews", "Settings", "Messages"].map((t) => <button key={t} onClick={() => setTab(t)} className={`btn !py-2 text-sm ${tab === t ? "" : "btn-ghost"}`}>{t}</button>)}</div>
      <T />
    </div></>);
}
