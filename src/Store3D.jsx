/**
 * Store3D — OPTIONAL first-person 3D store (route #/store). Lazy-loaded and isolated from the normal shop.
 * Real data: products from Supabase; the trolley IS the site cart (same state as the cart drawer);
 * checkout calls the same place_order() RPC (server re-prices everything).
 * Controls: WASD/arrows + mouse, click = product details, E = quick add / interact, 1-4 = jump to an aisle, C = trolley, Esc = menu.
 * Touch: joystick, drag to look, tap a product for details, aisle buttons to jump.
 * UX choices: one-tap aisle jumps (less steering), a details card before adding (no accidental adds, sizes compared by
 * honest price per 100 g), a non-blocking coach that advances when you do the step, and risk-reversal facts
 * (cash on delivery, free delivery, 7-day return) at the moments people hesitate. No fake urgency or reviews.
 * Everything is built from primitives + canvas textures (no external models) so it loads fast. Bottle labels use the real BONADI artwork.
 */
import React, { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { X, ShoppingBasket, Plus, Minus, Trash2, Check, Home, Menu, Navigation, Footprints, MousePointerClick, Banknote, Truck, RotateCcw, Copy, PhoneCall, PackageCheck, ArrowRight } from "lucide-react";
import { submitOrder, validOrder } from "./lib/order.js";
import { t, pname } from "./i18n.js";

const TOUCH = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
const LITE = TOUCH || (typeof window !== "undefined" && window.innerWidth < 768);   // lighter rendering on phones
const Y = new THREE.Vector3(0, 1, 0);
const LOGO_ASPECT = 0.3611;
const GOLD = "#d4a843", BROWN = "#4a2a0e", GREEN = "#4f6b2a", FOREST = "#2f4421", WALNUT = "#6b4426";

/* ---------- Layout (metres). Player spawns inside the entrance, facing the aisles and checkout ---------- */
// order: [L-3.6, R-3.6, L0, R0, L3.6, R3.6, gondola1 A, gondola1 B, gondola2 A, gondola2 B]
const UNITS = (() => {
  const u = [];
  [-3.6, 0, 3.6].forEach((z) => { u.push({ x: -7.55, z, rot: Math.PI / 2, len: 3.4 }); u.push({ x: 7.55, z, rot: -Math.PI / 2, len: 3.4 }); });
  [-3, 3].forEach((xg) => { u.push({ x: xg + 0.38, z: 0, rot: Math.PI / 2, len: 4.6 }); u.push({ x: xg - 0.38, z: 0, rot: -Math.PI / 2, len: 4.6 }); });
  return u;
})();
const CAT_OF_UNIT = ["ghee", "honey", "ghee", "honey", "honey", "ghee", "ghee", "honey", "oil", "oil"];
const CAT_SIGN = { ghee: "খাঁটি গাওয়া ঘি  ·  PURE GHEE", honey: "প্রাকৃতিক মধু  ·  NATURAL HONEY", oil: "সরিষার তেল  ·  শীঘ্রই আসছে", other: "BONADI" };
const COUNTER = { x: 0, z: -8.6 }, DISPLAY = { x: 0, z: -4.8 };
const BLOCKS = [...UNITS.map((u) => [u.x, u.z, 0.4, u.len / 2]), [COUNTER.x, COUNTER.z, 2.1, 0.75], [DISPLAY.x, DISPLAY.z, 1.45, 1.45],
  [5.9, 9.7, 1.1, 0.5], [-5.5, 9.7, 0.35, 0.35], [-7.1, 10.2, 0.35, 0.35], [7.1, -10.2, 0.35, 0.35], [-7.1, -10.2, 0.35, 0.35], [-5.2, 6.4, 0.6, 0.35], [5.2, 6.4, 0.6, 0.35]];
const ROWS = [0.12, 0.8, 1.48];
/** One-tap jump points: [x, z, yaw, pitch]. Each stands in a free aisle, facing the shelf or counter. */
// Shelf spots stand ~2.2 m back and aim at a middle-row jar (z = 0.2 is a jar, z = 0 a gap; the top row is skipped on phones).
const SPOTS = { ghee: [-5.0, 0.2, Math.PI / 2, -0.25], honey: [5.0, 0.2, -Math.PI / 2, -0.25], display: [0, -1.9, 0, -0.28], counter: [2.3, -6.3, Math.PI / 4, -0.15] };   // counter: seen at an angle, within the 3.4 m "near" radius

/* ---------- helpers ---------- */
const catOf = (p) => (/honey|modhu|মধু/i.test(p.name) ? "honey" : /oil|tel|তেল/i.test(p.name) ? "oil" : /ghee|ghi|ঘি/i.test(p.name) ? "ghee" : "other");
const contentColor = (p) => ({ honey: "#d9901a", oil: "#b8a636", ghee: "#e8b84b", other: "#e3b64f" }[catOf(p)]);
/** Bottle scale from the size text (cube-root of volume), so 250 g / 500 g / 1 kg look different */
function sizeScale(p) { const m = /([\d.]+)\s*(kg|g|l|ml)/i.exec(p.size || ""); if (!m) return 1; const v = +m[1] * (/^(kg|l)$/i.test(m[2]) ? 1000 : 1); return Math.max(0.72, Math.min(1.3, Math.cbrt(v / 500))); }
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
const mkTex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const money = (n) => "৳" + Number(n || 0).toLocaleString();
const phoneOk = (v) => /^(\+?88)?01[3-9]\d{8}$/.test(v.replace(/[\s-]/g, ""));

/** Printed label wrapped around the bottle: real logo, product name, weight. Only verified data is drawn. */
function labelTexture(p, logo, soon) {
  const c = document.createElement("canvas"); c.width = 660; c.height = 400; const g = c.getContext("2d");
  g.fillStyle = "#f7f0df"; g.fillRect(0, 0, 660, 400);
  g.strokeStyle = GOLD; g.lineWidth = 6; g.strokeRect(14, 14, 632, 372);
  if (logo) { const w = 400, h = w * (logo.height / logo.width); g.drawImage(logo, (660 - w) / 2, 34, w, h); }
  g.textAlign = "center"; g.fillStyle = BROWN; g.font = "bold 40px Georgia, serif";
  g.fillText(p.name.replace(/\(.*\)/, "").trim().toUpperCase(), 330, 215);
  if (catOf(p) === "ghee") { g.font = '700 38px "Noto Sans Bengali", sans-serif'; g.fillStyle = GREEN; g.fillText("খাঁটি গাওয়া ঘি", 330, 268); }
  g.fillStyle = BROWN; g.font = "bold 44px Arial"; g.fillText(p.size ? "NET WT " + p.size.toUpperCase() : "", 330, 345);
  if (soon) { g.fillStyle = "rgba(255,255,255,.75)"; g.fillRect(14, 150, 632, 80); g.fillStyle = "#555"; g.font = "bold 46px Arial"; g.fillText("COMING SOON", 330, 206); }
  return mkTex(c);
}
/** Shelf-edge price tag: dark card, gold rule, big price (prices are easier to read than on a white sticker). */
function tagTexture(p, soon) {
  const c = document.createElement("canvas"); c.width = 340; c.height = 100; const g = c.getContext("2d");
  g.fillStyle = "#1f170e"; g.fillRect(0, 0, 340, 100); g.fillStyle = GOLD; g.fillRect(0, 0, 340, 6);
  g.fillStyle = "#f4ead3"; g.textAlign = "left"; g.font = "bold 24px Arial"; g.fillText(p.name.replace(/\(.*\)/, "").trim().slice(0, 20), 12, 44); g.font = "22px Arial"; g.fillStyle = "#bfae8c"; g.fillText(p.size || "", 12, 80);
  g.textAlign = "right"; g.font = "bold 46px Arial"; g.fillStyle = soon ? "#8d857a" : "#f1c25a"; g.fillText(soon ? "Soon" : "৳" + p.price, 328, 84);
  return mkTex(c);
}
function signTexture(text, w, h, bg, fg, size = 90, font = 'Georgia, "Noto Sans Bengali", serif') {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
  let s = size; g.font = `bold ${s}px ${font}`; while (g.measureText(text).width > w * 0.9 && s > 14) { s -= 2; g.font = `bold ${s}px ${font}`; }   // shrink to fit
  g.fillText(text, w / 2, h / 2 + 4); return mkTex(c);
}
const useSign = (...a) => useMemo(() => signTexture(...a), [a.join("|")]);   // eslint-disable-line

/** Honey-oak plank floor with staggered joints and soft grain. */
function floorTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
  const tones = ["#a8774a", "#9b6c41", "#b38152", "#a2723f", "#8f6239"], rowH = 48;
  for (let r = 0, y = 0; y < 512; r++, y += rowH) {
    let x = -((r * 173) % 256);
    while (x < 512) {
      const w = 200 + ((r * 37 + Math.abs(x)) % 3) * 56;
      g.fillStyle = tones[(r * 7 + Math.abs(x)) % tones.length]; g.fillRect(x, y, w, rowH);
      g.strokeStyle = "rgba(255,240,215,.07)"; g.lineWidth = 1.5;
      for (let k = 0; k < 5; k++) { const gy = y + 6 + k * 9; g.beginPath(); g.moveTo(x, gy); g.bezierCurveTo(x + w * 0.3, gy + 3, x + w * 0.6, gy - 3, x + w, gy); g.stroke(); }
      g.fillStyle = "rgba(40,22,8,.32)"; g.fillRect(x, y, 2, rowH); x += w;
    }
    g.fillStyle = "rgba(40,22,8,.28)"; g.fillRect(0, y, 512, 2);
  }
  const t = mkTex(c); t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 9.5); return t;
}
/** Shared light textures (made once): a vertical wash for shelf back panels and a round pool for the floor. */
let WASH, POOL;
const wash = () => { if (!WASH) { const c = document.createElement("canvas"); c.width = 8; c.height = 128; const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, "rgba(255,214,150,.75)"); gr.addColorStop(0.45, "rgba(255,196,120,.22)"); gr.addColorStop(1, "rgba(255,196,120,0)"); g.fillStyle = gr; g.fillRect(0, 0, 8, 128); WASH = mkTex(c); } return WASH; };
const pool = () => { if (!POOL) { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,214,140,.5)"); gr.addColorStop(1, "rgba(255,214,140,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); POOL = mkTex(c); } return POOL; };
const LightPool = ({ x, z, r }) => <mesh position={[x, 0.006, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[r * 2, r * 2]} /><meshBasicMaterial map={pool()} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>;

/** End-cap poster at the front of a gondola: brand green, gold frame, real jar photo for ghee. */
function posterTexture(kind, logo, jar) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 1024; const g = c.getContext("2d"), soon = kind === "oil";
  const bg = g.createLinearGradient(0, 0, 0, 1024); bg.addColorStop(0, soon ? "#5d5a52" : "#4a6532"); bg.addColorStop(1, soon ? "#36342f" : "#22321a");
  g.fillStyle = bg; g.fillRect(0, 0, 512, 1024);
  g.strokeStyle = GOLD; g.lineWidth = 6; g.strokeRect(22, 22, 468, 980); g.lineWidth = 2; g.strokeRect(36, 36, 440, 952);
  if (logo) { g.fillStyle = "#fffaf0"; g.beginPath(); g.roundRect ? g.roundRect(106, 72, 300, 106, 53) : g.rect(106, 72, 300, 106); g.fill(); const w = 236, h = w * (logo.height / logo.width); g.drawImage(logo, 256 - w / 2, 125 - h / 2, w, h); }
  const halo = g.createRadialGradient(256, 480, 10, 256, 480, 230); halo.addColorStop(0, soon ? "rgba(255,255,255,.12)" : "rgba(255,206,120,.55)"); halo.addColorStop(1, "rgba(255,206,120,0)");
  g.fillStyle = halo; g.fillRect(0, 230, 512, 500);
  if (!soon && jar) { const h = 460, w = h * (jar.width / jar.height); g.drawImage(jar, 256 - w / 2, 236, w, h); }
  else { g.strokeStyle = soon ? "#bdb6a6" : GOLD; g.lineWidth = 5; g.beginPath(); g.arc(256, 470, 150, 0, Math.PI * 2); g.stroke();
    g.fillStyle = soon ? "#d8d1bf" : GOLD; g.beginPath(); g.moveTo(256, 360); g.bezierCurveTo(330, 450, 340, 520, 256, 570); g.bezierCurveTo(172, 520, 182, 450, 256, 360); g.fill(); }
  const [title, en, foot] = { ghee: ["খাঁটি গাওয়া ঘি", "PURE COW GHEE", "সাতক্ষীরা, কালিগঞ্জ থেকে"], honey: ["প্রাকৃতিক মধু", "NATURAL HONEY", "BONADI"], oil: ["সরিষার তেল", "MUSTARD OIL", "শীঘ্রই আসছে"] }[kind];
  g.textAlign = "center"; g.fillStyle = soon ? "#e6e0d2" : "#f1c25a"; g.font = '700 66px "Noto Sans Bengali", sans-serif'; g.fillText(title, 256, 800);
  g.fillStyle = "#f6ecd6"; g.font = "600 30px Georgia, serif"; g.fillText(en, 256, 856);
  g.fillStyle = GOLD; g.fillRect(206, 890, 100, 3);
  g.fillStyle = "rgba(246,236,214,.85)"; g.font = '500 30px "Noto Sans Bengali", sans-serif'; g.fillText(foot, 256, 948);
  return mkTex(c);
}

