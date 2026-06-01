-- BF_CANCELLED_ORDERS_RESTORE_PURGE_PATCH_V2
-- Suivi d'annulation restaurable et purgeable après 2 heures.

alter table public.orders
  add column if not exists previous_status_before_cancel text;

alter table public.orders
  add column if not exists cancelled_at timestamptz;

alter table public.orders
  add column if not exists purge_after timestamptz;

create index if not exists orders_cancelled_purge_idx
  on public.orders (status, purge_after)
  where status = 'annulée';

comment on column public.orders.previous_status_before_cancel is
  'Dernier statut connu avant passage en annulée, utilisé pour restaurer une annulation accidentelle.';

comment on column public.orders.cancelled_at is
  'Date et heure de passage au statut annulée.';

comment on column public.orders.purge_after is
  'Date et heure à partir de laquelle une commande annulée peut être purgée automatiquement.';
