/**
 * Motion layer for the storefront (Awwwards-style): intro loader, word-by-word text reveals, route curtain,
 * scroll progress, follower cursor + magnetic buttons, scroll-lit manifesto and a pinned horizontal section.
 * Everything is DOM-driven (refs + rAF), so scrolling never re-renders React, and everything switches off
 * for visitors who ask for reduced motion.
 */
import React, { useEffect, useRef, useState } from "react";

const mq = (q) => typeof window !== "undefined" && window.matchMedia(q).matches;
export const REDUCED = mq("(prefers-reduced-motion: reduce)");
const FINE = mq("(pointer: fine)");

/** Runs `fn` at most once per frame on scroll and resize. Returns the cleanup. */
const onScrollFrame = (fn) => {
  let raf = 0;
  const on = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; fn(); }); };
  fn(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
  return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
};

/**
 * Text that slides up word by word (or letter by letter with `chars`) when it scrolls into view.
 * Splits on spaces only, so Bangla conjuncts are never broken. Screen readers get the plain text.
 */
export function SplitText({ text = "", chars = false, className = "", inner = "", delay = 0 }) {
  const parts = chars ? [...String(text)] : String(text).split(" ");
  return (
    <span className={`split ${className}`} style={{ "--d": `${delay}ms` }}>
      <span className="sr-only">{text}</span>
      {parts.map((w, i) => <React.Fragment key={i}><span className="sw" aria-hidden="true"><span className={`sw-i ${inner}`} style={{ "--i": i }}>{w}</span></span>{!chars && i < parts.length - 1 ? " " : null}</React.Fragment>)}
    </span>
  );
}

/** First-visit intro: counter 0 → 100 over the brand surface, then the panel lifts away. Once per browser session. */
export function Loader({ tagline }) {
  const [show, setShow] = useState(() => { if (REDUCED) return false; try { return !sessionStorage.getItem("bonadi-intro"); } catch { return false; } });
  const [out, setOut] = useState(false), num = useRef(null), bar = useRef(null);
  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem("bonadi-intro", "1"); } catch { /* private mode */ }
    document.documentElement.classList.add("intro");            // holds the hero entrance until the panel lifts
    const t0 = performance.now(), dur = 1150; let raf, t1, t2;
    const step = (now) => {
      const k = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
      if (num.current) num.current.textContent = Math.round(e * 100);
      if (bar.current) bar.current.style.transform = `scaleX(${e})`;
      if (k < 1) raf = requestAnimationFrame(step);
      else { t1 = setTimeout(() => { setOut(true); document.documentElement.classList.remove("intro"); }, 150); t2 = setTimeout(() => setShow(false), 1150); }
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); document.documentElement.classList.remove("intro"); };
  }, [show]);
  if (!show) return null;
  return (
    <div aria-hidden="true" className={`loader hero-bg fixed inset-0 z-[10000] flex flex-col justify-between p-6 text-white md:p-10 ${out ? "loader-out" : ""}`}>
      <span className="w-fit rounded-full bg-white px-4 py-2"><img src="/logo.png" alt="" className="h-8 w-auto" /></span>
      <div className="flex items-end justify-between gap-6">
        <span className="font-display text-[28vw] leading-[.8] md:text-[16vw]"><span ref={num}>0</span><span className="text-gold">%</span></span>
        <span className="hidden max-w-xs pb-4 text-right text-white/70 md:block">{tagline}</span>
      </div>
      <span ref={bar} className="absolute bottom-0 left-0 h-1 w-full origin-left bg-gold" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}

/** Brand-green curtain that wipes upward on every page change. */
export function RouteCurtain({ path }) {
  const first = useRef(true), [k, setK] = useState(0);
  useEffect(() => { if (first.current) { first.current = false; return; } if (!REDUCED) setK((x) => x + 1); }, [path]);
  return k ? <div key={k} aria-hidden="true" className="curtain"><span className="curtain-edge" /></div> : null;
}

/** Thin gold bar at the very top showing how far down the page you are. */
export function ScrollProgress() {
  const r = useRef(null);
  useEffect(() => onScrollFrame(() => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    if (r.current) r.current.style.transform = `scaleX(${h > 0 ? Math.min(window.scrollY / h, 1) : 0})`;
  }), []);
  return <div ref={r} aria-hidden="true" className="fixed left-0 top-0 z-[70] h-[3px] w-full origin-left bg-gold" style={{ transform: "scaleX(0)" }} />;
}

