# Bonadi Store — React + Vite + Tailwind + Three.js + Supabase
Run: `npm install && npm run dev`  (the .env already points to the `bonadi-store` Supabase project).
Database schema, RLS and place_order() are already applied in Supabase (Dashboard → Database → Migrations).
Admin: sign up on /login with your admin email, then ask Claude (or run SQL) to set role='admin' for that profile.
Deploy: Vercel → add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as env vars.

## 3D Store (optional, route #/store)
Lazy-loaded `src/Store3D.jsx`. Uses the same cart state and the same `place_order()` RPC as the normal shop (`src/lib/order.js`).
Controls: WASD/arrows + mouse, E interact, C trolley, Esc menu. Touch: joystick, drag to look, tap to pick.
Bottle labels use `public/logo.png`. To use a real bottle photo/label artwork, replace `labelTexture()` in Store3D.jsx.

## Bottle images & admin
- `public/products/ghee-{250,500,1000}.png` = cut-out bottle photos (shop cards, cart). `wrap-*.jpg` + `ghee-meta.json` = the same artwork unwrapped for the 3D jars.
- Admin: sign up on /login, confirm email, open Account → "Admin access code" (one-time code given by Claude).
- Order e-mail: Supabase → Edge Functions → Secrets: RESEND_API_KEY, ADMIN_EMAIL (optional: MAIL_FROM, ADMIN_PHONE, SMS_API_URL).
