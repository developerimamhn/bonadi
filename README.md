# Bonadi Store — React + Vite + Tailwind + Three.js + Supabase
Run: `npm install && npm run dev` · Test: `node --test src/lib/order.test.js`  (the .env already points to the `bonadi-store` Supabase project).
Database schema, RLS and place_order() are already applied in Supabase (Dashboard → Database → Migrations).
Admin: sign up on /login with your admin email, then ask Claude (or run SQL) to set role='admin' for that profile.
Deploy: Vercel → add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as env vars.

## 3D Store (optional, route #/store)
Lazy-loaded `src/Store3D.jsx`. Uses the same cart state and the same `place_order()` RPC as the normal shop (`src/lib/order.js`).
Controls: WASD/arrows + mouse, E interact, C trolley, Esc menu. Touch: joystick, drag to look, tap to pick.
Ghee jars use the real label artwork in `public/products/wrap-*.webp`; other bottles use `public/logo.png`.

## Bottle images & admin
- `public/products/ghee-{250,500,1000}.webp` = cut-out bottle photos (shop cards, cart). `wrap-*.webp` (with transparency) + `ghee-meta.json` = the same artwork unwrapped for the 3D jars.
- Admin: sign up on /login, confirm email, open Account → "Admin access code" (one-time code given by Claude).
- Order e-mail: Supabase → Edge Functions → Secrets: RESEND_API_KEY, ADMIN_EMAIL (optional: MAIL_FROM, ADMIN_PHONE, SMS_API_URL).

## Steadfast courier (parcel booking + customer tracking)
Files: `supabase/migrations/20261020120000_steadfast.sql`, `supabase/functions/steadfast` (admin: book parcel / refresh), `supabase/functions/steadfast-webhook` (Steadfast → site).
1. Run the migration SQL (Supabase → SQL Editor). It adds courier columns to `orders`, the `steadfast_events` table and the `track_courier()` lookup.
2. Secrets (Supabase → Edge Functions → Secrets): `STEADFAST_API_KEY`, `STEADFAST_SECRET_KEY` (Steadfast portal → API), `STEADFAST_WEBHOOK_TOKEN` (the auth token on Steadfast's Webhook page). Never commit them.
3. Deploy: `supabase functions deploy steadfast` and `supabase functions deploy steadfast-webhook --no-verify-jwt`.
4. Steadfast portal → Webhook → Callback URL: `https://<project-ref>.supabase.co/functions/v1/steadfast-webhook`.
Flow: Admin → Orders → "Send to Steadfast" books the parcel (invoice `BON-<order id>`, COD = order total) and marks the order *shipped*. Webhook updates arrive automatically: `delivered` → order *delivered*, `cancelled` → order *cancelled*; `partial_delivered` is left for the admin. Customers see the courier status, tracking code and a Steadfast tracking link on the Track page.
