/**
 * Bonadi — "Pure Food, Honest Promise"
 * Single-file React app. Multi-page via a tiny hash router (#/, #/shop, #/about, #/contact).
 * Styling: Tailwind utilities + CSS variables in styles.css.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo, lazy, Suspense } from "react";

/* 3D hero is code-split so Three.js never blocks first paint */
import Lenis from "lenis";
import { supabase, saveRow, fetchProducts } from "./lib/supabase.js";
const Store3D = lazy(() => import("./Store3D.jsx"));   // optional 3D shopping mode (separate chunk)
import { SITE, FAQ, POLICIES } from "./config.js";
import { t, pname, getLang, setLang } from "./i18n.js";
import { RECIPES } from "./recipes.js";
import { captureRef } from "./lib/ref.js";
import { submitOrder, validOrder } from "./lib/order.js";
const AuthPage = lazy(() => import("./Auth.jsx"));
const Account = lazy(() => import("./Account.jsx"));
const Admin = lazy(() => import("./Admin.jsx"));
import Hero from "./Hero.jsx";
import { ShieldCheck, Leaf, Heart, Truck, Award, Menu, X, Sun, Moon, ShoppingBag, ArrowUp, Phone, Mail, MapPin,
  ChevronDown, ArrowRight, Store, User, MessageCircle, Home as HomeIcon, Search, Facebook, Instagram, Youtube, Check, Star } from "lucide-react";

/* ============================ DATA ============================ */
const PAGES = [["/", "Home"], ["/shop", "Shop"], ["/about", "About"], ["/contact", "Contact"], ["/track", "Track order"], ["/recipes", "Recipes"]];

const FEATURES = [
  [ShieldCheck, "100% Authentic", "Carefully selected, quality ingredients."],
  [Award, "Traditional Taste", "Bringing the authentic taste of our heritage to your table."],
  [Heart, "Quality You Can Trust", "Made with care and attention to quality."],
  [Leaf, "Pure & Natural", "No unnecessary additives, just honest food."],
  [Truck, "Delivered to Your Door", "Fresh products delivered conveniently to your home."],
];

