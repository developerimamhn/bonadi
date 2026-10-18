/** Login / Sign-up page. Sign-up can request a Dropshipper account (needs admin approval) and collects a payout number. */
import React, { useState } from "react";
import { supabase } from "./lib/supabase.js";
import { getRef } from "./lib/ref.js";

export default function Auth() {
  const [mode, setMode] = useState("login"), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const [f, setF] = useState({ email: "", password: "", name: "", phone: "", dropship: false, method: "bkash", number: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg("");
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
      error ? setMsg(error.message) : (window.location.hash = "#/account");
    } else {
      if (f.name.trim().length < 2 || f.password.length < 6) { setBusy(false); return setMsg("Enter your name and a password of 6+ characters."); }
      const { error } = await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: {
        full_name: f.name, phone: f.phone, want_dropship: f.dropship, payout_method: f.method, payout_number: f.number,
        ref: getRef() || "" } } });   // referral code captured from ?ref=
      setMsg(error ? error.message : "Account created! Check your email to confirm, then log in.");
    }
    setBusy(false);
  };
  const forgot = async () => {
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setMsg("Enter your email above first, then tap “Forgot password”.");
    const { error } = await supabase.auth.resetPasswordForEmail(f.email, { redirectTo: window.location.origin + "/" });
    setMsg(error ? error.message : "Password reset link sent — check your email.");
  };
  return (<>
    <div className="bg-brand pb-10 pt-32 text-center text-white"><h1 className="text-4xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1></div>
    <form onSubmit={submit} className="card mx-auto my-12 max-w-md space-y-3 p-6">
      {mode === "signup" && <>
        <input className="field" placeholder="Full name" value={f.name} onChange={set("name")} />
        <input className="field" placeholder="Phone (01XXXXXXXXX)" value={f.phone} onChange={set("phone")} />
      </>}
      <input className="field" type="email" placeholder="Email" value={f.email} onChange={set("email")} required />
      <input className="field" type="password" placeholder="Password" value={f.password} onChange={set("password")} required />
      {mode === "signup" && <>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.dropship} onChange={set("dropship")} className="mt-1" />
          I want a Dropshipper account (earn 7% — needs admin approval)</label>
        <p className="text-sm text-muted">Payout number for commissions (optional now, add later in your account):</p>
        <div className="flex gap-2"><select className="field !w-32" value={f.method} onChange={set("method")}><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="bank">Bank</option></select>
          <input className="field" placeholder="Number / account" value={f.number} onChange={set("number")} /></div>
      </>}
      {mode === "login" && <button type="button" onClick={forgot} className="text-sm text-muted underline">Forgot password?</button>}
      {msg && <p className="text-sm text-gold">{msg}</p>}
      <button className="btn w-full justify-center" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}</button>
      <button type="button" className="w-full text-sm text-muted underline" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(""); }}>
        {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}</button>
    </form>
  </>);
}
