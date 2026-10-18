/** Account dashboard: referral link + stats (affiliate), payout info, commissions, own orders, password, one-time admin unlock. */
import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js";

const money = (n) => "৳" + Number(n || 0).toLocaleString();
export default function Account({ user, profile, reload }) {
  const [rows, setRows] = useState([]), [orders, setOrders] = useState([]), [stats, setStats] = useState(null), [rates, setRates] = useState({});
  const [f, setF] = useState({ name: "", phone: "", method: "bkash", number: "" }), [msg, setMsg] = useState("");
  const [custom, setCustom] = useState(""), [codeMsg, setCodeMsg] = useState(""), [copied, setCopied] = useState(false);
  const [pw, setPw] = useState(""), [pwMsg, setPwMsg] = useState(""), [code, setCode] = useState(""), [adminMsg, setAdminMsg] = useState("");
  const recovery = sessionStorage.getItem("bonadi-recovery") === "1";

  useEffect(() => { if (profile) setF({ name: profile.full_name || "", phone: profile.phone || "", method: profile.payout_method || "bkash", number: profile.payout_number || "" }); }, [profile]);
  useEffect(() => {
    if (!user) return;
    supabase.rpc("my_commissions").then(({ data }) => setRows(data || []));
    supabase.rpc("my_ref_stats").then(({ data }) => setStats(data?.[0] || null));
    supabase.from("settings").select("*").then(({ data }) => data && setRates(Object.fromEntries(data.map((r) => [r.key, r.value]))));
    supabase.from("orders").select("id,created_at,subtotal,status,items").eq("user_id", user.id).order("id", { ascending: false }).then(({ data }) => setOrders(data || []));
  }, [user, profile?.ref_code]);
  if (!user) return <p className="px-5 pt-40 text-center">Please <a className="text-gold underline" href="#/login">log in</a>.</p>;

  const link = `${window.location.origin}/?ref=${profile?.ref_code || ""}`, text = "Pure Gawa Ghee from BONADI — Pure Food, Honest Promise. Order here:";
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { window.prompt("Copy your link:", link); } };
  const save = async (e) => { e.preventDefault(); await supabase.rpc("update_my_profile", { p_name: f.name, p_phone: f.phone, p_method: f.method, p_number: f.number }); setMsg("Saved ✓"); reload(); };
  const saveCode = async (e) => { e.preventDefault(); const { error } = await supabase.rpc("set_my_ref_code", { p_code: custom }); setCodeMsg(error ? error.message : "Code updated ✓ (old links stop working)"); if (!error) { setCustom(""); reload(); } };
  const changePw = async (e) => { e.preventDefault(); if (pw.length < 6) return setPwMsg("Use at least 6 characters."); const { error } = await supabase.auth.updateUser({ password: pw }); setPwMsg(error ? error.message : "Password updated ✓"); if (!error) { setPw(""); sessionStorage.removeItem("bonadi-recovery"); } };
  const claim = async (e) => { e.preventDefault(); const { data, error } = await supabase.rpc("claim_admin", { p_code: code }); if (data) { setAdminMsg("You are now an admin ✓ — open the Admin link in the menu."); reload(); } else setAdminMsg(error ? error.message : "That code is not valid or was already used."); };
  const Stat = ({ l, v, gold }) => <div className="rounded-2xl bg-bg/60 p-3 text-center"><p className={`font-display text-xl font-bold ${gold ? "text-gold" : ""}`}>{v}</p><p className="text-xs text-muted">{l}</p></div>;

  return (<>
    <div className="bg-brand pb-10 pt-32 text-center text-white"><h1 className="text-4xl font-bold">My Account</h1><p className="mt-2 text-white/70">{user.email}</p></div>
    <div className="mx-auto grid max-w-5xl gap-6 px-5 py-12 md:grid-cols-2">
      <div className="card space-y-3 p-6 md:col-span-2">
        <h2 className="font-display text-xl font-bold">Your referral link</h2>
        <p className="text-sm text-muted">Share it. When someone orders through your link and the order is delivered, you earn <b className="text-gold">{rates.affiliate_rate ?? 10}%</b> of the order value.{profile?.role === "dropshipper" && profile.status === "approved" && <> As an approved dropshipper you earn <b className="text-gold">{rates.dropship_rate ?? 7}%</b> on orders you place for your customers.</>}</p>
        <div className="flex flex-wrap gap-2"><input readOnly className="field min-w-0 flex-1" value={link} onFocus={(e) => e.target.select()} aria-label="Referral link" /><button className="btn" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button></div>
        <div className="flex flex-wrap gap-2 text-sm">
          <a className="btn btn-ghost !py-2" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text + " " + link)}`}>WhatsApp</a>
          <a className="btn btn-ghost !py-2" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`}>Facebook</a>
          {navigator.share && <button className="btn btn-ghost !py-2" onClick={() => navigator.share({ title: "BONADI", text, url: link }).catch(() => {})}>Share…</button>}
        </div>
        <form onSubmit={saveCode} className="flex flex-wrap items-center gap-2 pt-1"><input className="field !w-56" placeholder="Choose a short code, e.g. imam" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Custom referral code" /><button className="btn btn-ghost !py-2 text-sm">Change code</button><span className="text-sm text-gold">{codeMsg}</span></form>
        {profile?.role === "dropshipper" && <p className={`rounded-xl p-3 text-sm ${profile.status === "approved" ? "bg-gold/20" : "bg-red-500/10"}`}>Dropshipper account: <b>{profile.status}</b>{profile.status === "pending" && " — waiting for admin approval."}</p>}
        <div className="grid grid-cols-3 gap-2 pt-2 md:grid-cols-6"><Stat l="Link visits" v={stats?.clicks ?? 0} /><Stat l="Orders" v={stats?.orders ?? 0} /><Stat l="Delivered" v={stats?.delivered ?? 0} />
          <Stat l="Pending" v={money(stats?.pending_amount)} /><Stat l="Payable now" v={money(stats?.payable_amount)} gold /><Stat l="Paid" v={money(stats?.paid_amount)} /></div>
        <p className="text-xs text-muted">Commission becomes “payable” after the order is delivered and is paid to your bKash/Nagad number below. Cancelled orders earn nothing. Referral links are remembered for 30 days.</p>
      </div>

      <form onSubmit={save} className="card space-y-3 p-6"><h2 className="font-display text-xl font-bold">Profile & payout</h2>
        <input className="field" placeholder="Full name" value={f.name} onChange={set("name")} /><input className="field" placeholder="Phone" value={f.phone} onChange={set("phone")} />
        <div className="flex gap-2"><select className="field !w-32" value={f.method} onChange={set("method")}><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="bank">Bank</option></select><input className="field" placeholder="Payout number" value={f.number} onChange={set("number")} /></div>
        <div className="flex items-center gap-3"><button className="btn">Save</button><span className="text-sm text-gold">{msg}</span></div></form>

      <form onSubmit={changePw} className={`card space-y-3 p-6 ${recovery ? "ring-2 ring-gold" : ""}`}><h2 className="font-display text-xl font-bold">{recovery ? "Set your new password" : "Change password"}</h2>
        <input className="field" type="password" autoComplete="new-password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} /><div className="flex items-center gap-3"><button className="btn">Update</button><span className="text-sm text-gold">{pwMsg}</span></div></form>

      <div className="card p-6 md:col-span-2"><h2 className="mb-3 font-display text-xl font-bold">Commission history</h2>
        {rows.length === 0 ? <p className="text-muted">No commissions yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-xs uppercase text-muted"><th className="pb-2">Order</th><th>Order value</th><th>Rate</th><th>You earn</th><th>Order</th><th>Commission</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.order_id} className="border-t border-gold/20"><td className="py-2">#{r.order_id}</td><td>{money(r.subtotal)}</td><td>{r.rate}%</td><td className="font-bold">{money(r.amount)}</td><td>{r.order_status}</td><td>{r.commission_status}</td></tr>)}</tbody></table></div>}</div>

      <div className="card p-6 md:col-span-2"><h2 className="mb-3 font-display text-xl font-bold">My orders</h2>
        {orders.length === 0 ? <p className="text-muted">No orders yet.</p> : orders.map((o) => <p key={o.id} className="border-t border-gold/20 py-2 text-sm">#{o.id} · {o.items.map((i) => `${i.name} ×${i.qty}`).join(", ")} · <b>{money(o.subtotal)}</b> · {o.status}</p>)}</div>

      {profile?.role !== "admin" && <form onSubmit={claim} className="card space-y-3 p-6 md:col-span-2"><h2 className="font-display text-xl font-bold">Admin access code</h2><p className="text-sm text-muted">Only for the site owner. One-time code.</p>
        <input className="field" placeholder="BON-XXXX-XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} /><div className="flex items-center gap-3"><button className="btn">Unlock admin</button><span className="text-sm text-gold">{adminMsg}</span></div></form>}
      <button className="btn btn-ghost w-fit" onClick={() => supabase.auth.signOut().then(() => (window.location.hash = "#/"))}>Log out</button>
    </div>
  </>);
}
