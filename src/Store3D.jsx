/**
 * Store3D — OPTIONAL first-person 3D supermarket (route #/store). Lazy-loaded and isolated from the normal shop.
 * Real data: products from Supabase; the trolley IS the site cart (same state as the cart drawer);
 * checkout calls the same place_order() RPC (server re-prices everything).
 * Controls: WASD/arrows + mouse (click to capture), E = pick/interact, C = trolley, Esc = menu. Touch: joystick, drag to look, tap to pick.
 * Everything is built from primitives + canvas textures (no external models) so it loads fast. Bottle labels use the real BONADI logo.
 */
import React, { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { X, ShoppingBasket, Plus, Minus, Trash2, Check, Home, Menu, Navigation } from "lucide-react";
import { submitOrder, validOrder } from "./lib/order.js";

const TOUCH = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
const LITE = TOUCH || (typeof window !== "undefined" && window.innerWidth < 768);   // lighter rendering on phones
const Y = new THREE.Vector3(0, 1, 0);
const LOGO_ASPECT = 0.3611;
const GOLD = "#d4a843", BROWN = "#4a2a0e", GREEN = "#4f6b2a";

/* ---------- Layout (metres). Player spawns inside the entrance, facing the aisles and checkout ---------- */
// order: [L-3.6, R-3.6, L0, R0, L3.6, R3.6, gondola1 A, gondola1 B, gondola2 A, gondola2 B]
const UNITS = (() => {
  const u = [];
  [-3.6, 0, 3.6].forEach((z) => { u.push({ x: -7.55, z, rot: Math.PI / 2, len: 3.4 }); u.push({ x: 7.55, z, rot: -Math.PI / 2, len: 3.4 }); });
  [-3, 3].forEach((xg) => { u.push({ x: xg + 0.38, z: 0, rot: Math.PI / 2, len: 4.6 }); u.push({ x: xg - 0.38, z: 0, rot: -Math.PI / 2, len: 4.6 }); });
  return u;
})();
const CAT_OF_UNIT = ["ghee", "honey", "ghee", "honey", "honey", "ghee", "ghee", "honey", "oil", "oil"];
const CAT_SIGN = { ghee: "PURE GHEE · খাঁটি গাওয়া ঘি", honey: "NATURAL HONEY", oil: "MUSTARD OIL · COMING SOON", other: "BONADI" };
const COUNTER = { x: 0, z: -8.6 }, DISPLAY = { x: 0, z: -4.8 };
const BLOCKS = [...UNITS.map((u) => [u.x, u.z, 0.4, u.len / 2]), [COUNTER.x, COUNTER.z, 2.1, 0.75], [DISPLAY.x, DISPLAY.z, 1.45, 1.45],
  [5.9, 9.7, 1.1, 0.5], [-5.5, 9.7, 0.35, 0.35], [-7.1, 10.2, 0.35, 0.35], [7.1, -10.2, 0.35, 0.35], [-7.1, -10.2, 0.35, 0.35], [-5.2, 6.4, 0.6, 0.35], [5.2, 6.4, 0.6, 0.35]];
const ROWS = [0.12, 0.8, 1.48];

/* ---------- helpers ---------- */
const catOf = (p) => (/honey|modhu|মধু/i.test(p.name) ? "honey" : /oil|tel|তেল/i.test(p.name) ? "oil" : /ghee|ghi|ঘি/i.test(p.name) ? "ghee" : "other");
const contentColor = (p) => ({ honey: "#d9901a", oil: "#b8a636", ghee: "#e8b84b", other: "#e3b64f" }[catOf(p)]);
/** Bottle scale from the size text (cube-root of volume), so 250 g / 500 g / 1 kg look different */
function sizeScale(p) { const m = /([\d.]+)\s*(kg|g|l|ml)/i.exec(p.size || ""); if (!m) return 1; const v = +m[1] * (/^(kg|l)$/i.test(m[2]) ? 1000 : 1); return Math.max(0.72, Math.min(1.3, Math.cbrt(v / 500))); }
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
const mkTex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

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
function tagTexture(p, soon) {
  const c = document.createElement("canvas"); c.width = 340; c.height = 100; const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 340, 100); g.fillStyle = GOLD; g.fillRect(0, 0, 340, 10);
  g.fillStyle = "#333"; g.textAlign = "left"; g.font = "bold 26px Arial"; g.fillText(p.name.replace(/\(.*\)/, "").trim().slice(0, 20), 12, 48); g.font = "22px Arial"; g.fillStyle = "#666"; g.fillText(p.size || "", 12, 82);
  g.textAlign = "right"; g.font = "bold 44px Arial"; g.fillStyle = soon ? "#888" : "#9a6b00"; g.fillText(soon ? "Soon" : "৳" + p.price, 328, 84);
  return mkTex(c);
}
function signTexture(text, w, h, bg, fg, size = 90, font = 'Georgia, "Noto Sans Bengali", serif') {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
  let s = size; g.font = `bold ${s}px ${font}`; while (g.measureText(text).width > w * 0.9 && s > 14) { s -= 2; g.font = `bold ${s}px ${font}`; }   // shrink to fit
  g.fillText(text, w / 2, h / 2 + 4); return mkTex(c);
}
const useSign = (...a) => useMemo(() => signTexture(...a), [a.join("|")]);   // eslint-disable-line

