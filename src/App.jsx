/**
 * Bonadi — "Pure Food, Honest Promise"
 * Single-file React app. Multi-page via a tiny hash router (#/, #/shop, #/about, #/contact).
 * Styling: Tailwind utilities + CSS variables in styles.css.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo, lazy, Suspense } from "react";

/* 3D hero is code-split so Three.js never blocks first paint */
import Lenis from "lenis";
import { db, saveRow, fetchProducts } from "./lib/db.js";
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
import { SplitText, RouteCurtain, ScrollProgress, Cursor, Manifesto, HScroll } from "./fx.jsx";
import { ShieldCheck, Leaf, Heart, Truck, Award, Menu, X, Sun, Moon, ShoppingBag, ArrowUp, Phone, Mail, MapPin,
  ChevronDown, ArrowRight, Store, User, MessageCircle, Home as HomeIcon, Search, Facebook, Instagram, Youtube, Check, Star, Plus, Minus, Trash2 } from "lucide-react";

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
const useReveal = () => {
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { threshold: 0.12 });
    const scan = () => document.querySelectorAll(".reveal:not(.in), .split:not(.in)").forEach((el) => io.observe(el));
    // Watch for elements rendered later (filtered products, loaded reviews…) so they never stay invisible
    let raf = 0; const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; scan(); }); });
    scan(); mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); cancelAnimationFrame(raf); };
  }, []);
};
/** Boolean scroll flag. State changes only when the threshold is crossed, so scrolling never re-renders the app. */
const useScrollFlag = (px) => {
  const [f, setF] = useState(false);
  useEffect(() => { const c = () => setF(window.scrollY > px); c(); window.addEventListener("scroll", c, { passive: true }); return () => window.removeEventListener("scroll", c); }, [px]);
  return f;
};