/* ============================ HOOKS ============================ */
/** Hash router: returns the current path and re-renders on change. */
const useRoute = () => {
  const get = () => window.location.hash.replace("#", "") || "/";
  const [path, setPath] = useState(get);
  useEffect(() => {
    const h = () => { setPath(get()); window.__lenis ? window.__lenis.scrollTo(0, { immediate: true }) : window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return path;
};
/** Adds `.in` to elements with `.reveal` when they scroll into view. */
const useReveal = (dep) => {
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { threshold: 0.12 });
    document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
};
/** Boolean scroll flag. State changes only when the threshold is crossed, so scrolling never re-renders the app. */
const useScrollFlag = (px) => {
  const [f, setF] = useState(false);
  useEffect(() => { const c = () => setF(window.scrollY > px); c(); window.addEventListener("scroll", c, { passive: true }); return () => window.removeEventListener("scroll", c); }, [px]);
  return f;
};

/* ============================ SMALL COMPONENTS ============================ */
const Section = ({ id, title, sub, children, className = "" }) => (
  <section id={id} className={`mx-auto max-w-6xl px-5 py-20 ${className}`}>
    {title && <div className="reveal mb-12 text-center">
      <span className="text-sm font-semibold uppercase tracking-[.25em] text-gold">Bonadi</span>
      <h2 className="mt-2 text-3xl font-bold md:text-4xl">{title}</h2>
      {sub && <p className="mx-auto mt-3 max-w-xl text-muted">{sub}</p>}
    </div>}
    {children}
  </section>
);

/** Animated number that counts up once visible. */
function Counter({ to, suffix }) {
  const [n, setN] = useState(0), ref = useRef(null);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now(), dur = 1800;
      const step = (t) => { const k = Math.min((t - t0) / dur, 1); setN(Math.round(to * (1 - Math.pow(1 - k, 3)))); k < 1 && requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }, { threshold: .5 });
    io.observe(ref.current); return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{n.toLocaleString()}{suffix}</span>;
}

/** Real numbers only: appears automatically once there are at least 10 delivered-order customers. */
function Stats() {
  const [s, setS] = useState(null);
  useEffect(() => { supabase.rpc("site_stats").then(({ data }) => setS(data?.[0] || null)); }, []);
  if (!s || Number(s.customers) < 10) return null;
  return (
    <div className="bg-brand py-14 text-white"><div className="mx-auto grid max-w-3xl grid-cols-2 gap-8 px-5 text-center">
      {[[s.customers, "Happy customers"], [s.delivered, "Orders delivered"]].map(([n, l]) => <div key={l}><div className="font-display text-4xl font-bold text-gold md:text-5xl"><Counter to={Number(n)} suffix="" /></div><p className="mt-1 text-white/70">{l}</p></div>)}
    </div></div>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {FAQ.map(([q, a], k) => (
        <div key={q} className="card reveal overflow-hidden">
          <button className="flex w-full items-center justify-between p-5 text-left font-semibold" aria-expanded={open === k} onClick={() => setOpen(open === k ? -1 : k)}>
            {t(q)}<ChevronDown className={`shrink-0 text-gold transition-transform ${open === k ? "rotate-180" : ""}`} />
          </button>
          <div className="grid transition-all duration-300" style={{ gridTemplateRows: open === k ? "1fr" : "0fr" }}>
            <p className="overflow-hidden px-5 text-muted"><span className="block pb-5">{t(a)}</span></p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductCard({ p, onAdd }) {
  const soon = p.status === "coming_soon", [credit, link] = (p.image_credit || "").split("|");
  return (
    <article className="card reveal overflow-hidden">
      <div className="relative overflow-hidden">
        {p.image_url ? <img src={p.image_url} alt={`${p.name} ${p.size || ""}`} loading="lazy" decoding="async" width="700" height="520" className={`h-56 w-full ${p.image_url.startsWith("/products/") ? "bg-gradient-to-b from-gold/10 to-gold/30 object-contain p-3" : "object-cover"} ${soon ? "grayscale" : ""}`} />
          : <div className="grid h-56 place-items-center bg-gold/15 font-display text-2xl text-gold">Bonadi</div>}
        <span className="absolute left-3 top-3 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-ink">{soon ? "Coming Soon" : p.tag}</span>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold">{pname(p)}</h3><p className="text-sm text-muted">{p.size}</p>
        <div className="mt-4 flex items-center justify-between"><span className="text-xl font-bold text-gold">৳{p.price.toLocaleString()}</span>
          {soon ? <span className="rounded-full border border-gold px-4 py-2 text-sm text-muted">{t("Coming Soon")}</span>
            : <button className="btn !px-4 !py-2 text-sm" onClick={() => onAdd(p)}><ShoppingBag size={16} />{t("Add")}</button>}</div>
        {credit && <a href={link} target="_blank" rel="noreferrer" className="mt-3 block text-[11px] text-muted">Photo: {credit} / Unsplash</a>}
      </div>
    </article>
  );
}

/** Contact form with client-side validation. */
function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", message: "" }), [err, setErr] = useState({}), [ok, setOk] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const x = {};
    if (f.name.trim().length < 2) x.name = t("Please enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(f.email)) x.email = t("Enter a valid email address.");
    if (f.message.trim().length < 10) x.message = t("Message must be at least 10 characters.");
    setErr(x);
    if (Object.keys(x).length) return;
    const { error } = await saveRow("contact_messages", f);
    if (error) return setErr({ message: t("Could not send. Please try again.") });
    setOk(true); setF({ name: "", email: "", message: "" });
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={submit} noValidate className="card space-y-4 p-6">
      {ok && <p className="flex items-center gap-2 rounded-xl bg-gold/20 p-3 text-sm"><Check size={18} />{t("Thank you! We will reply within 24 hours.")}</p>}
      {[["name", "Your name", "text"], ["email", "Email address", "email"]].map(([k, ph, t]) => (
        <div key={k}><input className="field" type={t} placeholder={ph} value={f[k]} onChange={set(k)} aria-invalid={!!err[k]} />
          {err[k] && <p className="mt-1 text-sm text-red-500">{err[k]}</p>}</div>))}
      <div><textarea className="field min-h-32" placeholder={t("How can we help?")} value={f.message} onChange={set("message")} />
        {err.message && <p className="mt-1 text-sm text-red-500">{err.message}</p>}</div>
      <button className="btn w-full justify-center">{t("Send Message")}</button>
    </form>
  );
}

function Newsletter() {
  const [em, setEm] = useState(""), [msg, setMsg] = useState("");
  const sub = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(em)) return setMsg(t("Please enter a valid email."));
    const { error } = await saveRow("newsletter_subscribers", { email: em.toLowerCase() });
    setMsg(error && error.code !== "23505" ? t("Something went wrong. Try again.") : t("You're subscribed. Welcome to Bonadi!"));  // 23505 = already subscribed
    if (!error) setEm("");
  };
  return (
    <form onSubmit={sub} className="space-y-2" noValidate>
      <div className="flex flex-col gap-2 sm:flex-row"><input className="field !text-ink" placeholder={t("Your email")} value={em} onChange={(e) => setEm(e.target.value)} aria-label="Email for newsletter" /><button className="btn justify-center">{t("Subscribe")}</button></div>
      {msg && <p className="text-sm text-gold">{msg}</p>}
    </form>
  );
}

/* ============================ PAGES ============================ */
function Home({ onAdd, products }) {
  return (<>
    {/* HERO: canvas particles + parallax layers (depth = different scroll speeds) */}
    <Hero products={products} />

    <Section id="why" title={t("What Makes Bonadi Special")} sub={t("Five promises we keep with every jar, bottle and box.")}>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([Icon, ti, d]) => (
          <div key={ti} className="card reveal p-7"><div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-gold/20 text-gold"><Icon /></div>
            <h3 className="text-xl font-bold">{t(ti)}</h3><p className="mt-2 text-muted">{t(d)}</p></div>))}
      </div>
    </Section>

    <Stats />

    <Section title={t("Our Best Sellers")} sub={t("Pure gawa ghee and natural honey — made with care.")}>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{products.filter((p) => p.status === "active").slice(0, 3).map((p) => <ProductCard key={p.id} p={p} onAdd={onAdd} />)}</div>
      <div className="mt-8 text-center"><a href="#/shop" className="btn btn-ghost">{t("View all products")}</a></div>
    </Section>
    <StoreExperience />
    <Reviews />
    <Section title={t("Frequently Asked Questions")}><Faq /></Section>
    <Section title={t("Tried BONADI?")} sub={t("We read every message — tell us what you think.")}><div className="text-center"><a href="#/contact" className="btn">{t("Contact us")}</a></div></Section>
  </>);
}

function StoreExperience() {
  return (
    <section aria-labelledby="store-experience-title" className="relative isolate overflow-hidden text-white">
      <div aria-hidden="true" className="absolute inset-0 z-0">
        <img src="https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1400&q=72" alt="" loading="eager" fetchPriority="low" decoding="async" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,37,27,.65)_0%,rgba(25,47,34,.45)_48%,rgba(28,48,35,.33)_100%)]" />
      </div>
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 sm:py-20 md:grid-cols-2 md:gap-12">
        <div className="max-w-xl">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-gold"><Store size={16} />{t("BONADI 3D STORE")}</p>
          <h2 id="store-experience-title" className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">{t("A new way to shop.")}</h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">{t("Walk through our virtual store, browse the shelves and add your favourites to your cart.")}</p>
          <a href="#/store" className="btn mt-6 !px-6 !py-3 text-sm sm:text-base">{t("Enter 3D Store")}<ArrowRight size={18} /></a>
        </div>
        <a href="#/store" aria-label={t("Enter 3D Store")} className="store-preview group relative flex aspect-[4/3] items-end justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_55%,rgba(218,177,92,.24),transparent_65%)]">
          <div aria-hidden="true" className="absolute inset-x-[8%] top-[10%] h-[70%] border-x border-t border-white/10 bg-white/[.025]">
            <div className="absolute inset-x-0 top-1/3 border-t border-white/10" />
            <div className="absolute inset-x-0 top-2/3 border-t border-white/10" />
          </div>
          <div className="relative z-10 flex h-[76%] w-[86%] items-end justify-center gap-2 border-b-[10px] border-[#77512d] px-4 sm:gap-5">
            {["250", "500", "1000"].map((size) => <img key={size} src={`/products/ghee-${size}.webp`} alt={`BONADI Gawa Ghee ${size} g`} loading="lazy" decoding="async" className={`h-auto w-[28%] object-contain drop-shadow-[0_18px_18px_rgba(0,0,0,.35)] transition-transform duration-300 group-hover:-translate-y-2 ${size === "250" ? "max-h-[66%]" : size === "500" ? "max-h-[82%]" : "max-h-[96%]"}`} />)}
          </div>
          <span className="absolute bottom-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-gold text-ink transition-transform group-hover:translate-x-1"><ArrowRight size={18} /></span>
        </a>
      </div>
    </section>
  );
}

