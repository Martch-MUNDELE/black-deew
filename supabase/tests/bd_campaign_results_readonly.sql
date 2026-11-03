-- BLAC-P3-014 : test SQL en LECTURE SEULE des resultats d'une campagne (NON execute par le ticket).
-- A lancer manuellement apres application des migrations marketing. Aucun numero n'est affiche.
-- Remplacer 'REMPLACER_PAR_ID_CAMPAGNE' par l'identifiant de la campagne.
begin read only;

do $$
declare
  v_campaign text := 'REMPLACER_PAR_ID_CAMPAGNE';
  v_sent bigint;
  v_orders bigint;
  v_revenue numeric;
  v_clients_converted bigint;
begin
  select count(*) into v_sent
  from public.campaign_sends
  where campaign_id::text = v_campaign and status = 'sent';

  select count(*), coalesce(sum(o.total), 0), count(distinct right(regexp_replace(s.phone, '\D', '', 'g'), 9))
    into v_orders, v_revenue, v_clients_converted
  from public.orders o
  join public.campaign_sends s
    on s.campaign_id::text = v_campaign and s.status = 'sent'
   and right(regexp_replace(o.customer_phone, '\D', '', 'g'), 9) = right(regexp_replace(s.phone, '\D', '', 'g'), 9)
  where o.status not in ('cancelled', 'canceled', 'annulee', 'annulée')
    and o.created_at >= s.sent_at
    and o.created_at <= s.sent_at + interval '7 days';

  assert v_sent >= 0, 'ECHEC : sent negatif';
  assert v_orders >= 0, 'ECHEC : orders negatif';
  assert v_revenue >= 0, 'ECHEC : revenue negatif';

  if v_clients_converted > v_sent then
    raise exception 'ECHEC : % clients ayant commande pour % envoyes', v_clients_converted, v_sent;
  end if;
  if v_sent = 0 and v_orders > 0 then
    raise exception 'ECHEC : commandes attribuees sans aucun envoi';
  end if;
  raise notice 'OK : sent=%, orders=%, revenue=%', v_sent, v_orders, v_revenue;
end $$;

rollback;
