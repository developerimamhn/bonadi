/**
 * Hero — first screen of the home page.
 * UX rules applied: (1) value proposition + one primary CTA visible without scrolling (also on phones),
 * (2) REAL product photos with a visible price (trust), (3) trust cues under the CTA, (4) strong contrast (white/gold on charcoal),
 * (5) subtle motion only (CSS), respects prefers-reduced-motion, no layout shift (fixed image sizes), (6) LCP image preloaded, no heavy 3D on first paint.
 */
import React, { useEffect, useRef } from "react";
import { t, pname } from "./i18n.js";
import { ArrowRight, Store, ShieldCheck, Truck, Banknote, MapPin, ChevronDown, RotateCcw } from "lucide-react";

// Real BONADI bottle cut-outs (public/products). x = left position %, h = height % of the stage, d = parallax depth
const BOTTLES = [
  { k: "250", w: 329, alt: "BONADI Pure Cow Ghee 250 g", x: 0, h: 58, d: 10, r: -5, z: 1, delay: "0s" },
  { k: "500", w: 365, alt: "BONADI Pure Cow Ghee 500 g", x: 27, h: 76, d: 18, r: 0, z: 3, delay: ".8s" },
  { k: "1000", w: 348, alt: "BONADI Pure Cow Ghee 1 kg", x: 60, h: 90, d: 26, r: 4, z: 2, delay: "1.6s" },
];
const SPARKS = [[8, 20], [18, 70], [30, 38], [44, 14], [52, 82], [64, 30], [74, 60], [86, 18], [92, 74], [12, 48], [58, 52], [80, 40], [36, 88], [70, 10]];
const TRUST = [[ShieldCheck, "100% Natural"], [Truck, "Free delivery"], [Banknote, "Cash on Delivery"], [RotateCcw, "7-day return"]];