/* ---------- Jar kit ----------
 * Ghee: built from YOUR bottle photos. public/products/wrap-{250,500,1000}.jpg are the real bottle artwork unwrapped onto a cylinder,
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
const wallMat = <meshStandardMaterial color="#f5eedd" roughness={0.92} />;
const woodMat = <meshStandardMaterial color="#5a3817" roughness={0.6} />;

function Plant({ x, z, s = 1 }) {
  return (<group position={[x, 0, z]} scale={s}>
    <mesh position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[0.28, 0.2, 0.5, 18]} /><meshStandardMaterial color="#8a5a34" roughness={0.7} /></mesh>
    {[[0, 0.95, 0, 0.42], [0.18, 0.75, 0.1, 0.3], [-0.2, 0.8, -0.08, 0.32], [0.05, 1.25, -0.05, 0.28]].map(([px, py, pz, r], k) => <mesh key={k} position={[px, py, pz]} scale={[1, 1.25, 1]} castShadow><sphereGeometry args={[r, 14, 12]} /><meshStandardMaterial color={k % 2 ? "#5d7d33" : GREEN} roughness={0.8} /></mesh>)}
  </group>);
}
function PromoStand({ x, z, rot, text, sub }) {
  const t = useSign(text, 512, 700, "#fffaf0", BROWN, 62), t2 = useSign(sub, 512, 160, GOLD, "#333", 44, "Arial");
  return (<group position={[x, 0, z]} rotation={[0, rot, 0]}>
    {[-1, 1].map((s) => <group key={s} rotation={[s * 0.12, 0, 0]} position={[0, 0.8, s * 0.12]}><mesh castShadow><boxGeometry args={[1.0, 1.5, 0.05]} />{woodMat}</mesh>
      <mesh position={[0, 0.12, s * 0.03]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[0.9, 1.1]} /><meshBasicMaterial map={t} /></mesh>
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
  const floor = useMemo(() => { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
    g.fillStyle = "#ece2cb"; g.fillRect(0, 0, 256, 256); g.fillStyle = "#e1d4b6"; g.fillRect(0, 0, 128, 128); g.fillRect(128, 128, 128, 128);
    g.strokeStyle = "rgba(120,90,50,.18)"; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256); const t = mkTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 8); return t; }, []);
  const logoTex = useMemo(() => { if (!logo) return null; const t = new THREE.Texture(logo); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; }, [logo]);
  const exit = useSign("EXIT", 256, 96, "#2f7d3a", "#fff", 64), banner = useSign("PURE FOOD, HONEST PROMISE", 1024, 128, BROWN, GOLD, 64);
  const frame = (x, z, r, k) => <group key={k} position={[x, 3.1, z]} rotation={[0, r, 0]}><mesh position={[0, 0, -0.02]}><boxGeometry args={[1.5, 0.8, 0.04]} />{woodMat}</mesh><mesh><planeGeometry args={[1.38, 0.68]} /><meshBasicMaterial color="#fbf6e9" /></mesh>
    {logoTex && <mesh position={[0, 0, 0.005]}><planeGeometry args={[1.2, 1.2 * LOGO_ASPECT]} /><meshBasicMaterial map={logoTex} transparent /></mesh>}</group>;
  return (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[16, 22]} /><meshStandardMaterial map={floor} roughness={0.38} metalness={0.05} envMapIntensity={0.6} /></mesh>
    <mesh position={[0, 4, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[16, 22]} /><meshStandardMaterial color="#fffaf0" /></mesh>
    {[-8, -3, 3, 8].map((z) => <mesh key={z} position={[0, 3.88, z]}><boxGeometry args={[16, 0.22, 0.3]} />{woodMat}</mesh>)}
    <mesh position={[0, 2, -11]}><boxGeometry args={[16, 4, 0.2]} />{wallMat}</mesh>
    <mesh position={[-8, 2, 0]}><boxGeometry args={[0.2, 4, 22]} />{wallMat}</mesh><mesh position={[8, 2, 0]}><boxGeometry args={[0.2, 4, 22]} />{wallMat}</mesh>
    {/* back wall: wainscot + brand logo + tagline */}
    <mesh position={[0, 0.45, -10.86]}><boxGeometry args={[16, 0.9, 0.06]} />{woodMat}</mesh>
    {logoTex && <mesh position={[0, 2.75, -10.88]}><planeGeometry args={[5.2, 5.2 * LOGO_ASPECT]} /><meshBasicMaterial map={logoTex} transparent /></mesh>}
    <mesh position={[0, 1.55, -10.88]}><planeGeometry args={[5.2, 0.65]} /><meshBasicMaterial map={banner} /></mesh>
    {/* entrance: wall with glass double doors, logo header, EXIT sign, daylight outside */}
    <mesh position={[-4.6, 2, 10.9]}><boxGeometry args={[6.8, 4, 0.2]} />{wallMat}</mesh><mesh position={[4.6, 2, 10.9]}><boxGeometry args={[6.8, 4, 0.2]} />{wallMat}</mesh>
    <mesh position={[0, 3.25, 10.9]}><boxGeometry args={[2.4, 1.5, 0.2]} />{wallMat}</mesh>
    {[-0.6, 0.6].map((x) => <group key={x} position={[x, 1.25, 10.86]}><mesh><boxGeometry args={[1.12, 2.5, 0.03]} /><meshStandardMaterial color="#cfe6ee" transparent opacity={0.22} roughness={0.05} metalness={0.2} depthWrite={false} /></mesh>
      <mesh position={[0, 1.22, 0]}><boxGeometry args={[1.16, 0.06, 0.06]} /><meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} /></mesh><mesh position={[0, -1.22, 0]}><boxGeometry args={[1.16, 0.06, 0.06]} /><meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[x > 0 ? -0.5 : 0.5, 0, 0.04]}><boxGeometry args={[0.03, 0.5, 0.04]} /><meshStandardMaterial color="#aaa" metalness={0.9} roughness={0.2} /></mesh></group>)}
    <mesh position={[0, 1.25, 10.7 + 0.04]}><boxGeometry args={[0.04, 2.5, 0.06]} /><meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} /></mesh>
    <mesh position={[0, 1.4, 11.6]} rotation={[0, Math.PI, 0]}><planeGeometry args={[7, 4]} /><meshBasicMaterial color="#fff6dc" /></mesh>
    <mesh position={[0, 2.78, 10.78]} rotation={[0, Math.PI, 0]}><planeGeometry args={[1.0, 0.36]} /><meshBasicMaterial map={exit} /></mesh>
    {logoTex && <mesh position={[0, 3.5, 10.78]} rotation={[0, Math.PI, 0]}><planeGeometry args={[1.9, 1.9 * LOGO_ASPECT]} /><meshBasicMaterial map={logoTex} transparent /></mesh>}
    {/* wall frames, ceiling lights, pendants */}
    {[-6, 0, 6].flatMap((z) => [frame(-7.88, z, Math.PI / 2, "l" + z), frame(7.88, z, -Math.PI / 2, "r" + z)])}
    {[-6, -1, 5].flatMap((z) => [-4, 4].map((x) => <mesh key={x + "" + z} position={[x, 3.76, z]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[2.4, 0.5]} /><meshBasicMaterial color="#fffbe8" /></mesh>))}
    {[-1.1, 1.1].map((x) => <group key={x} position={[x, 0, -8.2]}><mesh position={[0, 3.5, 0]}><cylinderGeometry args={[0.01, 0.01, 0.8]} /><meshBasicMaterial color="#222" /></mesh><mesh position={[0, 3.05, 0]}><sphereGeometry args={[0.2, 16, 12]} /><meshBasicMaterial color="#ffe3a0" /></mesh></group>)}
    {/* decoration */}
    <Plant x={-7.1} z={10.2} s={1.1} /><Plant x={-7.1} z={-10.2} /><Plant x={7.1} z={-10.2} />
    <PromoStand x={-5.2} z={6.4} rot={0.25} text="BONADI" sub="Pure Food, Honest Promise" /><PromoStand x={5.2} z={6.4} rot={-0.25} text="Cash on Delivery" sub="Free delivery" />
    {[0, 1, 2].map((k) => <group key={k} position={[4.9 + k * 0.7, 0, 9.7]} rotation={[0, Math.PI, 0]}><TrolleyModel /></group>)}
    {[0, 1, 2, 3].map((k) => <mesh key={k} position={[-5.5, 0.12 + k * 0.1, 9.7]} castShadow><boxGeometry args={[0.46, 0.22, 0.32]} /><meshStandardMaterial color={GREEN} roughness={0.6} /></mesh>)}
  </>);
}