const catKey = (p) => (/honey|modhu/i.test(p.name) ? "honey" : /oil|tel/i.test(p.name) ? "oil" : "ghee");
function Shop({ onAdd, products }) {
  const [q, setQ] = useState(""), [cat, setCat] = useState("all"), [sort, setSort] = useState("featured");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    let l = products.filter((p) => (cat === "all" || catKey(p) === cat) && `${p.name} ${p.name_bn || ""} ${p.size || ""}`.toLowerCase().includes(s));
    if (sort === "asc") l = [...l].sort((x, y) => x.price - y.price); else if (sort === "desc") l = [...l].sort((x, y) => y.price - x.price);
    return [...l.filter((p) => p.status === "active"), ...l.filter((p) => p.status !== "active")];       // coming-soon items always last
  }, [products, q, cat, sort]);
  const cats = [["all", "All"], ["ghee", "Ghee"], ["honey", "Honey"], ["oil", "Mustard oil"]];
  return (<>
    <PageTitle title={t("Shop Bonadi")} sub={t("Pure ghee, mustard oil and honey — delivered fresh.")} />
    <div className="mx-auto max-w-6xl px-5 pt-10"><a href="#/store" className="card flex flex-wrap items-center justify-between gap-3 p-4"><span><b className="font-display text-xl">{t("Prefer to walk around?")}</b> <span className="text-muted">{t("Try our optional 3D store — pick products from the shelves and pay at the counter.")}</span></span><span className="btn !py-2 text-sm"><Store size={16} />{t("Enter 3D Store")}</span></a></div>
    <div className="mx-auto max-w-6xl px-5 pt-8"><div className="flex flex-wrap items-center gap-3">
      <input type="search" aria-label={t("Search products")} placeholder={t("Search products")} className="field !w-full sm:!w-64" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Category">{cats.map(([k, l]) => <button key={k} aria-pressed={cat === k} onClick={() => setCat(k)} className={`min-h-[44px] rounded-full border px-5 text-sm font-semibold transition ${cat === k ? "border-gold bg-gold text-ink" : "border-gold/50"}`}>{t(l)}</button>)}</div>
      <label className="flex items-center gap-2 text-sm sm:ml-auto">{t("Sort")}<select className="field !w-auto !py-2" value={sort} onChange={(e) => setSort(e.target.value)}><option value="featured">{t("Featured")}</option><option value="asc">{t("Price: low to high")}</option><option value="desc">{t("Price: high to low")}</option></select></label>
    </div></div>
    <Section>{list.length ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{list.map((p) => <ProductCard key={p.id} p={p} onAdd={onAdd} />)}</div>
      : <div className="py-10 text-center"><p className="text-muted">{t("No products match your search.")}</p><button className="btn mt-4" onClick={() => { setQ(""); setCat("all"); }}>{t("Clear filters")}</button></div>}</Section>
  </>);
}