export default function Hero({ products = [] }) {
  const root = useRef(null), stage = useRef(null);
  const ghee = products.find((p) => /ghee/i.test(p.name) && p.status === "active" && /500/.test(p.size || ""));

  // Mouse parallax: writes CSS variables directly (no React re-render)
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)").matches) return;
    let raf; const el = stage.current;
    const move = (e) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { el.style.setProperty("--mx", (e.clientX / innerWidth - 0.5).toFixed(3)); el.style.setProperty("--my", (e.clientY / innerHeight - 0.5).toFixed(3)); }); };
    const sec = root.current; sec.addEventListener("pointermove", move); return () => { sec.removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, []);

  const down = (e) => { e.preventDefault(); window.__lenis ? window.__lenis.scrollTo("#why", { offset: -70 }) : document.getElementById("why")?.scrollIntoView({ behavior: "smooth" }); };

  return (
    <header ref={root} className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-brand text-white"
      style={{ backgroundImage: "radial-gradient(900px 520px at 78% 38%, rgba(225,161,62,.30), transparent 62%), radial-gradient(700px 400px at 8% 90%, rgba(248,238,207,.10), transparent 60%), linear-gradient(135deg,#4a6632,#2d3f1d)" }}>
      {SPARKS.map(([x, y], i) => <span key={i} aria-hidden="true" className="absolute -z-10 h-1.5 w-1.5 rounded-full bg-gold" style={{ left: x + "%", top: y + "%", animation: `twinkle ${3 + (i % 4)}s ease-in-out ${i * 0.35}s infinite` }} />)}

      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-24 pt-28 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pt-24">
        {/* ---- Copy ---- */}
        <div>
          <p className="hero-in inline-flex items-center gap-2 rounded-full border border-gold/40 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[.18em] text-gold">
            <MapPin size={14} />{t("Satkhira · Bangladesh")}</p>
          <h1 className="hero-in mt-5 font-display text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl" style={{ animationDelay: ".1s" }}>
            {t("Pure Food,")}<br /><span className="bg-gradient-to-r from-[#f6dd93] via-gold to-[#b98a25] bg-clip-text text-transparent">{t("Honest Promise.")}</span></h1>
          <p className="hero-in mt-5 max-w-lg text-lg leading-relaxed text-white/80" style={{ animationDelay: ".2s" }}>
            {t("Authentic gawa ghee, natural honey and more — made with care and delivered to your door.")}</p>
          <div className="hero-in mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: ".3s" }}>
            <a href="#/shop" className="btn !px-8 !py-4 text-base">{t("Shop Now")} <ArrowRight size={18} /></a>
            <a href="#/store" className="btn btn-ghost !px-6 !py-4 text-base !text-white"><Store size={18} />{t("Try the 3D Store")}</a>
          </div>
          <ul className="hero-in mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/80" style={{ animationDelay: ".4s" }}>
            {TRUST.map(([Icon, ti]) => <li key={ti} className="flex items-center gap-2"><Icon size={18} className="text-gold" />{t(ti)}</li>)}
          </ul>
        </div>

        {/* ---- Product stage ---- */}
        <div ref={stage} className="hero-in relative mx-auto aspect-[4/3.4] w-full max-w-[560px]" style={{ animationDelay: ".25s", "--mx": 0, "--my": 0 }}>
          <div aria-hidden="true" className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle_at_50%_55%,rgba(225,161,62,.55),transparent_64%)] blur-2xl" />
          <div aria-hidden="true" className="absolute inset-[3%] rounded-full border border-dashed border-gold/30" style={{ animation: "spin-slow 60s linear infinite" }} />
          {[["-left-2 top-[8%]", "-rotate-12", "0s"], ["right-0 top-[2%]", "rotate-45", "1.2s"]].map(([pos, rot, d], i) =>
            <svg key={i} aria-hidden="true" viewBox="0 0 64 64" className={`absolute h-14 w-14 ${pos} ${rot}`} style={{ animation: `sway 7s ease-in-out ${d} infinite` }}><path d="M8 56C8 26 30 8 58 6c0 28-18 50-50 50z" fill="#4f6b2a" opacity=".85" /><path d="M10 54C24 36 38 24 56 8" stroke="#a9c27a" strokeWidth="2" fill="none" /></svg>)}
          {BOTTLES.map((b) => (
            <div key={b.k} className="absolute bottom-[3%]" style={{ left: b.x + "%", height: b.h + "%", zIndex: b.z, transform: `translate3d(calc(var(--mx) * ${b.d}px), calc(var(--my) * ${b.d * 0.6}px), 0) rotate(${b.r}deg)`, transition: "transform .25s ease-out" }}>
              <img src={`/products/ghee-${b.k}.webp`} alt={b.alt} width={b.w} height="700" decoding="async" fetchpriority={b.k === "500" ? "high" : "auto"} loading={b.k === "500" ? "eager" : "lazy"}
                className="float h-full w-auto drop-shadow-[0_28px_28px_rgba(0,0,0,.5)]" style={{ animationDelay: b.delay }} />
            </div>))}
          {ghee && <a href="#/shop" className="absolute right-0 top-[44%] z-10 rounded-2xl border border-white/15 bg-black/45 px-4 py-2.5 text-sm shadow-xl backdrop-blur transition hover:scale-105" style={{ zIndex: 5 }}>
            <span className="block text-xs text-white/70">{pname(ghee)} · {ghee.size}</span><b className="text-lg text-gold">৳{ghee.price.toLocaleString()}</b></a>}
        </div>
      </div>

      <a href="#why" onClick={down} aria-label="Scroll to learn why Bonadi" className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white/70"><ChevronDown size={28} style={{ animation: "cue 1.8s ease-in-out infinite" }} /></a>
      <svg aria-hidden="true" viewBox="0 0 1440 80" preserveAspectRatio="none" className="absolute -bottom-px left-0 h-14 w-full fill-bg"><path d="M0,44 C240,90 480,0 720,32 C960,64 1200,14 1440,52 L1440,80 L0,80Z" /></svg>
    </header>
  );
}