function CounterDesk({ logo }) {
  const till = useSign("CHECKOUT", 512, 128, "#333", GOLD, 80);
  const belt = useMemo(() => { const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d"); g.fillStyle = "#222"; g.fillRect(0, 0, 64, 256); g.fillStyle = "#383838"; for (let i = 0; i < 256; i += 16) g.fillRect(0, i, 64, 6); const t = mkTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 4); return t; }, []);
  const logoTex = useMemo(() => { if (!logo) return null; const t = new THREE.Texture(logo); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; }, [logo]);
  const steel = <meshStandardMaterial color="#9aa0a6" metalness={0.9} roughness={0.25} />;
  return (<group position={[COUNTER.x, 0, COUNTER.z]}>
    <mesh position={[0, 0.5, 0]} castShadow receiveShadow><boxGeometry args={[4, 1, 1.2]} />{woodMat}</mesh>
    <mesh position={[0, 1.01, 0]} receiveShadow><boxGeometry args={[4.1, 0.05, 1.3]} /><meshStandardMaterial color={GOLD} metalness={0.5} roughness={0.3} /></mesh>
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
    <mesh position={[0, 2.5, 0.3]}><planeGeometry args={[2.4, 0.6]} /><meshBasicMaterial map={till} /></mesh>
  </group>);
}

function Shelf({ u, cat, soon }) {
  const wood = <meshStandardMaterial color="#c9a46b" roughness={0.7} />;
  const sign = useSign(CAT_SIGN[cat] || "BONADI", 1024, 160, soon ? "#555" : BROWN, soon ? "#ddd" : GOLD, 70);
  return (
    <group position={[u.x, 0, u.z]} rotation={[0, u.rot, 0]}>
      <mesh position={[0, 1.2, -0.35]} castShadow receiveShadow><boxGeometry args={[u.len, 2.4, 0.05]} />{wood}</mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * u.len / 2, 1.2, 0]} castShadow><boxGeometry args={[0.05, 2.4, 0.7]} />{wood}</mesh>)}
      {[...ROWS, 2.14].map((y) => <mesh key={y} position={[0, y, 0]} receiveShadow castShadow><boxGeometry args={[u.len, 0.04, 0.7]} />{wood}</mesh>)}
      <mesh position={[0, 2.62, 0.05]}><boxGeometry args={[Math.min(u.len * 0.8, 2.6), 0.4, 0.05]} /><meshStandardMaterial color="#2b2b2b" /></mesh>
      <mesh position={[0, 2.62, 0.08]}><planeGeometry args={[Math.min(u.len * 0.8, 2.6) - 0.06, 0.34]} /><meshBasicMaterial map={sign} /></mesh>
    </group>
  );
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
        for (let x = -u.len / 2 + 0.6; x < u.len / 2 - 0.3; x += 1.15) tags[pi].push(new THREE.Matrix4().compose(at(new THREE.Vector3(x, top, 0.358)), q, one));
      });
    });
    return { jars, tags };
  }, [products, kit]);
  const setM = (arr) => (m) => { if (m) { arr.forEach((mx, k) => m.setMatrixAt(k, mx)); m.instanceMatrix.needsUpdate = true; } };
  const act = products.map((p, i) => i).filter((i) => products[i].status !== "coming_soon").slice(0, 6);
  const banner = useSign("BONADI · PREMIUM COLLECTION", 1024, 128, BROWN, GOLD, 62);
  return (
    <group ref={group}>
      {products.map((p, i) => jars[i].length > 0 && (<React.Fragment key={p.id}>
        {kit.parts[i].map((pt, k) => <instancedMesh key={k} args={[pt.g, pt.m, jars[i].length]} userData={{ product: p }} frustumCulled={false} renderOrder={pt.order || 0} ref={setM(jars[i])} />)}
        <instancedMesh args={[kit.tag, kit.tagM[i], tags[i].length]} frustumCulled={false} ref={setM(tags[i])} />
      </React.Fragment>))}
      <group position={[DISPLAY.x, 0, DISPLAY.z]}>
        <mesh position={[0, 0.125, 0]} castShadow receiveShadow><cylinderGeometry args={[1.4, 1.45, 0.25, 40]} />{woodMat}</mesh>
        <mesh position={[0, 0.26, 0]}><cylinderGeometry args={[1.42, 1.42, 0.03, 40]} /><meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.3} /></mesh>
        <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.6, 0.65, 0.28, 32]} />{woodMat}</mesh><mesh position={[0, 0.545, 0]}><cylinderGeometry args={[0.62, 0.62, 0.03, 32]} /><meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.3} /></mesh>
        {act.map((i, k) => { const a = (k / act.length) * Math.PI * 2 + 0.3, s = 1.3;
          return <Jar key={i} kit={kit} i={i} p={products[i]} scale={s} position={[Math.sin(a) * 1.0, 0.275 + kit.half[i] * s, Math.cos(a) * 1.0]} rotation={[0, a, 0]} />; })}
        {act[0] != null && <Jar kit={kit} i={act[0]} p={products[act[0]]} scale={1.6} position={[0, 0.56 + kit.half[act[0]] * 1.6, 0]} />}
        <mesh position={[0, 2.85, 0]}><boxGeometry args={[3.1, 0.55, 0.05]} /><meshStandardMaterial color="#222" /></mesh><mesh position={[0, 2.85, 0.03]}><planeGeometry args={[3.0, 0.45]} /><meshBasicMaterial map={banner} /></mesh>
        {[-1.4, 1.4].map((x) => <mesh key={x} position={[x, 3.4, 0]}><cylinderGeometry args={[0.01, 0.01, 1.1]} /><meshBasicMaterial color="#222" /></mesh>)}
      </group>
    </group>
  );
});