/* ---------- Jar kit ----------
 * Ghee: built from YOUR bottle photos. public/products/wrap-{250,500,1000}.webp are the real bottle artwork unwrapped onto a cylinder,
 * ghee-meta.json holds the measured proportions (body/neck/cap), so shape, gold cap, colours and label match the supplied references.
 * Other products (honey, oil) have no reference photos yet, so they use a generic jar with the BONADI logo label. */
const GLASS = [[0, -0.16], [0.108, -0.16], [0.125, -0.145], [0.125, 0.07], [0.108, 0.105], [0.075, 0.125], [0.075, 0.15]].map(([x, y]) => new THREE.Vector2(x, y));
const CONTENT = [[0, -0.15], [0.105, -0.15], [0.117, -0.135], [0.117, 0.035], [0, 0.035]].map(([x, y]) => new THREE.Vector2(x, y));
const gramsOf = (p) => { const m = /([\d.]+)\s*(kg|g)/i.exec(p.size || ""); return m ? Math.round(+m[1] * (/kg/i.test(m[2]) ? 1000 : 1)) : 0; };
const tex = (img, aniso = 8) => { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.needsUpdate = true; return t; };

function photoParts(meta, img, Hm) {
  const yb = meta.bottom + 14, k = Hm / (yb - meta.capTop), R = (meta.bodyW / 2) * k, cR = (meta.capW / 2) * k, nR = (meta.neckW / 2) * k;
  const hB = (yb - meta.bodyTop) * k, hN = (meta.bodyTop - meta.capBot) * k, hC = (meta.capBot - meta.capTop) * k;
  const flat = new THREE.MeshStandardMaterial({ color: meta.gheeColor, roughness: 0.3 });
  const wrap = new THREE.MeshStandardMaterial({ map: tex(img), roughness: 0.3, envMapIntensity: 0.9 });
  return { half: Hm / 2, parts: [
    { g: new THREE.CylinderGeometry(R, R, hB, 48, 1, false, -Math.PI, Math.PI * 2).translate(0, -Hm / 2 + hB / 2, 0), m: [wrap, flat, flat] },
    { g: new THREE.CylinderGeometry(nR, R * 0.96, hN, 36).translate(0, -Hm / 2 + hB + hN / 2, 0), m: new THREE.MeshStandardMaterial({ color: meta.gheeColor, roughness: 0.2, emissive: meta.gheeColor, emissiveIntensity: 0.1 }) },
    { g: new THREE.CylinderGeometry(cR, cR, hC, 48).translate(0, Hm / 2 - hC / 2, 0), m: new THREE.MeshStandardMaterial({ color: meta.capColor, metalness: 0.9, roughness: 0.26, envMapIntensity: 1.3 }) }] };
}
function genericParts(p, logo, s) {
  const soon = p.status === "coming_soon", col = soon ? "#b9b2a0" : contentColor(p);
  const lid = new THREE.MeshStandardMaterial({ color: soon ? "#8a8a8a" : "#2f2f2f", roughness: 0.4, metalness: 0.5 });
  return { half: 0.16 * s, parts: [
    { g: new THREE.LatheGeometry(GLASS, 28).scale(s, s, s), m: new THREE.MeshStandardMaterial({ color: "#e8f2f4", transparent: true, opacity: 0.28, roughness: 0.04, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6 }), order: 2 },
    { g: new THREE.LatheGeometry(CONTENT, 28).scale(s, s, s), m: new THREE.MeshStandardMaterial({ color: col, roughness: 0.28, emissive: col, emissiveIntensity: soon ? 0 : 0.14 }) },
    { g: new THREE.CylinderGeometry(0.082, 0.082, 0.05, 24).translate(0, 0.175, 0).scale(s, s, s), m: lid },
    { g: new THREE.CylinderGeometry(0.1285, 0.1285, 0.17, 28, 1, true, -1.1, 2.2).translate(0, -0.04, 0).scale(s, s, s), m: new THREE.MeshStandardMaterial({ map: labelTexture(p, logo, soon), roughness: 0.75 }) }] };
}
function useJarKit(products, assets) {
  const kit = useMemo(() => {
    const per = products.map((p) => { const v = String(gramsOf(p)), meta = assets?.meta?.[v], img = assets?.wraps?.[v], s = sizeScale(p);
      return catOf(p) === "ghee" && meta && img && p.status !== "coming_soon" ? photoParts(meta, img, 0.3 * s * 1.12) : genericParts(p, assets?.logo, s); });
    const tagM = products.map((p) => new THREE.MeshBasicMaterial({ map: tagTexture(p, p.status === "coming_soon") }));
    return { parts: per.map((x) => x.parts), half: per.map((x) => x.half), tag: new THREE.PlaneGeometry(0.34, 0.1), tagM };
  }, [products, assets]);
  useEffect(() => () => { kit.tag.dispose(); kit.tagM.forEach((m) => { m.map?.dispose(); m.dispose(); }); kit.parts.forEach((ps) => ps.forEach((x) => { x.g.dispose(); [].concat(x.m).forEach((m) => { m.map?.dispose(); m.dispose(); }); })); }, [kit]);
  return kit;
}
/** One non-instanced jar (premium display) */
function Jar({ kit, i, p, scale = 1, ...rest }) {
  const ud = { product: p };
  return <group scale={scale} {...rest}>{kit.parts[i].map((pt, k) => <mesh key={k} geometry={pt.g} material={pt.m} userData={ud} renderOrder={pt.order || 0} />)}</group>;
}

/* ---------- Scenery ---------- */
const wallMat = <meshStandardMaterial color="#f2e8d3" roughness={0.92} />;
const woodMat = <meshStandardMaterial color={WALNUT} roughness={0.55} />;
const greenMat = <meshStandardMaterial color="#34502c" roughness={0.8} />;
const goldMat = <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} />;

function Plant({ x, z, s = 1 }) {
  return (<group position={[x, 0, z]} scale={s}>
    <mesh position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[0.28, 0.2, 0.5, 18]} /><meshStandardMaterial color="#2f2a24" roughness={0.5} metalness={0.2} /></mesh>
    <mesh position={[0, 0.5, 0]}><torusGeometry args={[0.27, 0.015, 8, 32]} />{goldMat}</mesh>
    {[[0, 0.95, 0, 0.42], [0.18, 0.75, 0.1, 0.3], [-0.2, 0.8, -0.08, 0.32], [0.05, 1.25, -0.05, 0.28]].map(([px, py, pz, r], k) => <mesh key={k} position={[px, py, pz]} scale={[1, 1.25, 1]} castShadow><sphereGeometry args={[r, 14, 12]} /><meshStandardMaterial color={k % 2 ? "#5d7d33" : GREEN} roughness={0.8} /></mesh>)}
  </group>);
}
/** Warm pendant lamp: brass shade + glowing bulb (emissive, so it costs no extra light). */
function Pendant({ x, z, y = 3.12 }) {
  return (<group position={[x, 0, z]}>
    <mesh position={[0, (y + 4) / 2, 0]}><cylinderGeometry args={[0.008, 0.008, 4 - y]} /><meshBasicMaterial color="#2a1a0c" /></mesh>
    <mesh position={[0, y, 0]}><coneGeometry args={[0.26, 0.24, 24, 1, true]} /><meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.28} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, y - 0.08, 0]}><sphereGeometry args={[0.09, 14, 10]} /><meshBasicMaterial color="#fff1c9" /></mesh>
  </group>);
}
function PromoStand({ x, z, rot, text, sub }) {
  const t1 = useSign(text, 512, 700, "#fffaf0", BROWN, 62), t2 = useSign(sub, 512, 160, GOLD, "#2a1a0c", 44, '"Noto Sans Bengali", Arial');
  return (<group position={[x, 0, z]} rotation={[0, rot, 0]}>
    {[-1, 1].map((s) => <group key={s} rotation={[s * 0.12, 0, 0]} position={[0, 0.8, s * 0.12]}><mesh castShadow><boxGeometry args={[1.0, 1.5, 0.05]} />{woodMat}</mesh>
      <mesh position={[0, 0.12, s * 0.03]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[0.9, 1.1]} /><meshBasicMaterial map={t1} /></mesh>
      <mesh position={[0, -0.58, s * 0.03]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[0.9, 0.28]} /><meshBasicMaterial map={t2} /></mesh></group>)}
  </group>);
}
function TrolleyModel({ items = [] }) {
  const metal = <meshStandardMaterial color="#c9ccd1" metalness={0.85} roughness={0.3} />;
  return (<group>
    <mesh position={[0, 0.4, 0]}><boxGeometry args={[0.62, 0.03, 0.9]} />{metal}</mesh>
    {[-0.31, 0.31].map((x) => <mesh key={x} position={[x, 0.58, 0]}><boxGeometry args={[0.03, 0.36, 0.9]} />{metal}</mesh>)}
    {[-0.45, 0.45].map((z) => <mesh key={z} position={[0, 0.58, z]}><boxGeometry args={[0.62, 0.36, 0.03]} /><meshStandardMaterial color="#c9ccd1" transparent opacity={0.45} metalness={0.8} /></mesh>)}
    <mesh position={[0, 0.98, 0.47]}><boxGeometry args={[0.66, 0.04, 0.04]} /><meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} /></mesh>
    {[[-0.28, 0.4], [0.28, 0.4], [-0.28, -0.4], [0.28, -0.4]].map(([x, z]) => <mesh key={x + "" + z} position={[x, 0.07, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.07, 0.07, 0.05, 12]} /><meshStandardMaterial color="#333" /></mesh>)}
    {items.map((p, k) => <mesh key={k} position={[-0.17 + (k % 3) * 0.17, 0.58 + Math.floor(k / 9) * 0.3, -0.3 + Math.floor((k % 9) / 3) * 0.28]}><cylinderGeometry args={[0.07, 0.07, 0.2, 14]} /><meshStandardMaterial color={contentColor(p)} roughness={0.4} /></mesh>)}
  </group>);
}