const PageTitle = ({ title, sub }) => (
  <div className="bg-brand px-5 pb-16 pt-36 text-center text-white"><h1 className="text-4xl font-bold md:text-5xl">{title}</h1><p className="mx-auto mt-3 max-w-xl text-white/70">{sub}</p></div>
);

function About() {
  return (<>
    <PageTitle title={t("About BONADI")} sub={t("Pure Food, Honest Promise.")} />
    <Section>
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div className="reveal rounded-2xl bg-gradient-to-b from-gold/10 to-gold/30 p-6"><img src="/products/ghee-500.webp" alt="BONADI Pure Cow Ghee, 500 g jar" width="365" height="700" loading="lazy" className="mx-auto h-80 w-auto drop-shadow-xl" /></div>
        <div className="reveal space-y-4 text-muted">
          <h2 className="font-display text-3xl font-bold text-[var(--ink)]">{t("Pure Food, Honest Promise")}</h2>
          <p>{t("BONADI is a premium food brand offering authentic and quality traditional foods. From pure ghee and mustard oil to natural honey, BONADI focuses on purity, great taste, quality and customer trust.")}</p>
          <p>{t("Our Gawa Ghee comes from Satkhira, Kaliganj, Bangladesh and is labelled 100% natural.")}</p>
          <a href="#/shop" className="btn">{t("Explore Products")}</a>
        </div>
      </div>
    </Section>
    <Section title={t("Why Families Trust Us")}><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map(([Icon, ti, d]) => <div key={ti} className="card reveal p-7"><Icon className="mb-3 text-gold" /><h3 className="font-bold">{t(ti)}</h3><p className="mt-1 text-muted">{t(d)}</p></div>)}</div></Section>
  </>);
}

function Contact() {
  return (<>
    <PageTitle title={t("Get in Touch")} sub={t("Questions, bulk orders or feedback — we'd love to hear from you.")} />
    <Section><div className="grid gap-8 md:grid-cols-2">
      <ContactForm />
      <div className="reveal space-y-5">
        {[[Phone, SITE.phone], SITE.email && [Mail, SITE.email], [MapPin, SITE.address]].filter(Boolean).map(([I, t]) => <p key={t} className="flex items-center gap-3"><I className="text-gold" />{t}</p>)}
        <iframe title="Bonadi location map" className="h-64 w-full rounded-2xl border-0" loading="lazy"
          src={`https://www.google.com/maps?q=${encodeURIComponent(SITE.mapQuery)}&output=embed`} />
      </div>
    </div></Section>
  </>);
}

/* ============================ LAYOUT ============================ */
const STEPS = ["pending", "confirmed", "sent_to_supplier", "shipped", "delivered"], STEP_L = ["Placed", "Confirmed", "Packed", "Shipped", "Delivered"];
/** Order tracking: needs BOTH the order number and the phone number used on the order (checked on the server). */
function Track() {
  const [f, setF] = useState({ id: "", phone: "" }), [res, setRes] = useState(undefined), [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); if (busy) return;
    if (!/^\d+$/.test(f.id.trim()) || f.phone.trim().length < 6) return setRes(null);
    setBusy(true); const { data } = await supabase.rpc("track_order", { p_id: Number(f.id), p_phone: f.phone }); setBusy(false); setRes(data?.[0] || null);
  };
  const step = res ? STEPS.indexOf(res.status) : -1;
  return (<>
    <PageTitle title={t("Track your order")} sub={t("Enter the order number and the phone number you used.")} />
    <Section><div className="mx-auto max-w-lg">
      <form onSubmit={go} className="card space-y-3 p-6">
        <label className="block text-sm font-semibold">{t("Order number")}<input className="field mt-1" inputMode="numeric" autoComplete="off" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} /></label>
        <label className="block text-sm font-semibold">{t("Phone number")}<input className="field mt-1" type="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <button className="btn w-full justify-center" disabled={busy}>{busy ? t("Searching…") : t("Track")}</button>
      </form>
      {res === null && <p role="alert" className="mt-4 text-center text-sm text-red-700">{t("No order found. Check the order number and phone number.")}</p>}
      {res && <div className="card mt-6 space-y-4 p-6">
        <p className="font-display text-2xl font-bold">{t("Order")} #{res.id}</p>
        {res.status === "cancelled" ? <p className="font-semibold text-red-700">{t("Cancelled")}</p> :
          <ol className="grid grid-cols-5 gap-1 text-center text-xs">{STEP_L.map((l, k) => <li key={l}><div className={`mx-auto mb-1 grid h-8 w-8 place-items-center rounded-full font-bold ${k <= step ? "bg-gold text-ink" : "bg-brand/10 text-muted"}`}>{k < step ? "✓" : k + 1}</div><span className={k <= step ? "font-semibold" : "text-muted"}>{t(l)}</span></li>)}</ol>}
        <div className="border-t border-gold/30 pt-3 text-sm">{res.items.map((i, k) => <p key={k}>{i.name} {i.size} × {i.qty}</p>)}<p className="mt-2 font-bold">{t("Order total")}: ৳{Number(res.subtotal).toLocaleString()}</p></div>
        {res.status === "delivered" && <ReviewForm orderId={res.id} phone={f.phone} />}
      </div>}
    </div></Section>
  </>);
}