/* ---------- Player, interaction, collision, guidance ---------- */
function Scene({ products, cart, assets, ctl, api, onHover, onNear, guide }) {
  const { camera, scene, gl } = useThree();
  const group = useRef(), trolley = useRef(), hl = useRef(), fly = useRef([]);
  const ray = useMemo(() => new THREE.Raycaster(), []), tmp = useMemo(() => new THREE.Matrix4(), []), wp = useMemo(() => new THREE.Vector3(), []);
  const st = useRef({ x: 0, z: 8.6, bob: 0, hover: null, near: null });
  const items = useMemo(() => cart.flatMap((i) => Array(Math.min(i.qty, 6)).fill(i)).slice(0, 14), [cart]);
  useEffect(() => { camera.rotation.order = "YXZ"; camera.position.set(0, 1.6, 8.6); }, [camera]);
  useEffect(() => {   // local environment map (no network) = realistic reflections on glass, gold and steel
    const pm = new THREE.PMREMGenerator(gl), env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env; scene.environmentIntensity = 0.55; return () => { scene.environment = null; env.dispose(); pm.dispose(); };
  }, [gl, scene]);

  const cast = useCallback((ndc) => {
    ray.setFromCamera(ndc || { x: 0, y: 0 }, camera);
    const hit = ray.intersectObjects(group.current ? group.current.children : [], true).find((h) => h.object.userData.product);
    return hit && hit.distance < 3.4 ? hit : null;
  }, [camera, ray]);
  const hitPos = (hit, out) => { if (hit.instanceId != null) { hit.object.getMatrixAt(hit.instanceId, tmp); return out.setFromMatrixPosition(tmp); } return hit.object.getWorldPosition(out); };

  api.current.pick = (ndc, done) => {
    const hit = cast(ndc); if (!hit) return done(null, "Walk closer to a shelf, then aim at a product");
    const p = hit.object.userData.product; if (p.status === "coming_soon") return done(null, `${p.name} is coming soon`);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16), new THREE.MeshStandardMaterial({ color: contentColor(p) }));
    mesh.position.copy(hit.point); scene.add(mesh); fly.current.push({ mesh, from: hit.point.clone(), t: 0 }); done(p);
  };

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
      if (Math.hypot(nx - S.x, nz - S.z) > 0.0005) S.bob += dt * 9 * run;
      S.x = nx; S.z = nz;
    }
    camera.position.set(S.x, 1.6 + Math.sin(S.bob) * 0.025, S.z); camera.rotation.set(c.pitch, c.yaw, 0);
    const t = trolley.current; if (t) { t.position.set(S.x - Math.sin(c.yaw) * 1.0, 0, S.z - Math.cos(c.yaw) * 1.0); t.rotation.y = c.yaw; }
    if (!TOUCH && c.active) {
      const hit = cast(), key = hit ? hit.object.userData.product.id : null;
      if (hit) { hl.current.position.copy(hitPos(hit, wp)); hl.current.visible = true; } else hl.current.visible = false;
      if (key !== S.hover) { S.hover = key; onHover(hit ? hit.object.userData.product : null); }
    }
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

  return (<>
    <color attach="background" args={["#f4efe4"]} /><fog attach="fog" args={["#f4efe4", 16, 34]} />
    <hemisphereLight args={["#fff6e0", "#c9b48a", 0.75]} />
    <directionalLight position={[5, 9, 4]} intensity={1.0} castShadow={!LITE} shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-camera-far={30} shadow-bias={-0.0004} />
    {!LITE && <><pointLight position={[0, 3.3, -4.8]} intensity={14} distance={7} color="#ffe2a8" /><pointLight position={[0, 3.2, -8]} intensity={10} distance={6} color="#ffe9c0" /></>}
    <Shell logo={assets?.logo} /><CounterDesk logo={assets?.logo} />
    {UNITS.map((u, i) => <Shelf key={i} u={u} cat={CAT_OF_UNIT[i]} soon={CAT_OF_UNIT[i] === "oil"} />)}
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
    <div ref={base} role="application" aria-label="Movement joystick" className="pointer-events-auto absolute bottom-8 left-6 grid h-32 w-32 touch-none place-items-center rounded-full border-2 border-white/60 bg-black/25 backdrop-blur"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }} onPointerMove={(e) => e.buttons && move(e)} onPointerUp={end} onPointerCancel={end}>
      <div ref={knob} className="h-14 w-14 rounded-full bg-gold/90 shadow-lg" />
    </div>
  );
}