function Shell({ logo }) {
  const floor = useMemo(floorTexture, []);
  const logoTex = useMemo(() => { if (!logo) return null; const t = new THREE.Texture(logo); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; }, [logo]);
  const exit = useSign("EXIT", 256, 96, "#2f7d3a", "#fff", 64), banner = useSign("PURE FOOD, HONEST PROMISE", 1024, 128, FOREST, GOLD, 64);
  const frame = (x, z, r, k) => <group key={k} position={[x, 3.0, z]} rotation={[0, r, 0]}><mesh position={[0, 0, -0.02]}><boxGeometry args={[1.5, 0.8, 0.04]} />{goldMat}</mesh><mesh><planeGeometry args={[1.42, 0.72]} /><meshBasicMaterial color="#fbf6e9" /></mesh>
    {logoTex && <mesh position={[0, 0, 0.005]}><planeGeometry args={[1.2, 1.2 * LOGO_ASPECT]} /><meshBasicMaterial map={logoTex} transparent /></mesh>}</group>;
  // green wainscot + brass trim along a wall: [x, z, width, rotY]
  const wainscot = (x, z, w, r, k) => <group key={k} position={[x, 0, z]} rotation={[0, r, 0]}><mesh position={[0, 0.55, 0]}><boxGeometry args={[w, 1.1, 0.04]} />{greenMat}</mesh><mesh position={[0, 1.12, 0.01]}><boxGeometry args={[w, 0.04, 0.05]} />{goldMat}</mesh></group>;
  return (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[16, 22]} /><meshStandardMaterial map={floor} roughness={0.42} metalness={0.04} envMapIntensity={0.55} /></mesh>
    <mesh position={[0, 4, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[16, 22]} /><meshStandardMaterial color="#efe3cc" /></mesh>
    {[-8, -3, 3, 8].map((z) => <mesh key={z} position={[0, 3.88, z]}><boxGeometry args={[16, 0.22, 0.3]} />{woodMat}</mesh>)}
    <mesh position={[0, 2, -11]}><boxGeometry args={[16, 4, 0.2]} />{wallMat}</mesh>
    <mesh position={[-8, 2, 0]}><boxGeometry args={[0.2, 4, 22]} />{wallMat}</mesh><mesh position={[8, 2, 0]}><boxGeometry args={[0.2, 4, 22]} />{wallMat}</mesh>
    {wainscot(0, -10.88, 16, 0, "b")}{wainscot(-7.88, 0, 22, Math.PI / 2, "l")}{wainscot(7.88, 0, 22, -Math.PI / 2, "r")}
    {wainscot(-4.6, 10.78, 6.8, Math.PI, "fl")}{wainscot(4.6, 10.78, 6.8, Math.PI, "fr")}
    {/* back wall behind the counter: brand logo + tagline */}
    {logoTex && <mesh position={[0, 2.95, -10.88]}><planeGeometry args={[4.6, 4.6 * LOGO_ASPECT]} /><meshBasicMaterial map={logoTex} transparent /></mesh>}
    <mesh position={[0, 1.95, -10.88]}><planeGeometry args={[4.6, 0.58]} /><meshBasicMaterial map={banner} /></mesh>
    {/* entrance: wall with glass double doors, logo header, EXIT sign, daylight outside */}
    <mesh position={[-4.6, 2, 10.9]}><boxGeometry args={[6.8, 4, 0.2]} />{wallMat}</mesh><mesh position={[4.6, 2, 10.9]}><boxGeometry args={[6.8, 4, 0.2]} />{wallMat}</mesh>
    <mesh position={[0, 3.25, 10.9]}><boxGeometry args={[2.4, 1.5, 0.2]} />{wallMat}</mesh>
    {[-0.6, 0.6].map((x) => <group key={x} position={[x, 1.25, 10.86]}><mesh><boxGeometry args={[1.12, 2.5, 0.03]} /><meshStandardMaterial color="#cfe6ee" transparent opacity={0.22} roughness={0.05} metalness={0.2} depthWrite={false} /></mesh>
      <mesh position={[0, 1.22, 0]}><boxGeometry args={[1.16, 0.06, 0.06]} />{goldMat}</mesh><mesh position={[0, -1.22, 0]}><boxGeometry args={[1.16, 0.06, 0.06]} />{goldMat}</mesh>
      <mesh position={[x > 0 ? -0.5 : 0.5, 0, 0.04]}><boxGeometry args={[0.03, 0.5, 0.04]} /><meshStandardMaterial color="#aaa" metalness={0.9} roughness={0.2} /></mesh></group>)}
    <mesh position={[0, 1.25, 10.7 + 0.04]}><boxGeometry args={[0.04, 2.5, 0.06]} />{goldMat}</mesh>
    <mesh position={[0, 1.4, 11.6]} rotation={[0, Math.PI, 0]}><planeGeometry args={[7, 4]} /><meshBasicMaterial color="#fff6dc" /></mesh>
    <mesh position={[0, 2.78, 10.78]} rotation={[0, Math.PI, 0]}><planeGeometry args={[1.0, 0.36]} /><meshBasicMaterial map={exit} /></mesh>
    {logoTex && <mesh position={[0, 3.5, 10.78]} rotation={[0, Math.PI, 0]}><planeGeometry args={[1.9, 1.9 * LOGO_ASPECT]} /><meshBasicMaterial map={logoTex} transparent /></mesh>}
    {/* wall frames and warm pendant lamps over every aisle */}
    {[-6, 6].flatMap((z) => [frame(-7.86, z, Math.PI / 2, "l" + z), frame(7.86, z, -Math.PI / 2, "r" + z)])}
    {[-5.4, 0, 5.4].flatMap((x) => [-1.5, 4].map((z) => <Pendant key={x + "" + z} x={x} z={z} />))}
    {[-1.1, 1.1].map((x) => <Pendant key={x} x={x} z={-8.2} y={2.9} />)}
    <LightPool x={DISPLAY.x} z={DISPLAY.z} r={2.6} /><LightPool x={COUNTER.x} z={COUNTER.z + 1.3} r={2.2} />
    {[-5.4, 5.4].map((x) => <LightPool key={x} x={x} z={0} r={2.2} />)}
    {/* decoration */}
    <Plant x={-7.1} z={10.2} s={1.1} /><Plant x={-7.1} z={-10.2} /><Plant x={7.1} z={-10.2} />
    <PromoStand x={-5.2} z={6.4} rot={0.25} text="BONADI" sub="খাঁটি খাবার, সৎ প্রতিশ্রুতি" /><PromoStand x={5.2} z={6.4} rot={-0.25} text="হাতে পেয়ে টাকা দিন" sub="ডেলিভারি একদম ফ্রি" />
    {[0, 1, 2].map((k) => <group key={k} position={[4.9 + k * 0.7, 0, 9.7]} rotation={[0, Math.PI, 0]}><TrolleyModel /></group>)}
    {[0, 1, 2, 3].map((k) => <mesh key={k} position={[-5.5, 0.12 + k * 0.1, 9.7]} castShadow><boxGeometry args={[0.46, 0.22, 0.32]} /><meshStandardMaterial color={GREEN} roughness={0.6} /></mesh>)}
  </>);
}