function Recipes() {
  const l = getLang();
  return (<>
    <PageTitle title={t("Ghee recipes")} sub={t("Five easy recipes made better with pure gawa ghee.")} />
    <Section><div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
      {RECIPES.map((r) => (
        <details key={r.id} className="card reveal group p-5 open:md:col-span-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span><span className="font-display text-2xl font-bold">{r.title[l]}</span><span className="block text-sm text-muted">{t("Time")}: {r.time[l]} · {t("Serves")}: {r.serves}</span></span><ChevronDown className="shrink-0 text-gold transition-transform group-open:rotate-180" /></summary>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <div><h3 className="mb-2 font-bold">{t("Ingredients")}</h3><ul className="list-disc space-y-1 pl-5 text-sm">{r.ing[l].map((x, k) => <li key={k}>{x}</li>)}</ul></div>
            <div><h3 className="mb-2 font-bold">{t("Method")}</h3><ol className="list-decimal space-y-2 pl-5 text-sm">{r.steps[l].map((x, k) => <li key={k}>{x}</li>)}</ol></div>
          </div>
        </details>))}
    </div>
    <div className="mt-10 text-center"><a href="#/shop" className="btn">{t("Buy BONADI Gawa Ghee")}</a></div></Section>
  </>);
}

/** Approved, verified-purchase reviews only. Shows nothing until the first real review exists. */
function Reviews() {
  const [rows, setRows] = useState([]);
  useEffect(() => { supabase.from("reviews").select("name,rating,comment,product_name").eq("status", "approved").order("id", { ascending: false }).limit(50).then(({ data }) => setRows(data || [])); }, []);
  if (!rows.length) return null;
  const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
  return (
    <Section title={t("Customer reviews")} sub={`★ ${avg.toFixed(1)} / 5 · ${rows.length} ${t("Verified purchase")}`}>
      <div className="grid gap-5 md:grid-cols-3">{rows.slice(0, 6).map((r, k) => <div key={k} className="card reveal p-5"><p className="text-gold" aria-label={`${r.rating} / 5`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</p>{r.comment && <p className="mt-2 text-sm">{r.comment}</p>}<p className="mt-3 text-xs text-muted">{r.name} · {t("Verified purchase")}</p></div>)}</div>
    </Section>
  );
}

function ReviewForm({ orderId, phone }) {
  const [r, setR] = useState(5), [c, setC] = useState(""), [msg, setMsg] = useState(""), [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault(); if (busy) return; setBusy(true);
    const { error } = await supabase.rpc("submit_review", { p_order: orderId, p_phone: phone, p_rating: r, p_comment: c }); setBusy(false);
    if (error) setMsg(error.message.includes("already") ? t("You already reviewed this order.") : t("Could not send. Please try again.")); else setDone(true);
  };
  if (done) return <p className="rounded-xl bg-gold/20 p-3 text-sm">{t("Thank you! Your review will appear after approval.")}</p>;
  return (
    <form onSubmit={send} className="space-y-3 border-t border-gold/30 pt-4"><h3 className="font-display text-xl font-bold">{t("Review your order")}</h3>
      <div role="radiogroup" aria-label={t("Your rating")} className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} role="radio" aria-checked={r === n} aria-label={`${n} / 5`} onClick={() => setR(n)} className={`min-h-[44px] min-w-[44px] text-2xl ${n <= r ? "text-gold" : "text-muted/40"}`}>★</button>)}</div>
      <textarea className="field" maxLength={600} placeholder={t("Your comment (optional)")} value={c} onChange={(e) => setC(e.target.value)} />
      {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}<button className="btn" disabled={busy}>{t("Submit review")}</button></form>
  );
}

function Policy({ slug }) {
  const p = POLICIES[slug]; if (!p) return <NotFound />;
  return (<><PageTitle title={t(p.title)} sub={t("Pure Food, Honest Promise.")} /><Section><div className="mx-auto max-w-2xl space-y-4 leading-relaxed">{(p[getLang()] || p.en).map((x, k) => <p key={k}>{x}</p>)}</div></Section></>);
}

function NotFound() {
  return (<><PageTitle title="404" sub={t("The page you are looking for does not exist.")} />
    <Section><div className="flex flex-wrap justify-center gap-3"><a href="#/" className="btn">{t("Go to homepage")}</a><a href="#/shop" className="btn btn-ghost">{t("Browse the shop")}</a></div></Section></>);
}

