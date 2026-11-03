-- BLAC-P3-013 : test SQL en lecture seule des colonnes de public.orders utilisees par les scenarios de campagne.
-- NON EXECUTE par le ticket (aucune operation sur la base). A lancer par Martial s'il le souhaite.
-- Echoue si une des colonnes customer_phone, customer_name, total, status, created_at n'existe pas dans public.orders.
begin;
do $$
declare
  n bigint;
begin
  select count(*) into n
  from (
    select customer_phone, customer_name, total, status, created_at
    from public.orders
    limit 0
  ) t;
  if n <> 0 then
    raise exception 'public.orders : lecture inattendue';
  end if;
end
$$;
rollback;