function CounterDesk({ logo }) {
  const front = useSign("কাউন্টার  ·  CHECKOUT", 1024, 160, FOREST, "#f1c25a", 84);
  const belt = useMemo(() => { const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d"); g.fillStyle = "#222"; g.fillRect(0, 0, 64, 256); g.fillStyle = "#383838"; for (let i = 0; i < 256; i += 16) g.fillRect(0, i, 64, 6); const t = mkTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 4); return t; }, []);
  const logoTex = useMemo(() => { if (!logo) return null; const t = new THREE.Texture(logo); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; }, [logo]);
  const steel = <meshStandardMaterial color="#9aa0a6" metalness={0.9} roughness={0.25} />;
  return (<group position={[COUNTER.x, 0, COUNTER.z]}>
    <mesh position={[0, 0.5, 0]} castShadow receiveShadow><boxGeometry args={[4, 1, 1.2]} />{woodMat}</mesh>
    <mesh position={[0, 1.01, 0]} receiveShadow><boxGeometry args={[4.1, 0.05, 1.3]} /><meshStandardMaterial color={GOLD} metalness={0.5} roughness={0.3} /></mesh>
    {/* illuminated front sign (replaces the old hanging sign that covered the wall logo) */}
    <mesh position={[0, 0.55, 0.605]}><boxGeometry args={[3.3, 0.56, 0.02]} />{goldMat}</mesh>
    <mesh position={[0, 0.55, 0.62]}><planeGeometry args={[3.2, 0.5]} /><meshBasicMaterial map={front} /></mesh>
    {/* conveyor belt with rails */}
    <mesh position={[-0.65, 1.075, 0.15]}><boxGeometry args={[2.1, 0.07, 0.62]} /><meshStandardMaterial map={belt} roughness={0.8} /></mesh>
    {[0.47, -0.17].map((z) => <mesh key={z} position={[-0.65, 1.11, z]}>{<boxGeometry args={[2.1, 0.08, 0.03]} />}{steel}</mesh>)}
    {/* barcode scanner */}
    <mesh position={[0.78, 1.075, 0.2]}><boxGeometry args={[0.34, 0.07, 0.26]} /><meshStandardMaterial color="#111" roughness={0.4} /></mesh><mesh position={[0.78, 1.112, 0.2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.2, 0.012]} /><meshBasicMaterial color="#ff2a2a" /></mesh>
    {/* payment terminal + POS monitor */}
    <group position={[1.35, 1.04, 0.3]} rotation={[-0.35, -0.3, 0]}><mesh position={[0, 0.1, 0]}><boxGeometry args={[0.17, 0.24, 0.05]} /><meshStandardMaterial color="#222" /></mesh><mesh position={[0, 0.16, 0.027]}><planeGeometry args={[0.12, 0.08]} /><meshBasicMaterial color="#4bd37b" /></mesh></group>
    <mesh position={[1.45, 1.35, -0.3]}><boxGeometry args={[0.5, 0.32, 0.04]} /><meshStandardMaterial color="#1b1b1b" /></mesh><mesh position={[1.45, 1.17, -0.3]}><boxGeometry args={[0.08, 0.2, 0.08]} /><meshStandardMaterial color="#222" /></mesh>
    <mesh position={[1.45, 1.35, -0.277]}><planeGeometry args={[0.44, 0.26]} /><meshBasicMaterial color="#27406b" /></mesh>
    {/* paper bags with the logo */}
    {[-1.75, -1.45, -1.15].map((x, k) => <group key={x} position={[x, 1.28, -0.2 + k * 0.05]}><mesh castShadow><boxGeometry args={[0.28, 0.5, 0.18]} /><meshStandardMaterial color="#b98d5a" roughness={0.9} /></mesh>
      {logoTex && <mesh position={[0, 0.02, 0.092]}><planeGeometry args={[0.22, 0.22 * LOGO_ASPECT]} /><meshBasicMaterial map={logoTex} transparent /></mesh>}</group>)}
  </group>);
}

/** Walnut shelf unit: dark back panel so jars pop, brass shelf lips, warm LED strips washing light down the back. */
function Shelf({ u, cat, soon }) {
  const sign = useSign(CAT_SIGN[cat] || "BONADI", 1024, 160, soon ? "#4a4741" : FOREST, soon ? "#e0dcd2" : "#f1c25a", 70);
  const boards = [...ROWS, 2.14];
  return (
    <group position={[u.x, 0, u.z]} rotation={[0, u.rot, 0]}>
      <mesh position={[0, 1.2, -0.35]} castShadow receiveShadow><boxGeometry args={[u.len, 2.4, 0.05]} /><meshStandardMaterial color="#3a2414" roughness={0.7} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * u.len / 2, 1.2, 0]} castShadow><boxGeometry args={[0.05, 2.4, 0.7]} />{woodMat}</mesh>)}
      {boards.map((y) => <group key={y}><mesh position={[0, y, 0]} receiveShadow castShadow><boxGeometry args={[u.len, 0.04, 0.7]} />{woodMat}</mesh>
        <mesh position={[0, y, 0.352]}><boxGeometry args={[u.len, 0.045, 0.012]} />{goldMat}</mesh></group>)}
      {!soon && ROWS.map((y, r) => { const top = boards[r + 1]; return <group key={y}>
        <mesh position={[0, top - 0.03, 0.31]}><boxGeometry args={[u.len - 0.1, 0.012, 0.02]} /><meshBasicMaterial color="#fff0c8" /></mesh>
        <mesh position={[0, (y + top) / 2, -0.32]}><planeGeometry args={[u.len - 0.1, top - y - 0.04]} /><meshBasicMaterial map={wash()} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></mesh></group>; })}
      <mesh position={[0, 2.62, 0.05]}><boxGeometry args={[Math.min(u.len * 0.8, 2.6), 0.4, 0.05]} />{goldMat}</mesh>
      <mesh position={[0, 2.62, 0.08]}><planeGeometry args={[Math.min(u.len * 0.8, 2.6) - 0.06, 0.34]} /><meshBasicMaterial map={sign} /></mesh>
    </group>
  );
}
/** Poster panel closing the front end of a gondola (seen first from the entrance). */
function EndCap({ x, kind, logo, jar }) {
  const tx = useMemo(() => posterTexture(kind, logo, jar), [kind, logo, jar]);
  useEffect(() => () => tx.dispose(), [tx]);
  return (<group position={[x, 0, 2.33]}>
    <mesh position={[0, 1.2, 0]} castShadow><boxGeometry args={[1.46, 2.4, 0.04]} />{woodMat}</mesh>
    <mesh position={[0, 1.22, 0.025]}><planeGeometry args={[1.1, 2.2]} /><meshBasicMaterial map={tx} /></mesh>
  </group>);
}

/* ---------- Products on shelves: InstancedMesh per jar part (few draw calls); premium display with individual jars ---------- */
const Products = React.memo(function Products({ products, group, assets }) {
  const kit = useJarKit(products, assets);
  const { jars, tags } = useMemo(() => {
    const jars = products.map(() => []), tags = products.map(() => []), one = new THREE.Vector3(1, 1, 1);
    UNITS.forEach((u, ui) => {
      let pool = products.map((p, i) => i).filter((i) => catOf(products[i]) === CAT_OF_UNIT[ui]); if (!pool.length) pool = products.map((p, i) => i);
      ROWS.forEach((top, r) => {
        if (LITE && r === 2) return; const pi = pool[r % pool.length], at = (v) => v.applyAxisAngle(Y, u.rot).add(new THREE.Vector3(u.x, 0, u.z));
        const q = new THREE.Quaternion().setFromAxisAngle(Y, u.rot);                                        // jars face +z of the shelf (towards the shopper)
        for (let x = -u.len / 2 + 0.3; x < u.len / 2 - 0.15; x += 0.4) jars[pi].push(new THREE.Matrix4().compose(at(new THREE.Vector3(x, top + 0.04 + kit.half[pi], 0.06)), q, one));
        for (let x = -u.len / 2 + 0.6; x < u.len / 2 - 0.3; x += 1.15) tags[pi].push(new THREE.Matrix4().compose(at(new THREE.Vector3(x, top, 0.362)), q, one));
      });
    });
    return { jars, tags };
  }, [products, kit]);
  const setM = (arr) => (m) => { if (m) { arr.forEach((mx, k) => m.setMatrixAt(k, mx)); m.instanceMatrix.needsUpdate = true; } };
  const act = products.map((p, i) => i).filter((i) => products[i].status !== "coming_soon").slice(0, 6);
  return (
    <group ref={group}>
      {products.map((p, i) => jars[i].length > 0 && (<React.Fragment key={p.id}>
        {kit.parts[i].map((pt, k) => <instancedMesh key={k} args={[pt.g, pt.m, jars[i].length]} userData={{ product: p }} frustumCulled={false} renderOrder={pt.order || 0} ref={setM(jars[i])} />)}
        <instancedMesh args={[kit.tag, kit.tagM[i], tags[i].length]} frustumCulled={false} ref={setM(tags[i])} />
      </React.Fragment>))}
      <group position={[DISPLAY.x, 0, DISPLAY.z]}>
        <mesh position={[0, 0.125, 0]} castShadow receiveShadow><cylinderGeometry args={[1.4, 1.45, 0.25, 40]} />{woodMat}</mesh>
        <mesh position={[0, 0.26, 0]}><cylinderGeometry args={[1.42, 1.42, 0.03, 40]} />{goldMat}</mesh>
        <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.6, 0.65, 0.28, 32]} />{woodMat}</mesh><mesh position={[0, 0.545, 0]}><cylinderGeometry args={[0.62, 0.62, 0.03, 32]} />{goldMat}</mesh>
        {act.map((i, k) => { const a = (k / act.length) * Math.PI * 2 + 0.3, s = 1.3;
          return <Jar key={i} kit={kit} i={i} p={products[i]} scale={s} position={[Math.sin(a) * 1.0, 0.275 + kit.half[i] * s, Math.cos(a) * 1.0]} rotation={[0, a, 0]} />; })}
        {act[0] != null && <Jar kit={kit} i={act[0]} p={products[act[0]]} scale={1.6} position={[0, 0.56 + kit.half[act[0]] * 1.6, 0]} />}
      </group>
    </group>
  );
});

