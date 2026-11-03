-- BLAC-P3-013 : test SQL en lecture seule des requetes equivalentes aux scenarios de campagne.
-- NON EXECUTE par le ticket (aucune operation sur la base). Aucune ecriture, aucun changement de schema.
begin;
do $$
declare
  best_count integer;
  inactive_count integer;
begin
  -- Meilleurs clients : au plus 20 clients, commandes annulees exclues, fenetre de 180 jours.
  select count(*) into best_count from (
    select customer_phone
    from public.orders
    where lower(coalesce(status, '')) not in ('cancelled', 'canceled', 'annule', 'annulee')
      and created_at >= now() - interval '180 days'
    group by customer_phone
    order by sum(total) desc, max(created_at) desc
    limit 20
  ) b;
  if best_count > 20 then
    raise exception 'meilleurs clients : % clients retenus (maximum 20)', best_count;
  end if;

  -- Inactifs : au moins 2 commandes non annulees, derniere commande entre 60 (exclu) et 365 jours (inclus).
  select count(*) into inactive_count from (
    select customer_phone
    from public.orders
    where lower(coalesce(status, '')) not in ('cancelled', 'canceled', 'annule', 'annulee')
    group by customer_phone
    having count(*) >= 2
      and max(created_at) < now() - interval '60 days'
      and max(created_at) >= now() - interval '365 days'
  ) i;
  if inactive_count is null then
    raise exception 'inactifs : comptage impossible';
  end if;
end
$$;
rollback;