/* ============================ SMALL COMPONENTS ============================ */
const Section = ({ id, title, sub, eyebrow = "Bonadi", children, className = "" }) => (
  <section id={id} className={`mx-auto max-w-6xl px-5 py-20 ${className}`}>
    {title && <div className="reveal mb-10 flex flex-col gap-3 md:mb-14 md:flex-row md:items-end md:justify-between md:gap-10">
      <div><span className="eyebrow">{eyebrow}</span><h2 className="mt-4 max-w-2xl text-3xl font-bold leading-tight md:text-5xl"><SplitText text={title} /></h2></div>
      {sub && <p className="max-w-md text-muted md:pb-2 md:text-right">{sub}</p>}
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
  useEffect(() => { db().then((s) => s.rpc("site_stats")).then(({ data }) => setS(data?.[0] || null)); }, []);
  if (!s || Number(s.customers) < 10) return null;
  return (
    <div className="mx-auto max-w-6xl px-5"><div className="mx-auto grid grid-cols-2 gap-8 rounded-[28px] bg-brand px-5 py-14 text-center text-white">
      {[[s.customers, "Happy customers"], [s.delivered, "Orders delivered"]].map(([n, l]) => <div key={l}><div className="font-display text-4xl font-bold text-gold md:text-5xl"><Counter to={Number(n)} suffix="" /></div><p className="mt-1 text-white/70">{l}</p></div>)}
    </div></div>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {FAQ.map(([q, a], k) => (
        <div key={q} className={`card reveal overflow-hidden ${open === k ? "!border-gold/50" : ""}`}>
          <button className="flex w-full items-center justify-between gap-4 p-5 text-left text-lg font-bold" aria-expanded={open === k} onClick={() => setOpen(open === k ? -1 : k)}>
            {t(q)}<span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${open === k ? "rotate-180 bg-gold text-ink" : "bg-gold/15 text-gold"}`}><ChevronDown size={18} /></span>
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
  const soon = p.status === "coming_soon", [credit, link] = (p.image_credit || "").split("|"), cut = p.image_url?.startsWith("/products/");
  return (
    <article className="product-card group reveal">
      <div className="img-mask relative h-64 overflow-hidden rounded-[20px] bg-[radial-gradient(circle_at_50%_70%,rgb(var(--gold-rgb)/.30),transparent_60%),linear-gradient(180deg,rgb(var(--gold-rgb)/.08),rgb(var(--gold-rgb)/.22))]">
        {p.image_url ? <img src={p.image_url} alt={`${p.name} ${p.size || ""}`} loading="lazy" decoding="async" width="700" height="520" className={`h-full w-full transition-transform duration-500 group-hover:scale-105 ${cut ? "object-contain p-6 drop-shadow-[0_18px_18px_rgba(0,0,0,.18)]" : "object-cover"} ${soon ? "grayscale" : ""}`} />
          : <div className="grid h-full place-items-center font-display text-2xl text-gold">Bonadi</div>}
        {(soon || p.tag) && <span className="absolute left-3 top-3 rounded-full bg-card/90 px-3 py-1 text-xs font-bold text-accent shadow-sm backdrop-blur">{t(soon ? "Coming Soon" : p.tag)}</span>}
        {p.size && <span className="absolute right-3 top-3 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">{p.size}</span>}
      </div>
      <div className="flex items-end justify-between gap-3 px-2 pb-1 pt-4">
        <div className="min-w-0">
          <h3 className="truncate text-xl font-bold">{pname(p)}</h3>
          <p className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-extrabold text-accent">৳{p.price.toLocaleString()}</span>
            {p.compare_at_price > p.price && <s className="text-sm text-muted">৳{Number(p.compare_at_price).toLocaleString()}</s>}</p>
        </div>
        {soon ? <span className="shrink-0 rounded-full border border-gold/60 px-4 py-2 text-sm text-muted">{t("Coming Soon")}</span>
          : <button className="btn shrink-0 !px-4 !py-2.5 text-sm" onClick={() => onAdd(p)}><ShoppingBag size={16} />{t("Add")}</button>}
      </div>
      {credit && <a href={link} target="_blank" rel="noreferrer" className="block px-2 pt-2 text-[11px] text-muted">Photo: {credit} / Unsplash</a>}
    </article>
  );
}

/** Placeholder card while products load, so the grid keeps its height (no layout jump when they arrive). */
const CardSkeleton = () => (
  <div aria-hidden="true" className="animate-pulse"><div className="h-64 rounded-[20px] bg-gold/15" /><div className="mx-2 mt-4 h-5 w-2/3 rounded-full bg-gold/15" /><div className="mx-2 mt-3 h-7 w-1/3 rounded-full bg-gold/15" /></div>
);

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
      {[["name", "Your name", "text", "name"], ["email", "Email address", "email", "email"]].map(([k, ph, type, ac]) => (
        <div key={k}><input className="field" type={type} autoComplete={ac} placeholder={t(ph)} aria-label={t(ph)} value={f[k]} onChange={set(k)} aria-invalid={!!err[k]} />
          {err[k] && <p className="mt-1 text-sm text-red-500">{err[k]}</p>}</div>))}
      <div><textarea className="field min-h-32" placeholder={t("How can we help?")} aria-label={t("How can we help?")} value={f.message} onChange={set("message")} />
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
      <div className="flex flex-col gap-2 sm:flex-row"><input className="field !text-ink" type="email" autoComplete="email" placeholder={t("Your email")} value={em} onChange={(e) => setEm(e.target.value)} aria-label={t("Your email")} /><button className="btn btn-gold justify-center">{t("Subscribe")}</button></div>
      {msg && <p className="text-sm text-gold">{msg}</p>}
    </form>
  );
}

/* ============================ PAGES ============================ */
function Home({ onAdd, products }) {
  return (<>
    {/* HERO: canvas particles + parallax layers (depth = different scroll speeds) */}
    <Hero products={products} />
    <PromiseStrip />
    <Manifesto eyebrow={t("Our promise")} text={t("Finding pure food among so much adulteration is hard. So we bring pure gawa ghee from Kaliganj, Satkhira straight to your home — hold it in your hands first, then pay.")} />

    <Section id="why" title={t("What Makes Bonadi Special")} sub={t("Five promises we keep with every jar, bottle and box.")}>
      <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
        {FEATURES.map(([Icon, ti, d], k) => k === 0 ? (
          <div key={ti} className="reveal relative flex flex-col justify-between overflow-hidden rounded-[28px] bg-brand p-8 text-white md:row-span-2">
            <div aria-hidden="true" className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/25 blur-3xl" />
            <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-gold text-ink"><Icon size={26} /></div>
            <div className="relative mt-16"><h3 className="text-3xl font-bold leading-tight md:text-4xl">{t(ti)}</h3><p className="mt-3 text-white/75">{t(d)}</p>
              <a href="#/shop" className="btn btn-gold mt-6">{t("Shop Now")}<ArrowRight size={18} /></a></div>
          </div>
        ) : (
          <div key={ti} className="card reveal p-7"><div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-gold"><Icon /></div>
            <h3 className="text-xl font-bold">{t(ti)}</h3><p className="mt-2 text-sm text-muted">{t(d)}</p></div>))}
      </div>
    </Section>

    <Section title={t("Our Best Sellers")} sub={t("Pure gawa ghee and natural honey — made with care.")}>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{products.length ? products.filter((p) => p.status === "active").slice(0, 3).map((p) => <ProductCard key={p.id} p={p} onAdd={onAdd} />) : [0, 1, 2].map((k) => <CardSkeleton key={k} />)}</div>
      <div className="mt-10 text-center"><a href="#/shop" className="btn btn-ghost">{t("View all products")}<ArrowRight size={18} /></a></div>
    </Section>
    <HowItWorks />
    <StoreExperience />
    <Stats />
    <Reviews />
    <section className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-[.8fr_1.2fr]">
      <div className="reveal md:sticky md:top-28 md:self-start">
        <span className="eyebrow">FAQ</span>
        <h2 className="mt-4 text-3xl font-bold leading-tight md:text-5xl"><SplitText text={t("Frequently Asked Questions")} /></h2>
        <a href={`tel:${SITE.tel}`} className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-brand/10 bg-card p-4 font-semibold"><span className="grid h-10 w-10 place-items-center rounded-full bg-gold/20 text-gold"><Phone size={18} /></span>{SITE.phone}</a>
      </div>
      <Faq />
    </section>
    <CtaBand />
  </>);
}

/** Scrolling band of the shop's promises, right under the hero */
function PromiseStrip() {
  const items = ["100% Natural", "Free delivery", "Cash on Delivery", "7-day return", "Satkhira · Bangladesh"];
  const row = <div className="flex shrink-0 items-center gap-10 pr-10" aria-hidden="true">{items.map((x, k) => <span key={x} className="flex items-center gap-10 whitespace-nowrap font-display text-2xl md:text-4xl"><span className={k % 2 ? "outline-text" : ""}>{t(x)}</span><Leaf size={20} className="text-brand/60" /></span>)}</div>;
  return (
    <div className="overflow-hidden bg-gold py-5 text-ink" role="region" aria-label={items.map(t).join(" · ")}>
      <div className="marquee flex w-max">{row}{row}</div>
    </div>
  );
}

/** Five honest steps from order to doorstep, sliding sideways on wide screens */
const STEPS_HOW = [
  ["Order online", "A few taps — nothing to pay in advance."],
  ["We call you", "We phone you to confirm your address and delivery."],
  ["Free delivery", "We bring it to your door. No delivery charge."],
  ["Pay on delivery", "See the product first, then pay in cash."],
  ["7-day return", "Not happy? Cash refund or a replacement product."],
];
function HowItWorks() {
  return (
    <HScroll cursor={t("Scroll")}>
      <div className="flex w-full shrink-0 flex-col justify-center gap-5 md:w-[38vw] md:pr-10">
        <span className="eyebrow w-fit">{t("How it works")}</span>
        <h2 className="text-4xl font-bold leading-tight md:text-6xl"><SplitText text={t("From Satkhira to your door")} /></h2>
        <p className="max-w-sm text-muted">{t("No risk for you: you pay only when the jar is in your hands.")}</p>
      </div>
      {STEPS_HOW.map(([h, d], k) => (
        <article key={h} className={`how-card group relative flex shrink-0 flex-col justify-between overflow-hidden rounded-[28px] p-7 md:h-[62vh] md:w-[min(400px,30vw)] md:p-9 ${k % 2 ? "bg-card text-ink" : "bg-brand text-white"}`}>
          <span className={`font-display text-7xl leading-none md:text-9xl ${k % 2 ? "text-gold" : "text-gold/90"}`}>0{k + 1}</span>
          <div className="mt-10"><h3 className="text-2xl font-bold md:text-3xl">{t(h)}</h3><p className={`mt-3 ${k % 2 ? "text-muted" : "text-white/75"}`}>{t(d)}</p></div>
          <span aria-hidden="true" className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-gold/20 blur-2xl transition-transform duration-700 group-hover:scale-150" />
        </article>))}
      <a href="#/shop" data-cursor={t("Shop")} className="how-card flex shrink-0 flex-col items-start justify-end rounded-[28px] bg-gold p-7 text-ink md:h-[62vh] md:w-[min(400px,30vw)] md:p-9">
        <span className="font-display text-4xl leading-tight md:text-5xl">{t("Shop Now")}</span><span className="mt-6 grid h-14 w-14 place-items-center rounded-full bg-brand text-white"><ArrowRight /></span>
      </a>
    </HScroll>
  );
}

/** Closing call-to-action */
function CtaBand() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-20">
      <div className="reveal relative overflow-hidden rounded-[32px] bg-brand px-6 py-14 text-center text-white md:px-16 md:py-20">
        <div aria-hidden="true" className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-gold/25 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold leading-tight md:text-5xl"><SplitText text={t("Tried BONADI?")} /></h2>
          <p className="mt-4 text-white/75">{t("We read every message — tell us what you think.")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#/shop" className="btn btn-gold">{t("Shop Now")}<ArrowRight size={18} /></a>
            <a href="#/contact" className="btn btn-ghost !border-white/30 !text-white">{t("Contact us")}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function StoreExperience() {
  return (
    <section aria-labelledby="store-experience-title" className="mx-auto max-w-6xl px-5">
      <div className="reveal hero-bg relative isolate grid items-center gap-8 overflow-hidden rounded-[32px] px-6 py-12 text-white sm:px-10 sm:py-16 md:grid-cols-2 md:gap-12">
        <div className="max-w-xl">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-gold"><Store size={16} />{t("BONADI 3D STORE")}</p>
          <h2 id="store-experience-title" className="mt-3 font-display text-4xl font-bold leading-tight sm:text-6xl"><SplitText text={t("A new way to shop.")} /></h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">{t("Walk through our virtual store, browse the shelves and add your favourites to your cart.")}</p>
          <a href="#/store" className="btn mt-6 !px-6 !py-3 text-sm sm:text-base">{t("Enter 3D Store")}<ArrowRight size={18} /></a>
        </div>
        <a href="#/store" aria-label={t("Enter 3D Store")} data-cursor={t("Enter")} className="store-preview group relative flex aspect-[4/3] items-end justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_55%,rgba(218,177,92,.24),transparent_65%)]">
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

/** Category from the English or Bangla name. Anything that matches none is only listed under "All". */
const CATS = [["ghee", /ghee|\bghi\b|ঘি/i], ["honey", /honey|modhu|মধু/i], ["oil", /\boil\b|\btel\b|তেল/i]];
const catKey = (p) => { const s = `${p.name} ${p.name_bn || ""}`; return CATS.find(([, re]) => re.test(s))?.[0] || "other"; };
/** Search text: NFC unifies the two ways Bangla keyboards type য় ড় ঢ়; case and extra spaces are ignored. */
const norm = (s) => String(s || "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
const SORTS = [["featured", "Featured"], ["asc", "Price: low to high"], ["desc", "Price: high to low"]];

function Shop({ onAdd, products }) {
  const [q, setQ] = useState(""), [cat, setCat] = useState("all"), [sort, setSort] = useState("featured");
  const counts = useMemo(() => products.reduce((m, p) => { const k = catKey(p); m[k] = (m[k] || 0) + 1; return m; }, { all: products.length }), [products]);
  const list = useMemo(() => {
    const s = norm(q), tight = s.replace(/ /g, "");
    let l = products.filter((p) => {
      if (cat !== "all" && catKey(p) !== cat) return false;
      const hay = norm(`${p.name} ${p.name_bn || ""} ${p.size || ""} ${p.tag || ""}`);
      return hay.includes(s) || hay.replace(/ /g, "").includes(tight);          // "1kg" finds "1 kg"
    });
    if (sort === "asc") l = [...l].sort((x, y) => x.price - y.price); else if (sort === "desc") l = [...l].sort((x, y) => y.price - x.price);
    return [...l.filter((p) => p.status === "active"), ...l.filter((p) => p.status !== "active")];       // coming-soon items always last
  }, [products, q, cat, sort]);
  const cats = [["all", "All"], ["ghee", "Ghee"], ["honey", "Honey"], ["oil", "Mustard oil"]].filter(([k]) => k === "all" || counts[k]);
  const filtered = q.trim() || cat !== "all" || sort !== "featured";
  const reset = () => { setQ(""); setCat("all"); setSort("featured"); };
  const bn = getLang() === "bn";
  return (<>
    <PageTitle title={t("Shop Bonadi")} sub={t("Pure ghee, mustard oil and honey — delivered fresh.")} />
    {/* Filter bar: stays under the navbar while scrolling the products */}
    <div className="sticky top-[72px] z-30 mx-auto mt-6 max-w-6xl px-3 sm:px-5 md:top-[80px]">
      <div className="rounded-[24px] border border-brand/10 bg-card/90 p-2 shadow-lg backdrop-blur-xl sm:p-3">
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1"><span className="sr-only">{t("Search products")}</span>
            <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input type="search" enterKeyHint="search" placeholder={t("Search products")} className="field !rounded-full !py-2.5 !pl-10" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="shrink-0"><span className="sr-only">{t("Sort")}</span>
            <select className="field !w-[7.5rem] !rounded-full !py-2.5 !pl-3 !pr-6 text-xs sm:!w-auto sm:!pl-4 sm:!pr-8 sm:text-sm" value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select>
          </label>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div role="group" aria-label={t("Category")} className="no-scrollbar -mx-2 flex flex-1 gap-2 overflow-x-auto px-2 sm:mx-0 sm:flex-wrap sm:px-0">
            {cats.map(([k, l]) => <button key={k} aria-pressed={cat === k} onClick={() => setCat(k)} className={`flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${cat === k ? "border-brand bg-brand text-white" : "border-brand/15 hover:border-gold"}`}>
              {t(l)}<span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] ${cat === k ? "bg-white/20" : "bg-gold/20"}`}>{counts[k]}</span></button>)}
          </div>
          <p aria-live="polite" className="hidden shrink-0 text-sm text-muted sm:block">{list.length}{bn ? "" : " "}{t("items")}</p>
          {filtered && <button onClick={reset} className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-muted underline">{t("Clear filters")}</button>}
        </div>
      </div>
    </div>
    <Section className="!pt-8">{!products.length ? <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((k) => <CardSkeleton key={k} />)}</div>
      : list.length ? <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">{list.map((p) => <ProductCard key={p.id} p={p} onAdd={onAdd} />)}</div>
      : <div className="py-10 text-center"><p className="text-muted">{t("No products match your search.")}</p><button className="btn mt-4" onClick={reset}>{t("Clear filters")}</button></div>}</Section>
    <div className="mx-auto max-w-6xl px-5 pb-16"><a href="#/store" className="card flex flex-wrap items-center justify-between gap-3 p-5"><span><b className="font-display text-xl">{t("Prefer to walk around?")}</b> <span className="hidden text-muted sm:inline">{t("Try our optional 3D store — pick products from the shelves and pay at the counter.")}</span></span><span className="btn !py-2 text-sm"><Store size={16} />{t("Enter 3D Store")}</span></a></div>
  </>);
}

const PageTitle = ({ title, sub }) => (
  <div className="page-head px-5 pb-16 pt-36 text-center text-white"><span className="eyebrow eyebrow-dark">Bonadi</span><h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-tight md:text-7xl"><SplitText text={title} /></h1>{sub && <p className="mx-auto mt-4 max-w-xl text-white/75">{sub}</p>}</div>
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
        {[[Phone, SITE.phone, `tel:${SITE.tel}`], SITE.email && [Mail, SITE.email, `mailto:${SITE.email}`], [MapPin, SITE.address]].filter(Boolean).map(([I, txt, href]) => <p key={txt} className="flex items-center gap-3"><I className="text-gold" />{href ? <a href={href} className="hover:text-gold">{txt}</a> : txt}</p>)}
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
    setBusy(true);
    const sb = await db(), [{ data }, courier] = await Promise.all([sb.rpc("track_order", { p_id: Number(f.id), p_phone: f.phone }), sb.rpc("track_courier", { p_id: Number(f.id), p_phone: f.phone })]);
    setBusy(false); setRes(data?.[0] ? { ...data[0], courier: courier.data?.[0] || null } : null);
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
        {res.courier?.tracking_code && <CourierBox c={res.courier} />}
        <div className="border-t border-gold/30 pt-3 text-sm">{res.items.map((i, k) => <p key={k}>{i.name} {i.size} × {i.qty}</p>)}<p className="mt-2 font-bold">{t("Order total")}: ৳{Number(res.subtotal).toLocaleString()}</p></div>
        {res.status === "delivered" && <ReviewForm orderId={res.id} phone={f.phone} />}
      </div>}
    </div></Section>
  </>);
}

