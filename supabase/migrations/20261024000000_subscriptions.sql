-- Suscripciones de Prompter. Solo el servidor (service_role) escribe; cada usuario puede leer la suya.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null check (status in ('pending', 'active', 'trialing', 'past_due', 'suspended', 'canceled', 'expired')),
  provider text not null check (provider in ('paypal', 'demo')),
  provider_subscription_id text unique,
  plan_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "Cada usuario lee su suscripción" on public.subscriptions;
create policy "Cada usuario lee su suscripción" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- Registro de eventos de pago para auditoría e idempotencia.
-- Minimización: no se guarda el contenido del evento (nombre, correo ni dirección del pagador).
create table if not exists public.billing_events (
  id text primary key,
  provider text not null,
  type text not null,
  resource_id text,
  received_at timestamptz not null default now()
);

alter table public.billing_events enable row level security;   -- sin políticas: inaccesible para clientes
revoke all on public.billing_events from anon, authenticated;

create index if not exists billing_events_resource_idx on public.billing_events (resource_id);

-- Misma regla que lib/subscription.js → isActive. Disponible para futuras políticas RLS
-- (por ejemplo, sincronización de guiones solo para suscriptores).
create or replace function public.has_active_subscription()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = (select auth.uid())
      and (
        (s.status in ('active', 'trialing') and (s.current_period_end is null or s.current_period_end > now()))
        or (s.status = 'canceled' and s.current_period_end > now())
      )
  );
$$;

-- Sin parámetro: cada usuario solo puede consultar su propio estado.
revoke execute on function public.has_active_subscription() from public, anon;
grant execute on function public.has_active_subscription() to authenticated;