/** Sticky bottom bar for phones (thumb zone): Home, Shop, Cart, Order Now */
function BottomBar({ path, cartCount, openCart }) {
  const item = "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold";
  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gold/30 bg-card/95 shadow-2xl backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <a href="#/" className={`${item} ${path === "/" ? "text-brand" : "text-muted"}`}><HomeIcon size={20} />{t("Home")}</a>
      <a href="#/shop" className={`${item} ${path === "/shop" ? "text-brand" : "text-muted"}`}><Store size={20} />{t("Shop")}</a>
      <button onClick={openCart} className={`${item} relative text-muted`}><ShoppingBag size={20} />{t("Cart")}{cartCount > 0 && <span className="absolute right-[28%] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">{cartCount}</span>}</button>
      <button onClick={() => (cartCount ? openCart() : (window.location.hash = "#/shop"))} className={`${item} m-1.5 rounded-xl bg-gold text-ink`}>{t("Order Now")}</button>
    </nav>
  );
}

function Nav({ path, theme, setTheme, cartCount, openCart, user, profile, lang, onLang }) {
  const [open, setOpen] = useState(false), solid = useScrollFlag(40);
  useEffect(() => setOpen(false), [path]);
  return (
    <nav className={`fixed inset-x-0 top-0 z-50 transition-all ${solid ? "bg-bg/90 shadow-md backdrop-blur" : ""}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a href="#/" aria-label="Bonadi home" className="shrink-0 bg-white px-3 py-3"><img src="/logo.png" alt="Bonadi" width="160" height="58" className="h-9 w-auto md:h-10" /></a>
        <div className={`flex shrink-0 items-center gap-1 sm:gap-3 ${solid ? "" : "text-white"}`}>
          <button aria-label="Language" onClick={onLang} className="min-h-[36px] rounded-full border border-current px-3 text-xs font-bold">{lang === "bn" ? "EN" : "বাং"}</button>
          <button aria-label="Open cart" className="relative p-2" onClick={openCart}><ShoppingBag size={20} />{cartCount > 0 && <span className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-gold text-[10px] font-bold text-ink">{cartCount}</span>}</button>
          <button className="p-2" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        </div>
      </div>
      {open && <div className="bonadi-menu-panel mx-3 mb-3 rounded-2xl border border-gold/20 bg-bg/95 p-3 shadow-xl backdrop-blur lg:mx-auto lg:max-w-6xl">
        <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {PAGES.map(([p, l]) => <li key={p}><a href={"#" + p} className="block rounded-xl bg-card/70 px-3 py-3 font-medium transition hover:bg-gold/20">{t(l)}</a></li>)}
          <li><a href={user ? "#/account" : "#/login"} className="block rounded-xl bg-card/70 px-3 py-3 font-medium transition hover:bg-gold/20">{t(user ? "Account" : "Log in")}</a></li>
          {profile?.role === "admin" && <li><a href="#/admin" className="block rounded-xl bg-card/70 px-3 py-3 font-medium transition hover:bg-gold/20">Admin</a></li>}
          <li><button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="flex w-full items-center gap-2 rounded-xl bg-card/70 px-3 py-3 text-left font-medium transition hover:bg-gold/20">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}{t(theme === "dark" ? "Light mode" : "Dark mode")}</button></li>
        </ul>
      </div>}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="bg-brand pb-16 text-white/80 md:pb-0">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <div><img src="/logo.png" alt="Bonadi" width="160" height="58" className="h-12 w-auto  bg-white px-3 py-3" /><p className="mt-3 text-sm">Premium traditional foods — pure ghee, mustard oil and natural honey made with care.</p></div>
        <div><h4 className="mb-3 font-semibold text-white">{t("Quick Links")}</h4><ul className="space-y-2 text-sm">{PAGES.map(([p, l]) => <li key={p}><a className="hover:text-gold" href={"#" + p}>{t(l)}</a></li>)}</ul></div>
        <div><h4 className="mb-3 font-semibold text-white">{t("Contact")}</h4><p className="text-sm">{SITE.phone}{SITE.email && <><br />{SITE.email}</>}<br />{SITE.address}</p>
          <div className="mt-4 flex gap-3">{[[Facebook, "facebook", "Facebook"], [Instagram, "instagram", "Instagram"], [Youtube, "youtube", "YouTube"]].filter(([, k]) => SITE.social[k]).map(([I, k, n]) => <a key={k} href={SITE.social[k]} target="_blank" rel="noreferrer" aria-label={n} className="grid h-9 w-9 place-items-center rounded-full border border-gold/50 transition hover:bg-gold hover:text-ink"><I size={16} /></a>)}</div></div>
        <div><h4 className="mb-3 font-semibold text-white">{t("Newsletter")}</h4><p className="mb-3 text-sm">{t("Subscribe to hear from BONADI.")}</p><Newsletter /></div>
      </div>
      <p className="border-t border-white/10 pt-5 text-center text-sm">© {new Date().getFullYear()} Bonadi. Pure Food, Honest Promise.</p>
      <p className="px-5 pt-3 text-center text-sm text-white/80">{[["delivery", "Delivery Policy"], ["returns", "Return & Refund"], ["privacy", "Privacy Policy"], ["terms", "Terms of Use"]].map(([s, l]) => <a key={s} href={"#/policy/" + s} className="mx-2 inline-block py-1 underline">{t(l)}</a>)}</p>
    </footer>
  );
}

function CartDrawer({ open, close, cart, clear, profile }) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const [f, setF] = useState({ name: "", phone: "", address: "" }), [status, setStatus] = useState(""), [drop, setDrop] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const canDrop = profile?.role === "dropshipper" && profile?.status === "approved";
  /** Cash-on-delivery order. Prices/stock are re-checked on the server inside place_order(). */
  const checkout = async (e) => {
    e.preventDefault();
    if (!validOrder(f)) return setStatus(t("Please enter your name, a valid BD phone number and full address."));
    const { data, error } = await submitOrder(f, cart, drop && canDrop);
    if (error) return setStatus(error.message.includes("not available") ? t("A product is no longer available.") : t("Order failed. Please try again or call us."));
    setStatus(`✓ ${t("Order")} #${data} — ${t("We will call you to confirm.")}`); clear(); setF({ name: "", phone: "", address: "" });
  };
  return (
    <aside className={`fixed right-0 top-0 z-[9500] h-full w-96 max-w-full overflow-y-auto bg-bg p-6 shadow-2xl transition-transform duration-300 ${open ? "" : "translate-x-full"}`} aria-hidden={!open} data-lenis-prevent {...(!open ? { inert: "" } : {})}>
      <div className="mb-6 flex items-center justify-between"><h3 className="text-xl font-bold">{t("Your Cart")}</h3><button onClick={close} aria-label="Close cart"><X /></button></div>
      {cart.length === 0 ? <p className="text-muted">{status || "Your cart is empty."}</p> : <>
        <ul className="space-y-3">{cart.map((i) => <li key={i.id} className="flex justify-between text-sm"><span>{i.name} × {i.qty}</span><b>৳{(i.price * i.qty).toLocaleString()}</b></li>)}</ul>
        <p className="mt-6 flex justify-between border-t border-gold/30 pt-4 font-bold"><span>{t("Total")}</span><span className="text-gold">৳{total.toLocaleString()}</span></p>
        <form onSubmit={checkout} className="mt-5 space-y-3" noValidate>
          <input className="field" placeholder={t("Customer name")} value={f.name} onChange={set("name")} />
          <input className="field" placeholder={t("Phone (01XXXXXXXXX)")} value={f.phone} onChange={set("phone")} />
          <textarea className="field" placeholder={t("Delivery address")} value={f.address} onChange={set("address")} />
          {canDrop && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={drop} onChange={(e) => setDrop(e.target.checked)} />{t("Dropship order (I earn commission)")}</label>}
          {status && <p className="text-sm text-gold">{status}</p>}
          <button className="btn w-full justify-center">{t("Place Order (Cash on Delivery)")}</button>
        </form>
        <button onClick={clear} className="mt-3 w-full text-sm text-muted underline">{t("Clear cart")}</button></>}
    </aside>
  );
}

/* ============================ APP ROOT ============================ */
export default function App() {
  const path = useRoute(), showTop = useScrollFlag(500);
  const [theme, setTheme] = useState(() => localStorage.getItem("bonadi-theme") || "light");
  const [loaded, setLoaded] = useState(false);
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem("bonadi-cart")) || []; } catch { return []; } }), [cartOpen, setCartOpen] = useState(false);
  useEffect(() => { try { localStorage.setItem("bonadi-cart", JSON.stringify(cart)); } catch {} }, [cart]);
  const cursor = useRef(null);
  const [lang, setL] = useState(getLang());                                   // Bangla is the default language
  const toggleLang = () => { const n = lang === "bn" ? "en" : "bn"; setLang(n); setL(n); };   // App re-renders => every t() call re-evaluates
  useEffect(() => {   // per-page browser tab titles (SEO + usability)
    const m = { "/": "BONADI — Pure Food, Honest Promise", "/shop": "Shop — BONADI", "/about": "About — BONADI", "/contact": "Contact — BONADI", "/track": "Track your order — BONADI", "/recipes": "Recipes — BONADI", "/login": "Account — BONADI", "/account": "My account — BONADI" };
    if (path !== "/store") document.title = m[path] || (path.startsWith("/policy/") ? "Policy — BONADI" : "BONADI");
  }, [path]);
  useEffect(() => {
    const titles = { "/": "BONADI — Pure Food, Honest Promise", "/shop": "Shop — BONADI", "/about": "About — BONADI", "/contact": "Contact — BONADI", "/track": "Track your order — BONADI", "/login": "Account — BONADI" };
    if (path !== "/store") document.title = titles[path] || "BONADI";
  }, [path]);
  // Products come from Supabase; local PRODUCTS is the fallback if backend is not configured
  const [products, setProducts] = useState(() => { try { return JSON.parse(sessionStorage.getItem("bonadi-products")) || []; } catch { return []; } });  // instant repaint from cache
  const [usingSavedProducts, setUsingSavedProducts] = useState(false);
  const [user, setUser] = useState(null), [profile, setProfile] = useState(null);
  const loadProfile = useCallback(async (u) => { if (!u) return setProfile(null); const { data } = await supabase.from("profiles").select("*").eq("id", u.id).single(); setProfile(data); }, []);
  // Auth session (profile fetch deferred with setTimeout to avoid auth-callback deadlocks)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); loadProfile(data.session?.user); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { if (_e === "PASSWORD_RECOVERY") { sessionStorage.setItem("bonadi-recovery", "1"); setTimeout(() => { window.location.hash = "#/account"; }, 0); } setUser(s?.user || null); setTimeout(() => loadProfile(s?.user), 0); });
    return () => subscription.unsubscribe();
  }, [loadProfile]);
  // Referral capture: ?ref=CODE is remembered and attached to the order / signup
  useEffect(() => { captureRef(); }, []);
  useEffect(() => {
    fetchProducts().then(({ data, isFallback }) => {
      if (!data) return;
      setProducts(data);
      setUsingSavedProducts(isFallback && data.length > 0);
      try { sessionStorage.setItem("bonadi-products", JSON.stringify(data)); } catch {}
    });
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("bonadi-theme", theme); }, [theme]);
  useEffect(() => { const t = setTimeout(() => setLoaded(true), 600); return () => clearTimeout(t); }, []);
  useReveal(path + loaded + products.length);   // re-observe when DB products render

  // Smooth scrolling (Lenis) — disabled for users who prefer reduced motion
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true }); window.__lenis = lenis;
    let raf; const loop = (t) => { lenis.raf(t); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); delete window.__lenis; };
  }, []);

  // Depth parallax: one rAF-throttled listener moves [data-parallax] layers by DOM (no React re-render)
  useEffect(() => {
    let tick = false;
    const run = () => { tick = false; const vh = window.innerHeight;
      document.querySelectorAll("[data-parallax]").forEach((el) => {
        const r = el.parentElement.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
        const ty = -(r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.parallax);
        el.style.transform = `translate3d(0,${ty.toFixed(1)}px,0) scale(${el.dataset.scale || 1})`; }); };
    const on = () => { if (!tick) { tick = true; requestAnimationFrame(run); } };
    run(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, [path, loaded]);

  // Custom cursor: follows the pointer and grows over interactive elements
  useEffect(() => {
    const move = (e) => { if (cursor.current) cursor.current.style.transform = `translate(${e.clientX - 11}px, ${e.clientY - 11}px)`; };
    const over = (e) => cursor.current?.classList.toggle("hot", !!e.target.closest("a,button,input,textarea"));
    window.addEventListener("mousemove", move); window.addEventListener("mouseover", over);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseover", over); };
  }, []);

  const add = useCallback((p, quiet) => { setCart((c) => c.find((i) => i.id === p.id) ? c.map((i) => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...c, { ...p, qty: 1 }]); if (!quiet) setCartOpen(true); }, []);
  const L = (el) => <Suspense fallback={<div className="pt-40 text-center">Loading…</div>}>{el}</Suspense>;
  const page = path === "/shop" ? <Shop onAdd={add} products={products} /> : path === "/about" ? <About /> : path === "/contact" ? <Contact />
    : path === "/track" ? <Track /> : path === "/recipes" ? <Recipes /> : path.startsWith("/policy/") ? <Policy slug={path.slice(8)} />
    : path === "/login" ? L(<AuthPage />) : path === "/account" ? L(<Account user={user} profile={profile} reload={() => loadProfile(user)} />)
    : path === "/admin" ? L(<Admin profile={profile} />)
    : path === "/" || !path.startsWith("/") ? <Home onAdd={add} products={products} />      // a non-"/" hash is an auth-redirect token, not a page
    : <NotFound />;

  if (path === "/store") return L(<Store3D products={products} cart={cart} onAdd={add} setCart={setCart} clear={() => setCart([])} profile={profile} />);

  return (<div className="bonadi-site" data-theme={theme}>
    <div className={`preloader ${loaded ? "done" : ""}`}><div className="text-center"><div className="spinner mx-auto" /><img src="/logo.png" alt="Bonadi" className="mx-auto mt-5 h-12 w-auto bg-white px-3 py-3" /></div></div>
    <div ref={cursor} className="cursor" />
    <Nav lang={lang} onLang={toggleLang} user={user} profile={profile} path={path} theme={theme} setTheme={setTheme} cartCount={cart.reduce((s, i) => s + i.qty, 0)} openCart={() => setCartOpen(true)} />
    <main>
      {usingSavedProducts && <div role="status" className="mx-auto mt-4 max-w-6xl rounded-xl border border-gold/50 bg-ivory px-4 py-3 text-sm">{t("Showing the saved product list. Live prices could not be loaded — the final price is confirmed when you order.")}</div>}
      {page}
    </main>
    <Footer />
    <BottomBar path={path} cartCount={cart.reduce((s, i) => s + i.qty, 0)} openCart={() => setCartOpen(true)} />
    <a href={`https://wa.me/${SITE.tel.replace("+", "")}`} target="_blank" rel="noreferrer" aria-label={t("Chat on WhatsApp")} className="fixed bottom-[8.5rem] right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-lg md:bottom-20 md:right-5"><MessageCircle size={24} /></a>
    <CartDrawer profile={profile} open={cartOpen} close={() => setCartOpen(false)} cart={cart} clear={() => setCart([])} />
    {/* Sticky call-to-action */}
    <a href={`tel:${SITE.tel}`} className="btn fixed bottom-5 left-5 z-40 !hidden shadow-lg md:!inline-flex"><Phone size={18} />{t("Order Now")}</a>
    {/* Back to top */}
    <button aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-24 right-4 z-40 grid h-12 w-12 md:bottom-5 md:right-5 place-items-center rounded-full bg-gold text-ink shadow-lg transition-all ${showTop ? "opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}><ArrowUp /></button>
  </div>);
}