/* ---------- Player, interaction, collision, guidance ---------- */
function Scene({ products, cart, assets, ctl, api, onHover, onNear, onMoved, guide }) {
  const { camera, scene, gl } = useThree();
  const group = useRef(), trolley = useRef(), hl = useRef(), fly = useRef([]);
  const ray = useMemo(() => new THREE.Raycaster(), []), tmp = useMemo(() => new THREE.Matrix4(), []), wp = useMemo(() => new THREE.Vector3(), []);
  const st = useRef({ x: 0, z: 8.6, bob: 0, hover: null, near: null, walked: 0, movedSent: false });
  const items = useMemo(() => cart.flatMap((i) => Array(Math.min(i.qty, 6)).fill(i)).slice(0, 14), [cart]);
  useEffect(() => { camera.rotation.order = "YXZ"; camera.position.set(0, 1.6, 8.6); }, [camera]);
  useEffect(() => {   // local environment map (no network) = realistic reflections on glass, gold and steel
    const pm = new THREE.PMREMGenerator(gl), env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env; scene.environmentIntensity = 0.5; return () => { scene.environment = null; env.dispose(); pm.dispose(); };
  }, [gl, scene]);

  const cast = useCallback((ndc) => {
    ray.setFromCamera(ndc || { x: 0, y: 0 }, camera);
    const hit = ray.intersectObjects(group.current ? group.current.children : [], true).find((h) => h.object.userData.product);
    return hit && hit.distance < 3.4 ? hit : null;
  }, [camera, ray]);
  const hitPos = (hit, out) => { if (hit.instanceId != null) { hit.object.getMatrixAt(hit.instanceId, tmp); return out.setFromMatrixPosition(tmp); } return hit.object.getWorldPosition(out); };

  /** What is under the crosshair / finger (no side effects) */
  api.current.probe = (ndc) => { const hit = cast(ndc); return hit ? { p: hit.object.userData.product, point: hit.point.clone() } : null; };
  /** A jar flies from the shelf into the trolley (visual confirmation of the add) */
  api.current.fly = (point, p) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16), new THREE.MeshStandardMaterial({ color: contentColor(p) }));
    mesh.position.copy(point); scene.add(mesh); fly.current.push({ mesh, from: point.clone(), t: 0 });
  };
  api.current.tp = ([x, z, yaw, pitch]) => { st.current.x = x; st.current.z = z; ctl.current.yaw = yaw; ctl.current.pitch = pitch; };

  useFrame((s, dt) => {
    dt = Math.min(dt, 0.05); const c = ctl.current, S = st.current;
    if (c.active) {
      const k = c.keys, run = k.has("shift") ? 1.7 : 1;
      let f = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0) + c.joy.y;
      let r = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0) + c.joy.x;
      const len = Math.hypot(f, r); if (len > 1) { f /= len; r /= len; }
      const sp = 3.2 * run * dt, sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
      let nx = S.x + (-sy * f + cy * r) * sp, nz = S.z + (-cy * f - sy * r) * sp;
      nx = Math.max(-7.5, Math.min(7.5, nx)); nz = Math.max(-10.3, Math.min(10.3, nz));
      for (const [bx, bz, hw, hd] of BLOCKS) {
        const ox = hw + 0.4 - Math.abs(nx - bx), oz = hd + 0.4 - Math.abs(nz - bz);
        if (ox > 0 && oz > 0) { if (ox < oz) nx += Math.sign(nx - bx || 1) * ox; else nz += Math.sign(nz - bz || 1) * oz; }
      }
      const step = Math.hypot(nx - S.x, nz - S.z);
      if (step > 0.0005) { S.bob += dt * 9 * run; S.walked += step; if (!S.movedSent && S.walked > 1.2) { S.movedSent = true; onMoved(); } }
      S.x = nx; S.z = nz;
    }
    camera.position.set(S.x, 1.6 + Math.sin(S.bob) * 0.025, S.z); camera.rotation.set(c.pitch, c.yaw, 0);
    // trolley rides ahead and to the right, so it never hides the shelf you are looking at (further right on narrow portrait screens)
    const t = trolley.current; if (t) { const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw), side = s.size.width < s.size.height ? 0.85 : 0.55; t.position.set(S.x - sy * 1.15 + cy * side, 0, S.z - cy * 1.15 - sy * side); t.rotation.y = c.yaw; }
    if (!TOUCH && c.active) {
      const hit = cast(), key = hit ? hit.object.userData.product.id : null;
      if (hit) { hl.current.position.copy(hitPos(hit, wp)); hl.current.visible = true; } else hl.current.visible = false;
      if (key !== S.hover) { S.hover = key; onHover(hit ? hit.object.userData.product : null); }
    } else if (hl.current) hl.current.visible = false;
    const near = Math.hypot(S.x - COUNTER.x, S.z - COUNTER.z) < 3.4 ? "counter" : S.z > 9.6 ? "exit" : null;
    if (near !== S.near) { S.near = near; onNear(near); }
    // guidance arrow to the checkout counter (rotates in screen space; DOM updated directly, no React render)
    if (guide.current) { const dx = COUNTER.x - S.x, dz = COUNTER.z + 1.6 - S.z; let d = Math.atan2(-dx, -dz) - c.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); guide.current.style.transform = `rotate(${(-d * 180 / Math.PI).toFixed(0)}deg)`; }
    for (let i = fly.current.length - 1; i >= 0; i--) {
      const q = fly.current[i]; q.t += dt * 2.4; const e = q.t * q.t * (3 - 2 * q.t), tg = t ? t.position : q.from;
      q.mesh.position.set(q.from.x + (tg.x - q.from.x) * e, q.from.y + (0.75 - q.from.y) * e + Math.sin(e * Math.PI) * 0.35, q.from.z + (tg.z - q.from.z) * e);
      if (q.t >= 1) { scene.remove(q.mesh); q.mesh.geometry.dispose(); q.mesh.material.dispose(); fly.current.splice(i, 1); }
    }
  });

  const has = (k) => products.some((p) => catOf(p) === k);
  return (<>
    <color attach="background" args={["#e9dcc2"]} /><fog attach="fog" args={["#e9dcc2", 14, 32]} />
    <hemisphereLight args={["#fff0d2", "#7a5a34", 0.8]} />
    <directionalLight position={[5, 9, 4]} intensity={0.9} color="#fff1db" castShadow={!LITE} shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-camera-far={30} shadow-bias={-0.0004} />
    {!LITE && <><pointLight position={[0, 3.2, -4.8]} intensity={16} distance={7} color="#ffd998" /><pointLight position={[0, 2.8, -8]} intensity={10} distance={6} color="#ffe2b0" /></>}
    <Shell logo={assets?.logo} /><CounterDesk logo={assets?.logo} />
    {UNITS.map((u, i) => <Shelf key={i} u={u} cat={CAT_OF_UNIT[i]} soon={CAT_OF_UNIT[i] === "oil"} />)}
    <EndCap x={-3} kind={has("ghee") ? "ghee" : "honey"} logo={assets?.logo} jar={assets?.jar} />
    <EndCap x={3} kind="oil" logo={assets?.logo} jar={null} />
    <Products products={products} group={group} assets={assets} />
    <group ref={trolley}><TrolleyModel items={items} /></group>
    <mesh ref={hl} visible={false}><cylinderGeometry args={[0.16, 0.16, 0.38, 20]} /><meshBasicMaterial color="#ffd36a" transparent opacity={0.35} depthWrite={false} /></mesh>
  </>);
}

function Joystick({ ctl }) {
  const knob = useRef(null), base = useRef(null);
  const move = (e) => { const r = base.current.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } ctl.current.joy = { x, y: -y }; knob.current.style.transform = `translate(${x * 34}px,${y * 34}px)`; };
  const end = () => { ctl.current.joy = { x: 0, y: 0 }; knob.current.style.transform = "none"; };
  return (
    <div ref={base} role="application" aria-label={t("Movement joystick")} className="s3d-glass pointer-events-auto absolute bottom-8 left-5 grid h-32 w-32 touch-none place-items-center rounded-full"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }} onPointerMove={(e) => e.buttons && move(e)} onPointerUp={end} onPointerCancel={end}>
      <span aria-hidden="true" className="absolute inset-3 rounded-full border border-white/15" />
      <div ref={knob} className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-b from-[#f3c868] to-[#c98f2c] shadow-lg"><Footprints size={20} className="text-[#3a2410]" /></div>
    </div>
  );
}

/** Catches WebGL/runtime errors so customers always have a way back to normal shopping */
class Boundary extends React.Component {
  state = { bad: false }; static getDerivedStateFromError() { return { bad: true }; }
  render() { return this.state.bad ? <Fallback msg={t("The 3D store hit a problem on this device.")} /> : this.props.children; }
}
const Fallback = ({ msg }) => (
  <div className="absolute inset-0 grid place-items-center bg-brand p-6 text-center text-white"><div><img src="/logo.webp" alt="Bonadi" className="mx-auto h-14 rounded-xl bg-white p-2" />
    <p className="mt-5 text-lg font-semibold">{msg}</p><p className="mt-1 text-sm text-white/70">{t("Please use our normal shop — everything is available there.")}</p>
    <a href="#/shop" className="btn mt-5">{t("Shop normally")}</a></div></div>
);
const webglOK = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };

