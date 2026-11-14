-- PaseListo schema. Idempotent: safe to run repeatedly.
create table if not exists events (
  id text primary key,
  slug text unique not null,
  name text not null,
  price_cents int not null check (price_cents > 0),
  capacity int not null
);

-- Multi-event fields (additive, idempotent).
alter table events add column if not exists description text;
alter table events add column if not exists starts_at timestamptz;
alter table events add column if not exists venue text;
alter table events add column if not exists contact_email text;
alter table events add column if not exists created_at timestamptz default now();
alter table events add column if not exists organizer_name text;
-- Publish idempotency key (unique => constraint events_created_by_request_key).
alter table events add column if not exists created_by_request text unique;

create table if not exists orders (
  id uuid primary key,
  event_id text not null references events(id),
  buyer_name text not null,
  buyer_email text not null,
  amount_cents int not null,
  status text not null check (status in ('pending', 'paid', 'review', 'expired')),
  channel text not null default 'qr',
  pey_qr_id text unique,
  pey_transaction_id text unique,
  expires_at timestamptz not null,
  paid_at timestamptz,
  review_reason text,
  created_at timestamptz default now()
);

alter table orders add column if not exists confirmed_via text;
alter table orders add column if not exists pey_qr_string text;

create index if not exists orders_event_status_idx on orders (event_id, status);

create table if not exists passes (
  id uuid primary key,
  order_id uuid unique not null references orders(id),
  token text unique not null,
  used_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists webhook_events (
  webhook_id text primary key,
  type text,
  payload jsonb,
  received_at timestamptz default now()
);
