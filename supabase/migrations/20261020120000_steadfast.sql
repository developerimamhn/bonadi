-- Steadfast courier: parcel details on each order, webhook de-duplication, and a public tracking lookup.
-- Safe to run more than once.

alter table public.orders
  add column if not exists courier text,
  add column if not exists consignment_id bigint,
  add column if not exists tracking_code text,
  add column if not exists courier_status text,
  add column if not exists courier_message text,
  add column if not exists courier_updated_at timestamptz;

create unique index if not exists orders_consignment_id_key on public.orders (consignment_id) where consignment_id is not null;

-- Every webhook call Steadfast sends, keyed by its Idempotency-Key so a retry is handled only once.
-- Only the edge functions (service role) touch this table; RLS with no policies blocks everyone else.
create table if not exists public.steadfast_events (
  idempotency_key text primary key,
  notification_type text,
  consignment_id bigint,
  invoice text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
alter table public.steadfast_events enable row level security;

-- Courier progress for the Track page. Same rule as track_order: the caller must know the order number AND its phone number.
create or replace function public.track_courier(p_id bigint, p_phone text)
returns table (courier text, tracking_code text, courier_status text, courier_message text, courier_updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select o.courier, o.tracking_code, o.courier_status, o.courier_message, o.courier_updated_at
  from public.orders o
  where o.id = p_id
    and length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 10
    and right(regexp_replace(o.phone, '\D', '', 'g'), 10) = right(regexp_replace(p_phone, '\D', '', 'g'), 10);
$$;

revoke all on function public.track_courier(bigint, text) from public;
grant execute on function public.track_courier(bigint, text) to anon, authenticated;