/**
 * Follower cursor (mouse only). Grows over links/buttons and shows a label over elements with data-cursor="…".
 * Also makes every .btn magnetic: it leans toward the pointer. The normal system cursor stays visible.
 */
export function Cursor() {
  const dot = useRef(null), ring = useRef(null), label = useRef(null);
  useEffect(() => {
    if (!FINE || REDUCED) return;
    let x = -100, y = -100, rx = x, ry = y, raf, mag = null;
    const release = () => { if (mag) { mag.style.removeProperty("--bx"); mag.style.removeProperty("--by"); mag = null; } };
    const move = (e) => {
      x = e.clientX; y = e.clientY; dot.current.style.transform = `translate(${x}px,${y}px)`;
      if (mag) { const r = mag.getBoundingClientRect(); mag.style.setProperty("--bx", `${(x - r.left - r.width / 2) * 0.22}px`); mag.style.setProperty("--by", `${(y - r.top - r.height / 2) * 0.3}px`); }
    };
    const over = (e) => {
      const el = e.target.closest?.("[data-cursor],a,button,input,textarea,select,summary,label");
      const lab = e.target.closest?.("[data-cursor]")?.dataset.cursor;
      ring.current.dataset.state = lab ? "label" : el ? "hot" : ""; label.current.textContent = lab || "";
      const b = e.target.closest?.(".btn"); if (b !== mag) { release(); mag = b; }
    };
    const loop = () => { rx += (x - rx) * 0.18; ry += (y - ry) * 0.18; ring.current.style.transform = `translate(${rx}px,${ry}px)`; raf = requestAnimationFrame(loop); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseover", over); raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseover", over); cancelAnimationFrame(raf); release(); };
  }, []);
  if (!FINE || REDUCED) return null;
  return <><div ref={dot} className="c-dot" aria-hidden="true" /><div ref={ring} className="c-ring" aria-hidden="true"><span ref={label} /></div></>;
}

/** Big statement whose words light up one by one while the section is pinned on screen. */
export function Manifesto({ text, eyebrow }) {
  const box = useRef(null), words = String(text).split(" ");
  useEffect(() => {
    const ws = box.current.querySelectorAll(".mw");
    if (REDUCED) { ws.forEach((w) => (w.style.opacity = 1)); return; }
    return onScrollFrame(() => {
      const r = box.current.getBoundingClientRect(), p = Math.min(Math.max(-r.top / (r.height - window.innerHeight), 0), 1), lit = p * ws.length * 1.15;
      ws.forEach((w, i) => { w.style.opacity = 0.14 + Math.min(Math.max(lit - i, 0), 1) * 0.86; });
    });
  }, [text]);
  return (
    <div ref={box} role="region" aria-label={eyebrow} className="relative h-[230vh]">
      <div className="sticky top-0 flex h-[100svh] items-center">
        <div className="mx-auto max-w-5xl px-5">
          <span className="eyebrow">{eyebrow}</span>
          <p className="mt-6 font-display text-[2rem] leading-[1.3] md:text-6xl md:leading-[1.18]">{words.map((w, i) => <span key={i} className="mw" style={{ opacity: 0.14 }}>{w} </span>)}</p>
        </div>
      </div>
    </div>
  );
}

/** On wide screens the section pins and its cards slide sideways as you scroll down; on phones it is a normal list. */
export function HScroll({ children, cursor }) {
  const outer = useRef(null), track = useRef(null);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)");
    let dist = 0;
    const run = () => {
      if (!outer.current?.dataset.pin) return;
      const r = outer.current.getBoundingClientRect(), p = Math.min(Math.max(-r.top / (r.height - window.innerHeight), 0), 1);
      track.current.style.transform = `translate3d(${-p * dist}px,0,0)`;
    };
    const size = () => {
      const on = wide.matches && !REDUCED;
      outer.current.dataset.pin = on ? "1" : "";
      if (!on) { outer.current.style.height = ""; track.current.style.transform = ""; return; }
      dist = Math.max(track.current.scrollWidth - window.innerWidth, 0);
      outer.current.style.height = `${dist + window.innerHeight}px`; run();
    };
    size(); document.fonts?.ready.then(size);
    const stop = onScrollFrame(run);
    window.addEventListener("resize", size); wide.addEventListener("change", size);
    return () => { stop(); window.removeEventListener("resize", size); wide.removeEventListener("change", size); };
  }, []);
  return <div ref={outer} className="hscroll relative"><div className="hscroll-sticky" data-cursor={cursor}><div ref={track} className="hscroll-track">{children}</div></div></div>;
}