/** Catches WebGL/runtime errors so customers always have a way back to normal shopping */
class Boundary extends React.Component {
  state = { bad: false }; static getDerivedStateFromError() { return { bad: true }; }
  render() { return this.state.bad ? <Fallback msg="The 3D store hit a problem on this device." /> : this.props.children; }
}
const Fallback = ({ msg }) => (
  <div className="absolute inset-0 grid place-items-center bg-brand p-6 text-center text-white"><div><img src="/logo.png" alt="Bonadi" className="mx-auto h-14 rounded-xl bg-white p-2" />
    <p className="mt-5 text-lg font-semibold">{msg}</p><p className="mt-1 text-sm text-white/70">Please use our normal shop — everything is available there.</p>
    <a href="#/shop" className="btn mt-5">Shop normally</a></div></div>
);
const webglOK = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };

/* ---------- Main ---------- */
export default function Store3D({ products, cart, onAdd, setCart, clear, profile }) {
  const [phase, setPhase] = useState("intro"), [assets, setAssets] = useState(undefined), [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(null), [near, setNear] = useState(null), [panel, setPanel] = useState(false), [tut, setTut] = useState(0);
  const [checkout, setCheckout] = useState(false), [done, setDone] = useState(null), [toast, setToast] = useState("");
  const [f, setF] = useState({ name: "", phone: "", address: "" }), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [drop, setDrop] = useState(false);
  const ctl = useRef({ keys: new Set(), joy: { x: 0, y: 0 }, yaw: 0, pitch: 0, active: false });
  const api = useRef({}), wrap = useRef(null), nearRef = useRef(null), touch = useRef(null), toastT = useRef(), guide = useRef(null), noPause = useRef(false), lock = useRef(false), live = useRef(false);
  const [gl] = useState(webglOK);
  const list = useMemo(() => (products.length ? products : [{ id: 0, name: "Bonadi Pure Ghee", size: "500 g", price: 950, status: "active" }]), [products]);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0), count = cart.reduce((s, i) => s + i.qty, 0);
  const canDrop = profile?.role === "dropshipper" && profile?.status === "approved";
  const playing = phase === "play" && !checkout && !done && !paused && !tut;
  ctl.current.active = playing; live.current = phase === "play" && !checkout && !done;

  const say = useCallback((m) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 2400); }, []);
  const unlock = useCallback(() => { noPause.current = true; document.exitPointerLock?.(); setTimeout(() => { noPause.current = false; }, 300); }, []);
  useEffect(() => { window.__lenis?.stop(); document.title = "Bonadi 3D Store"; return () => { window.__lenis?.start(); unlock(); }; }, [unlock]);
  useEffect(() => { if (profile) setF((x) => ({ ...x, name: x.name || profile.full_name || "", phone: x.phone || profile.phone || "" })); }, [profile]);
  useEffect(() => {   // preload: logo, Bengali font, real bottle artwork (wrap textures) before building the scene
    let ok = true;
    const load = async () => {
      const [logo, meta] = await Promise.all([loadImg("/logo.png"), fetch("/products/ghee-meta.json").then((r) => r.json()).catch(() => ({})), document.fonts?.load('700 30px "Noto Sans Bengali"', "খাঁটি").catch(() => 0)]);
      const wraps = {}; await Promise.all(Object.entries(meta).map(async ([k, v]) => { wraps[k] = await loadImg(v.wrap); }));
      return { logo, meta, wraps };
    };
    Promise.race([load(), new Promise((r) => setTimeout(() => r({ logo: null, meta: {}, wraps: {} }), 6000))]).then((a) => ok && setAssets(a));
    return () => { ok = false; };
  }, []);
  useEffect(() => {   // Esc (pointer-lock release) opens the pause menu
    const h = () => { lock.current = !!document.pointerLockElement; if (!lock.current && live.current && !noPause.current && !TOUCH) setPaused(true); };
    document.addEventListener("pointerlockchange", h); return () => document.removeEventListener("pointerlockchange", h);
  }, []);

  const pick = useCallback((ndc) => api.current.pick?.(ndc, (p, msg) => { if (p) { onAdd(p, true); say(`Added to trolley: ${p.name} ${p.size || ""}`); } else say(msg); }), [onAdd, say]);
  const openCheckout = useCallback(() => { if (!cart.length) return say("Your trolley is empty — pick something first"); unlock(); setPanel(false); setPaused(false); setCheckout(true); }, [cart.length, say, unlock]);
  const act = useCallback(() => { const n = nearRef.current; if (n === "counter") openCheckout(); else if (n === "exit") window.location.hash = "#/"; else pick(null); }, [openCheckout, pick]);

  useEffect(() => {
    const typing = (e) => /INPUT|TEXTAREA/.test(e.target.tagName);
    const kd = (e) => { if (typing(e)) return; const k = e.key.toLowerCase(); ctl.current.keys.add(k); if (k === "e" && ctl.current.active) act(); if (k === "c") setPanel((p) => !p); if (k === "escape" && TOUCH) setPaused((p) => !p); if ([" ", "arrowup", "arrowdown"].includes(k)) e.preventDefault(); };
    const ku = (e) => ctl.current.keys.delete(e.key.toLowerCase());
    const mm = (e) => { if (document.pointerLockElement && ctl.current.active) { ctl.current.yaw -= e.movementX * 0.0023; ctl.current.pitch = Math.max(-1.2, Math.min(1.2, ctl.current.pitch - e.movementY * 0.0023)); } };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); document.addEventListener("mousemove", mm);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); document.removeEventListener("mousemove", mm); };
  }, [act]);

  const onClick = () => { if (TOUCH || !ctl.current.active) return; if (document.pointerLockElement) pick(null); else wrap.current.requestPointerLock?.(); };
  const pd = (e) => { if (e.pointerType === "touch") touch.current = { x: e.clientX, y: e.clientY, moved: 0 }; };
  const pm = (e) => { const t = touch.current; if (!t || e.pointerType !== "touch" || !ctl.current.active) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y; t.moved += Math.abs(dx) + Math.abs(dy); t.x = e.clientX; t.y = e.clientY;
    ctl.current.yaw -= dx * 0.005; ctl.current.pitch = Math.max(-1.2, Math.min(1.2, ctl.current.pitch - dy * 0.004)); };
  const pu = (e) => { const t = touch.current; touch.current = null; if (t && t.moved < 12 && ctl.current.active) pick({ x: (e.clientX / innerWidth) * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }); };

  const start = (withTut) => { setPhase("play"); const seen = localStorage.getItem("bonadi-3d-tut"); if (withTut && !seen) setTut(1); if (!TOUCH) setTimeout(() => wrap.current?.requestPointerLock?.(), 50); };
  const endTut = () => { setTut(0); localStorage.setItem("bonadi-3d-tut", "1"); if (!TOUCH) setTimeout(() => wrap.current?.requestPointerLock?.(), 50); };
  const resume = () => { setPaused(false); if (!TOUCH) setTimeout(() => wrap.current?.requestPointerLock?.(), 50); };
  const dec = (id) => setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i)).filter((i) => i.qty > 0));
  const del = (id) => setCart((c) => c.filter((i) => i.id !== id));

  const submitting = useRef(false);
  const confirm = async (e) => {
    e.preventDefault(); if (submitting.current) return; setErr("");
    if (!validOrder(f)) return setErr("Please enter your name, a valid BD phone number (01XXXXXXXXX) and a full delivery address.");
    submitting.current = true; setBusy(true);
    const { data, error } = await submitOrder(f, cart, drop && canDrop);
    submitting.current = false; setBusy(false);
    if (error) return setErr(error.message.includes("not available") ? "A product in your trolley is no longer available. Please update your trolley." : "Order failed — nothing was charged. Please try again or call us.");
    clear(); setCheckout(false); setDone({ id: data, total });
  };
  const hint = near === "counter" ? (count ? "Press E (or tap Checkout) to pay at the counter" : "Checkout counter — your trolley is empty") : near === "exit" ? "Press E to leave the store" : null;
  const TUT = [["Move", TOUCH ? "Use the joystick to walk." : "Use W A S D or the arrow keys to walk (Shift to run)."], ["Look", TOUCH ? "Drag on the screen to look around." : "Move the mouse to look. Aim the dot at a product."],
    ["Add to trolley", TOUCH ? "Tap a product to add it." : "Click (or press E) on a product. Walk closer if nothing happens."], ["Checkout", "When you are done, follow the gold arrow to the counter and press E."]];

  if (!gl) return <div className="fixed inset-0 z-[9000]"><Fallback msg="Your browser or device does not support 3D graphics (WebGL)." /></div>;
  return (
    <div className="fixed inset-0 z-[9000] select-none bg-[#f4efe4] font-body text-ink">
      <div ref={wrap} className="absolute inset-0 touch-none" onClick={onClick} onPointerDown={pd} onPointerMove={pm} onPointerUp={pu}>
        <Boundary><Canvas shadows={!LITE} dpr={LITE ? 1 : [1, 1.5]} camera={{ fov: 70, near: 0.1, far: 60 }} gl={{ antialias: !LITE, powerPreference: "high-performance" }}>
          {assets !== undefined && <Scene products={list} cart={cart} assets={assets} ctl={ctl} api={api} guide={guide} onHover={setHover} onNear={(n) => { nearRef.current = n; setNear(n); }} />}
        </Canvas></Boundary>
      </div>

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute left-3 top-3 flex gap-2">
          <a href="#/" className="flex items-center gap-2 rounded-full bg-brand/90 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur"><X size={16} />Exit</a>
          <button onClick={() => { unlock(); setPaused(true); }} className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold shadow-lg" aria-label="Open menu"><Menu size={16} />Menu</button>
        </div>
        <button onClick={() => setPanel((p) => !p)} aria-label="Open trolley" className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2 rounded-full bg-gold px-4 py-2 font-semibold shadow-lg"><ShoppingBasket size={18} />Trolley · {count} · ৳{total.toLocaleString()}</button>
        {phase === "play" && !TOUCH && <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/40" />}
        {hover && playing && <div className="absolute left-1/2 top-[56%] -translate-x-1/2 rounded-2xl bg-brand/90 px-5 py-3 text-center text-white shadow-xl">
          <p className="font-display text-lg font-bold">{hover.name} <span className="text-sm font-normal text-white/70">{hover.size}</span></p>
          <p className="text-gold">{hover.status === "coming_soon" ? "Coming soon" : `৳${hover.price.toLocaleString()} · click or press E to add`}</p></div>}
        {hint && playing && <div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-gold px-5 py-2 text-center text-sm font-semibold shadow-xl">{hint}</div>}
        {count > 0 && near !== "counter" && playing && <div className="absolute left-1/2 top-16 flex -translate-x-1/2 items-center gap-2 rounded-full bg-brand/85 px-4 py-1.5 text-xs text-white shadow"><div ref={guide} aria-hidden="true"><Navigation size={20} className="text-gold" /></div>Checkout counter</div>}
        {near === "counter" && count > 0 && playing && <button onClick={openCheckout} className="pointer-events-auto absolute bottom-8 right-6 rounded-full bg-brand px-6 py-3 font-semibold text-gold shadow-xl">Checkout →</button>}
        {toast && <div role="status" className="absolute left-1/2 top-28 -translate-x-1/2 rounded-full bg-white px-5 py-2 text-sm font-semibold shadow-xl">{toast}</div>}
        {TOUCH && phase === "play" && !checkout && !done && <Joystick ctl={ctl} />}
        {tut > 0 && <div className="pointer-events-auto absolute bottom-6 left-1/2 w-[92vw] max-w-sm -translate-x-1/2 rounded-2xl bg-white p-4 shadow-2xl" role="dialog" aria-label="Quick tutorial">
          <p className="text-xs text-muted">Quick tutorial · {tut}/{TUT.length}</p><p className="font-display text-lg font-bold">{TUT[tut - 1][0]}</p><p className="text-sm">{TUT[tut - 1][1]}</p>
          <div className="mt-3 flex justify-between"><button onClick={endTut} className="text-sm text-muted underline">Skip</button><button onClick={() => (tut < TUT.length ? setTut(tut + 1) : endTut())} className="rounded-full bg-gold px-5 py-1.5 font-semibold">{tut < TUT.length ? "Next" : "Start shopping"}</button></div></div>}

        {panel && <aside className="pointer-events-auto absolute right-3 top-16 max-h-[70vh] w-80 max-w-[92vw] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl" data-lenis-prevent aria-label="Trolley">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-display text-lg font-bold">Your trolley</h3><button onClick={() => setPanel(false)} aria-label="Close trolley"><X size={18} /></button></div>
          {!cart.length ? <p className="text-sm text-muted">Empty. Aim at a product and click (or tap) to add it.</p> : <>
            {cart.map((i) => <div key={i.id} className="flex items-center gap-3 border-t border-black/10 py-2">
              {i.image_url ? <img src={i.image_url} alt="" className="h-12 w-12 rounded-lg bg-card object-contain" /> : <div className="h-12 w-12 rounded-lg bg-gold/30" />}
              <div className="min-w-0 flex-1 text-sm"><p className="truncate font-semibold">{i.name}</p><p className="text-muted">{i.size} · ৳{i.price}</p>
                <div className="mt-1 flex items-center gap-2"><button className="rounded-full border p-1" onClick={() => dec(i.id)} aria-label={`Remove one ${i.name}`}><Minus size={12} /></button><b>{i.qty}</b><button className="rounded-full border p-1" onClick={() => onAdd(i, true)} aria-label={`Add one ${i.name}`}><Plus size={12} /></button></div></div>
              <div className="text-right text-sm"><b>৳{(i.price * i.qty).toLocaleString()}</b><button onClick={() => del(i.id)} className="mt-1 block text-red-500" aria-label={`Remove ${i.name}`}><Trash2 size={14} /></button></div></div>)}
            <p className="mt-2 flex justify-between border-t border-black/10 pt-3 font-bold"><span>Total</span><span className="text-[#9a6b00]">৳{total.toLocaleString()}</span></p>
            <button onClick={openCheckout} className="mt-3 w-full rounded-full bg-gold py-2.5 font-semibold">Go to checkout</button></>}
        </aside>}
      </div>

      {phase === "intro" && assets !== undefined && <div className="absolute inset-0 grid place-items-center bg-black/55 p-4 backdrop-blur-sm"><div className="max-h-full w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-7 text-center shadow-2xl">
        <img src="/logo.png" alt="Bonadi" className="mx-auto h-16" /><h1 className="mt-3 font-display text-2xl font-bold">Welcome to the Bonadi 3D Store</h1>
        <p className="mt-1 text-sm text-muted">Walk the aisles, pick products into your trolley, then pay at the counter. It uses your real cart and the real order system.</p>
        <div className="my-5 grid gap-2 text-left text-sm sm:grid-cols-2">{(TOUCH ? [["Joystick", "walk"], ["Drag screen", "look around"], ["Tap product", "add to trolley"], ["Checkout button", "at the counter"]]
          : [["W A S D / arrows", "walk (Shift = run)"], ["Mouse", "look & aim"], ["Click or E", "pick a product"], ["C", "open trolley"], ["E at counter", "checkout"], ["Esc", "menu"]]).map(([k, v]) => <p key={k} className="rounded-xl bg-card px-3 py-2"><b>{k}</b> — {v}</p>)}</div>
        <button onClick={() => start(true)} className="w-full rounded-full bg-gold py-3 text-lg font-semibold shadow-lg">Start shopping</button>
        <button onClick={() => start(false)} className="mt-2 w-full text-sm text-muted underline">Skip the tutorial</button>
        <a href="#/shop" className="mt-2 block rounded-full border border-gold py-2.5 text-sm font-semibold">Shop normally instead</a></div></div>}
      {assets === undefined && <div className="absolute inset-0 grid place-items-center bg-brand text-white"><div className="text-center"><img src="/logo.png" alt="Bonadi" className="mx-auto h-14 rounded-xl bg-white p-2" /><div className="spinner mx-auto mt-6" /><p className="mt-3 text-sm text-white/70">Opening the store…</p></div></div>}

      {paused && !checkout && !done && <div className="absolute inset-0 grid place-items-center bg-black/60 p-4" role="dialog" aria-label="Menu"><div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <h2 className="font-display text-2xl font-bold">Paused</h2><div className="mt-4 space-y-2">
          <button onClick={resume} className="w-full rounded-full bg-gold py-3 font-semibold">Resume shopping</button>
          <button onClick={() => { setPaused(false); setPanel(true); }} className="w-full rounded-full border border-gold py-2.5 font-semibold">View trolley ({count})</button>
          <button onClick={openCheckout} className="w-full rounded-full border border-gold py-2.5 font-semibold">Go to checkout</button>
          <a href="#/shop" className="block rounded-full bg-brand py-2.5 font-semibold text-gold">Shop normally</a><a href="#/" className="block py-2 text-sm text-muted underline">Exit to homepage</a></div></div></div>}

      {checkout && <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-black/60 p-4" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Checkout">
        <form onSubmit={confirm} noValidate className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Checkout counter</h2><button type="button" onClick={() => setCheckout(false)} aria-label="Back to store"><X /></button></div>
          <div className="max-h-40 overflow-y-auto text-sm">{cart.map((i) => <p key={i.id} className="flex justify-between py-1"><span>{i.name} {i.size} × {i.qty}</span><b>৳{(i.price * i.qty).toLocaleString()}</b></p>)}</div>
          <div className="my-3 space-y-1 border-t border-black/10 pt-3 text-sm"><p className="flex justify-between"><span>Subtotal</span><span>৳{total.toLocaleString()}</span></p>
            <p className="flex justify-between"><span>Delivery</span><span className="text-green-700">Free</span></p><p className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-[#9a6b00]">৳{total.toLocaleString()}</span></p>
            <p className="text-xs text-muted">The final total is confirmed by our server when you place the order.</p></div>
          <fieldset className="mb-3 text-sm"><legend className="mb-1 font-semibold">Payment method</legend>
            <label className="flex items-center gap-2 rounded-xl border border-gold bg-gold/10 p-2"><input type="radio" checked readOnly />Cash on Delivery</label>
            <p className="mt-1 text-xs text-muted">bKash, Nagad and card payments are not available yet.</p></fieldset>
          {[["name", "Full name", "text"], ["phone", "Phone (01XXXXXXXXX)", "tel"]].map(([k, ph, t]) => <input key={k} type={t} aria-label={ph} className="field mb-2 !text-ink" placeholder={ph} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
          <textarea aria-label="Delivery address" className="field mb-2 !text-ink" placeholder="Delivery address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          {canDrop && <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={drop} onChange={(e) => setDrop(e.target.checked)} />Dropship order (I earn commission)</label>}
          {err && <p role="alert" className="mb-2 text-sm text-red-600">{err}</p>}
          <button disabled={busy} className="w-full rounded-full bg-gold py-3 font-semibold shadow-lg disabled:opacity-60">{busy ? "Placing order…" : "Place order (Cash on Delivery)"}</button>
          <button type="button" onClick={() => setCheckout(false)} className="mt-2 w-full text-sm text-muted underline">Back to shopping</button>
        </form></div>}

      {done && <div className="absolute inset-0 grid place-items-center bg-brand/90 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-gold text-ink"><Check size={42} /></div>
        <h2 className="font-display text-3xl font-bold">Thank you!</h2><p className="mt-2 text-muted">Order <b>#{done.id}</b> is confirmed — ৳{done.total.toLocaleString()} (Cash on Delivery). We will call you to confirm delivery.</p>
        <a href="#/" className="mt-6 flex items-center justify-center gap-2 rounded-full bg-brand py-3 font-semibold text-gold"><Home size={18} />Back to homepage</a>
        <button onClick={() => { setDone(null); resume(); }} className="mt-3 w-full rounded-full border border-gold py-3 font-semibold">Continue shopping</button></div></div>}
    </div>
  );
}