/** The three facts that remove purchase risk, repeated where people hesitate (details card, trolley, checkout). */
const TRUST = [[Banknote, "Pay when it arrives"], [Truck, "Free delivery"], [RotateCcw, "7-day return"]];
const Trust = ({ dark }) => <ul className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${dark ? "text-white/80" : "text-muted"}`}>{TRUST.map(([I, l]) => <li key={l} className="flex items-center gap-1.5"><I size={14} className={dark ? "text-gold" : "text-brand"} />{t(l)}</li>)}</ul>;

/** Product details card: photo, sizes compared by price per 100 g, quantity, add. Opens on click/tap. */
function QuickView({ p, list, onAdd, onClose, onPick }) {
  const [qty, setQty] = useState(1);
  useEffect(() => setQty(1), [p.id]);
  const soon = p.status === "coming_soon";
  const sizes = list.filter((x) => x.name === p.name && x.status === "active" && gramsOf(x)).sort((a, b) => gramsOf(a) - gramsOf(b));
  const per100 = (x) => (gramsOf(x) ? (x.price / gramsOf(x)) * 100 : null);
  const base = sizes[0], save = base && base.id !== p.id && gramsOf(p) ? Math.round((per100(base) * gramsOf(p)) / 100 - p.price) : 0;
  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-end bg-black/45 md:place-items-center md:p-4" role="dialog" aria-modal="true" aria-label={pname(p)} onClick={onClose}>
      <div className="s3d-up w-full max-w-2xl overflow-hidden rounded-t-[28px] bg-[#fffaf0] shadow-2xl md:grid md:grid-cols-[.9fr_1.1fr] md:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="relative grid h-48 place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_62%,rgba(225,161,62,.45),transparent_62%),linear-gradient(180deg,#3f562a,#26361a)] md:h-auto md:min-h-[380px]">
          {p.image_url ? <img src={p.image_url} alt="" className={`absolute inset-0 m-auto ${p.image_url.startsWith("/products/") ? "h-[86%] w-auto object-contain drop-shadow-[0_20px_22px_rgba(0,0,0,.45)]" : "h-full w-full object-cover"}`} />
            : <span className="font-display text-4xl text-gold">Bonadi</span>}
          {p.size && <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-ink">{p.size}</span>}
          <button onClick={onClose} aria-label={t("Close")} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white md:hidden"><X size={18} /></button>
        </div>
        <div className="p-5 md:p-7">
          <div className="flex items-start justify-between gap-3"><h2 className="font-display text-2xl font-bold leading-tight md:text-3xl">{pname(p)}</h2>
            <button onClick={onClose} aria-label={t("Close")} className="hidden h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-black/5 md:grid"><X size={18} /></button></div>
          <p className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-extrabold text-[#9a6b00]">{soon ? t("Coming soon") : money(p.price)}</span>
            {!soon && p.compare_at_price > p.price && <s className="text-muted">{money(p.compare_at_price)}</s>}</p>
          {p.description && <p className="mt-2 text-sm leading-relaxed text-muted">{p.description}</p>}
          {sizes.length > 1 && <div className="mt-4"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{t("Choose a size")}</p>
            <div className="grid grid-cols-3 gap-2">{sizes.map((x) => <button key={x.id} onClick={() => onPick(x)} aria-pressed={x.id === p.id}
              className={`rounded-2xl border-2 px-2 py-2 text-left transition ${x.id === p.id ? "border-[#3f562a] bg-[#3f562a] text-white" : "border-black/10 hover:border-gold"}`}>
              <b className="block text-sm">{x.size}</b><span className="block text-sm">{money(x.price)}</span>
              <span className={`block text-[11px] ${x.id === p.id ? "text-white/75" : "text-muted"}`}>{money(Math.round(per100(x)))}/{t("100 g")}</span></button>)}</div>
            {save > 0 && <p className="mt-2 rounded-xl bg-[#3f562a]/10 px-3 py-2 text-sm font-semibold text-[#3f562a]">{t("Saves {save} compared with the same amount in {size} jars").replace("{save}", money(save)).replace("{size}", base.size)}</p>}</div>}
          {!soon && <div className="mt-5 flex items-center gap-3">
            <div className="flex items-center rounded-full border-2 border-black/10"><button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={t("Decrease")} className="grid h-11 w-11 place-items-center"><Minus size={16} /></button>
              <b className="w-7 text-center text-lg" aria-live="polite">{qty}</b><button onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label={t("Increase")} className="grid h-11 w-11 place-items-center"><Plus size={16} /></button></div>
            <button onClick={() => onAdd(p, qty)} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#f0c468] to-[#d79a33] py-3.5 font-bold text-[#2a1a0c] shadow-lg transition hover:brightness-105 active:scale-[.98]">
              <ShoppingBasket size={18} />{t("Add to trolley")} · {money(p.price * qty)}</button></div>}
          {soon && <p className="mt-5 rounded-2xl bg-black/5 p-3 text-sm text-muted">{t("This product is not available yet. Ghee is ready to order now.")}</p>}
          <div className="mt-4 border-t border-black/10 pt-3"><Trust /></div>
        </div>
      </div>
    </div>
  );
}

/** Small celebratory burst on the thank-you screen (peak-end: the last moment is the one people remember). */
function Confetti() {
  const bits = useMemo(() => Array.from({ length: 22 }, (_, k) => ({ left: `${(k * 37) % 100}%`, dx: `${((k * 53) % 120) - 60}px`, delay: `${(k % 7) * 0.12}s`, bg: ["#e1a13e", "#f6dd93", "#3f562a", "#fffaf0"][k % 4] })), []);
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">{bits.map((b, k) => <span key={k} className="s3d-confetti" style={{ left: b.left, background: b.bg, animationDelay: b.delay, "--dx": b.dx }} />)}</div>;
}

/* ---------- Main ---------- */
export default function Store3D({ products, cart, onAdd, setCart, clear, profile }) {
  const [phase, setPhase] = useState("intro"), [assets, setAssets] = useState(undefined), [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(null), [near, setNear] = useState(null), [panel, setPanel] = useState(false), [coach, setCoach] = useState(0);
  const [checkout, setCheckout] = useState(false), [done, setDone] = useState(null), [toast, setToast] = useState(""), [snack, setSnack] = useState(null);
  const [quick, setQuick] = useState(null), [fade, setFade] = useState(false), [bump, setBump] = useState(0), [copied, setCopied] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", address: "" }), [err, setErr] = useState(""), [tried, setTried] = useState(false), [busy, setBusy] = useState(false), [drop, setDrop] = useState(false);
  const ctl = useRef({ keys: new Set(), joy: { x: 0, y: 0 }, yaw: 0, pitch: 0, active: false });
  const api = useRef({}), wrap = useRef(null), nearRef = useRef(null), touch = useRef(null), toastT = useRef(), snackT = useRef(), guide = useRef(null), noPause = useRef(false), live = useRef(false);
  const [gl] = useState(webglOK);
  const list = useMemo(() => (products.length ? products : [{ id: 0, name: "Bonadi Pure Ghee", size: "500 g", price: 950, status: "active" }]), [products]);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0), count = cart.reduce((s, i) => s + i.qty, 0);
  const canDrop = profile?.role === "dropshipper" && profile?.status === "approved";
  const playing = phase === "play" && !checkout && !done && !paused && !quick;
  ctl.current.active = playing; live.current = phase === "play" && !checkout && !done && !quick;

  const say = useCallback((m) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 2600); }, []);
  const unlock = useCallback(() => { noPause.current = true; document.exitPointerLock?.(); setTimeout(() => { noPause.current = false; }, 300); }, []);
  /** Pointer lock is desktop-only and can be refused (iframes, headless); never let that throw. */
  const lockIn = useCallback(() => { if (TOUCH) return; setTimeout(() => { try { wrap.current?.requestPointerLock?.()?.catch?.(() => {}); } catch { /* not allowed here */ } }, 50); }, []);
  const coachDone = useCallback(() => { setCoach(0); try { localStorage.setItem("bonadi-3d-tut", "1"); } catch { /* private mode */ } }, []);
  /** Coach steps advance only when the shopper actually does the step; the last one remembers that the tips were seen. */
  const advance = useCallback((from) => setCoach((c) => { if (c !== from) return c; if (from < 4) return from + 1; try { localStorage.setItem("bonadi-3d-tut", "1"); } catch { /* private mode */ } return 0; }), []);

  useEffect(() => {   // the 3D store's own typefaces load only when the store opens, so the main site stays light
    if (document.getElementById("bonadi-3d-fonts")) return;
    const l = Object.assign(document.createElement("link"), { id: "bonadi-3d-fonts", rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" });
    document.head.appendChild(l);
  }, []);
  useEffect(() => { window.__lenis?.stop(); document.title = t("Bonadi 3D Store"); return () => { window.__lenis?.start(); unlock(); }; }, [unlock]);
  useEffect(() => { if (profile) setF((x) => ({ ...x, name: x.name || profile.full_name || "", phone: x.phone || profile.phone || "" })); }, [profile]);
  useEffect(() => {   // preload: logo, Bengali font, real bottle artwork (wrap textures) and the poster jar before building the scene
    let ok = true;
    const load = async () => {
      const [logo, meta, , jar] = await Promise.all([loadImg("/logo.png"), fetch("/products/ghee-meta.json").then((r) => r.json()).catch(() => ({})), document.fonts?.load('700 30px "Noto Sans Bengali"', "খাঁটি").catch(() => 0), loadImg("/products/ghee-500.webp")]);
      const wraps = {}; await Promise.all(Object.entries(meta).map(async ([k, v]) => { wraps[k] = await loadImg(v.wrap); }));
      return { logo, meta, wraps, jar };
    };
    Promise.race([load(), new Promise((r) => setTimeout(() => r({ logo: null, meta: {}, wraps: {}, jar: null }), 6000))]).then((a) => ok && setAssets(a));
    return () => { ok = false; };
  }, []);
  useEffect(() => {   // Esc (pointer-lock release) opens the pause menu
    const h = () => { if (!document.pointerLockElement && live.current && !noPause.current && !TOUCH) setPaused(true); };
    document.addEventListener("pointerlockchange", h); return () => document.removeEventListener("pointerlockchange", h);
  }, []);

  /** Adds to the real cart, flies a jar into the 3D trolley, bumps the trolley badge and shows an undo-free confirmation with the new total. */
  const addItem = useCallback((p, qty, point) => {
    for (let k = 0; k < qty; k++) onAdd(p, true);
    if (point) api.current.fly?.(point, p);
    setBump((b) => b + 1); setCoach((c) => (c === 2 || c === 3 ? 4 : c));   // E adds without the details card, so it completes both steps
    setSnack({ text: `${pname(p)} ${p.size || ""} × ${qty}`, total: total + p.price * qty }); clearTimeout(snackT.current); snackT.current = setTimeout(() => setSnack(null), 3200);
  }, [onAdd, advance, total]);
  const openQuick = useCallback((h) => { if (!h) return; setQuick(h); unlock(); advance(2); }, [unlock, advance]);
  const closeQuick = useCallback(() => { setQuick(null); lockIn(); }, [lockIn]);
  const quickAdd = useCallback(() => { const h = api.current.probe?.(null); if (!h) return say(t("Walk closer and aim at a product")); if (h.p.status === "coming_soon") return say(`${pname(h.p)} — ${t("coming soon")}`); addItem(h.p, 1, h.point); }, [addItem, say]);
  const openCheckout = useCallback(() => { if (!cart.length) return say(t("Your trolley is empty — pick something first")); unlock(); setPanel(false); setPaused(false); setQuick(null); setCheckout(true); advance(4); }, [cart.length, say, unlock, advance]);
  /** One-tap jump to an aisle: short fade, move, fade back (no steering needed). */
  const go = useCallback((spot) => { setFade(true); setPanel(false); setTimeout(() => { api.current.tp?.(SPOTS[spot]); setFade(false); advance(1); if (spot === "counter") advance(4); }, 280); }, [advance]);
  const act = useCallback(() => { const n = nearRef.current; if (n === "counter") openCheckout(); else if (n === "exit") window.location.hash = "#/"; else quickAdd(); }, [openCheckout, quickAdd]);

  const cats = useMemo(() => [["ghee", "Ghee"], ["honey", "Honey"]].filter(([k]) => list.some((p) => catOf(p) === k && p.status !== "coming_soon")), [list]);
  const dock = [...cats, ["display", "Collection"], ["counter", "Counter"]];

  useEffect(() => {
    const typing = (e) => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
    const kd = (e) => { if (typing(e)) return; const k = e.key.toLowerCase(); ctl.current.keys.add(k);
      if (k === "e" && ctl.current.active) act(); if (k === "c" && live.current) setPanel((p) => !p); if (k === "escape" && TOUCH) setPaused((p) => !p);
      if (ctl.current.active && /^[1-4]$/.test(k) && dock[+k - 1]) go(dock[+k - 1][0]);
      if ([" ", "arrowup", "arrowdown"].includes(k)) e.preventDefault(); };
    const ku = (e) => ctl.current.keys.delete(e.key.toLowerCase());
    const mm = (e) => { if (document.pointerLockElement && ctl.current.active) { ctl.current.yaw -= e.movementX * 0.0023; ctl.current.pitch = Math.max(-1.2, Math.min(1.2, ctl.current.pitch - e.movementY * 0.0023)); } };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); document.addEventListener("mousemove", mm);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); document.removeEventListener("mousemove", mm); };
  }, [act, go, dock.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Desktop: click on a product = details; click elsewhere = capture the mouse for looking around
  const onClick = () => { if (TOUCH || !ctl.current.active) return; const h = api.current.probe?.(null); if (h) openQuick(h); else if (!document.pointerLockElement) lockIn(); else say(t("Walk closer and aim at a product")); };
  const pd = (e) => { if (e.pointerType === "touch") touch.current = { x: e.clientX, y: e.clientY, moved: 0 }; };
  const pm = (e) => { const tt = touch.current; if (!tt || e.pointerType !== "touch" || !ctl.current.active) return;
    const dx = e.clientX - tt.x, dy = e.clientY - tt.y; tt.moved += Math.abs(dx) + Math.abs(dy); tt.x = e.clientX; tt.y = e.clientY;
    ctl.current.yaw -= dx * 0.005; ctl.current.pitch = Math.max(-1.2, Math.min(1.2, ctl.current.pitch - dy * 0.004)); };
  const pu = (e) => { const tt = touch.current; touch.current = null; if (tt && tt.moved < 12 && ctl.current.active) { const h = api.current.probe?.({ x: (e.clientX / innerWidth) * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }); h ? openQuick(h) : say(t("Tap a jar on the shelf to see it")); } };

  const start = () => { setPhase("play"); let seen = null; try { seen = localStorage.getItem("bonadi-3d-tut"); } catch { /* private mode */ } if (!seen) setCoach(1); lockIn(); };
  const resume = () => { setPaused(false); lockIn(); };
  const dec = (id) => setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i)).filter((i) => i.qty > 0));
  const del = (id) => setCart((c) => c.filter((i) => i.id !== id));

  const submitting = useRef(false);
  const bad = { name: f.name.trim().length < 2, phone: !phoneOk(f.phone), address: f.address.trim().length < 8 };
  const confirm = async (e) => {
    e.preventDefault(); if (submitting.current) return; setErr(""); setTried(true);
    if (!validOrder(f)) return setErr(t("Please check the highlighted fields."));
    submitting.current = true; setBusy(true);
    const { data, error } = await submitOrder(f, cart, drop && canDrop);
    submitting.current = false; setBusy(false);
    if (error) return setErr(error.message.includes("not available") ? t("A product in your trolley is no longer available. Please update your trolley.") : t("Order failed — nothing was charged. Please try again or call us."));
    clear(); setCheckout(false); coachDone(); setDone({ id: data, total });
  };
  const copyId = async () => { try { await navigator.clipboard.writeText(String(done.id)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ } };
  const COACH = [[Footprints, "Walk", TOUCH ? "Drag the joystick on the left — or tap an aisle button above." : "Use W A S D or the arrow keys — or press 1–4 to jump to an aisle."],
    [MousePointerClick, "Look at a jar", TOUCH ? "Tap any jar on a shelf to see its price and sizes." : "Put the dot on a jar and click to see its price and sizes."],
    [ShoppingBasket, "Add to trolley", "Choose the size and quantity, then press “Add to trolley”."],
    [Navigation, "Go to the counter", TOUCH ? "Tap “Counter” above — it takes you straight there." : "Press the number key next to “Counter” — it takes you straight there."]];
  const field = (k) => `field mt-1 !text-ink ${tried && bad[k] ? "!border-red-500 ring-2 ring-red-500/20" : ""}`;

  if (!gl) return <div className="fixed inset-0 z-[9000]"><Fallback msg={t("Your browser or device does not support 3D graphics (WebGL).")} /></div>;
  return (
    <div className="fixed inset-0 z-[9000] select-none bg-[#e9dcc2] font-body text-ink">
      <div ref={wrap} className="absolute inset-0 touch-none" onClick={onClick} onPointerDown={pd} onPointerMove={pm} onPointerUp={pu}>
        <Boundary><Canvas shadows={!LITE} dpr={LITE ? 1 : [1, 1.5]} camera={{ fov: 70, near: 0.1, far: 60 }} gl={{ antialias: !LITE, powerPreference: "high-performance" }}>
          {assets !== undefined && <Scene products={list} cart={cart} assets={assets} ctl={ctl} api={api} guide={guide} onHover={setHover} onMoved={() => advance(1)} onNear={(n) => { nearRef.current = n; setNear(n); }} />}
        </Canvas></Boundary>
      </div>
      <div aria-hidden="true" className="s3d-vignette pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 bg-[#1d1409] transition-opacity duration-300 ${fade ? "opacity-100" : "opacity-0"}`} />

      {phase === "play" && <div className="pointer-events-none absolute inset-0">
        {/* top bar: exit + menu | trolley */}
        <div className="pointer-events-auto absolute left-3 top-3 flex gap-2">
          <a href="#/" aria-label={t("Exit")} className="s3d-glass grid h-11 w-11 place-items-center rounded-full"><X size={18} /></a>
          <button onClick={() => { unlock(); setPaused(true); }} className="s3d-glass flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold" aria-label={t("Open menu")}><Menu size={16} /><span className="hidden sm:inline">{t("Menu")}</span></button>
        </div>
        <button key={bump} onClick={() => { unlock(); setPanel((p) => !p); }} aria-label={t("Open trolley")} className={`pointer-events-auto absolute right-3 top-3 flex h-11 items-center gap-2 rounded-full bg-gradient-to-b from-[#f0c468] to-[#d79a33] pl-3 pr-4 font-bold text-[#2a1a0c] shadow-lg ${bump ? "s3d-bump" : ""}`}>
          <span className="relative"><ShoppingBasket size={20} />{count > 0 && <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[#3f562a] px-1 text-[10px] text-white">{count}</span>}</span>{money(total)}</button>

        {/* aisle dock: one tap / number key to jump */}
        <nav aria-label={t("Go to")} className="pointer-events-auto absolute inset-x-0 top-[60px] flex justify-center px-3 md:bottom-6 md:top-auto">
          <div className="s3d-glass no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
            {dock.map(([k, l], n) => <button key={k} onClick={() => go(k)} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:bg-white/15 ${k === "counter" && count ? "bg-[#3f562a]" : ""} ${coach === 4 && k === "counter" ? "ring-2 ring-gold" : ""}`}>
              {!TOUCH && <kbd className="grid h-5 w-5 place-items-center rounded bg-white/15 font-body text-[11px]">{n + 1}</kbd>}{t(l)}{k === "counter" && count > 0 && <span className="rounded-full bg-gold px-1.5 text-[11px] font-bold text-[#2a1a0c]">{count}</span>}</button>)}
          </div>
        </nav>

        {/* centre stack: coach, guide, toast */}
        <div className="absolute inset-x-0 top-[112px] flex flex-col items-center gap-2 px-3 md:top-5">
          {coach > 0 && playing && (() => { const [I, h, d] = COACH[coach - 1]; return <div key={coach} className="s3d-up s3d-glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl p-3 pr-2" role="status">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold text-[#2a1a0c]"><I size={20} /></span>
            <span className="min-w-0 flex-1 text-sm"><b className="block">{t(h)} <span className="font-normal text-white/60">· {coach}/4</span></b><span className="text-white/80">{t(d)}</span></span>
            <button onClick={coachDone} aria-label={t("Hide tips")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-white/10"><X size={16} /></button></div>; })()}
          {count > 0 && near !== "counter" && playing && coach === 0 && <div className="s3d-glass flex items-center gap-2 rounded-full px-4 py-1.5 text-xs"><div ref={guide} aria-hidden="true"><Navigation size={18} className="text-gold" /></div>{t("Checkout counter")}</div>}
          {toast && <div role="status" className="s3d-up rounded-full bg-white px-5 py-2 text-sm font-semibold shadow-xl">{toast}</div>}
        </div>

        {!TOUCH && playing && <div className={`absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow ring-1 ring-black/40 transition ${hover ? "scale-150 border-gold bg-gold/40" : "border-white"}`} />}
        {hover && playing && <div className="absolute inset-x-0 top-[57%] flex justify-center"><div className="s3d-glass rounded-2xl px-5 py-3 text-center">
          <p className="font-display text-lg font-bold">{pname(hover)} <span className="text-sm font-normal text-white/70">{hover.size}</span></p>
          <p className="text-sm text-gold">{hover.status === "coming_soon" ? t("Coming soon") : <>{money(hover.price)} · <span className="text-white/80">{t("click for details · E adds 1")}</span></>}</p></div></div>}

        {/* at the counter: the one action that matters, big and with the amount */}
        {near === "counter" && playing && <div className="absolute inset-x-0 bottom-10 flex justify-end px-4 md:bottom-[96px] md:justify-center">
          {count > 0 ? <button onClick={openCheckout} className="s3d-up pointer-events-auto flex items-center gap-2 rounded-full bg-[#3f562a] px-7 py-4 text-base font-bold text-white shadow-2xl ring-2 ring-gold/70">
            {t("Checkout")} · {money(total)}{!TOUCH && <kbd className="rounded bg-white/15 px-1.5 text-xs">E</kbd>}<ArrowRight size={18} /></button>
            : <div className="s3d-up s3d-glass pointer-events-auto flex items-center gap-3 rounded-2xl p-3 text-sm">{t("Your trolley is empty")}{cats[0] && <button onClick={() => go(cats[0][0])} className="rounded-full bg-gold px-4 py-1.5 font-semibold text-[#2a1a0c]">{t(cats[0][1])} →</button>}</div>}
        </div>}

        {snack && <div className="absolute inset-x-0 bottom-[180px] flex justify-center px-3 md:bottom-[164px]"><div className="s3d-up flex items-center gap-3 rounded-2xl bg-white py-2.5 pl-3 pr-2 text-sm shadow-2xl" role="status">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#3f562a] text-white"><Check size={16} /></span>
          <span><b>{t("Added")}:</b> {snack.text}<span className="block text-xs text-muted">{t("Trolley total")} {money(snack.total)}</span></span>
          <button onClick={openCheckout} className="pointer-events-auto rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-[#2a1a0c]">{t("Checkout")}</button></div></div>}

        {TOUCH && playing && <Joystick ctl={ctl} />}

        {panel && <aside className="s3d-up pointer-events-auto absolute right-3 top-16 flex max-h-[78vh] w-[22rem] max-w-[94vw] flex-col overflow-hidden rounded-3xl bg-[#fffaf0] shadow-2xl" data-lenis-prevent aria-label={t("Trolley")}>
          <div className="flex items-center justify-between border-b border-black/10 p-4"><h3 className="font-display text-xl font-bold">{t("Your trolley")} <span className="text-sm font-normal text-muted">({count})</span></h3><button onClick={() => { setPanel(false); lockIn(); }} aria-label={t("Close trolley")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5"><X size={18} /></button></div>
          {!cart.length ? <div className="p-5 text-sm text-muted"><p>{t("Empty. Tap or click a jar on a shelf to add it.")}</p>{cats[0] && <button onClick={() => go(cats[0][0])} className="mt-3 rounded-full bg-gold px-4 py-2 font-semibold text-[#2a1a0c]">{t(cats[0][1])} →</button>}</div> : <>
            <div className="flex-1 overflow-y-auto px-4">{cart.map((i) => <div key={i.id} className="flex items-center gap-3 border-b border-black/5 py-3">
              {i.image_url ? <img src={i.image_url} alt="" className="h-14 w-14 rounded-xl bg-[#3f562a]/10 object-contain p-1" /> : <div className="h-14 w-14 rounded-xl bg-gold/30" />}
              <div className="min-w-0 flex-1 text-sm"><p className="truncate font-semibold">{pname(i)}</p><p className="text-muted">{i.size} · {money(i.price)}</p>
                <div className="mt-1 flex items-center gap-2"><button className="grid h-7 w-7 place-items-center rounded-full border" onClick={() => dec(i.id)} aria-label={`${t("Decrease")} ${pname(i)}`}><Minus size={12} /></button><b>{i.qty}</b><button className="grid h-7 w-7 place-items-center rounded-full border" onClick={() => onAdd(i, true)} aria-label={`${t("Increase")} ${pname(i)}`}><Plus size={12} /></button></div></div>
              <div className="text-right text-sm"><b>{money(i.price * i.qty)}</b><button onClick={() => del(i.id)} className="mt-2 block text-muted hover:text-red-600" aria-label={`${t("Remove")} ${pname(i)}`}><Trash2 size={15} /></button></div></div>)}</div>
            <div className="border-t border-black/10 p-4"><p className="flex justify-between font-bold"><span>{t("Total")}</span><span className="text-[#9a6b00]">{money(total)}</span></p>
              <p className="flex justify-between text-sm text-muted"><span>{t("Delivery")}</span><span className="font-semibold text-[#3f562a]">{t("Free")}</span></p>
              <button onClick={openCheckout} className="mt-3 w-full rounded-full bg-[#3f562a] py-3 font-bold text-white">{t("Go to checkout")} · {money(total)}</button>
              <div className="mt-3"><Trust /></div></div></>}
        </aside>}
      </div>}

      {quick && <QuickView p={quick.p} list={list} onClose={closeQuick} onPick={(x) => setQuick((q) => ({ ...q, p: x }))} onAdd={(p, qty) => { addItem(p, qty, quick.point); setQuick(null); lockIn(); }} />}

      {/* welcome: what you can do here in three steps, and why it is safe */}
      {phase === "intro" && assets !== undefined && <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_center,rgba(20,14,6,.35),rgba(20,14,6,.75))] p-3 backdrop-blur-[3px]">
        <div className="s3d-up grid max-h-full w-full max-w-3xl overflow-hidden overflow-y-auto rounded-[28px] bg-[#fffaf0] shadow-2xl md:grid-cols-2">
          <div className="relative flex flex-col justify-between gap-5 overflow-hidden bg-[linear-gradient(160deg,#4a6532,#22321a)] p-6 text-white md:p-8">
            <span aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/25 blur-3xl" />
            <div className="relative"><span className="inline-block rounded-full bg-white px-3 py-1.5"><img src="/logo.webp" alt="Bonadi" className="h-7 w-auto" /></span>
              <p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-gold">{t("BONADI 3D STORE")}</p>
              <h1 className="mt-2 font-display text-3xl font-bold leading-tight md:text-4xl">{t("Walk in. Pick it with your own eyes.")}</h1></div>
            <div aria-hidden="true" className="relative hidden h-40 items-end justify-center gap-2 md:flex">{["250", "500", "1000"].map((s, k) => <img key={s} src={`/products/ghee-${s}.webp`} alt="" className="w-auto drop-shadow-[0_16px_16px_rgba(0,0,0,.45)]" style={{ height: `${62 + k * 19}%` }} />)}</div>
            <div className="relative"><Trust dark /></div>
          </div>
          <div className="flex flex-col p-6 md:p-8">
            <ol className="space-y-4">{[[Footprints, "Walk the aisles", TOUCH ? "Joystick to walk, drag to look — or tap an aisle to jump there." : "W A S D to walk, mouse to look — or press 1–4 to jump."],
              [MousePointerClick, "Tap a jar", "See the price, compare sizes, choose how many."],
              [Banknote, "Order at the counter", "Nothing to pay now. Pay in cash when it arrives."]].map(([I, h, d], k) => <li key={h} className="flex gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#3f562a]/10 text-[#3f562a]"><I size={20} /></span>
                <span><b className="block">{k + 1}. {t(h)}</b><span className="text-sm text-muted">{t(d)}</span></span></li>)}</ol>
            <button onClick={start} className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#f0c468] to-[#d79a33] py-4 text-lg font-bold text-[#2a1a0c] shadow-lg transition hover:brightness-105 active:scale-[.98]">{t("Enter the store")}<ArrowRight size={20} /></button>
            <a href="#/shop" className="mt-3 block text-center text-sm font-semibold text-muted underline">{t("Shop the normal way instead")}</a>
          </div>
        </div></div>}
      {assets === undefined && <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_40%,#4a6532,#1c2914)] text-white"><div className="text-center"><img src="/logo.webp" alt="Bonadi" className="mx-auto h-14 rounded-xl bg-white p-2" /><div className="spinner mx-auto mt-6" /><p className="mt-3 text-sm text-white/75">{t("Setting up the store…")}</p></div></div>}

      {paused && !checkout && !done && <div className="absolute inset-0 grid place-items-center bg-black/60 p-4" role="dialog" aria-label={t("Menu")}><div className="s3d-up w-full max-w-sm rounded-[28px] bg-[#fffaf0] p-6 text-center shadow-2xl">
        <h2 className="font-display text-2xl font-bold">{t("Paused")}</h2><div className="mt-4 space-y-2">
          <button onClick={resume} className="w-full rounded-full bg-gradient-to-b from-[#f0c468] to-[#d79a33] py-3 font-bold text-[#2a1a0c]">{t("Resume shopping")}</button>
          <button onClick={() => { setPaused(false); setPanel(true); }} className="w-full rounded-full border-2 border-black/10 py-2.5 font-semibold">{t("View trolley")} ({count})</button>
          {count > 0 && <button onClick={openCheckout} className="w-full rounded-full bg-[#3f562a] py-2.5 font-semibold text-white">{t("Go to checkout")} · {money(total)}</button>}
          <a href="#/shop" className="block rounded-full border-2 border-black/10 py-2.5 font-semibold">{t("Shop normally")}</a><a href="#/" className="block py-2 text-sm text-muted underline">{t("Exit to homepage")}</a></div></div></div>}

      {checkout && <div className="absolute inset-0 grid place-items-end overflow-y-auto bg-black/60 md:place-items-center md:p-4" data-lenis-prevent role="dialog" aria-modal="true" aria-label={t("Checkout")}>
        <form onSubmit={confirm} noValidate className="s3d-up w-full max-w-md rounded-t-[28px] bg-[#fffaf0] p-5 shadow-2xl md:rounded-[28px] md:p-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">{t("Confirm your order")}</h2><button type="button" onClick={() => { setCheckout(false); lockIn(); }} aria-label={t("Back to store")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5"><X size={18} /></button></div>
          <div className="max-h-36 space-y-2 overflow-y-auto">{cart.map((i) => <div key={i.id} className="flex items-center gap-3 text-sm">
            {i.image_url ? <img src={i.image_url} alt="" className="h-10 w-10 rounded-lg bg-[#3f562a]/10 object-contain p-0.5" /> : <div className="h-10 w-10 rounded-lg bg-gold/30" />}
            <span className="min-w-0 flex-1 truncate">{pname(i)} {i.size} × {i.qty}</span><b>{money(i.price * i.qty)}</b></div>)}</div>
          <div className="my-3 space-y-1 rounded-2xl bg-black/[.04] p-3 text-sm"><p className="flex justify-between"><span>{t("Subtotal")}</span><span>{money(total)}</span></p>
            <p className="flex justify-between"><span>{t("Delivery")}</span><span className="font-semibold text-[#3f562a]">{t("Free")}</span></p><p className="flex justify-between text-lg font-bold"><span>{t("Total")}</span><span className="text-[#9a6b00]">{money(total)}</span></p>
            <p className="text-xs text-muted">{t("The final total is confirmed by our server when you place the order.")}</p></div>
          <label className="block text-sm font-semibold">{t("Full name")}<input className={field("name")} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="mt-2 block text-sm font-semibold">{t("Phone number")}<input className={field("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            {tried && bad.phone && <span className="mt-1 block text-xs font-normal text-red-600">{t("Use an 11-digit BD number, e.g. 017XXXXXXXX.")}</span>}</label>
          <label className="mt-2 block text-sm font-semibold">{t("Delivery address")}<textarea className={field("address")} autoComplete="street-address" rows={2} placeholder={t("House, road, area, district")} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
          {canDrop && <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={drop} onChange={(e) => setDrop(e.target.checked)} />{t("Dropship order (I earn commission)")}</label>}
          {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
          <button disabled={busy} className="mt-4 w-full rounded-full bg-[#3f562a] py-3.5 text-base font-bold text-white shadow-lg disabled:opacity-60">{busy ? t("Placing order…") : `${t("Place order")} · ${money(total)}`}</button>
          <p className="mt-2 text-center text-xs text-muted">{t("Nothing to pay now — Cash on Delivery. bKash, Nagad and card are not available yet.")}</p>
          <div className="mt-3 flex justify-center"><Trust /></div>
        </form></div>}

      {done && <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_40%,#4a6532,#1c2914)] p-4" role="dialog" aria-modal="true"><Confetti /><div className="s3d-up relative w-full max-w-md rounded-[28px] bg-[#fffaf0] p-7 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-b from-[#f0c468] to-[#d79a33] text-[#2a1a0c] shadow-lg"><Check size={42} /></div>
        <h2 className="font-display text-3xl font-bold">{t("Thank you!")}</h2><p className="mt-1 text-muted">{t("Your order is placed.")} {money(done.total)} · {t("Cash on Delivery")}</p>
        <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-2xl border-2 border-dashed border-gold px-4 py-2"><span className="text-sm text-muted">{t("Order number")}</span><b className="font-display text-2xl">#{done.id}</b>
          <button onClick={copyId} aria-label={t("Copy")} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5">{copied ? <Check size={16} className="text-[#3f562a]" /> : <Copy size={16} />}</button></div>
        <p className="mt-1 text-xs text-muted">{t("Keep this number — you need it to track your order.")}</p>
        <ol className="mt-5 space-y-2 text-left text-sm">{[[PhoneCall, "We call you to confirm the address."], [Truck, "Free delivery to your door."], [PackageCheck, "Check the jar, then pay in cash."]].map(([I, l]) => <li key={l} className="flex items-center gap-3 rounded-xl bg-black/[.04] px-3 py-2"><I size={18} className="shrink-0 text-[#3f562a]" />{t(l)}</li>)}</ol>
        <a href="#/track" className="mt-5 flex items-center justify-center gap-2 rounded-full bg-[#3f562a] py-3 font-semibold text-white">{t("Track your order")}</a>
        <div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => { setDone(null); resume(); }} className="rounded-full border-2 border-black/10 py-2.5 text-sm font-semibold">{t("Keep shopping")}</button>
          <a href="#/" className="flex items-center justify-center gap-1.5 rounded-full border-2 border-black/10 py-2.5 text-sm font-semibold"><Home size={16} />{t("Homepage")}</a></div></div></div>}
    </div>
  );
}