/** Steadfast parcel details on the Track page (filled in by the steadfast-webhook edge function). */
const COURIER_L = { in_review: "Parcel booked", pending: "On the way", hold: "On hold", delivered: "Delivered", partial_delivered: "Partly delivered", cancelled: "Returned / cancelled" };
function CourierBox({ c }) {
  const st = c.courier_status?.replace("_approval_pending", "");
  return (
    <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4 text-sm">
      <p className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold"><Truck size={16} className="mr-1.5 inline text-gold" />{t("Courier")}: Steadfast</span>
        {st && <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">{t(COURIER_L[st] || st)}</span>}</p>
      {c.courier_message && <p className="mt-2">{c.courier_message}</p>}
      <p className="mt-2 text-muted">{t("Tracking code")}: <b className="text-ink">{c.tracking_code}</b>{c.courier_updated_at && <> · {new Date(c.courier_updated_at).toLocaleString(getLang() === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}</>}</p>
      <a href={`https://steadfast.com.bd/t/${encodeURIComponent(c.tracking_code)}`} target="_blank" rel="noreferrer" className="btn btn-ghost mt-3 !py-2 text-sm">{t("Live tracking on Steadfast")}<ArrowRight size={16} /></a>
    </div>
  );
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
  useEffect(() => { db().then((s) => s.from("reviews").select("name,rating,comment,product_name").eq("status", "approved").order("id", { ascending: false }).limit(50)).then(({ data }) => setRows(data || [])); }, []);
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
    const { error } = await (await db()).rpc("submit_review", { p_order: orderId, p_phone: phone, p_rating: r, p_comment: c }); setBusy(false);
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
  const item = "flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold";
  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-3 z-40 flex gap-1 rounded-[22px] border border-brand/10 bg-card/90 p-1 shadow-2xl backdrop-blur-xl md:hidden" style={{ bottom: "calc(.75rem + env(safe-area-inset-bottom))" }}>
      <a href="#/" className={`${item} ${path === "/" ? "text-brand" : "text-muted"}`}><HomeIcon size={20} />{t("Home")}</a>
      <a href="#/shop" className={`${item} ${path === "/shop" ? "text-brand" : "text-muted"}`}><Store size={20} />{t("Shop")}</a>
      <a href={`https://wa.me/${SITE.tel.replace("+", "")}`} target="_blank" rel="noreferrer" aria-label={t("Chat on WhatsApp")} className={`${item} text-[#1da851]`}><MessageCircle size={20} />WhatsApp</a>
      <button onClick={openCart} className={`${item} relative text-muted`}><ShoppingBag size={20} />{t("Cart")}{cartCount > 0 && <span className="absolute right-[28%] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">{cartCount}</span>}</button>
      <button onClick={() => (cartCount ? openCart() : (window.location.hash = "#/shop"))} className={`${item} bg-brand px-1 text-center text-[11px] leading-tight text-white`}>{t("Order Now")}</button>
    </nav>
  );
}

function Nav({ path, theme, setTheme, cartCount, openCart, user, profile, lang, onLang }) {
  const [open, setOpen] = useState(false), solid = useScrollFlag(40) || open;
  useEffect(() => setOpen(false), [path]);
  const icon = "relative grid h-10 w-10 place-items-center rounded-full transition hover:bg-gold/20";
  const item = "block rounded-2xl px-4 py-3 font-semibold transition hover:bg-gold/15";
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
      <nav aria-label="Main" className={`nav-pill mx-auto flex max-w-6xl items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-2 transition-all duration-300 ${solid ? "border-brand/10 bg-card/85 text-ink shadow-lg backdrop-blur-xl" : "border-white/15 bg-white/10 text-white backdrop-blur-md"}`}>
        <a href="#/" aria-label="Bonadi home" className="shrink-0 rounded-full bg-white px-4 py-1.5"><img src="/logo.webp" alt="Bonadi" width="160" height="58" className="h-8 w-auto md:h-9" /></a>
        <ul className="mx-auto hidden items-center gap-1 lg:flex">
          {PAGES.map(([p, l]) => <li key={p}><a href={"#" + p} aria-current={path === p ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${path === p ? "bg-gold text-ink" : "hover:bg-gold/20"}`}>{t(l)}</a></li>)}
        </ul>
        <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-0">
          <button aria-label={t("Language")} onClick={onLang} className="h-10 rounded-full border border-current/30 px-3 text-xs font-bold">{lang === "bn" ? "EN" : "বাং"}</button>
          <button aria-label={t(theme === "dark" ? "Light mode" : "Dark mode")} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className={`${icon} hidden lg:grid`}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
          <a href={user ? "#/account" : "#/login"} aria-label={t(user ? "Account" : "Log in")} className={`${icon} hidden lg:grid`}><User size={19} /></a>
          {profile?.role === "admin" && <a href="#/admin" className="hidden rounded-full px-3 py-2 text-sm font-semibold hover:bg-gold/20 lg:block">Admin</a>}
          <button aria-label={t("Cart")} className={`${icon} bg-gold !text-ink hover:!bg-gold`} onClick={openCart}><ShoppingBag size={19} />{cartCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{cartCount}</span>}</button>
          <button className={`${icon} lg:hidden`} aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        </div>
      </nav>
      {open && <div className="bonadi-menu-panel mx-auto mt-2 max-w-6xl rounded-[28px] border border-brand/10 bg-card/95 p-3 text-ink shadow-xl backdrop-blur-xl lg:hidden">
        <ul className="grid grid-cols-2 gap-1">
          {PAGES.map(([p, l]) => <li key={p}><a href={"#" + p} className={`${item} ${path === p ? "bg-gold/20" : ""}`}>{t(l)}</a></li>)}
          <li><a href={user ? "#/account" : "#/login"} className={item}>{t(user ? "Account" : "Log in")}</a></li>
          {profile?.role === "admin" && <li><a href="#/admin" className={item}>Admin</a></li>}
          <li className="col-span-2"><button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className={`${item} flex w-full items-center gap-2 text-left`}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}{t(theme === "dark" ? "Light mode" : "Dark mode")}</button></li>
        </ul>
      </div>}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-4 overflow-hidden rounded-t-[32px] bg-brand pb-24 text-white/80 md:rounded-t-[48px] md:pb-6">
      <div className="mx-auto max-w-6xl px-5 pt-16"><p className="max-w-3xl font-display text-4xl leading-tight text-white md:text-7xl"><SplitText text={t("Pure Food, Honest Promise")} /><span className="text-gold">.</span></p></div>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div><span className="inline-block rounded-full bg-white px-4 py-2"><img src="/logo.webp" alt="Bonadi" width="160" height="58" className="h-9 w-auto" /></span><p className="mt-4 text-sm">{t("Premium traditional foods — pure ghee, mustard oil and natural honey made with care.")}</p></div>
        <div><h4 className="mb-3 font-semibold text-white">{t("Quick Links")}</h4><ul className="space-y-2 text-sm">{PAGES.map(([p, l]) => <li key={p}><a className="hover:text-gold" href={"#" + p}>{t(l)}</a></li>)}</ul></div>
        <div><h4 className="mb-3 font-semibold text-white">{t("Contact")}</h4><p className="text-sm">{SITE.phone}{SITE.email && <><br />{SITE.email}</>}<br />{SITE.address}</p>
          <div className="mt-4 flex gap-3">{[[Facebook, "facebook", "Facebook"], [Instagram, "instagram", "Instagram"], [Youtube, "youtube", "YouTube"]].filter(([, k]) => SITE.social[k]).map(([I, k, n]) => <a key={k} href={SITE.social[k]} target="_blank" rel="noreferrer" aria-label={n} className="grid h-9 w-9 place-items-center rounded-full border border-gold/50 transition hover:bg-gold hover:text-ink"><I size={16} /></a>)}</div></div>
        <div><h4 className="mb-3 font-semibold text-white">{t("Newsletter")}</h4><p className="mb-3 text-sm">{t("Subscribe to hear from BONADI.")}</p><Newsletter /></div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-white/10 px-5 pt-6 text-sm md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} Bonadi. Pure Food, Honest Promise.</p>
        <p className="flex flex-wrap gap-x-5 gap-y-1">{[["delivery", "Delivery Policy"], ["returns", "Return & Refund"], ["privacy", "Privacy Policy"], ["terms", "Terms of Use"]].map(([s, l]) => <a key={s} href={"#/policy/" + s} className="py-1 hover:text-gold">{t(l)}</a>)}</p>
      </div>
      <div aria-hidden="true" className="overflow-hidden px-3 pt-10"><SplitText chars text="BONADI" className="block text-center font-display text-[20vw] leading-[.78] text-white/[.07]" /></div>
    </footer>
  );
}

function CartDrawer({ open, close, cart, setCart, clear, profile }) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const [f, setF] = useState({ name: "", phone: "", address: "" }), [status, setStatus] = useState(""), [drop, setDrop] = useState(false), [busy, setBusy] = useState(false);
  const submitting = useRef(false);   // blocks a double tap from placing the same order twice
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const canDrop = profile?.role === "dropshipper" && profile?.status === "approved";
  const qty = (id, d) => setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: i.qty + d } : i)).filter((i) => i.qty > 0));
  useEffect(() => { if (!open) return; const k = (e) => e.key === "Escape" && close(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [open, close]);
  /** Cash-on-delivery order. Prices/stock are re-checked on the server inside place_order(). */
  const checkout = async (e) => {
    e.preventDefault(); if (submitting.current) return;
    if (!validOrder(f)) return setStatus(t("Please enter your name, a valid BD phone number and full address."));
    submitting.current = true; setBusy(true); setStatus("");
    const { data, error } = await submitOrder(f, cart, drop && canDrop);
    submitting.current = false; setBusy(false);
    if (error) return setStatus(error.message.includes("not available") ? t("A product is no longer available.") : t("Order failed. Please try again or call us."));
    setStatus(`✓ ${t("Order")} #${data} — ${t("We will call you to confirm.")}`); clear(); setF({ name: "", phone: "", address: "" });
  };
  const lbl = "block text-sm font-semibold";
  return (<>
    <div aria-hidden="true" onClick={close} className={`fixed inset-0 z-[9400] bg-black/40 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
    <aside role="dialog" aria-modal="true" aria-label={t("Your Cart")} className={`fixed right-0 top-0 z-[9500] h-full w-96 max-w-full overflow-y-auto bg-bg p-6 shadow-2xl transition-transform duration-300 ${open ? "" : "translate-x-full"}`} aria-hidden={!open} data-lenis-prevent {...(!open ? { inert: "" } : {})}>
      <div className="mb-6 flex items-center justify-between"><h3 className="text-xl font-bold">{t("Your Cart")}</h3><button onClick={close} aria-label={t("Close")}><X /></button></div>
      {cart.length === 0 ? <p className="text-muted">{status || t("Your cart is empty.")}</p> : <>
        <ul className="space-y-4">{cart.map((i) => <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0"><span className="block font-semibold">{pname(i)}</span><span className="text-muted">{i.size} · ৳{i.price.toLocaleString()}</span></span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="flex items-center rounded-full border border-gold/50">
              <button type="button" onClick={() => qty(i.id, -1)} aria-label={t("Decrease")} className="grid h-9 w-9 place-items-center"><Minus size={14} /></button>
              <span className="w-6 text-center font-bold" aria-live="polite">{i.qty}</span>
              <button type="button" onClick={() => qty(i.id, 1)} aria-label={t("Increase")} className="grid h-9 w-9 place-items-center"><Plus size={14} /></button>
            </span>
            <b className="w-16 text-right">৳{(i.price * i.qty).toLocaleString()}</b>
            <button type="button" onClick={() => qty(i.id, -i.qty)} aria-label={`${t("Remove")} ${pname(i)}`} className="text-muted hover:text-red-600"><Trash2 size={16} /></button>
          </span></li>)}</ul>
        <p className="mt-6 flex justify-between border-t border-gold/30 pt-4 font-bold"><span>{t("Total")}</span><span className="text-gold">৳{total.toLocaleString()}</span></p>
        <form onSubmit={checkout} className="mt-5 space-y-3" noValidate>
          <label className={lbl}>{t("Customer name")}<input className="field mt-1" autoComplete="name" value={f.name} onChange={set("name")} /></label>
          <label className={lbl}>{t("Phone number")}<input className="field mt-1" type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={f.phone} onChange={set("phone")} /></label>
          <label className={lbl}>{t("Delivery address")}<textarea className="field mt-1" autoComplete="street-address" value={f.address} onChange={set("address")} /></label>
          {canDrop && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={drop} onChange={(e) => setDrop(e.target.checked)} />{t("Dropship order (I earn commission)")}</label>}
          {status && <p role="alert" className="text-sm text-gold">{status}</p>}
          <button className="btn w-full justify-center" disabled={busy}>{busy ? t("Please wait…") : t("Place Order (Cash on Delivery)")}</button>
        </form>
        <button onClick={clear} className="mt-3 w-full text-sm text-muted underline">{t("Clear cart")}</button></>}
    </aside>
  </>);
}

/* ============================ APP ROOT ============================ */
export default function App() {
  const path = useRoute(), showTop = useScrollFlag(500);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("bonadi-theme") || "light"; } catch { return "light"; } });
  const [loaded, setLoaded] = useState(false);
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem("bonadi-cart")) || []; } catch { return []; } }), [cartOpen, setCartOpen] = useState(false);
  useEffect(() => { try { localStorage.setItem("bonadi-cart", JSON.stringify(cart)); } catch {} }, [cart]);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0), closeCart = useCallback(() => setCartOpen(false), []);
  const [lang, setL] = useState(getLang());                                   // Bangla is the default language
  const toggleLang = () => { const n = lang === "bn" ? "en" : "bn"; setLang(n); setL(n); };   // App re-renders => every t() call re-evaluates
  useEffect(() => {   // per-page browser tab titles (SEO + usability)
    const m = { "/": "BONADI — Pure Food, Honest Promise", "/shop": "Shop — BONADI", "/about": "About — BONADI", "/contact": "Contact — BONADI", "/track": "Track your order — BONADI", "/recipes": "Recipes — BONADI", "/login": "Account — BONADI", "/account": "My account — BONADI", "/admin": "Admin — BONADI" };
    if (path !== "/store") document.title = m[path] || (path.startsWith("/policy/") ? "Policy — BONADI" : "BONADI");
  }, [path]);
  // Products come from Supabase; local PRODUCTS is the fallback if backend is not configured
  const [products, setProducts] = useState(() => { try { return JSON.parse(sessionStorage.getItem("bonadi-products")) || []; } catch { return []; } });  // instant repaint from cache
  const [usingSavedProducts, setUsingSavedProducts] = useState(false);
  const [user, setUser] = useState(null), [profile, setProfile] = useState(null);
  const loadProfile = useCallback(async (u) => { if (!u) return setProfile(null); const { data } = await (await db()).from("profiles").select("*").eq("id", u.id).single(); setProfile(data); }, []);
  // Auth session (profile fetch deferred with setTimeout to avoid auth-callback deadlocks)
  useEffect(() => {
    let subscription, off = false;   // the SDK loads after first paint; the session is restored as soon as it arrives
    db().then((sb) => { if (off) return;
    sb.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); loadProfile(data.session?.user); });
    ({ data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => { if (_e === "PASSWORD_RECOVERY") { sessionStorage.setItem("bonadi-recovery", "1"); setTimeout(() => { window.location.hash = "#/account"; }, 0); } setUser(s?.user || null); setTimeout(() => loadProfile(s?.user), 0); }));
    });
    return () => { off = true; subscription?.unsubscribe(); };
  }, [loadProfile]);
  // Referral capture: ?ref=CODE is remembered and attached to the order / signup
  useEffect(() => { captureRef(); }, []);
  // Start downloading the 3D store as soon as someone points at / touches a link to it, so it opens faster
  useEffect(() => {
    let done = false;
    const pre = (e) => { if (!done && e.target.closest?.('a[href="#/store"]')) { done = true; import("./Store3D.jsx"); } };
    document.addEventListener("pointerover", pre, { passive: true }); document.addEventListener("touchstart", pre, { passive: true });
    return () => { document.removeEventListener("pointerover", pre); document.removeEventListener("touchstart", pre); };
  }, []);
  useEffect(() => {
    fetchProducts().then(({ data, isFallback }) => {
      if (!data) return;
      setProducts(data);
      setUsingSavedProducts(isFallback && data.length > 0);
      try { sessionStorage.setItem("bonadi-products", JSON.stringify(data)); } catch {}
      // A saved cart keeps the price from when it was added — refresh it so the total shown matches what the server will charge
      if (!isFallback) setCart((c) => c.map((i) => { const p = data.find((x) => x.id === i.id); return p ? { ...i, name: p.name, name_bn: p.name_bn, size: p.size, price: p.price } : i; }));
    });
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem("bonadi-theme", theme); } catch {} }, [theme]);
  useEffect(() => { const t = requestAnimationFrame(() => setLoaded(true)); return () => cancelAnimationFrame(t); }, []);
  useReveal();

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

  const add = useCallback((p, quiet) => { setCart((c) => c.find((i) => i.id === p.id) ? c.map((i) => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...c, { ...p, qty: 1 }]); if (!quiet) setCartOpen(true); }, []);
  const L = (el) => <Suspense fallback={<div className="pt-40 text-center">{t("Loading…")}</div>}>{el}</Suspense>;
  const page = path === "/shop" ? <Shop onAdd={add} products={products} /> : path === "/about" ? <About /> : path === "/contact" ? <Contact />
    : path === "/track" ? <Track /> : path === "/recipes" ? <Recipes /> : path.startsWith("/policy/") ? <Policy slug={path.slice(8)} />
    : path === "/login" ? L(<AuthPage />) : path === "/account" ? L(<Account user={user} profile={profile} reload={() => loadProfile(user)} />)
    : path === "/admin" ? L(<Admin profile={profile} />)
    : path === "/" || !path.startsWith("/") ? <Home onAdd={add} products={products} />      // a non-"/" hash is an auth-redirect token, not a page
    : <NotFound />;

  if (path === "/store") return L(<Store3D products={products} cart={cart} onAdd={add} setCart={setCart} clear={() => setCart([])} profile={profile} />);

  return (<div className="bonadi-site" data-theme={theme}>
    <ScrollProgress />
    <RouteCurtain path={path} />
    <Cursor />
    <div aria-hidden="true" className="grain" />
    <Nav lang={lang} onLang={toggleLang} user={user} profile={profile} path={path} theme={theme} setTheme={setTheme} cartCount={cartCount} openCart={() => setCartOpen(true)} />
    <main>
      {usingSavedProducts && <div role="status" className="mx-auto mt-4 max-w-6xl rounded-xl border border-gold/50 bg-card px-4 py-3 text-sm">{t("Showing the saved product list. Live prices could not be loaded — the final price is confirmed when you order.")}</div>}
      {page}
    </main>
    <Footer />
    <BottomBar path={path} cartCount={cartCount} openCart={() => setCartOpen(true)} />
    <a href={`https://wa.me/${SITE.tel.replace("+", "")}`} target="_blank" rel="noreferrer" aria-label={t("Chat on WhatsApp")} className="fixed bottom-20 right-5 z-40 hidden h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-lg md:grid"><MessageCircle size={24} /></a>
    <CartDrawer profile={profile} open={cartOpen} close={closeCart} cart={cart} setCart={setCart} clear={() => setCart([])} />
    {/* Back to top */}
    <button aria-label={t("Back to top")} onClick={() => (window.__lenis ? window.__lenis.scrollTo(0) : window.scrollTo({ top: 0, behavior: "smooth" }))}
      className={`fixed bottom-5 right-5 z-40 hidden h-12 w-12 md:grid place-items-center rounded-full bg-gold text-ink shadow-lg transition-all ${showTop ? "opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}><ArrowUp /></button>
  </div>);
}
