-- ============================================================
-- MDH SHARED DATABASE CLONE
-- Source project : black-deew
-- New project    : Style
-- Source schema  : public
-- Target schema  : style
--
-- Auth / Storage objects are intentionally not duplicated.
-- ============================================================


DO $mdh$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_namespace
    WHERE nspname = 'style'
  ) THEN
    RAISE EXCEPTION 'MDH: schema style existe deja';
  END IF;
END
$mdh$;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "style";


ALTER SCHEMA "style" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "style" IS 'standard public schema';



CREATE TYPE "style"."billing_adjustment_type" AS ENUM (
    'remise',
    'avoir',
    'correction',
    'frais'
);


ALTER TYPE "style"."billing_adjustment_type" OWNER TO "postgres";


CREATE TYPE "style"."billing_mode" AS ENUM (
    'flat_only',
    'flat_percent',
    'flat_tiered',
    'flat_category',
    'flat_per_order'
);


ALTER TYPE "style"."billing_mode" OWNER TO "postgres";


CREATE TYPE "style"."billing_period_status" AS ENUM (
    'en_cours',
    'cloture',
    'facture',
    'paye'
);


ALTER TYPE "style"."billing_period_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "style"."decrement_stock"("product_id" "uuid", "qty" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE products
  SET stock = GREATEST(0, stock - qty)
  WHERE id = product_id
    AND stock IS NOT NULL;
END;
$$;


ALTER FUNCTION "style"."decrement_stock"("product_id" "uuid", "qty" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "style"."get_next_invoice_seq"("p_date_key" "text") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_counter integer;
BEGIN
  INSERT INTO invoice_counters (date_key, counter)
  VALUES (p_date_key, 1)
  ON CONFLICT (date_key)
  DO UPDATE SET counter = invoice_counters.counter + 1
  RETURNING counter INTO v_counter;
  RETURN v_counter;
END;
$$;


ALTER FUNCTION "style"."get_next_invoice_seq"("p_date_key" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "style"."admin_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "temp_password" "text"
);


ALTER TABLE "style"."admin_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."admin_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "admin_email" "text",
    "action" "text",
    "details" "jsonb",
    "performed_by" "text"
);


ALTER TABLE "style"."admin_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."admins" (
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'admin'::"text",
    "auth_user_id" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "id" "uuid" DEFAULT "gen_random_uuid"()
);


ALTER TABLE "style"."admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."billing_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "billing_period_id" "uuid",
    "type" "style"."billing_adjustment_type",
    "amount" numeric,
    "reason" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "style"."billing_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."billing_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "period_start" "date",
    "period_end" "date",
    "status" "style"."billing_period_status" DEFAULT 'en_cours'::"style"."billing_period_status",
    "flat_fee_amount" numeric DEFAULT 0,
    "commission_amount" numeric DEFAULT 0,
    "adjustments_total" numeric DEFAULT 0,
    "total_due" numeric DEFAULT 0,
    "total_paid" numeric DEFAULT 0,
    "orders_count" integer DEFAULT 0,
    "orders_base_amount" numeric DEFAULT 0,
    "locked_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "style"."billing_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."client_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "started_at" "date",
    "ended_at" "date",
    "billing_mode" "style"."billing_mode" DEFAULT 'flat_only'::"style"."billing_mode" NOT NULL,
    "flat_fee_amount" numeric DEFAULT 0,
    "flat_fee_currency" character(3) DEFAULT 'MAD'::"bpchar",
    "minimum_guarantee" numeric,
    "maximum_cap" numeric,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "style"."client_contracts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."commission_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contract_id" "uuid",
    "rule_type" "text",
    "tier_from" numeric,
    "tier_to" numeric,
    "category_slug" "text",
    "rate_percent" numeric,
    "amount_per_order" numeric,
    "effective_from" "date",
    "effective_to" "date"
);


ALTER TABLE "style"."commission_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."contract_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contract_id" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "changed_by" "uuid",
    "old_snapshot" "jsonb",
    "new_snapshot" "jsonb",
    "reason" "text"
);


ALTER TABLE "style"."contract_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."delivery_drivers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "full_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text",
    "status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "vehicle_type" "text",
    "zone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "delivery_drivers_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'suspended'::"text"]))),
    CONSTRAINT "delivery_drivers_vehicle_type_check" CHECK (("vehicle_type" = ANY (ARRAY['bike'::"text", 'scooter'::"text", 'car'::"text", 'on_foot'::"text"])))
);


ALTER TABLE "style"."delivery_drivers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."delivery_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "time_start" time without time zone NOT NULL,
    "time_end" time without time zone NOT NULL,
    "capacity" integer NOT NULL,
    "booked" integer DEFAULT 0,
    "blocked" boolean DEFAULT false
);


ALTER TABLE "style"."delivery_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."delivery_zones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "min_km" numeric NOT NULL,
    "max_km" numeric NOT NULL,
    "price" numeric NOT NULL,
    "min_order" numeric DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "style"."delivery_zones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."driver_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "zone" "text",
    "notes" "text",
    "opening_cash" numeric DEFAULT 0,
    "collected_cash" numeric DEFAULT 0,
    "expected_cash" numeric DEFAULT 0,
    "declared_cash" numeric,
    "driver_fee_total" numeric DEFAULT 0,
    "delivery_subsidy_total" numeric DEFAULT 0,
    "net_to_remit" numeric DEFAULT 0,
    "cash_difference" numeric,
    "session_status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    "settled_at" timestamp with time zone,
    CONSTRAINT "driver_sessions_session_status_check" CHECK (("session_status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'cancelled'::"text", 'settled'::"text"])))
);


ALTER TABLE "style"."driver_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."invoice_counters" (
    "date_key" "text" NOT NULL,
    "counter" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "style"."invoice_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."menu_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "parent_id" "uuid",
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "icon_type" "text" DEFAULT 'builtin'::"text",
    "icon_value" "text",
    "level" integer DEFAULT 0,
    "is_visible" boolean DEFAULT true NOT NULL
);


ALTER TABLE "style"."menu_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."order_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "driver_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "assigned_at" timestamp with time zone,
    "picked_up_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "delivery_address" "text",
    "delivery_notes" "text",
    "distance_km" numeric(6,2),
    "amount_to_collect" numeric DEFAULT 0,
    "amount_collected" numeric DEFAULT 0,
    "delivery_fee_charged_to_customer" numeric DEFAULT 0,
    "real_delivery_cost" numeric DEFAULT 0,
    "driver_fee_due" numeric DEFAULT 0,
    "delivery_fee_subsidized" numeric DEFAULT 0,
    "amount_to_remit_by_driver" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "driver_fee_total" numeric DEFAULT 0,
    CONSTRAINT "order_deliveries_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'assigned'::"text", 'picked_up'::"text", 'in_transit'::"text", 'delivered'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "style"."order_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "product_id" "uuid",
    "product_name" "text",
    "product_price" numeric,
    "unit_price" numeric,
    "quantity" integer,
    "is_vip" boolean DEFAULT false,
    "selected_variants" "jsonb",
    "variant_name" "text",
    "variant_price" numeric,
    "variant_price_extra" numeric DEFAULT 0
);


ALTER TABLE "style"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."order_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "style"."order_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'en_attente'::"text",
    "customer_name" "text",
    "customer_phone" "text",
    "customer_address" "text",
    "customer_note" "text",
    "customer_email" "text",
    "lat" numeric,
    "lng" numeric,
    "geo_address" "text",
    "slot_id" "uuid",
    "total" numeric,
    "delivery_mode" "text",
    "delivery_fee" numeric DEFAULT 0,
    "distance_km" numeric,
    "zone_id" "uuid",
    "delivery_detail" "jsonb",
    "wantfacture" boolean DEFAULT false,
    "payment_method" "text" DEFAULT 'livraison'::"text",
    "invoice_number" "text",
    "driver_id" "uuid",
    "previous_status_before_cancel" "text",
    "cancelled_at" timestamp with time zone,
    "purge_after" timestamp with time zone
);


ALTER TABLE "style"."orders" OWNER TO "postgres";


COMMENT ON COLUMN "style"."orders"."previous_status_before_cancel" IS 'Dernier statut connu avant passage en annulée, utilisé pour restaurer une annulation accidentelle.';



COMMENT ON COLUMN "style"."orders"."cancelled_at" IS 'Date et heure de passage au statut annulée.';



COMMENT ON COLUMN "style"."orders"."purge_after" IS 'Date et heure à partir de laquelle une commande annulée peut être purgée automatiquement.';



CREATE TABLE IF NOT EXISTS "style"."platform_connexions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "client_phone" "text",
    "shop_id" "uuid",
    "session_id" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_connexions_type_check" CHECK (("type" = ANY (ARRAY['classique_visite'::"text", 'classique_commande'::"text", 'vip'::"text"])))
);


ALTER TABLE "style"."platform_connexions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "ingredients" "text",
    "price" numeric NOT NULL,
    "subcategory" "text",
    "image_url" "text",
    "stock" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "featured" boolean DEFAULT false,
    "popular" boolean DEFAULT false,
    "discount" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_vip" boolean DEFAULT false,
    "variants" "jsonb",
    "is_coup_de_coeur" boolean DEFAULT false,
    CONSTRAINT "products_discount_check" CHECK ((("discount" >= 0) AND ("discount" <= 80)))
);


ALTER TABLE "style"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "style"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."settings" (
    "key" "text" NOT NULL,
    "value" "text"
);


ALTER TABLE "style"."settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."vip_access_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "pseudo" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "text",
    "requested_password" "text",
    CONSTRAINT "vip_access_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "style"."vip_access_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."vip_individual_passwords" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "password" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "style"."vip_individual_passwords" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "style"."vip_password_reset_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone
);


ALTER TABLE "style"."vip_password_reset_requests" OWNER TO "postgres";


COMMENT ON TABLE "style"."vip_password_reset_requests" IS 'BF-P2-007 — Demandes de mot de passe perdu émises par les clients VIP depuis le front.';



CREATE TABLE IF NOT EXISTS "style"."vip_password_reset_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '01:00:00'::interval) NOT NULL,
    "used_at" timestamp with time zone
);


ALTER TABLE "style"."vip_password_reset_tokens" OWNER TO "postgres";


COMMENT ON TABLE "style"."vip_password_reset_tokens" IS 'BF-P2-007 — Tokens à usage unique (1h) permettant à un client VIP de redéfinir son mot de passe individuel via un lien WhatsApp envoyé par l''admin.';



ALTER TABLE ONLY "style"."admin_credentials"
    ADD CONSTRAINT "admin_credentials_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "style"."admin_credentials"
    ADD CONSTRAINT "admin_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."admin_logs"
    ADD CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."admins"
    ADD CONSTRAINT "admins_pkey" PRIMARY KEY ("email");



ALTER TABLE ONLY "style"."billing_adjustments"
    ADD CONSTRAINT "billing_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."billing_periods"
    ADD CONSTRAINT "billing_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."client_contracts"
    ADD CONSTRAINT "client_contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."commission_rules"
    ADD CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."contract_history"
    ADD CONSTRAINT "contract_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."delivery_drivers"
    ADD CONSTRAINT "delivery_drivers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."delivery_slots"
    ADD CONSTRAINT "delivery_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."delivery_zones"
    ADD CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."driver_sessions"
    ADD CONSTRAINT "driver_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."invoice_counters"
    ADD CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("date_key");



ALTER TABLE ONLY "style"."menu_categories"
    ADD CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."menu_categories"
    ADD CONSTRAINT "menu_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "style"."order_deliveries"
    ADD CONSTRAINT "order_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."order_status_history"
    ADD CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."platform_connexions"
    ADD CONSTRAINT "platform_connexions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "style"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "style"."vip_access_requests"
    ADD CONSTRAINT "vip_access_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."vip_individual_passwords"
    ADD CONSTRAINT "vip_individual_passwords_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "style"."vip_individual_passwords"
    ADD CONSTRAINT "vip_individual_passwords_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."vip_password_reset_requests"
    ADD CONSTRAINT "vip_password_reset_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "style"."vip_password_reset_tokens"
    ADD CONSTRAINT "vip_password_reset_tokens_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_delivery_drivers_status" ON "style"."delivery_drivers" USING "btree" ("status");



CREATE INDEX "idx_delivery_drivers_user_id" ON "style"."delivery_drivers" USING "btree" ("user_id");



CREATE INDEX "idx_driver_sessions_driver_id" ON "style"."driver_sessions" USING "btree" ("driver_id");



CREATE INDEX "idx_driver_sessions_ended_at" ON "style"."driver_sessions" USING "btree" ("ended_at");



CREATE INDEX "idx_driver_sessions_started_at" ON "style"."driver_sessions" USING "btree" ("started_at");



CREATE INDEX "idx_order_deliveries_created_at" ON "style"."order_deliveries" USING "btree" ("created_at");



CREATE INDEX "idx_order_deliveries_driver_id" ON "style"."order_deliveries" USING "btree" ("driver_id");



CREATE INDEX "idx_order_deliveries_order_id" ON "style"."order_deliveries" USING "btree" ("order_id");



CREATE INDEX "idx_order_deliveries_status" ON "style"."order_deliveries" USING "btree" ("status");



CREATE INDEX "idx_order_status_history_changed_at" ON "style"."order_status_history" USING "btree" ("changed_at");



CREATE INDEX "idx_order_status_history_order_id" ON "style"."order_status_history" USING "btree" ("order_id");



CREATE INDEX "idx_order_status_history_to_status" ON "style"."order_status_history" USING "btree" ("to_status");



CREATE INDEX "idx_orders_driver_id" ON "style"."orders" USING "btree" ("driver_id");



CREATE INDEX "idx_platform_connexions_created_at" ON "style"."platform_connexions" USING "btree" ("created_at");



CREATE INDEX "idx_platform_connexions_type" ON "style"."platform_connexions" USING "btree" ("type");



CREATE INDEX "idx_push_subscriptions_endpoint" ON "style"."push_subscriptions" USING "btree" ("endpoint");



CREATE INDEX "orders_cancelled_purge_idx" ON "style"."orders" USING "btree" ("status", "purge_after") WHERE ("status" = 'annulée'::"text");



CREATE INDEX "vip_access_requests_status_idx" ON "style"."vip_access_requests" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "vip_password_reset_requests_status_idx" ON "style"."vip_password_reset_requests" USING "btree" ("status");



CREATE INDEX "vip_password_reset_tokens_phone_idx" ON "style"."vip_password_reset_tokens" USING "btree" ("phone");



CREATE UNIQUE INDEX "vip_password_reset_tokens_token_idx" ON "style"."vip_password_reset_tokens" USING "btree" ("token");



ALTER TABLE ONLY "style"."billing_adjustments"
    ADD CONSTRAINT "billing_adjustments_billing_period_id_fkey" FOREIGN KEY ("billing_period_id") REFERENCES "style"."billing_periods"("id");



ALTER TABLE ONLY "style"."commission_rules"
    ADD CONSTRAINT "commission_rules_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "style"."client_contracts"("id");



ALTER TABLE ONLY "style"."contract_history"
    ADD CONSTRAINT "contract_history_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "style"."client_contracts"("id");



ALTER TABLE ONLY "style"."delivery_drivers"
    ADD CONSTRAINT "delivery_drivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "style"."driver_sessions"
    ADD CONSTRAINT "driver_sessions_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "style"."delivery_drivers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "style"."menu_categories"
    ADD CONSTRAINT "menu_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "style"."menu_categories"("id");



ALTER TABLE ONLY "style"."order_deliveries"
    ADD CONSTRAINT "order_deliveries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "style"."delivery_drivers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "style"."order_deliveries"
    ADD CONSTRAINT "order_deliveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "style"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "style"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "style"."orders"("id");



ALTER TABLE ONLY "style"."orders"
    ADD CONSTRAINT "orders_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "style"."delivery_drivers"("id") ON DELETE SET NULL;



CREATE POLICY "No public access" ON "style"."push_subscriptions" USING (false);



ALTER TABLE "style"."billing_adjustments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_adjustments_select_via_period" ON "style"."billing_adjustments" FOR SELECT USING (("billing_period_id" IN ( SELECT "billing_periods"."id"
   FROM "style"."billing_periods"
  WHERE ("billing_periods"."client_id" = "auth"."uid"()))));



ALTER TABLE "style"."billing_periods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_periods_select_own" ON "style"."billing_periods" FOR SELECT USING (("auth"."uid"() = "client_id"));



ALTER TABLE "style"."client_contracts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_contracts_select_own" ON "style"."client_contracts" FOR SELECT USING (("auth"."uid"() = "client_id"));



ALTER TABLE "style"."commission_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "style"."contract_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "style"."order_status_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_status_history_insert_service" ON "style"."order_status_history" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "order_status_history_select_admin" ON "style"."order_status_history" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "style"."platform_connexions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_connexions_insert_public" ON "style"."platform_connexions" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "platform_connexions_select_admin" ON "style"."platform_connexions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "style"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "realtime_orders_admin" ON "style"."orders" FOR SELECT USING (true);



CREATE POLICY "superadmin_all_billing_adjustments" ON "style"."billing_adjustments" USING (true) WITH CHECK (true);



CREATE POLICY "superadmin_all_billing_periods" ON "style"."billing_periods" USING (true) WITH CHECK (true);



CREATE POLICY "superadmin_all_client_contracts" ON "style"."client_contracts" USING (true) WITH CHECK (true);



CREATE POLICY "superadmin_all_commission_rules" ON "style"."commission_rules" USING (true) WITH CHECK (true);



CREATE POLICY "superadmin_all_contract_history" ON "style"."contract_history" USING (true) WITH CHECK (true);



ALTER TABLE "style"."vip_access_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vip_access_requests_public_insert" ON "style"."vip_access_requests" FOR INSERT WITH CHECK ((("status" = 'pending'::"text") AND ("length"(TRIM(BOTH FROM "phone")) > 0) AND ("length"(TRIM(BOTH FROM "pseudo")) > 0)));



CREATE POLICY "vip_access_requests_select_all" ON "style"."vip_access_requests" FOR SELECT USING (true);



CREATE POLICY "vip_access_requests_update_all" ON "style"."vip_access_requests" FOR UPDATE USING (true) WITH CHECK (true);



ALTER TABLE "style"."vip_individual_passwords" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vip_individual_passwords_select_all" ON "style"."vip_individual_passwords" FOR SELECT USING (true);



CREATE POLICY "vip_individual_passwords_update_all" ON "style"."vip_individual_passwords" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "vip_individual_passwords_write_all" ON "style"."vip_individual_passwords" FOR INSERT WITH CHECK (true);



ALTER TABLE "style"."vip_password_reset_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "style"."vip_password_reset_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vip_reset_requests_insert_anon" ON "style"."vip_password_reset_requests" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "vip_reset_requests_select_all" ON "style"."vip_password_reset_requests" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "vip_reset_requests_update_all" ON "style"."vip_password_reset_requests" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "vip_reset_tokens_insert_anon" ON "style"."vip_password_reset_tokens" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "vip_reset_tokens_select_all" ON "style"."vip_password_reset_tokens" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "vip_reset_tokens_update_used_at" ON "style"."vip_password_reset_tokens" FOR UPDATE TO "authenticated", "anon" USING ((("used_at" IS NULL) AND ("expires_at" > "now"()))) WITH CHECK (true);



GRANT USAGE ON SCHEMA "style" TO "postgres";
GRANT USAGE ON SCHEMA "style" TO "anon";
GRANT USAGE ON SCHEMA "style" TO "authenticated";
GRANT USAGE ON SCHEMA "style" TO "service_role";



GRANT ALL ON FUNCTION "style"."decrement_stock"("product_id" "uuid", "qty" integer) TO "anon";
GRANT ALL ON FUNCTION "style"."decrement_stock"("product_id" "uuid", "qty" integer) TO "authenticated";
GRANT ALL ON FUNCTION "style"."decrement_stock"("product_id" "uuid", "qty" integer) TO "service_role";



GRANT ALL ON FUNCTION "style"."get_next_invoice_seq"("p_date_key" "text") TO "anon";
GRANT ALL ON FUNCTION "style"."get_next_invoice_seq"("p_date_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "style"."get_next_invoice_seq"("p_date_key" "text") TO "service_role";



GRANT ALL ON TABLE "style"."admin_credentials" TO "anon";
GRANT ALL ON TABLE "style"."admin_credentials" TO "authenticated";
GRANT ALL ON TABLE "style"."admin_credentials" TO "service_role";



GRANT ALL ON TABLE "style"."admin_logs" TO "anon";
GRANT ALL ON TABLE "style"."admin_logs" TO "authenticated";
GRANT ALL ON TABLE "style"."admin_logs" TO "service_role";



GRANT ALL ON TABLE "style"."admins" TO "anon";
GRANT ALL ON TABLE "style"."admins" TO "authenticated";
GRANT ALL ON TABLE "style"."admins" TO "service_role";



GRANT ALL ON TABLE "style"."billing_adjustments" TO "anon";
GRANT ALL ON TABLE "style"."billing_adjustments" TO "authenticated";
GRANT ALL ON TABLE "style"."billing_adjustments" TO "service_role";



GRANT ALL ON TABLE "style"."billing_periods" TO "anon";
GRANT ALL ON TABLE "style"."billing_periods" TO "authenticated";
GRANT ALL ON TABLE "style"."billing_periods" TO "service_role";



GRANT ALL ON TABLE "style"."client_contracts" TO "anon";
GRANT ALL ON TABLE "style"."client_contracts" TO "authenticated";
GRANT ALL ON TABLE "style"."client_contracts" TO "service_role";



GRANT ALL ON TABLE "style"."commission_rules" TO "anon";
GRANT ALL ON TABLE "style"."commission_rules" TO "authenticated";
GRANT ALL ON TABLE "style"."commission_rules" TO "service_role";



GRANT ALL ON TABLE "style"."contract_history" TO "anon";
GRANT ALL ON TABLE "style"."contract_history" TO "authenticated";
GRANT ALL ON TABLE "style"."contract_history" TO "service_role";



GRANT ALL ON TABLE "style"."delivery_drivers" TO "anon";
GRANT ALL ON TABLE "style"."delivery_drivers" TO "authenticated";
GRANT ALL ON TABLE "style"."delivery_drivers" TO "service_role";



GRANT ALL ON TABLE "style"."delivery_slots" TO "anon";
GRANT ALL ON TABLE "style"."delivery_slots" TO "authenticated";
GRANT ALL ON TABLE "style"."delivery_slots" TO "service_role";



GRANT ALL ON TABLE "style"."delivery_zones" TO "anon";
GRANT ALL ON TABLE "style"."delivery_zones" TO "authenticated";
GRANT ALL ON TABLE "style"."delivery_zones" TO "service_role";



GRANT ALL ON TABLE "style"."driver_sessions" TO "anon";
GRANT ALL ON TABLE "style"."driver_sessions" TO "authenticated";
GRANT ALL ON TABLE "style"."driver_sessions" TO "service_role";



GRANT ALL ON TABLE "style"."invoice_counters" TO "anon";
GRANT ALL ON TABLE "style"."invoice_counters" TO "authenticated";
GRANT ALL ON TABLE "style"."invoice_counters" TO "service_role";



GRANT ALL ON TABLE "style"."menu_categories" TO "anon";
GRANT ALL ON TABLE "style"."menu_categories" TO "authenticated";
GRANT ALL ON TABLE "style"."menu_categories" TO "service_role";



GRANT ALL ON TABLE "style"."order_deliveries" TO "anon";
GRANT ALL ON TABLE "style"."order_deliveries" TO "authenticated";
GRANT ALL ON TABLE "style"."order_deliveries" TO "service_role";



GRANT ALL ON TABLE "style"."order_items" TO "anon";
GRANT ALL ON TABLE "style"."order_items" TO "authenticated";
GRANT ALL ON TABLE "style"."order_items" TO "service_role";



GRANT ALL ON TABLE "style"."order_status_history" TO "anon";
GRANT ALL ON TABLE "style"."order_status_history" TO "authenticated";
GRANT ALL ON TABLE "style"."order_status_history" TO "service_role";



GRANT ALL ON TABLE "style"."orders" TO "anon";
GRANT ALL ON TABLE "style"."orders" TO "authenticated";
GRANT ALL ON TABLE "style"."orders" TO "service_role";



GRANT ALL ON TABLE "style"."platform_connexions" TO "anon";
GRANT ALL ON TABLE "style"."platform_connexions" TO "authenticated";
GRANT ALL ON TABLE "style"."platform_connexions" TO "service_role";



GRANT ALL ON TABLE "style"."products" TO "anon";
GRANT ALL ON TABLE "style"."products" TO "authenticated";
GRANT ALL ON TABLE "style"."products" TO "service_role";



GRANT ALL ON TABLE "style"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "style"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "style"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "style"."settings" TO "anon";
GRANT ALL ON TABLE "style"."settings" TO "authenticated";
GRANT ALL ON TABLE "style"."settings" TO "service_role";



GRANT ALL ON TABLE "style"."vip_access_requests" TO "anon";
GRANT ALL ON TABLE "style"."vip_access_requests" TO "authenticated";
GRANT ALL ON TABLE "style"."vip_access_requests" TO "service_role";



GRANT ALL ON TABLE "style"."vip_individual_passwords" TO "anon";
GRANT ALL ON TABLE "style"."vip_individual_passwords" TO "authenticated";
GRANT ALL ON TABLE "style"."vip_individual_passwords" TO "service_role";



GRANT ALL ON TABLE "style"."vip_password_reset_requests" TO "anon";
GRANT ALL ON TABLE "style"."vip_password_reset_requests" TO "authenticated";
GRANT ALL ON TABLE "style"."vip_password_reset_requests" TO "service_role";



GRANT ALL ON TABLE "style"."vip_password_reset_tokens" TO "anon";
GRANT ALL ON TABLE "style"."vip_password_reset_tokens" TO "authenticated";
GRANT ALL ON TABLE "style"."vip_password_reset_tokens" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "style" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "style" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "style" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "style" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "style" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "style" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "style" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "style" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "style" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "style" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "style" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "style" GRANT ALL ON TABLES TO "service_role";









SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict GVjEbLtigGAPJt6Yzmsa3aUcwm16M9Km331qFdMb0rjgY5wKc3cZ1IVlIpuccOk

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: admin_credentials; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."admin_credentials" ("id", "email", "created_at", "temp_password") VALUES
	('281cd718-fcc3-477e-9622-c136ff73a58f', 'tianacare.kin@gmail.com', '2026-05-06 16:14:58.94305+00', 'UYaC9rpGk!5P'),
	('c431a1dd-8082-4ee8-b51e-0303c4ec563c', 'manualongaboni@gmail.com', '2026-05-10 01:23:14.243864+00', '8CEXU3TXkV74');


--
-- Data for Name: admin_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."admin_logs" ("id", "created_at", "admin_email", "action", "details", "performed_by") VALUES
	('56ff1619-97b3-44d7-952d-84c26777f57e', '2026-05-06 18:44:51.357576+00', 'heupel.martial@gmail.com', 'REACTIVATE_PLATFORM', '{"reason": "Réactivation manuelle superadmin"}', 'heupel.martial@gmail.com');


--
-- Data for Name: admins; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."admins" ("email", "role", "auth_user_id", "status", "created_at", "id") VALUES
	('heupel.martial@gmail.com', 'superadmin', 'be878f65-0c32-4e50-82a6-186ec8590fbb', 'active', '2026-04-26 21:55:50.614225+00', 'c39e18c0-8577-4c5f-82ad-3101a6eea712'),
	('manualongaboni@gmail.com', 'admin', '9f576223-4806-4e53-aa87-d827ca0f1172', 'active', '2026-05-09 14:02:39.545935+00', 'd2ba823a-4068-41ae-b199-d714d9c24bfd');


--
-- Data for Name: billing_periods; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."billing_periods" ("id", "client_id", "period_start", "period_end", "status", "flat_fee_amount", "commission_amount", "adjustments_total", "total_due", "total_paid", "orders_count", "orders_base_amount", "locked_at", "paid_at", "created_at", "updated_at") VALUES
	('a45ff07b-56f7-4aa3-b938-c1d199078788', 'b7ce615f-c811-492d-b5a0-d77625f11625', '2026-04-30', '2026-05-30', 'en_cours', 35, 6.1, 0, 41.1, 0, 1, 122, NULL, NULL, '2026-05-04 21:09:07.898801+00', '2026-05-06 15:47:00.723+00'),
	('8a371da8-b35d-47c4-be74-5961cfe7a2d6', '9f576223-4806-4e53-aa87-d827ca0f1172', '2026-06-01', '2026-06-30', 'en_cours', 35, 75.74, 0, 110.74, 0, 38, 1082, NULL, NULL, '2026-06-26 10:26:23.264534+00', '2026-07-01 12:27:15.422973+00');


--
-- Data for Name: billing_adjustments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: client_contracts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."client_contracts" ("id", "client_id", "started_at", "ended_at", "billing_mode", "flat_fee_amount", "flat_fee_currency", "minimum_guarantee", "maximum_cap", "is_active", "created_by", "created_at", "updated_at") VALUES
	('17b3bcb1-25b8-43b7-9da3-09d535dd71c6', 'b7ce615f-c811-492d-b5a0-d77625f11625', '2026-05-04', NULL, 'flat_category', 35, 'USD', NULL, NULL, true, NULL, '2026-05-04 21:09:07.744575+00', '2026-05-06 15:46:57.957+00'),
	('ea642162-9941-455b-91f4-d4ecefd69259', '9f576223-4806-4e53-aa87-d827ca0f1172', '2026-06-01', NULL, 'flat_percent', 35, 'MAD', NULL, NULL, true, NULL, '2026-06-26 10:26:23.121126+00', '2026-06-26 10:26:29.688+00');


--
-- Data for Name: commission_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."commission_rules" ("id", "contract_id", "rule_type", "tier_from", "tier_to", "category_slug", "rate_percent", "amount_per_order", "effective_from", "effective_to") VALUES
	('ceb658e3-15d3-4651-886f-65a1e71e5c1c', '17b3bcb1-25b8-43b7-9da3-09d535dd71c6', 'category', NULL, NULL, 'chaudes', 5, NULL, NULL, NULL),
	('78bd6eba-39c7-49d8-951a-d76eab8f6893', '17b3bcb1-25b8-43b7-9da3-09d535dd71c6', 'category', NULL, NULL, 'froides', 5, NULL, NULL, NULL),
	('0daad203-a8e0-4dcd-a58d-73d732d52d39', '17b3bcb1-25b8-43b7-9da3-09d535dd71c6', 'category', NULL, NULL, 'salades', 5, NULL, NULL, NULL),
	('f29f2d0a-7b2d-4e5f-ac4a-9bc4660fae6b', '17b3bcb1-25b8-43b7-9da3-09d535dd71c6', 'category', NULL, NULL, 'sandwichs_chauds', 5, NULL, NULL, NULL),
	('cb1b7645-a972-4637-b364-87d7bf187886', '17b3bcb1-25b8-43b7-9da3-09d535dd71c6', 'category', NULL, NULL, 'sandwichs_froids', 5, NULL, NULL, NULL),
	('f64731dc-39c6-4d42-a777-9dec3fe0444e', '17b3bcb1-25b8-43b7-9da3-09d535dd71c6', 'category', NULL, NULL, 'test_3', 5, NULL, NULL, NULL),
	('0ebaba85-671d-4eb1-968c-a49f99dff3c3', 'ea642162-9941-455b-91f4-d4ecefd69259', 'flat_percent', NULL, NULL, NULL, 7, NULL, NULL, NULL);


--
-- Data for Name: contract_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."contract_history" ("id", "contract_id", "changed_at", "changed_by", "old_snapshot", "new_snapshot", "reason") VALUES
	('f8c2b022-9370-4977-8334-730faf17fd18', '17b3bcb1-25b8-43b7-9da3-09d535dd71c6', '2026-05-04 21:09:41.441212+00', 'be878f65-0c32-4e50-82a6-186ec8590fbb', '{"id": "17b3bcb1-25b8-43b7-9da3-09d535dd71c6", "ended_at": null, "client_id": "39614f84-c1f9-4cd8-8d65-e296dfea65d0", "is_active": true, "created_at": "2026-05-04T21:09:07.744575+00:00", "created_by": null, "started_at": "2026-05-04", "updated_at": "2026-05-04T21:09:07.744575+00:00", "maximum_cap": null, "billing_mode": "flat_tiered", "flat_fee_amount": 35, "flat_fee_currency": "MAD", "minimum_guarantee": null}', '{"billing_mode": "flat_tiered", "flat_fee_amount": 35}', 'Modification via Super Admin'),
	('c69fd8fa-61ab-4250-8b0f-58d135e97879', '17b3bcb1-25b8-43b7-9da3-09d535dd71c6', '2026-05-06 15:28:26.338691+00', 'be878f65-0c32-4e50-82a6-186ec8590fbb', '{"id": "17b3bcb1-25b8-43b7-9da3-09d535dd71c6", "ended_at": null, "client_id": "b7ce615f-c811-492d-b5a0-d77625f11625", "is_active": true, "created_at": "2026-05-04T21:09:07.744575+00:00", "created_by": null, "started_at": "2026-05-04", "updated_at": "2026-05-04T21:09:41.463+00:00", "maximum_cap": null, "billing_mode": "flat_tiered", "flat_fee_amount": 35, "flat_fee_currency": "USD", "minimum_guarantee": null}', '{"billing_mode": "flat_category", "flat_fee_amount": 35}', 'Modification via Super Admin'),
	('6c9b7f67-8388-4156-b7ba-374836d1bae4', '17b3bcb1-25b8-43b7-9da3-09d535dd71c6', '2026-05-06 15:29:06.682541+00', 'be878f65-0c32-4e50-82a6-186ec8590fbb', '{"id": "17b3bcb1-25b8-43b7-9da3-09d535dd71c6", "ended_at": null, "client_id": "b7ce615f-c811-492d-b5a0-d77625f11625", "is_active": true, "created_at": "2026-05-04T21:09:07.744575+00:00", "created_by": null, "started_at": "2026-05-04", "updated_at": "2026-05-06T15:28:26.359+00:00", "maximum_cap": null, "billing_mode": "flat_category", "flat_fee_amount": 35, "flat_fee_currency": "USD", "minimum_guarantee": null}', '{"billing_mode": "flat_category", "flat_fee_amount": 35}', 'Modification via Super Admin'),
	('7bd22496-7d6c-4e4f-90a7-4b8dc336db1e', '17b3bcb1-25b8-43b7-9da3-09d535dd71c6', '2026-05-06 15:46:57.944198+00', 'be878f65-0c32-4e50-82a6-186ec8590fbb', '{"id": "17b3bcb1-25b8-43b7-9da3-09d535dd71c6", "ended_at": null, "client_id": "b7ce615f-c811-492d-b5a0-d77625f11625", "is_active": true, "created_at": "2026-05-04T21:09:07.744575+00:00", "created_by": null, "started_at": "2026-05-04", "updated_at": "2026-05-06T15:29:06.561+00:00", "maximum_cap": null, "billing_mode": "flat_category", "flat_fee_amount": 35, "flat_fee_currency": "USD", "minimum_guarantee": null}', '{"billing_mode": "flat_category", "flat_fee_amount": 35}', 'Modification via Super Admin'),
	('5897d45a-d199-4933-879b-ecd01a593140', 'ea642162-9941-455b-91f4-d4ecefd69259', '2026-06-26 10:26:29.814191+00', 'be878f65-0c32-4e50-82a6-186ec8590fbb', '{"id": "ea642162-9941-455b-91f4-d4ecefd69259", "ended_at": null, "client_id": "9f576223-4806-4e53-aa87-d827ca0f1172", "is_active": true, "created_at": "2026-06-26T10:26:23.121126+00:00", "created_by": null, "started_at": "2026-06-01", "updated_at": "2026-06-26T10:26:23.121126+00:00", "maximum_cap": null, "billing_mode": "flat_percent", "flat_fee_amount": 35, "flat_fee_currency": "MAD", "minimum_guarantee": null}', '{"billing_mode": "flat_percent", "flat_fee_amount": 35}', 'Modification via Super Admin');


--
-- Data for Name: delivery_drivers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."delivery_drivers" ("id", "user_id", "full_name", "phone", "email", "status", "vehicle_type", "zone", "created_at", "updated_at") VALUES
	('ded379e8-a14f-428b-bd9f-f17b1c875514', NULL, 'Chen zen', '+243972495533', NULL, 'active', 'scooter', NULL, '2026-05-19 18:05:06.850682+00', '2026-05-19 18:05:06.850682+00'),
	('57eeff07-a0a2-44cb-ae57-cc5c90dcf939', NULL, 'Martch', '+352691434011', NULL, 'active', 'scooter', NULL, '2026-05-19 13:44:33.556864+00', '2026-05-19 13:44:33.556864+00'),
	('7544aa44-f856-4f61-9e6f-f20039c92005', NULL, 'Manu x', '+243820730633', NULL, 'active', 'scooter', NULL, '2026-05-19 18:04:25.325592+00', '2026-05-19 18:04:25.325592+00'),
	('d17026e5-2564-4166-bcaa-7855b5038d11', NULL, 'Kayzer', '+243980980467', NULL, 'active', 'scooter', NULL, '2026-07-17 18:27:34.377212+00', '2026-07-17 18:27:34.377212+00'),
	('09e90815-2a1a-4b4b-b1a8-42bfc95f71ca', NULL, 'Sam sun', '+243855764821', NULL, 'active', 'scooter', NULL, '2026-07-28 15:09:57.529671+00', '2026-07-28 15:09:57.529671+00');


--
-- Data for Name: delivery_slots; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."delivery_slots" ("id", "date", "time_start", "time_end", "capacity", "booked", "blocked") VALUES
	('d8dcd4b8-3c6b-4335-b63b-2ecd599b1eff', '2026-05-30', '19:00:00', '19:30:00', 2, 0, false),
	('b20be682-c8ab-4fef-9fc4-464b3c847ff5', '2026-06-07', '00:00:00', '00:30:00', 2, 0, false),
	('c6268be3-8e7a-495d-b516-2119bc0c7193', '2026-06-07', '00:30:00', '01:00:00', 2, 0, false),
	('547c4c13-03e6-4851-b671-09b8de8d250c', '2026-06-07', '01:00:00', '01:30:00', 2, 0, false),
	('31ccfe42-f37f-46be-aecc-3f89045097a8', '2026-06-07', '01:30:00', '02:00:00', 2, 0, false),
	('1822ec80-4217-420a-a4bc-a1e982021f4a', '2026-06-07', '02:00:00', '02:30:00', 2, 0, false),
	('27142eb8-57dd-4955-b23c-aa10dae940cb', '2026-06-07', '02:30:00', '03:00:00', 2, 0, false),
	('7d08e71e-2bd5-42c0-9025-4f0d73fa2254', '2026-06-07', '03:00:00', '03:30:00', 2, 0, false),
	('65e003f1-4eb1-4aaa-bdb3-0196146fb83d', '2026-06-07', '03:30:00', '04:00:00', 2, 0, false),
	('a3a6a6f2-1f68-433f-a634-6c5182730d91', '2026-06-07', '08:00:00', '08:30:00', 2, 0, false),
	('c118d67e-e6e4-4346-a504-59c739bd2f43', '2026-06-07', '08:30:00', '09:00:00', 2, 0, false),
	('2772a276-2cbd-4b5b-b22d-13638b7c4414', '2026-06-07', '09:00:00', '09:30:00', 2, 0, false),
	('e92b59c5-998e-40a6-8fc4-1ddefc9b9a48', '2026-06-07', '09:30:00', '10:00:00', 2, 0, false),
	('717f86da-6c4d-4894-ba78-2f548117670d', '2026-06-07', '10:00:00', '10:30:00', 2, 0, false),
	('bedd5801-e694-47b7-8db7-3882c91462c3', '2026-05-24', '18:00:00', '18:30:00', 2, 0, false),
	('5e654e5d-e03b-484f-bb35-1fd1e2b01c03', '2026-05-24', '18:30:00', '19:00:00', 2, 0, false),
	('ec45ae9d-45ac-4a60-ae55-f29fa2c04136', '2026-05-24', '19:00:00', '19:30:00', 2, 0, false),
	('8dd69513-3164-42dc-813d-dc606c178b40', '2026-05-24', '19:30:00', '20:00:00', 2, 0, false),
	('52ae48bf-4ae2-4a04-a0b4-cc459c24c4b4', '2026-05-24', '20:00:00', '20:30:00', 2, 0, false),
	('e1646b0c-f641-4712-93d7-08d6eb2d77ac', '2026-05-24', '20:30:00', '21:00:00', 2, 0, false),
	('e5ce1482-6eb1-4128-866b-1b15f32f36f7', '2026-05-24', '21:00:00', '21:30:00', 2, 0, false),
	('982c8aa1-7ba7-4874-a121-cf27aff3c521', '2026-05-24', '21:30:00', '22:00:00', 2, 0, false),
	('1e0289d0-634f-4675-b6c3-61104508df61', '2026-05-24', '22:00:00', '22:30:00', 2, 0, false),
	('404ea843-1c04-4860-b84f-cffdcceca244', '2026-05-24', '22:30:00', '23:00:00', 2, 0, false),
	('2164fcc3-aed9-4d5f-8bbe-e426b784cf31', '2026-05-24', '23:00:00', '23:30:00', 2, 0, false),
	('38c1dd74-3ca8-4abb-96a2-ac844fa12676', '2026-05-30', '22:00:00', '22:30:00', 2, 0, false),
	('29452c9b-799d-40ee-be4c-b23bca74807c', '2026-05-02', '11:30:00', '12:00:00', 2, 0, false),
	('e37373d8-8b50-44db-9f53-739ff21dde0c', '2026-05-02', '12:00:00', '12:30:00', 2, 0, false),
	('5142a02c-4a3c-4298-bab9-21519a2d2f4c', '2026-05-02', '12:30:00', '13:00:00', 2, 0, false),
	('4c8103fc-d1b6-42f5-b4a9-6f673d4459cb', '2026-05-02', '13:00:00', '13:30:00', 2, 0, false),
	('260834c6-59bf-4ef5-a076-7505f6e84f0a', '2026-05-02', '13:30:00', '14:00:00', 2, 0, false),
	('b01ea5a4-5d66-44d6-92dd-053206ae324b', '2026-05-02', '14:00:00', '14:30:00', 2, 0, false),
	('80a0bc92-08b9-40e2-978f-46a9c8ec3bd9', '2026-05-02', '14:30:00', '15:00:00', 2, 0, false),
	('b6213e72-c99a-45d4-a5fb-f61c4de09832', '2026-05-30', '02:00:00', '02:30:00', 2, 0, false),
	('4baca08f-10f2-4f74-bb1e-fe5a9105bfed', '2026-05-30', '01:30:00', '02:00:00', 2, 0, false),
	('57559a97-a4ba-451b-aa08-8551d60ec463', '2026-06-06', '02:00:00', '02:30:00', 2, 0, false),
	('b2ef19f4-0d9d-418a-b7c9-0f8f4f04eaaa', '2026-06-06', '02:30:00', '03:00:00', 2, 0, false),
	('32532d58-bce5-4fac-83a4-8e7eff93b0b4', '2026-06-01', '02:00:00', '02:30:00', 2, 0, false),
	('e6e90d21-e38e-48a0-868e-2e6501c75262', '2026-06-01', '02:30:00', '03:00:00', 2, 0, false),
	('d5fe9302-f8ec-497b-b807-c51924a31c1e', '2026-06-01', '00:00:00', '00:30:00', 2, 0, false),
	('24d55a89-2b5c-4e91-8393-6bf0f609230b', '2026-06-01', '13:30:00', '14:00:00', 2, 0, false),
	('d76b54a9-74c5-4ab5-9ec6-aa22536c38b2', '2026-06-01', '14:00:00', '14:30:00', 2, 0, false),
	('30641ec8-b84d-43ff-8176-2acbd32cdd15', '2026-06-09', '08:00:00', '08:30:00', 2, 0, false),
	('ad0b5ea8-fe15-4ba0-9795-4d504347ef90', '2026-06-01', '15:30:00', '16:00:00', 2, 0, false),
	('6b8c94b0-aad1-4cea-8841-d3f6711dcda7', '2026-06-01', '16:00:00', '16:30:00', 2, 0, false),
	('d0fe0c0e-246a-4ce7-ad7a-ac38b5db845d', '2026-06-01', '16:30:00', '17:00:00', 2, 0, false),
	('40055446-e045-4e4c-aa4b-cc7e73edf68d', '2026-06-01', '17:00:00', '17:30:00', 2, 0, false),
	('8deb03ec-5e5f-4669-a711-22b66af30369', '2026-06-01', '17:30:00', '18:00:00', 2, 0, false),
	('19588712-8c96-436f-b72e-656c1eebb8b2', '2026-06-01', '18:00:00', '18:30:00', 2, 0, false),
	('25885ef7-b70a-462a-8e24-d296b9a9d6ce', '2026-06-01', '19:00:00', '19:30:00', 2, 0, false),
	('30eeb3ea-60e8-470e-8036-815875536ca8', '2026-06-01', '19:30:00', '20:00:00', 2, 0, false),
	('602b6223-5920-421e-b71a-623ef86cd797', '2026-06-01', '20:00:00', '20:30:00', 2, 0, false),
	('19d233f6-c376-45b9-8ee5-29611ae94b74', '2026-06-01', '20:30:00', '21:00:00', 2, 0, false),
	('4953dd7d-363b-481d-8a3b-371d687b4d52', '2026-06-01', '21:00:00', '21:30:00', 2, 0, false),
	('b218166d-a6d7-4a02-8185-9e3aa6dd2bf5', '2026-06-01', '21:30:00', '22:00:00', 2, 0, false),
	('963f5c9f-7f33-4c85-8201-301390e1629f', '2026-06-01', '22:00:00', '22:30:00', 2, 0, false),
	('fd64ccdd-e358-45a7-be1f-8ec04572cac3', '2026-06-01', '22:30:00', '23:00:00', 2, 0, false),
	('e1eb1ec9-1d8a-49f3-837c-19290024e04a', '2026-06-01', '23:00:00', '23:30:00', 2, 0, false),
	('ac3acc09-866b-4faf-a478-1c30f643337f', '2026-05-18', '00:00:00', '00:30:00', 2, 0, false),
	('e8a095b6-1b7c-4568-b1b8-976c8ea3ebd3', '2026-05-18', '00:30:00', '01:00:00', 2, 0, false),
	('7b2dabc2-b5bf-441f-a93b-0d193c41d0e0', '2026-05-18', '01:00:00', '01:30:00', 2, 0, false),
	('545f5f47-fc63-4daa-84d0-de6ff6c644e2', '2026-05-18', '01:30:00', '02:00:00', 2, 0, false),
	('835c3dd6-8bcf-4ad3-9b39-8a234a6feccf', '2026-05-19', '02:00:00', '02:30:00', 2, 0, false),
	('99f53e98-cf53-4f4b-b5b9-9da2daf7b8b7', '2026-05-19', '01:30:00', '02:00:00', 2, 0, false),
	('bdfc2b08-c76b-4369-abe0-090638aa157a', '2026-05-18', '15:30:00', '16:00:00', 2, 0, false),
	('65e800da-6a59-42d8-ba41-9082b47582ca', '2026-05-18', '16:00:00', '16:30:00', 2, 0, false),
	('8a8c0a43-6491-4e5c-8fea-9aaf56aa7988', '2026-05-18', '16:30:00', '17:00:00', 2, 0, false),
	('31419992-5c46-4b37-8407-dbc3f641ccee', '2026-05-18', '17:00:00', '17:30:00', 2, 0, false),
	('3b653b98-a37d-48ac-a146-bba323cb595f', '2026-05-18', '17:30:00', '18:00:00', 2, 0, false),
	('43749f5c-70bc-46f4-a52a-1f1f83406484', '2026-05-18', '18:00:00', '18:30:00', 2, 0, false),
	('6a76e77e-7f85-4251-9bc2-94354b9f90ee', '2026-05-18', '18:30:00', '19:00:00', 2, 0, false),
	('eceaed3e-fd07-472c-8d29-306df792e410', '2026-05-18', '19:00:00', '19:30:00', 2, 0, false),
	('90b232bc-1eff-4db3-8957-840f6e8bd554', '2026-05-18', '19:30:00', '20:00:00', 2, 0, false),
	('87c7d173-d848-40d8-a3f5-dd5041a9e536', '2026-05-18', '20:00:00', '20:30:00', 2, 0, false),
	('c6e01f5f-e66d-4e6d-a820-c8d015866545', '2026-05-18', '20:30:00', '21:00:00', 2, 0, false),
	('c34206ae-dd17-43f6-a821-721046a4da8e', '2026-05-18', '21:00:00', '21:30:00', 2, 0, false),
	('710dc2a2-52ad-48da-acc1-76988566634d', '2026-05-18', '21:30:00', '22:00:00', 2, 0, false),
	('769371e0-a009-4ebb-a561-724e8480fb45', '2026-06-06', '03:00:00', '03:30:00', 2, 0, false),
	('c50ba537-8557-4acc-b27e-5dee5eb53244', '2026-06-06', '03:30:00', '04:00:00', 2, 0, false),
	('bd9bd40b-0636-4392-bac8-c304a90c9516', '2026-06-06', '08:00:00', '08:30:00', 2, 0, false),
	('5c29f203-256c-474a-be32-81fa6cb16264', '2026-06-06', '08:30:00', '09:00:00', 2, 0, false),
	('6f5b9e53-9662-423a-98a5-d053b4074070', '2026-06-06', '09:00:00', '09:30:00', 2, 0, false),
	('a618466a-9ae7-4c31-9de4-1833ce304f03', '2026-06-06', '09:30:00', '10:00:00', 2, 0, false),
	('a1c3e37d-c72e-4673-b12d-25e54e3b270c', '2026-06-06', '10:00:00', '10:30:00', 2, 0, false),
	('f955e755-19a6-40b3-8b99-d483720495d6', '2026-06-06', '10:30:00', '11:00:00', 2, 0, false),
	('f5a8fe3d-35e2-4bc1-8522-65eeb336aedb', '2026-06-06', '11:00:00', '11:30:00', 2, 0, false),
	('c4286fe9-ba04-49c0-8592-ac2621e8b3e2', '2026-06-06', '11:30:00', '12:00:00', 2, 0, false),
	('f6319d05-c374-452b-8e55-654223509ab7', '2026-06-06', '12:00:00', '12:30:00', 2, 0, false),
	('7d08d35f-dfac-4de2-b4e4-d5ae46aa9798', '2026-06-06', '12:30:00', '13:00:00', 2, 0, false),
	('ae992857-4551-4558-ba7c-809f280c9d7d', '2026-06-06', '13:00:00', '13:30:00', 2, 0, false),
	('9a497a28-15e8-495e-a41d-25b97a2dd9a8', '2026-06-06', '13:30:00', '14:00:00', 2, 0, false),
	('42238efc-fb16-491e-9fa3-aaa8712c827a', '2026-06-06', '14:00:00', '14:30:00', 2, 0, false),
	('c43f2248-7f49-406e-8777-8afc77442326', '2026-06-02', '11:00:00', '11:30:00', 2, 0, false),
	('ec59c1c4-951d-4275-8ec3-cb439cfbe212', '2026-06-02', '11:30:00', '12:00:00', 2, 0, false),
	('615822bd-ebb8-466e-be99-fd583a1998fb', '2026-06-01', '15:00:00', '15:30:00', 2, 1, false),
	('a87b62cb-8ca6-449c-b433-7d61c91cec90', '2026-06-01', '18:30:00', '19:00:00', 2, 1, false),
	('a734e03b-d9c8-420d-9222-32a4b69a9058', '2026-05-14', '13:00:00', '13:30:00', 2, 0, false),
	('f0f02c00-c08d-4b2e-8d66-7efab1a7b69e', '2026-06-02', '12:00:00', '12:30:00', 2, 0, false),
	('26a59bdc-0783-46f6-b5e2-1a8bacc167cc', '2026-06-02', '12:30:00', '13:00:00', 2, 0, false),
	('4210f7ef-a9fd-4189-b2e2-ffad8b480524', '2026-06-02', '13:00:00', '13:30:00', 2, 0, false),
	('2a35d9af-6a6f-4552-a4e9-7e19129c4490', '2026-06-02', '13:30:00', '14:00:00', 2, 0, false),
	('f69ce182-a458-40be-84e8-ecda980b4ef1', '2026-06-02', '14:30:00', '15:00:00', 2, 0, false),
	('35a884cb-0ff9-415d-9280-6416aaf3ec5d', '2026-06-02', '15:00:00', '15:30:00', 2, 0, false),
	('0327c8b5-6d84-4afd-97fb-84c6906c0199', '2026-06-02', '15:30:00', '16:00:00', 2, 0, false),
	('8387346a-e860-4a27-b2be-31c063a3282c', '2026-06-02', '18:00:00', '18:30:00', 2, 0, false),
	('bdcc5a01-d19a-4030-ae00-a542e0aa81bd', '2026-06-02', '18:30:00', '19:00:00', 2, 0, false),
	('8b08985b-483a-40e0-a3eb-a02138f48140', '2026-06-02', '19:00:00', '19:30:00', 2, 0, false),
	('c9e4d878-d067-44be-99c1-c9c4021627c3', '2026-06-02', '19:30:00', '20:00:00', 2, 0, false),
	('d0f50e6c-a4d2-4fa6-8ac7-7e57ee5ad8ac', '2026-06-02', '20:00:00', '20:30:00', 2, 0, false),
	('367b9fe1-fb8b-4a5c-b7fb-8efe5f013209', '2026-06-02', '20:30:00', '21:00:00', 2, 0, false),
	('4364b329-9353-4c16-a817-a5f0a4f37803', '2026-06-06', '00:00:00', '00:30:00', 2, 0, false),
	('c9a16a09-2be2-4dc6-8ff8-9ba27b3f0df4', '2026-05-21', '14:30:00', '15:00:00', 2, 0, false),
	('a692eaf8-270b-4d23-81b1-5b9f216ef64a', '2026-05-26', '08:00:00', '08:30:00', 2, 0, false),
	('48184091-4562-4960-a344-e38b677beb1d', '2026-05-24', '01:30:00', '02:00:00', 2, 0, false),
	('5c76e474-27f1-4d38-9ae5-904fa39ea2fb', '2026-05-24', '02:00:00', '02:30:00', 2, 0, false),
	('65f2cd04-8af3-43bf-89df-9e2df79cf143', '2026-05-31', '14:30:00', '15:00:00', 2, 0, false),
	('2dc70741-b770-448e-99e2-a3dce3bb29d2', '2026-05-31', '15:00:00', '15:30:00', 2, 0, false),
	('8d6f9637-2a5b-4be1-927b-f7ceff218d29', '2026-05-31', '15:30:00', '16:00:00', 2, 0, false),
	('cc3dac9c-ded0-497c-9509-2363dfb6208d', '2026-05-31', '16:00:00', '16:30:00', 2, 0, false),
	('f619ce53-56a4-44e8-8bc5-f8ae2371d389', '2026-05-31', '16:30:00', '17:00:00', 2, 0, false),
	('df6a3ecb-a7b3-43c4-ab19-af7a0c1c8682', '2026-05-31', '17:00:00', '17:30:00', 2, 0, false),
	('165dab29-25c7-41b9-98ff-51ad374fd3aa', '2026-05-31', '17:30:00', '18:00:00', 2, 0, false),
	('04f6fdd5-6760-4bf7-ab22-d2643a2307e0', '2026-05-31', '18:00:00', '18:30:00', 2, 0, false),
	('9bf1152d-3929-4305-95cd-2221b752915f', '2026-05-31', '18:30:00', '19:00:00', 2, 0, false),
	('98a0d52e-4e54-476a-8be9-546c4a232274', '2026-05-31', '19:00:00', '19:30:00', 2, 0, false),
	('9dc9f27e-68a5-4484-ab13-a7f9362f3012', '2026-05-31', '19:30:00', '20:00:00', 2, 0, false),
	('ec99a924-33a3-4c08-905a-42f29fef1547', '2026-05-31', '20:00:00', '20:30:00', 2, 0, false),
	('42e5ccb3-a9f6-4695-ab30-11b3664aaad2', '2026-05-31', '20:30:00', '21:00:00', 2, 0, false),
	('e2c4ffb4-192f-4444-8a98-7d43163c4c1a', '2026-05-31', '21:00:00', '21:30:00', 2, 0, false),
	('cd04b4af-45e7-4ec0-b881-165d9b02aeee', '2026-05-31', '21:30:00', '22:00:00', 2, 0, false),
	('11f1f5b3-6b32-4773-9161-43e50eb2e5c4', '2026-05-25', '08:00:00', '08:30:00', 2, 0, false),
	('76bc1733-ce6c-4a05-ad58-2428303759a3', '2026-05-25', '08:30:00', '09:00:00', 2, 0, false),
	('a9c25466-dac4-4087-b8e8-04f0e2ef5b40', '2026-05-19', '00:00:00', '00:30:00', 2, 0, false),
	('de155eaf-4a99-4e77-a8f4-f8960feba5ad', '2026-05-14', '10:30:00', '11:00:00', 2, 0, false),
	('e52a29b8-86bc-4657-9897-a2ee7153da80', '2026-05-14', '11:00:00', '11:30:00', 2, 0, false),
	('661cb5c6-33e1-48f0-86a9-3f58f8841c28', '2026-05-14', '11:30:00', '12:00:00', 2, 0, false),
	('5109de95-4ced-44ba-93fe-cb41ff7d5a33', '2026-05-07', '16:30:00', '17:00:00', 2, 0, false),
	('5b582cb5-a935-4ecc-a64a-a20a8f6c496b', '2026-05-07', '17:00:00', '17:30:00', 2, 0, false),
	('003c5abd-479a-4e6c-bb93-2ddf22b7ad1e', '2026-05-07', '17:30:00', '18:00:00', 2, 0, false),
	('f808d349-7f90-4fb2-af63-e50b6e49326d', '2026-05-07', '18:00:00', '18:30:00', 2, 0, false),
	('98a5abea-6640-4935-b97b-1dbfa167fdbb', '2026-05-07', '18:30:00', '19:00:00', 2, 0, false),
	('a896269f-4802-4876-b341-3fbed114bd04', '2026-05-07', '19:00:00', '19:30:00', 2, 0, false),
	('22c1081b-da31-447b-a4f4-24a674221741', '2026-05-25', '10:30:00', '11:00:00', 2, 0, false),
	('d4845e50-36c1-4f9d-a600-b9438751c5d1', '2026-05-25', '11:00:00', '11:30:00', 2, 0, false),
	('9f23dcf7-39b3-4465-a29a-b056688561c1', '2026-05-25', '11:30:00', '12:00:00', 2, 0, false),
	('5e9e0e99-1473-4930-8705-3a4219213235', '2026-05-25', '12:00:00', '12:30:00', 2, 0, false),
	('d1874f42-5a4d-4ab0-b65f-6edee5c18ff0', '2026-05-13', '16:00:00', '16:30:00', 2, 0, false),
	('9e632e6f-3d99-4b37-8d21-ba4eef30b2c4', '2026-06-02', '21:00:00', '21:30:00', 2, 0, false),
	('49632bd5-364b-42fa-9100-eba0bf314fa4', '2026-06-02', '21:30:00', '22:00:00', 2, 0, false),
	('158bcc3e-c3ac-49a3-b2df-20aaeb2cfb93', '2026-06-02', '22:00:00', '22:30:00', 2, 0, false),
	('c9877fec-2224-4528-bb17-0e2ce4135114', '2026-06-02', '22:30:00', '23:00:00', 2, 0, false),
	('b50fd681-8b7e-4e51-86c9-bc636e7ca812', '2026-06-02', '23:00:00', '23:30:00', 2, 0, false),
	('22bda507-6e8d-486a-adcb-1855fcb50e63', '2026-05-18', '22:00:00', '22:30:00', 2, 0, false),
	('4a87a375-01b3-416a-8341-0a2ba7ede931', '2026-05-18', '22:30:00', '23:00:00', 2, 0, false),
	('b0c937c0-ea44-4ee9-9b03-c1988f9c2c58', '2026-06-03', '14:00:00', '14:30:00', 2, 0, false),
	('476e79a6-7126-47c3-8e8b-2a6fc4f1d78e', '2026-06-03', '14:30:00', '15:00:00', 2, 0, false),
	('9900c741-eeba-486c-a6a5-5377ca1fb00a', '2026-06-03', '15:00:00', '15:30:00', 2, 0, false),
	('4f46a845-19b9-402a-a374-a85306fd9425', '2026-06-03', '15:30:00', '16:00:00', 2, 0, false),
	('bc4011e5-b74e-4fa8-a743-d387615cca3d', '2026-06-03', '16:00:00', '16:30:00', 2, 0, false),
	('ebdc71fb-08af-4552-8b60-3a0b27414927', '2026-06-03', '16:30:00', '17:00:00', 2, 0, false),
	('5561c6ce-b1c8-41e9-baf7-02994f7b2153', '2026-06-03', '17:00:00', '17:30:00', 2, 0, false),
	('206e8f8c-ad65-40c4-8f98-3f4f6a42fa46', '2026-06-03', '17:30:00', '18:00:00', 2, 0, false),
	('19c961a3-775c-4674-a103-b4be7a9bd342', '2026-06-03', '18:00:00', '18:30:00', 2, 0, false),
	('5d388008-3350-4e3e-8cae-499b6d0aad0f', '2026-06-03', '18:30:00', '19:00:00', 2, 0, false),
	('2d8e66f8-7d64-40f6-a359-16521454d525', '2026-06-03', '19:00:00', '19:30:00', 2, 0, false),
	('17ac8887-9e6f-4121-ae1e-74872641e69c', '2026-06-03', '19:30:00', '20:00:00', 2, 0, false),
	('04a08856-e6c6-446f-acf3-5d019318af06', '2026-06-03', '20:00:00', '20:30:00', 2, 0, false),
	('a1420cd7-e7c0-4628-a962-30384efe2e57', '2026-05-13', '16:30:00', '17:00:00', 2, 0, false),
	('4159c988-433b-4a1f-b5a6-dce58c8ddcd7', '2026-05-07', '19:30:00', '20:00:00', 2, 0, false),
	('f9cb7b25-ebad-4b8d-b4a8-189a5ee873f1', '2026-05-07', '09:30:00', '10:00:00', 2, 0, false),
	('b422d86d-29b2-4f56-bf94-d0dd4738a2d4', '2026-05-10', '10:00:00', '10:30:00', 2, 0, false),
	('336c8677-d116-4dcd-a339-6b57a1e7e2db', '2026-05-10', '10:30:00', '11:00:00', 2, 0, false),
	('60f8dd74-69ad-4f69-9db8-44a656af2a7c', '2026-05-10', '11:00:00', '11:30:00', 2, 0, false),
	('4de8293f-7a12-4a9f-8ed1-51163d5c98f4', '2026-05-10', '11:30:00', '12:00:00', 2, 0, false),
	('b2798481-54f4-42ce-9568-7f8ca5b4fcf9', '2026-05-09', '12:30:00', '13:00:00', 2, 0, false),
	('e6d417d0-a296-4f04-9038-ca80a0f273e9', '2026-05-10', '12:00:00', '12:30:00', 2, 0, false),
	('578fcc42-46c2-4963-b966-4265bfe83015', '2026-05-10', '12:30:00', '13:00:00', 2, 0, false),
	('52b12df0-c831-453d-a3a0-3e252045ce33', '2026-05-10', '13:00:00', '13:30:00', 2, 0, false),
	('fde1c4cc-6a9e-4690-9daf-98608c58318f', '2026-05-25', '10:00:00', '10:30:00', 2, 0, false),
	('8a929de4-6205-4105-a7f4-ec07e0f86d18', '2026-05-10', '13:30:00', '14:00:00', 2, 0, false),
	('a82a55f9-f49c-46f4-be24-daf86e6708ee', '2026-05-10', '14:00:00', '14:30:00', 2, 0, false),
	('802f0756-cbc5-4bd0-a875-d38c1eb12bb4', '2026-05-10', '14:30:00', '15:00:00', 2, 0, false),
	('6f0badcb-b96c-4465-bd36-fa5b66356128', '2026-05-10', '15:30:00', '16:00:00', 2, 0, false),
	('e5f63f3e-4afa-4151-ba1e-49a821351435', '2026-04-28', '10:00:00', '10:30:00', 2, 0, false),
	('17d0fbf6-5fe7-4234-bfa5-46cc87c0a438', '2026-04-28', '10:30:00', '11:00:00', 2, 0, false),
	('ea87b985-f121-4901-9026-4521be538fb6', '2026-04-28', '11:30:00', '12:00:00', 2, 0, false),
	('f0265f91-8093-40b6-8273-33d934e89268', '2026-04-30', '09:30:00', '10:00:00', 2, 0, false),
	('f2306803-940c-43f0-9b80-6d681068b15c', '2026-04-28', '09:30:00', '10:00:00', 2, 0, false),
	('c842aedb-2dcb-4eba-9dd1-05d588135004', '2026-04-28', '11:00:00', '11:30:00', 2, 0, false),
	('2e0e34c7-9d56-460a-a392-47641de83d64', '2026-04-28', '12:00:00', '12:30:00', 2, 0, false),
	('14b95b17-7a71-4e8f-a8db-6ea44c077e85', '2026-06-07', '10:30:00', '11:00:00', 2, 0, false),
	('556b96bd-cc41-4d67-87a1-fc252f9e5c94', '2026-06-03', '20:30:00', '21:00:00', 2, 1, false),
	('15573c1f-cbb8-4e1f-a6b4-3b0a4232d395', '2026-05-09', '14:00:00', '14:30:00', 2, 0, false),
	('6d84d01e-d902-4e33-9f9f-300abf0ee25e', '2026-05-14', '14:00:00', '14:30:00', 2, 0, false),
	('d014faf3-4dfe-4c9c-9639-36e29d88b1f0', '2026-05-09', '14:30:00', '15:00:00', 2, 0, false),
	('a7734ca0-d9aa-461e-8e22-0ac90d1f0ec0', '2026-05-14', '14:30:00', '15:00:00', 2, 0, false),
	('b591cba1-f146-4cdf-bab1-178c1d378057', '2026-05-14', '15:30:00', '16:00:00', 2, 0, false),
	('62be23a7-b519-4aec-a355-8bb4a803de8f', '2026-05-14', '16:30:00', '17:00:00', 2, 0, false),
	('a79e11e4-84f9-4c22-9ddc-09955da82f6c', '2026-04-28', '09:00:00', '09:30:00', 2, 0, false),
	('3f4d8737-cda0-4693-ab79-8aae0877e241', '2026-04-28', '12:30:00', '13:00:00', 2, 0, false),
	('df98763e-9087-4ed3-81fb-228103b54cb5', '2026-05-07', '15:30:00', '16:00:00', 2, 0, false),
	('d4602fcb-6132-43d7-8b83-ea6d7173486c', '2026-05-07', '16:00:00', '16:30:00', 2, 0, false),
	('73efc2b2-bf96-4a6a-ae2f-a3f68afdb5fb', '2026-05-31', '00:30:00', '01:00:00', 2, 0, false),
	('95e785b6-f66b-4925-82a3-b874b84c7aa3', '2026-06-05', '21:00:00', '21:30:00', 2, 0, false),
	('5abc2d1f-cc58-404c-a462-d3a7e3e0d4f4', '2026-06-05', '21:30:00', '22:00:00', 2, 0, false),
	('1b1f51e5-78e1-4b41-9b0f-db754162d34d', '2026-06-06', '14:30:00', '15:00:00', 2, 0, false),
	('30594c2c-819b-4a11-bcc8-1e8fe2a9b574', '2026-06-06', '15:00:00', '15:30:00', 2, 0, false),
	('bc0e68d7-a61b-4331-a9da-f78f056d1284', '2026-06-06', '15:30:00', '16:00:00', 2, 0, false),
	('cccd64a6-cd9b-42e4-ba23-7affce4fbaa9', '2026-06-06', '16:00:00', '16:30:00', 2, 0, false),
	('507a16f2-fb04-40bb-b67e-c2c7775b1553', '2026-06-06', '16:30:00', '17:00:00', 2, 0, false),
	('e8514f54-5672-44d2-8b45-6431cc3734e4', '2026-06-06', '17:00:00', '17:30:00', 2, 0, false),
	('9dfd4891-63cb-4e09-a9cb-91af853ebef0', '2026-06-06', '17:30:00', '18:00:00', 2, 0, false),
	('88c06d40-dcb6-41eb-b607-cdc14b40852d', '2026-06-06', '18:00:00', '18:30:00', 2, 0, false),
	('8b585562-02e3-44d4-a8a7-7a82716c7c33', '2026-06-06', '18:30:00', '19:00:00', 2, 0, false),
	('90bbb610-f7c9-4ede-8c14-cfd0e2df912b', '2026-06-06', '19:00:00', '19:30:00', 2, 0, false),
	('debac581-0580-4a42-b71f-759012a2fc9d', '2026-06-06', '19:30:00', '20:00:00', 2, 0, false),
	('cc0166f9-f99e-49a8-8173-b52683a42313', '2026-06-06', '20:00:00', '20:30:00', 2, 0, false),
	('a39c994f-53d8-4caa-a396-a8dbe2b96ee7', '2026-06-06', '20:30:00', '21:00:00', 2, 0, false),
	('204d3236-8520-4dff-ae7f-d2740a0f8d16', '2026-06-06', '21:00:00', '21:30:00', 2, 0, false),
	('0e013f8f-8c04-494a-ac2a-16c333d3f4bd', '2026-06-06', '21:30:00', '22:00:00', 2, 0, false),
	('c206d282-2c4a-4ac9-9f49-bf6292262eb6', '2026-06-06', '22:00:00', '22:30:00', 2, 0, false),
	('37abba55-7892-4f91-a41b-9192529aa646', '2026-06-06', '22:30:00', '23:00:00', 2, 0, false),
	('3b727f68-6c11-4adf-b957-74f811002cdd', '2026-06-06', '23:00:00', '23:30:00', 2, 0, false),
	('bae0034f-2e1b-4360-92aa-b1b8d846e685', '2026-06-09', '08:30:00', '09:00:00', 2, 0, false),
	('81c41762-1e4d-416f-ab36-ef9535999db0', '2026-06-02', '00:30:00', '01:00:00', 2, 0, false),
	('c5f3ceaa-9699-4072-b125-45c2f20a25c5', '2026-06-02', '01:00:00', '01:30:00', 2, 0, false),
	('37e6106e-e1c6-46d7-bb6c-7976d70fb650', '2026-06-02', '01:30:00', '02:00:00', 2, 0, false),
	('26be9a18-373c-4f98-9858-b1e5a9bfc380', '2026-06-03', '09:00:00', '09:30:00', 2, 0, false),
	('0b1e10c2-7a3e-4d83-ba6c-e46829b85f18', '2026-06-03', '09:30:00', '10:00:00', 2, 0, false),
	('4c21ee6b-becf-4c2f-baa4-694dac0e70b2', '2026-06-03', '10:00:00', '10:30:00', 2, 0, false),
	('eedd2721-0002-49e3-b904-df77a92faa49', '2026-06-03', '10:30:00', '11:00:00', 2, 0, false),
	('9b45bfcb-92c7-46eb-8571-31816a5b92b4', '2026-06-03', '11:00:00', '11:30:00', 2, 0, false),
	('4285d7e3-451b-43f0-b7f5-22c06ee4bcb2', '2026-06-03', '11:30:00', '12:00:00', 2, 0, false),
	('23ac5148-aa30-4951-9877-bfef7cb7131e', '2026-06-03', '12:00:00', '12:30:00', 2, 0, false),
	('e410017b-009e-463b-aefd-c7680a04ea16', '2026-06-03', '12:30:00', '13:00:00', 2, 0, false),
	('35369dff-0e8e-48be-899a-2bc06116ea7d', '2026-06-03', '13:00:00', '13:30:00', 2, 0, false),
	('97ceda67-5566-47c8-b1fb-c6065687b948', '2026-06-03', '13:30:00', '14:00:00', 2, 0, false),
	('70315659-2505-4a35-a157-58067f588b55', '2026-06-05', '08:30:00', '09:00:00', 2, 0, false),
	('c90399fa-d57e-4fe1-aa08-6f458f1d11d0', '2026-06-05', '09:00:00', '09:30:00', 2, 0, false),
	('58e0faf8-48c0-4de4-aeb2-94de6a566478', '2026-06-05', '09:30:00', '10:00:00', 2, 0, false),
	('419691c8-ad9d-4bd7-82e0-40ad34185045', '2026-06-05', '10:00:00', '10:30:00', 2, 0, false),
	('eaa67673-50b6-458f-ae11-3037789b4ccc', '2026-06-05', '10:30:00', '11:00:00', 2, 0, false),
	('4f6dbedd-28e5-4b47-9397-fae0b0ec4960', '2026-06-05', '11:00:00', '11:30:00', 2, 0, false),
	('578ef504-2552-475c-bd69-175ed72391ad', '2026-06-05', '11:30:00', '12:00:00', 2, 0, false),
	('c79648c5-bb36-4d3a-8568-cb1965001473', '2026-06-05', '12:00:00', '12:30:00', 2, 0, false),
	('ac427d60-d37e-48e0-8e3b-3efd15bfe3c5', '2026-06-05', '12:30:00', '13:00:00', 2, 0, false),
	('ff435edb-1da5-4be3-88f5-89cf33e84340', '2026-06-05', '13:00:00', '13:30:00', 2, 0, false),
	('ad3e495c-faa7-408f-806c-1fe4e53ca78f', '2026-06-05', '13:30:00', '14:00:00', 2, 0, false),
	('bb2b40de-113d-4bfe-a45d-5c54eef5bd61', '2026-06-05', '14:00:00', '14:30:00', 2, 0, false),
	('8c519648-54b4-4046-9499-5c4f37c1eb5a', '2026-05-26', '14:30:00', '15:00:00', 2, 0, false),
	('da6e4337-cd78-4e65-88bb-92903e670fcf', '2026-05-26', '15:00:00', '15:30:00', 2, 0, false),
	('54125aa2-159e-4713-ae05-3cfc7cf699ac', '2026-05-26', '15:30:00', '16:00:00', 2, 0, false),
	('06bd3519-13e9-4293-ad5f-8964a9dd4cd2', '2026-05-26', '16:00:00', '16:30:00', 2, 0, false),
	('6627ecb8-f445-4cac-8c8f-8b32ed54c7e3', '2026-05-26', '16:30:00', '17:00:00', 2, 0, false),
	('5600cf04-b430-4820-ae03-7dec86318fba', '2026-05-26', '17:00:00', '17:30:00', 2, 0, false),
	('de8d37f3-21e2-4bf6-8d94-22821f3e9df1', '2026-05-26', '17:30:00', '18:00:00', 2, 0, false),
	('78ce1ac9-20a6-42ea-b601-ebfd7b72c561', '2026-05-26', '18:00:00', '18:30:00', 2, 0, false),
	('1e288c5f-41e4-4ab7-9aa5-136e1eab50e7', '2026-05-26', '18:30:00', '19:00:00', 2, 0, false),
	('6836a3b3-9bcb-4c3f-a3aa-7c0003168a07', '2026-05-26', '19:00:00', '19:30:00', 2, 0, false),
	('911ae0e2-2b48-4f4e-ac1b-5bffd2ca5116', '2026-05-26', '19:30:00', '20:00:00', 2, 0, false),
	('5ff20be2-a2ff-47a3-b078-e60e2c08d1e1', '2026-05-26', '20:00:00', '20:30:00', 2, 0, false),
	('db32a595-b992-4761-9603-bf75ceb25eb9', '2026-05-13', '17:00:00', '17:30:00', 2, 0, false),
	('df112511-949b-4f14-a30a-5667aab28b22', '2026-05-13', '17:30:00', '18:00:00', 2, 0, false),
	('9888141b-820f-49b8-865d-e17676ff4eff', '2026-05-26', '20:30:00', '21:00:00', 2, 0, false),
	('9df00e8a-92e3-48db-952f-79c300c5785c', '2026-05-26', '21:00:00', '21:30:00', 2, 0, false),
	('d1a15c4d-2ba8-4c41-a553-c4096d5c1d95', '2026-05-26', '21:30:00', '22:00:00', 2, 0, false),
	('c7fdb3a2-3154-4132-bd56-ff81411aa997', '2026-05-13', '18:00:00', '18:30:00', 2, 0, false),
	('4028b453-88b7-45af-a234-40f2de80a072', '2026-05-26', '22:00:00', '22:30:00', 2, 0, false),
	('15e7dd08-d88b-4983-ae39-d5e78692f7a4', '2026-06-05', '14:30:00', '15:00:00', 2, 0, false),
	('9ae3f66f-d726-4f7e-8f97-13efb43d9e96', '2026-06-05', '15:00:00', '15:30:00', 2, 0, false),
	('b6a67495-f667-4a3c-997d-fe9ca0182c91', '2026-06-05', '15:30:00', '16:00:00', 2, 0, false),
	('fa837c95-d239-4e7b-8a57-940603e6aad4', '2026-06-05', '16:00:00', '16:30:00', 2, 0, false),
	('7313ef73-0083-4d53-9ff2-02c06ffeb747', '2026-06-05', '16:30:00', '17:00:00', 2, 0, false),
	('c7502d90-04cd-4042-9d03-09dcd9460e89', '2026-06-05', '17:00:00', '17:30:00', 2, 0, false),
	('514bcda3-c276-4b04-ae26-74cacdcd2b0d', '2026-06-05', '17:30:00', '18:00:00', 2, 0, false),
	('36db94de-a87f-478a-9bae-ada2eae06451', '2026-06-05', '18:00:00', '18:30:00', 2, 0, false),
	('7c758bdc-5f02-4742-a479-53acea69ca4e', '2026-06-05', '18:30:00', '19:00:00', 2, 0, false),
	('9b4e19e5-2631-4035-a3e0-a902df4caefa', '2026-06-05', '19:00:00', '19:30:00', 2, 0, false),
	('84a21a9a-6366-43b8-9f51-d526886f3e34', '2026-06-05', '19:30:00', '20:00:00', 2, 0, false),
	('19ff010d-1ef6-4436-a737-826b3b1d7a2b', '2026-06-05', '20:00:00', '20:30:00', 2, 0, false),
	('060e7d99-3d06-44b3-a37b-a1d4294a68ca', '2026-06-05', '20:30:00', '21:00:00', 2, 0, false),
	('c55c300f-2b51-41d1-a85c-0483f2794209', '2026-05-26', '08:30:00', '09:00:00', 2, 0, false),
	('63a0a795-f73b-476a-b3c3-2c414c1b953f', '2026-05-26', '09:30:00', '10:00:00', 2, 0, false),
	('ab82bbf4-77bb-4130-a152-de9b3bd00109', '2026-06-07', '11:00:00', '11:30:00', 2, 0, false),
	('9118d13f-a429-408f-841c-b8ae12ec1971', '2026-06-07', '11:30:00', '12:00:00', 2, 0, false),
	('e35dd88d-d964-4d49-9278-fe461f376180', '2026-06-07', '12:00:00', '12:30:00', 2, 0, false),
	('5329cc04-b24f-4361-bbbd-c5c54c5acd33', '2026-06-07', '12:30:00', '13:00:00', 2, 0, false),
	('b1c5e959-8250-4739-8c3d-6749edad3917', '2026-06-07', '13:00:00', '13:30:00', 2, 0, false),
	('bd72d1e3-2d28-4c19-84c0-9d14f33a118a', '2026-05-14', '17:00:00', '17:30:00', 2, 0, false),
	('c1e2d5ad-1b60-403e-9944-5d3eb25da5dd', '2026-05-28', '09:30:00', '10:00:00', 2, 0, false),
	('83e6f47f-4c18-4ecf-a2c7-515d209560ce', '2026-05-28', '10:00:00', '10:30:00', 2, 0, false),
	('a76aaaf2-dd59-4f72-b3ba-145ba6377402', '2026-05-28', '10:30:00', '11:00:00', 2, 0, false),
	('93377283-7843-420f-a9cc-c64b944036cb', '2026-05-28', '16:30:00', '17:00:00', 2, 0, false),
	('8f4c12e5-3dc9-4ef8-b1fe-4e97e62ebacb', '2026-05-28', '17:00:00', '17:30:00', 2, 0, false),
	('8cb780b2-edc9-49b9-954e-ff029ff42373', '2026-05-28', '17:30:00', '18:00:00', 2, 0, false),
	('533c45b7-7bbe-45a7-add6-d37f7cbd22e6', '2026-05-28', '18:00:00', '18:30:00', 2, 0, false),
	('a7e0a800-f997-4cdb-8c6b-d48aac654584', '2026-05-28', '18:30:00', '19:00:00', 2, 0, false),
	('b31b2785-7d68-466c-a878-89f82db5bda8', '2026-05-28', '19:00:00', '19:30:00', 2, 0, false),
	('ec4eef53-818a-46e3-b33b-b59f0118c1b5', '2026-05-28', '19:30:00', '20:00:00', 2, 0, false),
	('aa946715-bcf3-452f-8bb3-4c37d415ec38', '2026-05-28', '20:00:00', '20:30:00', 2, 0, false),
	('c8388a36-fe76-445f-92ab-ceabceb2d144', '2026-05-28', '20:30:00', '21:00:00', 2, 0, false),
	('24f88e3f-c33f-4f93-b2f6-a53529187cf9', '2026-05-28', '21:00:00', '21:30:00', 2, 0, false),
	('a01293ac-7aa0-4f05-bd87-5b02d7a42e7c', '2026-05-28', '21:30:00', '22:00:00', 2, 0, false),
	('95565d30-c64d-4a09-b024-72f0a8bdd8fa', '2026-05-28', '22:00:00', '22:30:00', 2, 0, false),
	('d5030d2f-c5c0-4805-911c-d666ddd6a876', '2026-05-28', '22:30:00', '23:00:00', 2, 0, false),
	('abc7f461-91b8-436a-b06f-0fa069723c6a', '2026-05-28', '23:00:00', '23:30:00', 2, 0, false),
	('b18e6d66-3208-4969-8dc3-d601a6f29663', '2026-05-29', '00:00:00', '00:30:00', 2, 0, false),
	('e6f9576b-9f22-40e3-887b-e4b006ed501f', '2026-05-29', '00:30:00', '01:00:00', 2, 0, false),
	('d2022ec1-8e81-4f50-82e4-8270494d10fd', '2026-05-29', '01:00:00', '01:30:00', 2, 0, false),
	('67cf8653-2133-432e-9592-f6485e1e56aa', '2026-05-29', '01:30:00', '02:00:00', 2, 0, false),
	('3b011f61-9fa2-4ff7-b2c4-d1cb5f72633e', '2026-05-29', '02:00:00', '02:30:00', 2, 0, false),
	('77f94255-4838-46cb-aabd-0ed5fba7d38d', '2026-05-29', '02:30:00', '03:00:00', 2, 0, false),
	('aee89aaa-c3ea-4bd1-89dd-4cca56fb4178', '2026-05-29', '03:00:00', '03:30:00', 2, 0, false),
	('89ac3d60-36f7-41d4-8c7a-82a55095913c', '2026-05-29', '03:30:00', '04:00:00', 2, 0, false),
	('dd96ace5-b8da-4807-a3d2-db858d273b35', '2026-05-29', '08:00:00', '08:30:00', 2, 0, false),
	('61071f33-b238-4441-b125-37a237a7210a', '2026-05-29', '08:30:00', '09:00:00', 2, 0, false),
	('4b51b503-facf-427d-8970-cf450a9e43fe', '2026-05-29', '09:00:00', '09:30:00', 2, 0, false),
	('0404650c-1102-4bbc-a79d-c799d58076eb', '2026-05-29', '14:00:00', '14:30:00', 2, 0, false),
	('1fdbd367-4114-4717-8ce3-d091dab0da3f', '2026-05-29', '14:30:00', '15:00:00', 2, 0, false),
	('fdc31b5b-81f0-4f38-94f4-29725c170425', '2026-05-29', '15:00:00', '15:30:00', 2, 0, false),
	('5d1236ca-da98-4a42-88be-26f7b3f3497d', '2026-05-29', '15:30:00', '16:00:00', 2, 0, false),
	('aeb0cd13-5509-4450-8f59-e1c9d3ffc052', '2026-05-29', '16:00:00', '16:30:00', 2, 0, false),
	('a4124d69-cdf3-47b3-acee-028995df103a', '2026-05-29', '16:30:00', '17:00:00', 2, 0, false),
	('79be1ed3-2cb7-4e10-ac98-88e86f69a83c', '2026-04-29', '16:30:00', '17:00:00', 2, 0, false),
	('2c28095e-0f40-4411-919c-7a8a35ac045d', '2026-04-29', '17:00:00', '17:30:00', 2, 0, false),
	('f373d778-a108-489a-9f6f-fc21d33e879d', '2026-05-26', '11:00:00', '11:30:00', 2, 0, false),
	('9be4cf1c-9396-4d6f-873f-a4adc5ff6ad8', '2026-05-26', '11:30:00', '12:00:00', 2, 0, false),
	('15cf2933-32f4-4aac-9855-22a027bf1060', '2026-05-20', '00:00:00', '00:30:00', 2, 0, false),
	('52a0ac92-e01d-430d-8cc6-ecbc814fe6c0', '2026-05-26', '12:00:00', '12:30:00', 2, 0, false),
	('80809dfa-cbc1-42b2-873a-e48fa98c2e6b', '2026-05-26', '13:00:00', '13:30:00', 2, 0, false),
	('05deae7e-cd41-4f13-a66b-409f2800e307', '2026-05-26', '13:30:00', '14:00:00', 2, 0, false),
	('4af19e7b-4e7b-457f-a783-7f467723bf20', '2026-05-09', '10:00:00', '10:30:00', 2, 0, false),
	('4f77e141-024e-4b94-beab-38bf5932c269', '2026-05-09', '09:00:00', '09:30:00', 2, 0, false),
	('fbebe64b-59bb-4336-a9d2-b1cbd8601200', '2026-05-03', '09:00:00', '09:30:00', 2, 0, false),
	('84041d7f-096a-4dca-bd3a-2e55e3c17ad5', '2026-05-03', '10:00:00', '10:30:00', 2, 0, false),
	('40e14938-62e6-4fde-8eb1-a72959e2464a', '2026-05-03', '10:30:00', '11:00:00', 2, 0, false),
	('98b0e8ed-0f6e-43da-9b76-c003f5042fcf', '2026-05-03', '11:00:00', '11:30:00', 2, 0, false),
	('86ce0639-56df-4ea5-bd88-65a4883f2011', '2026-05-03', '11:30:00', '12:00:00', 2, 0, false),
	('5eb4a83b-fa3f-44e1-869d-645bba8e247d', '2026-05-03', '12:00:00', '12:30:00', 2, 0, false),
	('8911b436-84c2-4c7d-a51a-239cc52ae0c0', '2026-05-03', '12:30:00', '13:00:00', 2, 0, false),
	('b8e6a8eb-d608-46ac-b4ba-6cdf7fdf65e6', '2026-05-03', '13:00:00', '13:30:00', 2, 0, false),
	('7f36568f-1510-4a2b-9a6b-044383611cf0', '2026-05-03', '13:30:00', '14:00:00', 2, 0, false),
	('6e28052f-fa55-4750-b48f-fa2b1ccfeb5a', '2026-05-03', '14:00:00', '14:30:00', 2, 0, false),
	('1cc9bff6-9e82-4f93-9e18-414647eddb09', '2026-05-03', '14:30:00', '15:00:00', 2, 0, false),
	('6a7d7ebb-fd8d-4d9b-817c-776ce3fa7af0', '2026-05-03', '15:30:00', '16:00:00', 2, 0, false),
	('84271792-faad-4dc2-9f37-693204442836', '2026-05-03', '16:00:00', '16:30:00', 2, 0, false),
	('f517fb77-c4ea-4be0-a6d7-2c46e7029ffe', '2026-05-03', '16:30:00', '17:00:00', 2, 0, false),
	('971f14ce-324d-40be-8e8d-3603f9b1b8c1', '2026-05-03', '17:00:00', '17:30:00', 2, 0, false),
	('3565ea44-780a-425a-bd59-708c3cf95fca', '2026-06-07', '13:30:00', '14:00:00', 2, 0, false),
	('3332f3fb-78e4-4ba9-bde6-e238fc0a92ea', '2026-06-07', '14:00:00', '14:30:00', 2, 0, false),
	('a2702caf-52d2-4177-a548-c33631702cc6', '2026-06-07', '14:30:00', '15:00:00', 2, 0, false),
	('463b6c1d-907e-4fdf-a082-176c7ddc8462', '2026-06-07', '15:00:00', '15:30:00', 2, 0, false),
	('f7198e61-9b62-447b-a96b-d85429cf0f83', '2026-06-07', '15:30:00', '16:00:00', 2, 0, false),
	('99148d92-8ffe-445c-8c0d-469cc0c3caea', '2026-06-07', '16:30:00', '17:00:00', 2, 0, false),
	('55449cd7-d8ff-4fd3-b11f-d5e69d539109', '2026-06-07', '17:00:00', '17:30:00', 2, 0, false),
	('c3a82269-644c-4162-afa5-b07ae134d10f', '2026-06-07', '17:30:00', '18:00:00', 2, 0, false),
	('c6a6db5c-498d-4686-8546-c47505457745', '2026-06-07', '18:00:00', '18:30:00', 2, 0, false),
	('eac5c51f-b563-4ab4-ae28-a99c9f8b1829', '2026-06-07', '18:30:00', '19:00:00', 2, 0, false),
	('c6f3fdcc-4002-47fc-84ff-1f1c48f42661', '2026-06-07', '19:00:00', '19:30:00', 2, 0, false),
	('54f5b08d-04cb-4be4-ab9e-b272c9732fb0', '2026-06-07', '19:30:00', '20:00:00', 2, 0, false),
	('e2e382cb-b300-4e20-82e3-fa32b706da29', '2026-06-07', '20:00:00', '20:30:00', 2, 0, false),
	('d7377829-0d9f-4add-a02b-afb265123718', '2026-06-07', '20:30:00', '21:00:00', 2, 0, false),
	('e0e173e9-43a5-4d2e-b361-97437d08a357', '2026-06-07', '21:00:00', '21:30:00', 2, 0, false),
	('0f5da675-7b4d-4d6f-9c7c-40272b8d38a2', '2026-06-07', '21:30:00', '22:00:00', 2, 0, false),
	('32faf5ae-cdee-4cbe-862d-48c8902bde15', '2026-06-07', '22:00:00', '22:30:00', 2, 0, false),
	('e6c33d2f-d39c-482b-bbc5-a487ccf09150', '2026-06-07', '22:30:00', '23:00:00', 2, 0, false),
	('416829d7-62e9-4da0-9261-5b96cabfc4a2', '2026-06-07', '23:00:00', '23:30:00', 2, 0, false),
	('abb137fe-7a22-4bb3-b4c7-b32e0b0c6402', '2026-06-09', '09:00:00', '09:30:00', 2, 0, false),
	('a83ff5b1-e513-4ce9-a2b0-4a628faeb31a', '2026-06-09', '09:30:00', '10:00:00', 2, 0, false),
	('28fc5691-5207-4e56-8eef-c07458d90442', '2026-06-09', '10:00:00', '10:30:00', 2, 0, false),
	('53b4a775-51db-4c15-9e35-e038e4258c56', '2026-06-07', '16:00:00', '16:30:00', 2, 1, false),
	('ace5bc1e-e3f9-456f-ae55-5d3edac9c99a', '2026-06-09', '10:30:00', '11:00:00', 2, 0, false),
	('fd98fa79-e5fb-42de-ac4a-c97400e59e17', '2026-06-09', '11:00:00', '11:30:00', 2, 0, false),
	('d2176909-65d0-423d-99ee-263aeedc2633', '2026-06-09', '11:30:00', '12:00:00', 2, 0, false),
	('928dbc76-6368-4b1e-8f4b-a81694e64fe5', '2026-06-09', '12:00:00', '12:30:00', 2, 0, false),
	('ba9faef3-6cd5-42cf-8a0f-a09ac8bd2c2d', '2026-06-09', '12:30:00', '13:00:00', 2, 0, false),
	('34e6f9d5-3c0a-427c-9af0-a330d226c867', '2026-06-09', '13:00:00', '13:30:00', 2, 0, false),
	('f2bf0132-bdf9-43ae-b398-640da2e8b57c', '2026-07-29', '08:00:00', '08:30:00', 2, 0, false),
	('dfc2dba4-fdc6-4770-aa44-c2d171e06003', '2026-06-09', '14:30:00', '15:00:00', 2, 0, false),
	('62e45ced-6892-490a-b978-b774bd1970de', '2026-06-09', '15:00:00', '15:30:00', 2, 0, false),
	('7b88f368-6af5-4466-9be9-6b1c18f4e8a1', '2026-06-09', '15:30:00', '16:00:00', 2, 0, false),
	('bfbe2eff-94d6-498e-880f-7d5e8b4b697f', '2026-06-09', '16:00:00', '16:30:00', 2, 0, false),
	('742ec2a1-ff28-41e3-959d-fe55ad20fde1', '2026-06-09', '14:00:00', '14:30:00', 2, 1, false),
	('e583d39b-18bc-4c1b-8a9c-4add7c1521f3', '2026-06-09', '16:30:00', '17:00:00', 2, 0, false),
	('8eb8ecef-da21-4c3d-8d73-7a3f3a1c97e3', '2026-06-09', '17:00:00', '17:30:00', 2, 0, false),
	('d57146ae-731d-43d9-b9da-a4744fd130d7', '2026-06-09', '17:30:00', '18:00:00', 2, 0, false),
	('6cf74eee-a07d-483e-bbc9-800eb1dddd58', '2026-05-30', '22:30:00', '23:00:00', 2, 0, false),
	('0be4b2c2-76ad-4463-9abc-55538c03665a', '2026-05-30', '23:00:00', '23:30:00', 2, 0, false),
	('e6abb259-9fc5-4635-a02c-1e7752ba795f', '2026-05-29', '17:00:00', '17:30:00', 2, 0, false),
	('7a7a1842-8d21-4083-866c-219b0e39f3a1', '2026-05-29', '17:30:00', '18:00:00', 2, 0, false),
	('47749d0b-885e-497c-9e13-df6a29ed1e9f', '2026-05-29', '18:00:00', '18:30:00', 2, 0, false),
	('9667dff6-39c1-4dfe-b25d-d71f59bccd72', '2026-05-29', '18:30:00', '19:00:00', 2, 0, false),
	('07ec60e9-1692-40b9-b45a-5ab02ccc50e7', '2026-05-29', '19:00:00', '19:30:00', 2, 0, false),
	('aaa09c85-b3df-4988-887f-d05f5da0adcb', '2026-05-29', '19:30:00', '20:00:00', 2, 0, false),
	('80c20b92-80f6-4f63-b9e4-832612ccca2d', '2026-05-29', '20:00:00', '20:30:00', 2, 0, false),
	('1a07a3e4-4ed2-470d-b8ae-112ed9093f65', '2026-05-29', '20:30:00', '21:00:00', 2, 0, false),
	('18ea5265-43b6-406d-93a4-87ce87d0f485', '2026-05-29', '21:00:00', '21:30:00', 2, 0, false),
	('4417a019-20d7-41cf-964a-2daef6f14d00', '2026-05-29', '21:30:00', '22:00:00', 2, 0, false),
	('7c972207-736c-4fa4-97ca-1633e7bda72d', '2026-05-29', '22:00:00', '22:30:00', 2, 0, false),
	('7dc29c91-c9ad-44c3-b830-d9d416cd4c40', '2026-05-29', '22:30:00', '23:00:00', 2, 0, false),
	('b1db5fa2-f4d1-4ee5-ba69-27d769b13bf2', '2026-05-29', '23:00:00', '23:30:00', 2, 0, false),
	('bfd0fa5a-5d03-41ab-80cb-c0a9a66bf2a6', '2026-05-30', '00:00:00', '00:30:00', 2, 0, false),
	('981ff44b-9279-4040-adca-4c4c4d23dd36', '2026-05-30', '00:30:00', '01:00:00', 2, 0, false),
	('3dea20f1-d1c5-48ba-ab54-53ed313dcadf', '2026-05-30', '01:00:00', '01:30:00', 2, 0, false),
	('a83442c1-f891-4109-92ef-a439e44ed6e4', '2026-05-30', '02:30:00', '03:00:00', 2, 0, false),
	('1ffe60cf-a493-4d0d-a09d-2556e75c9237', '2026-05-30', '03:00:00', '03:30:00', 2, 0, false),
	('19006a3f-df2f-416f-b734-9597893ee4cb', '2026-05-30', '03:30:00', '04:00:00', 2, 0, false),
	('ccaf60da-b1d2-48c7-b376-91fb04144d3f', '2026-05-30', '13:00:00', '13:30:00', 2, 0, false),
	('323b045c-df48-494d-aff8-7045b3f9a620', '2026-05-31', '00:00:00', '00:30:00', 2, 0, false),
	('e7207796-1355-42f2-9ed1-c25e8a43e149', '2026-04-29', '17:30:00', '18:00:00', 2, 0, false),
	('d5e73b07-5442-47d5-b770-c52743def1dd', '2026-04-29', '18:00:00', '18:30:00', 2, 0, false),
	('b0c68249-f932-4045-aa46-c2855e8cbddd', '2026-04-29', '18:30:00', '19:00:00', 2, 0, false),
	('2e30d175-41d7-4bbd-97e4-75cea6e3134a', '2026-04-29', '19:00:00', '19:30:00', 2, 0, false),
	('d777e535-e743-401f-a64e-2fbf563c7bca', '2026-05-07', '12:30:00', '13:00:00', 2, 0, false),
	('2912af89-4dd6-41ec-85cc-c6f548626a2c', '2026-05-07', '13:00:00', '13:30:00', 2, 0, false),
	('30cf92f7-76ad-4f77-8393-6265d3fbfee0', '2026-05-07', '13:30:00', '14:00:00', 2, 0, false),
	('05b29e0f-8299-496a-acc4-834b820478a2', '2026-05-07', '14:00:00', '14:30:00', 2, 0, false),
	('ac06a26d-9256-4f77-8457-9592714dbcd2', '2026-05-31', '01:00:00', '01:30:00', 2, 0, false),
	('aa303030-6ad4-4652-a807-29a7288d6138', '2026-05-31', '23:00:00', '23:30:00', 2, 0, false),
	('2c8931ea-8f46-493f-82d3-f09c5d3b918e', '2026-04-26', '18:00:00', '19:00:00', 4, 0, false),
	('1e70c434-fc3d-4fd0-af3e-8a34301d49aa', '2026-05-02', '09:00:00', '09:30:00', 2, 0, false),
	('58f148b9-6012-448a-8f7b-cb6f02eb23fc', '2026-05-02', '09:30:00', '10:00:00', 2, 0, false),
	('2da5de52-f9a4-414e-ad07-75136d855936', '2026-05-02', '10:00:00', '10:30:00', 2, 0, false),
	('ec8245e0-9f66-4caf-a9fc-db2b90ec4cf2', '2026-05-02', '10:30:00', '11:00:00', 2, 0, false),
	('ca82307b-4efe-4f39-b7c4-9cf1e7e6a75d', '2026-05-02', '11:00:00', '11:30:00', 2, 0, false),
	('12360a49-7bdb-4e17-8293-8a59d081a66d', '2026-06-09', '18:00:00', '18:30:00', 2, 0, false),
	('b858acca-e8d7-46e7-b018-587c48b7b3f4', '2026-06-09', '18:30:00', '19:00:00', 2, 0, false),
	('ebb18099-7a30-4bd5-b53a-11caa292449a', '2026-06-09', '19:00:00', '19:30:00', 2, 0, false),
	('8da3466d-451b-40f8-9e46-ac9759f204a0', '2026-06-09', '20:00:00', '20:30:00', 2, 0, false),
	('424bdab2-b115-4c02-a3de-f94bcae84707', '2026-06-09', '20:30:00', '21:00:00', 2, 0, false),
	('231c944e-3673-4af2-a748-f995a533d6e7', '2026-06-09', '21:00:00', '21:30:00', 2, 0, false),
	('bdaa04a5-bd0d-41bd-b27a-1ec3e3eed5a4', '2026-06-09', '21:30:00', '22:00:00', 2, 0, false),
	('2d7bffc5-c51d-4615-b8ea-5d8112f38b92', '2026-06-09', '22:00:00', '22:30:00', 2, 0, false),
	('f0c14c45-7cef-4d2f-bde0-a80f42943531', '2026-06-09', '22:30:00', '23:00:00', 2, 0, false),
	('6bc88f24-80d7-435d-9583-973ee8cdd428', '2026-06-17', '08:00:00', '08:30:00', 2, 0, false),
	('8e802e36-c51a-409a-8be2-7c42a24bab00', '2026-06-17', '08:30:00', '09:00:00', 2, 0, false),
	('df268b54-bbe5-403d-b4e7-5f7431cd917d', '2026-06-17', '09:00:00', '09:30:00', 2, 0, false),
	('086eb7f3-3db8-4148-b76a-e5bcce028df5', '2026-06-17', '09:30:00', '10:00:00', 2, 0, false),
	('b44d9147-d091-40a9-ba83-ce0df65d51ec', '2026-06-17', '10:00:00', '10:30:00', 2, 0, false),
	('0f0f9ae2-18e8-4004-b95a-6bee8a944e77', '2026-06-17', '10:30:00', '11:00:00', 2, 0, false),
	('590f84c5-5c96-4e8c-97f1-806618ea1baf', '2026-06-17', '11:00:00', '11:30:00', 2, 0, false),
	('1669e38d-1a29-42a3-94fa-ba0fe9a5e18a', '2026-06-17', '12:30:00', '13:00:00', 2, 0, false),
	('a6f515ae-cb0c-4ecf-b2a7-767e2e06912a', '2026-06-17', '13:00:00', '13:30:00', 2, 0, false),
	('b71ebf2c-db96-4445-9dd6-de100a2a5b0d', '2026-06-17', '13:30:00', '14:00:00', 2, 0, false),
	('b3ec9141-def3-4442-9ed4-4bd22d3aeafa', '2026-06-17', '14:00:00', '14:30:00', 2, 0, false),
	('5decf933-30b0-4408-9541-b58877e7a7a8', '2026-06-17', '14:30:00', '15:00:00', 2, 0, false),
	('08f5c648-9661-4722-b6ef-ab4c1b5b49ce', '2026-06-17', '15:00:00', '15:30:00', 2, 0, false),
	('2a0122c0-e94a-4fa2-be72-5f564a9cbd94', '2026-06-17', '15:30:00', '16:00:00', 2, 0, false),
	('7fa70a8c-f7e0-4987-839b-3369e6278758', '2026-06-17', '16:00:00', '16:30:00', 2, 0, false),
	('59ee633f-9d7f-4c1e-a664-5ab82a893790', '2026-06-17', '16:30:00', '17:00:00', 2, 0, false),
	('05a2f3e0-e2f9-4e8a-befc-d99bcb4e0d66', '2026-06-17', '17:00:00', '17:30:00', 2, 0, false),
	('07ea4b86-2584-4772-8225-eeefa64d32c9', '2026-06-17', '17:30:00', '18:00:00', 2, 0, false),
	('196e9343-d6e2-47a9-a958-706d67d6c52c', '2026-06-17', '18:00:00', '18:30:00', 2, 0, false),
	('dd1591db-cc84-46de-b0d1-9dfdaa9c8b3c', '2026-06-17', '18:30:00', '19:00:00', 2, 0, false),
	('f6534e2d-ce03-4025-b4fe-7832510bcd43', '2026-06-17', '19:00:00', '19:30:00', 2, 0, false),
	('634558fe-89d2-4fec-8c0a-a2ac4bda5a4f', '2026-06-17', '19:30:00', '20:00:00', 2, 0, false),
	('f0fbcc03-a6b0-4139-81f3-3536f64da0c8', '2026-06-17', '20:00:00', '20:30:00', 2, 0, false),
	('87be5c2b-36e9-4c47-8586-19d249612069', '2026-06-17', '20:30:00', '21:00:00', 2, 0, false),
	('0349731f-c49a-4860-90fe-7f7590278bea', '2026-06-17', '21:00:00', '21:30:00', 2, 0, false),
	('d4a7cba2-421b-4787-a487-edd81a9dfffa', '2026-06-17', '21:30:00', '22:00:00', 2, 0, false),
	('3dbd8eda-c594-4656-baee-71dec9dea0bb', '2026-06-17', '22:00:00', '22:30:00', 2, 0, false),
	('7bdf7d34-239a-45ec-a432-b84b88182917', '2026-06-17', '22:30:00', '23:00:00', 2, 0, false),
	('806c2749-46fb-407a-8639-802e611649b9', '2026-07-29', '08:30:00', '09:00:00', 2, 0, false),
	('11a5d4ff-9b6f-434e-a206-2cbfae9bc32b', '2026-07-29', '09:00:00', '09:30:00', 2, 0, false),
	('f9c3ad1a-d899-4119-8b9d-543a2304fffc', '2026-06-09', '19:30:00', '20:00:00', 2, 1, false),
	('47f8d583-c6cb-4bf5-bb8f-9c525f13f480', '2026-06-27', '09:00:00', '09:30:00', 2, 0, false),
	('35001340-a3d1-469b-bc9a-58bbc2d8e636', '2026-06-27', '09:30:00', '10:00:00', 2, 0, false),
	('7fabe517-1720-4229-9fe0-4a92f51b3fc8', '2026-06-27', '10:00:00', '10:30:00', 2, 0, false),
	('2ac4ddb3-9ce3-4c28-8d5c-3d234fc9ed96', '2026-06-27', '10:30:00', '11:00:00', 2, 0, false),
	('8b7f1be0-fe3a-4167-9486-fbcc8fefc535', '2026-06-27', '11:00:00', '11:30:00', 2, 0, false),
	('571ffcaf-2364-4bb3-b7b8-a72df3c4e9a0', '2026-06-27', '11:30:00', '12:00:00', 2, 0, false),
	('2752d0b4-740c-47d5-aa92-c40aaa72ab48', '2026-06-27', '12:00:00', '12:30:00', 2, 0, false),
	('92da62a2-001d-4766-a5b4-e8c43a588a46', '2026-06-27', '12:30:00', '13:00:00', 2, 0, false),
	('33b2268b-51bd-4015-b2cc-837378caaaaa', '2026-06-17', '11:30:00', '12:00:00', 2, 1, false),
	('58d8c036-7c86-4ee1-ad8e-3c5792934111', '2026-06-17', '12:00:00', '12:30:00', 2, 1, false),
	('650bc9a4-6891-480b-a0c9-13e3b206e027', '2026-06-27', '08:00:00', '08:30:00', 2, 0, false),
	('28687072-c471-4c09-b608-83dc1324662b', '2026-07-29', '09:30:00', '10:00:00', 2, 0, false),
	('7b413e54-3111-443b-9bf5-c4a9a1a9400c', '2026-06-27', '08:30:00', '09:00:00', 2, 2, false),
	('7c8e54ad-c982-49f4-8629-1eac7f6e9a5c', '2026-06-01', '00:30:00', '01:00:00', 2, 0, false),
	('b6b274ab-6bd1-4348-bc4f-58a0e2bd7792', '2026-06-01', '01:00:00', '01:30:00', 2, 0, false),
	('e3cafdd3-b6e1-4b2f-a08d-f47728005585', '2026-06-01', '01:30:00', '02:00:00', 2, 0, false),
	('ab70d766-e419-4152-8b6f-62ddd8a7ff6a', '2026-06-01', '03:00:00', '03:30:00', 2, 0, false),
	('8844e367-2a4f-4a24-974b-53fdb7a667ef', '2026-06-01', '03:30:00', '04:00:00', 2, 0, false),
	('30d9e8b9-ae51-45e2-acf6-df51f1f15894', '2026-06-01', '08:00:00', '08:30:00', 2, 0, false),
	('32b38798-3038-4bc4-be48-377f07c9ff19', '2026-06-01', '08:30:00', '09:00:00', 2, 0, false),
	('d460a182-7779-4b89-b9d4-f1f2e72852b7', '2026-06-01', '09:00:00', '09:30:00', 2, 0, false),
	('68ba06b7-18bc-4fe5-b9ea-ec614910c251', '2026-06-01', '09:30:00', '10:00:00', 2, 0, false),
	('9b82cb1c-2745-4c53-9a58-83bf39a348df', '2026-06-01', '10:00:00', '10:30:00', 2, 0, false),
	('5ddb1cbf-a582-46d0-bfdb-85d784506a4e', '2026-06-01', '10:30:00', '11:00:00', 2, 0, false),
	('cd17193a-5b5c-4e6a-90a3-c8557b8c4a10', '2026-06-01', '11:00:00', '11:30:00', 2, 0, false),
	('5c4ee33f-fcab-4659-93a5-7a230661a8f8', '2026-06-01', '11:30:00', '12:00:00', 2, 0, false),
	('244ca320-2a6a-45d1-a89f-37a1ba4fb233', '2026-06-01', '12:00:00', '12:30:00', 2, 0, false),
	('3b4c067d-4cb5-4655-ad53-da3be64f0e59', '2026-06-01', '12:30:00', '13:00:00', 2, 0, false),
	('2d42ba79-1fb3-4ea1-9fff-b6e33e7b0cc2', '2026-06-01', '13:00:00', '13:30:00', 2, 0, false),
	('745bf557-383d-4182-b7b2-77ca70327b2d', '2026-06-27', '15:30:00', '16:00:00', 2, 1, false),
	('aae27b8b-9554-4446-95ee-9c6d0defc591', '2026-06-10', '08:00:00', '08:30:00', 2, 0, false),
	('65b1ef35-33df-4f66-a064-a42127d88ba8', '2026-06-10', '08:30:00', '09:00:00', 2, 0, false),
	('5099fd7d-8196-4589-a16d-53333d367e3e', '2026-06-10', '09:00:00', '09:30:00', 2, 0, false),
	('c4941770-c279-4ac6-9bde-78a12237660b', '2026-06-10', '09:30:00', '10:00:00', 2, 0, false),
	('14dc42fe-b970-42e7-aec4-372705f41e25', '2026-06-10', '10:30:00', '11:00:00', 2, 0, false),
	('4b5f663d-2cba-44db-92b6-fbfc171ee854', '2026-06-10', '11:00:00', '11:30:00', 2, 0, false),
	('f6c8d5cc-7fe7-4ebf-9022-80bb5f876b71', '2026-06-10', '11:30:00', '12:00:00', 2, 0, false),
	('709c7aa8-edff-48b8-971c-6c1e1f4e20df', '2026-06-10', '12:00:00', '12:30:00', 2, 0, false),
	('3c89a06a-9950-49ad-b754-15565c9b905c', '2026-06-10', '12:30:00', '13:00:00', 2, 0, false),
	('26ad3e12-6e99-4c19-8c64-ca8398f24a21', '2026-06-10', '13:00:00', '13:30:00', 2, 0, false),
	('fedf9d93-e780-4535-aa5c-58def590a733', '2026-06-10', '13:30:00', '14:00:00', 2, 0, false),
	('710531a5-d92c-4217-a303-f3f3cf68c940', '2026-06-10', '14:00:00', '14:30:00', 2, 0, false),
	('bf51a352-066e-4641-ab84-c759e200daa3', '2026-06-10', '14:30:00', '15:00:00', 2, 0, false),
	('782470a0-49a5-4d81-b7c7-b66e668e5dea', '2026-06-10', '15:00:00', '15:30:00', 2, 0, false),
	('907cfd15-b6f0-412a-82df-e76f5a5a70de', '2026-06-10', '15:30:00', '16:00:00', 2, 0, false),
	('33fce26c-270a-4f60-8a03-6273fa9cbcab', '2026-06-10', '16:00:00', '16:30:00', 2, 0, false),
	('a979c339-7036-4494-a3be-e3d66e6c1015', '2026-06-10', '16:30:00', '17:00:00', 2, 0, false),
	('4180056e-cf8d-4f07-af59-2d5af54e6523', '2026-06-10', '17:00:00', '17:30:00', 2, 0, false),
	('08aa5aee-9ecc-4d22-9e46-8c4443d6a87c', '2026-06-10', '17:30:00', '18:00:00', 2, 0, false),
	('b1777d2c-360c-408c-a657-83111f5b45ad', '2026-06-10', '18:00:00', '18:30:00', 2, 0, false),
	('846d2387-a859-4d5d-8663-48ed537817f0', '2026-06-10', '18:30:00', '19:00:00', 2, 0, false),
	('d975d600-f4ef-4149-a7b2-64b4638c19fa', '2026-06-10', '19:00:00', '19:30:00', 2, 0, false),
	('c1c8a91e-11db-48a0-afca-0a21a6092885', '2026-06-10', '19:30:00', '20:00:00', 2, 0, false),
	('613832b4-ed84-4006-8f57-30887089fca1', '2026-06-10', '20:00:00', '20:30:00', 2, 0, false),
	('225ed91b-14c7-465c-b108-5606a3b5f099', '2026-06-10', '20:30:00', '21:00:00', 2, 0, false),
	('8b4a3195-e0d1-4d1a-a7aa-bbb1aa2d1b78', '2026-06-10', '21:00:00', '21:30:00', 2, 0, false),
	('55531c11-f0f3-4749-a1c7-799c9d8c61fc', '2026-06-10', '21:30:00', '22:00:00', 2, 0, false),
	('e5be0128-2bdf-45aa-a1d1-902b8a10cd3a', '2026-06-10', '22:00:00', '22:30:00', 2, 0, false),
	('ee3cf832-52ae-4d7f-bf68-3763b3e67086', '2026-06-10', '22:30:00', '23:00:00', 2, 0, false),
	('97337f66-fba9-4ebd-ae32-b404e04c3a5d', '2026-06-18', '08:00:00', '08:30:00', 2, 0, false),
	('00be0e62-3e80-46fb-9c38-391dcb563cab', '2026-06-18', '08:30:00', '09:00:00', 2, 0, false),
	('fe6ce0c3-4199-4cd8-b769-cc7f2a0c73c4', '2026-06-18', '09:00:00', '09:30:00', 2, 0, false),
	('892b0265-ae06-49aa-8195-fab1617ba9f2', '2026-06-18', '09:30:00', '10:00:00', 2, 0, false),
	('a95acc01-213c-443a-ab07-3729e7c55e0f', '2026-06-18', '10:00:00', '10:30:00', 2, 0, false),
	('c8440aa1-b5b9-4f41-abef-a960ab58bbad', '2026-06-18', '10:30:00', '11:00:00', 2, 0, false),
	('fb3988fc-62ab-41e4-a739-8d673e4824eb', '2026-06-18', '11:00:00', '11:30:00', 2, 0, false),
	('b5c81453-07dc-4826-9db9-f84cfdb828b9', '2026-06-18', '11:30:00', '12:00:00', 2, 0, false),
	('5aac45c9-ca71-4ac1-bcb4-fa06eb8edd9c', '2026-06-18', '12:00:00', '12:30:00', 2, 0, false),
	('c7f4f2da-c1e0-499d-93be-77ff8ae28dd1', '2026-06-18', '12:30:00', '13:00:00', 2, 0, false),
	('d02b163a-cc1d-400b-ac0c-7bdab95452ac', '2026-06-18', '13:00:00', '13:30:00', 2, 0, false),
	('66b73885-2249-4e88-af50-d9b771235add', '2026-06-18', '13:30:00', '14:00:00', 2, 0, false),
	('e97e3de3-6c34-4a2f-83d4-b28c2af5e991', '2026-06-18', '14:00:00', '14:30:00', 2, 0, false),
	('095bafe6-b984-4d21-89e4-1b3dd5c110c5', '2026-06-18', '14:30:00', '15:00:00', 2, 0, false),
	('abf61bde-d645-482c-9960-cc42a127e999', '2026-06-18', '15:00:00', '15:30:00', 2, 0, false),
	('93a3a869-2dcf-4c60-9e58-51f3b3dde10a', '2026-06-18', '15:30:00', '16:00:00', 2, 0, false),
	('199edb73-2264-4900-b4b7-f083bd341c28', '2026-06-18', '16:00:00', '16:30:00', 2, 0, false),
	('e176854a-c583-4551-bb27-c8f9a0b82153', '2026-06-18', '16:30:00', '17:00:00', 2, 0, false),
	('7cd50aa1-fe95-42f2-9d42-6d21ff03b3a6', '2026-06-18', '17:00:00', '17:30:00', 2, 0, false),
	('3ad47fd7-be90-4756-beee-f7dbdfc3f9ac', '2026-06-18', '17:30:00', '18:00:00', 2, 0, false),
	('0653a904-82be-4117-93a6-fd13598bcf41', '2026-06-18', '18:00:00', '18:30:00', 2, 0, false),
	('d3add509-5057-4bad-9a0e-aeedaece6401', '2026-06-18', '18:30:00', '19:00:00', 2, 0, false),
	('6febc00a-84ac-47ea-b930-ee05c09953a2', '2026-06-18', '19:00:00', '19:30:00', 2, 0, false),
	('96f03390-7349-491c-9e79-2223fc5dc1a7', '2026-06-18', '19:30:00', '20:00:00', 2, 0, false),
	('86b2fe4d-9c3f-4b73-a716-bca8d185e68b', '2026-06-18', '20:00:00', '20:30:00', 2, 0, false),
	('9bd241ab-cb90-4b41-a1f9-bd85d91e1db6', '2026-06-18', '20:30:00', '21:00:00', 2, 0, false),
	('542d7cf6-34b5-4af7-933a-2b05bc59d673', '2026-06-18', '21:00:00', '21:30:00', 2, 0, false),
	('e414f2ba-fc48-4059-b015-7a8dd368527f', '2026-06-18', '21:30:00', '22:00:00', 2, 0, false),
	('b80a15ea-70cb-402e-80be-e54b09875e80', '2026-06-18', '22:00:00', '22:30:00', 2, 0, false),
	('d15e0cdd-8b5a-44ca-bb39-d93105da8058', '2026-06-18', '22:30:00', '23:00:00', 2, 0, false),
	('7af85120-493a-41bb-be57-fcf886cdb923', '2026-06-01', '14:30:00', '15:00:00', 2, 2, false),
	('9c5b34fa-d190-405a-af0e-f2a042e63464', '2026-06-10', '10:00:00', '10:30:00', 2, 2, false),
	('fee2963e-6218-4425-aed2-a94a869b4363', '2026-06-27', '13:00:00', '13:30:00', 2, 0, false),
	('d730a56d-425b-4a36-9a21-ca8e01467c45', '2026-06-27', '13:30:00', '14:00:00', 2, 0, false),
	('2e8823be-bba3-48ad-bea6-af9a62dd1ec1', '2026-06-27', '14:00:00', '14:30:00', 2, 0, false),
	('35b3596b-5a9f-461c-b828-0cfdd2766a7c', '2026-06-27', '14:30:00', '15:00:00', 2, 0, false),
	('b3f4fa64-d53c-4b4f-a24b-a283a73a5782', '2026-06-27', '15:00:00', '15:30:00', 2, 0, false),
	('c8c1a405-7f24-49b6-8532-058d4d9f1897', '2026-06-27', '16:00:00', '16:30:00', 2, 0, false),
	('3f456fe1-6238-48d2-888b-4e15bbf51588', '2026-06-27', '16:30:00', '17:00:00', 2, 0, false),
	('47c1ced8-a660-4001-9a85-6fe656c98aa1', '2026-06-27', '17:00:00', '17:30:00', 2, 0, false),
	('e55dbc05-8c1c-46aa-8d41-a4058102d0c0', '2026-06-27', '17:30:00', '18:00:00', 2, 0, false),
	('d6c832db-5c3f-4f79-8a62-e2b0d1df2b24', '2026-06-27', '18:00:00', '18:30:00', 2, 0, false),
	('977f47e1-164b-4552-8dfa-3616df8612c9', '2026-06-27', '18:30:00', '19:00:00', 2, 0, false),
	('b8a9e603-80ac-45fb-be94-f5ec43950003', '2026-06-27', '19:00:00', '19:30:00', 2, 0, false),
	('36c77658-3dab-456c-a0f6-10a0b0c02c08', '2026-06-27', '19:30:00', '20:00:00', 2, 0, false),
	('ee9f3406-826a-4a3c-bafc-e9b8c9dde022', '2026-06-27', '20:00:00', '20:30:00', 2, 0, false),
	('fd730fe5-ebd2-4bc8-9630-411a9bfa7ea5', '2026-06-27', '20:30:00', '21:00:00', 2, 0, false),
	('e5483630-7aae-428f-8c2e-6384f79b9c6a', '2026-06-27', '21:00:00', '21:30:00', 2, 0, false),
	('53f3d280-d50a-407a-9cb9-8e868c29a9ee', '2026-07-29', '10:00:00', '10:30:00', 2, 0, false),
	('645b6ba9-92a2-48dc-accf-7e4cdfe04394', '2026-07-29', '10:30:00', '11:00:00', 2, 0, false),
	('7ebe9f69-8097-496e-bd2a-dfc0a1575631', '2026-06-11', '08:00:00', '08:30:00', 2, 0, false),
	('515cbc3d-9451-4c5e-8a7e-44e48b3fa125', '2026-06-02', '16:30:00', '17:00:00', 2, 0, false),
	('81816344-1bca-4739-8cbe-567050bacd35', '2026-06-02', '17:00:00', '17:30:00', 2, 0, false),
	('9434853a-fb59-443b-b1c4-527efd8775a6', '2026-06-02', '17:30:00', '18:00:00', 2, 0, false),
	('6bd99ccc-2939-4411-b063-397c3f2acf08', '2026-06-11', '08:30:00', '09:00:00', 2, 0, false),
	('c7cab87c-1c62-4edf-ab58-b985903b5a0f', '2026-06-11', '09:00:00', '09:30:00', 2, 0, false),
	('944e3dda-fbeb-490c-8966-39260773c860', '2026-06-11', '09:30:00', '10:00:00', 2, 0, false),
	('6ad0379f-be2e-412f-b814-198addbd232a', '2026-06-02', '00:00:00', '00:30:00', 2, 0, false),
	('e0ab0db7-048e-4fef-a50f-75c0a7df6a31', '2026-06-02', '16:00:00', '16:30:00', 2, 1, false),
	('04c30171-fc2c-4cf0-914d-e3ffd16a29f9', '2026-06-11', '10:00:00', '10:30:00', 2, 0, false),
	('d147c3d6-e00e-4d56-adc6-08cf8ca764cb', '2026-06-11', '10:30:00', '11:00:00', 2, 0, false),
	('54e81cbd-2380-4c0a-81fe-d6de756e3b21', '2026-06-11', '11:00:00', '11:30:00', 2, 0, false),
	('8c716475-0d3e-42c7-9374-55bc88157e9c', '2026-06-11', '11:30:00', '12:00:00', 2, 0, false),
	('7ecfbe38-d1ed-4ea6-b2cd-66af5c1960b2', '2026-06-11', '12:30:00', '13:00:00', 2, 0, false),
	('b5e069a3-20ab-4dca-8853-cc6ab4ffaa2e', '2026-06-11', '13:30:00', '14:00:00', 2, 0, false),
	('4295d8ce-6041-4305-bf63-c1224b0cf150', '2026-06-11', '14:00:00', '14:30:00', 2, 0, false),
	('9d8087d5-2233-414a-82e0-dbcc549f6002', '2026-06-11', '14:30:00', '15:00:00', 2, 0, false),
	('f1db07bb-eff7-48f2-a4b6-6ffed2e344d7', '2026-06-11', '15:00:00', '15:30:00', 2, 0, false),
	('a49e1e45-b49e-4a1d-b12f-e0fc2f32e51f', '2026-06-11', '15:30:00', '16:00:00', 2, 0, false),
	('e41c9fe0-2e50-44b2-aaab-05d6034b4b2a', '2026-06-11', '16:00:00', '16:30:00', 2, 0, false),
	('483b0207-8e97-4ced-9159-7ad0b6d5c7e8', '2026-06-11', '16:30:00', '17:00:00', 2, 0, false),
	('54096061-04f7-4c88-98f0-1e67d488f037', '2026-06-11', '17:00:00', '17:30:00', 2, 0, false),
	('dc51628e-096e-453e-a6d1-d651ef75a40d', '2026-06-11', '17:30:00', '18:00:00', 2, 0, false),
	('0140a131-0c35-4e16-9fab-67f214a33f43', '2026-06-11', '18:00:00', '18:30:00', 2, 0, false),
	('4e6b64a1-0525-46a1-ab51-e3b2a1f51f77', '2026-06-11', '18:30:00', '19:00:00', 2, 0, false),
	('fc0c7360-99be-440d-acd2-55333f0310d1', '2026-06-11', '19:00:00', '19:30:00', 2, 0, false),
	('f6578b28-4ae1-4acf-8c1b-9a5ab41110c4', '2026-06-11', '19:30:00', '20:00:00', 2, 0, false),
	('f1a85550-f478-4000-a2ff-4d4dd4ae3dee', '2026-06-11', '20:00:00', '20:30:00', 2, 0, false),
	('01105a2a-7e5d-452d-acee-db17edc88624', '2026-06-11', '20:30:00', '21:00:00', 2, 0, false),
	('c0b0efca-e6d0-4df7-849d-886f29881ad7', '2026-06-11', '21:00:00', '21:30:00', 2, 0, false),
	('0ed310b3-186f-4a31-8bf6-caaecaa0a1dd', '2026-06-11', '21:30:00', '22:00:00', 2, 0, false),
	('329e4482-3f9f-4834-aa04-974f83689540', '2026-06-11', '22:00:00', '22:30:00', 2, 0, false),
	('da33a341-fa92-4a5d-8b19-37cb2c620a61', '2026-06-11', '22:30:00', '23:00:00', 2, 0, false),
	('2eb66edc-dea7-43ef-90bd-39d7a29f0052', '2026-06-19', '08:00:00', '08:30:00', 2, 0, false),
	('8d049340-23a9-466d-9c73-a865b49f819a', '2026-06-19', '08:30:00', '09:00:00', 2, 0, false),
	('48e88604-6c3d-453c-8f33-0bfcc271edde', '2026-06-19', '09:00:00', '09:30:00', 2, 0, false),
	('357a7f39-7dfb-455d-b30f-feff33e5a01e', '2026-06-19', '10:00:00', '10:30:00', 2, 0, false),
	('388784d5-a107-4235-935e-e4d0b9ace37b', '2026-06-19', '10:30:00', '11:00:00', 2, 0, false),
	('8b653d78-558a-4112-96e7-f6517d0ccf49', '2026-06-19', '11:00:00', '11:30:00', 2, 0, false),
	('d7447f24-c842-45f7-8ba8-0b778d26932d', '2026-06-19', '11:30:00', '12:00:00', 2, 0, false),
	('1feb963a-c4fc-4e4c-8313-6c91de6dfda9', '2026-06-19', '12:00:00', '12:30:00', 2, 0, false),
	('35f2c374-e901-4ecd-aacf-43d13a307645', '2026-06-19', '12:30:00', '13:00:00', 2, 0, false),
	('d3097acb-3eb8-4ff5-a81f-9720540c8450', '2026-06-19', '13:00:00', '13:30:00', 2, 0, false),
	('91d29fed-ae28-45dd-95cb-08a92280b137', '2026-06-19', '13:30:00', '14:00:00', 2, 0, false),
	('7016d9c5-fcc4-4059-b818-411cb1b73cd0', '2026-06-19', '14:00:00', '14:30:00', 2, 0, false),
	('03a41b94-78ae-448a-9057-9c98176c3e59', '2026-06-19', '14:30:00', '15:00:00', 2, 0, false),
	('14f8ca67-1fe8-4143-b926-c148cefb5e88', '2026-06-19', '15:00:00', '15:30:00', 2, 0, false),
	('a2a0cc20-d8d6-4c58-8130-71cfbd17bdeb', '2026-06-19', '15:30:00', '16:00:00', 2, 0, false),
	('5f639fad-1bdd-41a7-8b97-1573fbaf1c65', '2026-06-19', '16:00:00', '16:30:00', 2, 0, false),
	('f1682517-efd0-42de-ba2f-7bc33a1c29aa', '2026-06-19', '16:30:00', '17:00:00', 2, 0, false),
	('90ff7b9e-cb7f-4557-9aa0-509af6a2d313', '2026-06-19', '17:00:00', '17:30:00', 2, 0, false),
	('d895f51b-d478-434d-8602-ec20a10a6dd4', '2026-06-19', '17:30:00', '18:00:00', 2, 0, false),
	('c72326e7-a40f-43d9-ae97-92715c26dae1', '2026-06-19', '18:00:00', '18:30:00', 2, 0, false),
	('7b7ab97b-2aac-4c50-8255-bc8535976224', '2026-06-19', '18:30:00', '19:00:00', 2, 0, false),
	('8cc80ebf-d444-4c73-b225-b56d9cf4b7cc', '2026-06-19', '19:00:00', '19:30:00', 2, 0, false),
	('8b81fb84-2feb-49d6-b904-7932688d0b54', '2026-06-19', '19:30:00', '20:00:00', 2, 0, false),
	('0967356c-f5c8-46a8-b594-3ad1c27c97d9', '2026-06-19', '20:00:00', '20:30:00', 2, 0, false),
	('af03ae57-cd6b-4ca3-a72d-e2a1df51c53b', '2026-06-19', '20:30:00', '21:00:00', 2, 0, false),
	('4a8b48c4-ef14-4ae2-9d4b-30ff50b81b4a', '2026-06-19', '21:00:00', '21:30:00', 2, 0, false),
	('d1f47399-ec5f-49cf-bd3b-54ede4a31b00', '2026-06-19', '21:30:00', '22:00:00', 2, 0, false),
	('b86df298-7878-44a8-aa8b-8b3da1b9112b', '2026-06-19', '22:00:00', '22:30:00', 2, 0, false),
	('10602ed9-068a-43a7-95e5-9216c0b32ebe', '2026-06-19', '22:30:00', '23:00:00', 2, 0, false),
	('5a24643d-7a74-498a-a87c-27c4031c64dd', '2026-06-11', '12:00:00', '12:30:00', 2, 1, false),
	('8b7f3d30-aaed-4290-af28-b641a789fc52', '2026-06-11', '13:00:00', '13:30:00', 2, 1, false),
	('8c9fd21e-595e-48db-9a10-fce472d34a89', '2026-06-27', '21:30:00', '22:00:00', 2, 0, false),
	('e2eee430-48db-4dd0-b869-93e134c82a8d', '2026-06-27', '22:00:00', '22:30:00', 2, 0, false),
	('b0268832-7441-4cbb-93cc-a9ef9265739c', '2026-06-27', '22:30:00', '23:00:00', 2, 0, false),
	('f2857fd7-b461-4350-9ba7-0609ff2cb9f6', '2026-06-19', '09:30:00', '10:00:00', 2, 1, false),
	('f6e3c441-4aca-4a96-9a67-0ce1752afc5d', '2026-07-06', '08:00:00', '08:30:00', 2, 0, false),
	('3b19f6b0-a2cb-404c-b07b-509bf825508b', '2026-07-06', '08:30:00', '09:00:00', 2, 0, false),
	('bf0e9953-2196-4345-a55a-4bf5f4c3c174', '2026-07-06', '09:00:00', '09:30:00', 2, 0, false),
	('60b8866e-05fa-4711-b74e-dfcef4a9eb24', '2026-07-06', '09:30:00', '10:00:00', 2, 0, false),
	('cee3d86c-e5c0-4e5b-b0b6-b878f3bdbac0', '2026-07-06', '10:00:00', '10:30:00', 2, 0, false),
	('881c0a61-120e-4544-be00-e3343b503e0b', '2026-07-06', '10:30:00', '11:00:00', 2, 0, false),
	('028c5f28-f0d8-4737-86d0-00ba06145ae2', '2026-07-06', '11:00:00', '11:30:00', 2, 0, false),
	('2d1472e8-549a-4812-8597-76c9f1fc85a2', '2026-07-06', '11:30:00', '12:00:00', 2, 0, false),
	('a7837084-f516-468d-8563-000e1510b53f', '2026-07-06', '12:00:00', '12:30:00', 2, 0, false),
	('df861f05-96ef-4fa1-b9e6-3dad4435aca7', '2026-07-06', '12:30:00', '13:00:00', 2, 0, false),
	('091c81c3-30d6-43b4-bf3e-deb8e24e603e', '2026-07-06', '13:00:00', '13:30:00', 2, 0, false),
	('db35b7b6-27c3-4652-8e19-bd666573f1cc', '2026-07-06', '13:30:00', '14:00:00', 2, 0, false),
	('3b878326-c0b6-410a-9ab3-6930952bd693', '2026-07-06', '14:00:00', '14:30:00', 2, 0, false),
	('2ac2abcf-7711-41c0-9e3a-42d949a48660', '2026-07-06', '14:30:00', '15:00:00', 2, 0, false),
	('b6449066-9b48-4872-a0bf-468a29cadd50', '2026-07-06', '15:00:00', '15:30:00', 2, 0, false),
	('44eaadd0-8e2a-4aca-a701-82a332a84c64', '2026-07-06', '15:30:00', '16:00:00', 2, 0, false),
	('7920cd49-7823-4e7f-945c-0d3247c72688', '2026-07-06', '16:00:00', '16:30:00', 2, 0, false),
	('e95750ee-b95f-492d-96e7-5cc945506fa0', '2026-07-06', '16:30:00', '17:00:00', 2, 0, false),
	('068f4b97-f70b-41ef-b3a6-771831f99bfc', '2026-07-06', '17:00:00', '17:30:00', 2, 0, false),
	('6257ae43-7303-4624-9d4e-7e5028e30875', '2026-07-06', '17:30:00', '18:00:00', 2, 0, false),
	('aafecb63-38a2-42b5-875f-998bffe3c054', '2026-07-06', '18:00:00', '18:30:00', 2, 0, false),
	('712504e0-a0dc-41c0-bd7c-3506a758d86e', '2026-07-06', '18:30:00', '19:00:00', 2, 0, false),
	('02bb4ad3-4c34-4540-89a3-95e3e5ff7671', '2026-07-06', '19:00:00', '19:30:00', 2, 0, false),
	('237e1bcf-2a47-40d0-9f82-1d4e4cdb04eb', '2026-07-06', '19:30:00', '20:00:00', 2, 0, false),
	('b356c9e3-b4a6-41e0-bade-c71dcea25ee1', '2026-07-06', '20:00:00', '20:30:00', 2, 0, false),
	('b1680ea2-b00a-4e24-8713-754a2e31460e', '2026-07-06', '20:30:00', '21:00:00', 2, 0, false),
	('0a7620a8-890d-4e88-90f2-035c74ef6c3a', '2026-07-29', '11:00:00', '11:30:00', 2, 0, false),
	('a331972f-0bb1-474a-a7da-162db8c9d254', '2026-07-29', '11:30:00', '12:00:00', 2, 0, false),
	('a3ea683d-522d-4dbc-a8ec-7eff87567469', '2026-06-02', '14:00:00', '14:30:00', 2, 1, false),
	('56005099-6271-4b73-a138-c33fdd0a6356', '2026-06-12', '08:00:00', '08:30:00', 2, 0, false),
	('d999e7e9-5a94-49c4-81f6-d2659e193e16', '2026-05-10', '16:00:00', '16:30:00', 2, 0, false),
	('cb9cef7d-fae9-42e4-a99f-85e02c578b05', '2026-05-27', '20:00:00', '20:30:00', 2, 0, false),
	('d377d17f-d97a-4d4c-8876-95905514337f', '2026-05-27', '20:30:00', '21:00:00', 2, 0, false),
	('c9f8d0b7-4f6f-49da-9da6-24787bf7d445', '2026-05-27', '21:00:00', '21:30:00', 2, 0, false),
	('9080c15d-0c17-4f1a-87ea-45bf74f7337e', '2026-05-27', '21:30:00', '22:00:00', 2, 0, false),
	('731c0a9f-3982-4edc-b92a-9107ff4f675d', '2026-05-27', '22:00:00', '22:30:00', 2, 0, false),
	('320edc20-fab2-4eac-922a-5ad436b441a0', '2026-05-27', '22:30:00', '23:00:00', 2, 0, false),
	('ddddce4d-7d1a-4e26-9ed3-7d94d14cc0a6', '2026-05-27', '23:00:00', '23:30:00', 2, 0, false),
	('cb8918f6-08b0-4591-b93d-be7f84b8e92c', '2026-05-28', '00:00:00', '00:30:00', 2, 0, false),
	('a64fbf38-dde6-45b7-bea3-a6526d861231', '2026-05-28', '01:00:00', '01:30:00', 2, 0, false),
	('2c9542d9-b018-4f7c-8d2b-3b3627712a1b', '2026-05-28', '01:30:00', '02:00:00', 2, 0, false),
	('763ef6ec-3ba6-4dc3-87b9-13995a2b9e01', '2026-05-28', '02:00:00', '02:30:00', 2, 0, false),
	('5c03ff4d-b7b8-4ebe-990e-b144e12065b0', '2026-05-28', '02:30:00', '03:00:00', 2, 0, false),
	('6d4597c1-8134-4467-a562-421626fb65bf', '2026-05-28', '03:00:00', '03:30:00', 2, 0, false),
	('2c9a01c0-ec97-46e6-8970-11c59bcc6699', '2026-05-14', '12:30:00', '13:00:00', 2, 0, false),
	('a449d897-f982-422f-96f1-07be197eb2f4', '2026-05-09', '11:30:00', '12:00:00', 2, 0, false),
	('59fd01d5-48cc-44a6-8664-ca16af7f99ff', '2026-05-09', '13:30:00', '14:00:00', 2, 0, false),
	('0fae4546-8756-4621-9e05-85e394c22810', '2026-05-28', '11:00:00', '11:30:00', 2, 0, false),
	('1cda1c57-3548-496a-bcc8-ed650540bb2b', '2026-05-28', '11:30:00', '12:00:00', 2, 0, false),
	('67012078-e6d0-464f-9929-2e095b714baf', '2026-05-28', '12:00:00', '12:30:00', 2, 0, false),
	('de8d1eac-9ade-4677-9eb0-f9ae7a785139', '2026-05-28', '12:30:00', '13:00:00', 2, 0, false),
	('304e0fa6-d926-4c31-aa04-ba133c071174', '2026-05-28', '13:00:00', '13:30:00', 2, 0, false),
	('38decf4e-0ff1-4d84-a339-1ada727cb24d', '2026-06-06', '00:30:00', '01:00:00', 2, 0, false),
	('0884a962-3529-4678-9e74-b2490c64f8d7', '2026-06-06', '01:00:00', '01:30:00', 2, 0, false),
	('fdcc2010-4135-4e35-ac69-d588e7e99924', '2026-06-06', '01:30:00', '02:00:00', 2, 0, false),
	('6a5c5e82-0ce5-48e0-bf65-a5747695f59c', '2026-05-22', '10:00:00', '10:30:00', 2, 0, false),
	('1fc97cd8-329c-42fb-b855-8ead5d34f1c1', '2026-05-19', '18:30:00', '19:00:00', 2, 0, false),
	('feabae1e-4415-44c2-9818-730e841d7f5a', '2026-05-28', '13:30:00', '14:00:00', 2, 0, false),
	('be9b05d3-dccf-4862-b70a-fb93e5b56c15', '2026-05-28', '14:00:00', '14:30:00', 2, 0, false),
	('e9f78745-2f09-46e3-886c-191a0d098d25', '2026-05-28', '14:30:00', '15:00:00', 2, 0, false),
	('4e7922f5-fa7f-4289-a432-4708b42a2d9d', '2026-05-28', '15:00:00', '15:30:00', 2, 0, false),
	('84e6842b-7ca1-4ce8-8223-afa87cd1d828', '2026-05-28', '15:30:00', '16:00:00', 2, 0, false),
	('b8ce3d3e-722f-4873-bb09-6f09c5543db9', '2026-05-28', '16:00:00', '16:30:00', 2, 0, false),
	('60484a43-dcb9-48f5-bfa9-05c0b93eafd5', '2026-05-07', '14:30:00', '15:00:00', 2, 0, false),
	('0b1d69c0-498d-4e81-b791-4e7c349e19ed', '2026-06-12', '08:30:00', '09:00:00', 2, 0, false),
	('532119ac-4cae-4720-8ea4-44e8831f35bc', '2026-06-12', '09:00:00', '09:30:00', 2, 0, false),
	('71306d0a-ea16-4ba5-8783-af2b87b29954', '2026-06-12', '09:30:00', '10:00:00', 2, 0, false),
	('1ee9e3f9-ea31-4b6b-88d1-1f6bd507d852', '2026-06-12', '10:00:00', '10:30:00', 2, 0, false),
	('c66cec7d-835e-46df-98d3-554c52b4c125', '2026-06-12', '10:30:00', '11:00:00', 2, 0, false),
	('e390903b-3715-4610-b379-aacbfc39af90', '2026-06-12', '11:00:00', '11:30:00', 2, 0, false),
	('534a47b9-c790-4dbe-a639-8146be190e97', '2026-06-12', '12:00:00', '12:30:00', 2, 0, false),
	('7cb6e92b-96fa-4921-a142-02d81e8b7fbe', '2026-06-12', '12:30:00', '13:00:00', 2, 0, false),
	('97d8510d-9e38-4afe-bac6-756ecc453b4b', '2026-06-12', '13:00:00', '13:30:00', 2, 0, false),
	('56660c66-fa1e-4945-aefb-aeeaf34423e3', '2026-06-12', '13:30:00', '14:00:00', 2, 0, false),
	('90e90add-6679-4a05-8bf3-6ded3a5afa97', '2026-06-12', '14:00:00', '14:30:00', 2, 0, false),
	('f4ba8bcb-2c16-4778-85a9-f51a1b5860b5', '2026-06-12', '14:30:00', '15:00:00', 2, 0, false),
	('3efd1615-d833-4af4-bad6-ddf864d9e0df', '2026-06-12', '15:00:00', '15:30:00', 2, 0, false),
	('059ffe96-c933-4a77-a825-0293f30dea9b', '2026-06-12', '15:30:00', '16:00:00', 2, 0, false),
	('27c0c97d-26b3-4abc-832e-1776f6604749', '2026-06-12', '16:00:00', '16:30:00', 2, 0, false),
	('723b4307-d3b7-4ed5-bbc0-5b49b416a947', '2026-06-12', '16:30:00', '17:00:00', 2, 0, false),
	('428f8f48-cd7b-4139-9a9b-2667b142a76f', '2026-06-12', '17:00:00', '17:30:00', 2, 0, false),
	('e7b45223-b984-4406-b1c5-11c2aa495d31', '2026-06-12', '17:30:00', '18:00:00', 2, 0, false),
	('99b58c94-efe3-4120-98d3-db04a673186d', '2026-06-12', '18:00:00', '18:30:00', 2, 0, false),
	('bfbfe3eb-6dda-4eb4-9bdc-c59027e4d911', '2026-06-12', '18:30:00', '19:00:00', 2, 0, false),
	('5723d805-dc69-40b2-abe3-9fedc05c87d8', '2026-06-12', '19:00:00', '19:30:00', 2, 0, false),
	('4a1b20aa-3481-4f59-90fa-292ccf102564', '2026-06-12', '19:30:00', '20:00:00', 2, 0, false),
	('7e123d8f-9cba-480d-a54d-0f1e2b00ab12', '2026-06-12', '20:00:00', '20:30:00', 2, 0, false),
	('8038a957-7fc4-4b75-a2e5-c9298219e142', '2026-06-12', '20:30:00', '21:00:00', 2, 0, false),
	('a47631b3-ef99-42e3-a57a-5872fe2ddf68', '2026-06-12', '21:00:00', '21:30:00', 2, 0, false),
	('5357fb02-691b-41e8-8ab5-fc7e526cabdb', '2026-06-12', '21:30:00', '22:00:00', 2, 0, false),
	('0b75a89e-7293-45f8-8893-d9f7f09dbfa4', '2026-06-12', '22:00:00', '22:30:00', 2, 0, false),
	('a2119e35-960b-4ac5-9ff1-06833fbc592d', '2026-06-12', '22:30:00', '23:00:00', 2, 0, false),
	('235c3e74-467d-4117-9ce3-85a14e10bf21', '2026-06-20', '08:00:00', '08:30:00', 2, 0, false),
	('60b25ac2-e4a4-47d7-854d-bdaf99775a45', '2026-06-20', '08:30:00', '09:00:00', 2, 0, false),
	('33a83f5a-6571-49ef-b982-8579619e594a', '2026-06-20', '09:00:00', '09:30:00', 2, 0, false),
	('f716e919-259b-4297-9a31-7317588ff515', '2026-06-20', '09:30:00', '10:00:00', 2, 0, false),
	('361a5eb3-49b8-442e-8c0b-ccb4344a0176', '2026-06-20', '10:00:00', '10:30:00', 2, 0, false),
	('37195dfc-1496-4bde-92de-fcd9fa9390c7', '2026-06-20', '10:30:00', '11:00:00', 2, 0, false),
	('7865ae3a-e86f-4f8f-bf9b-1adba8079a8e', '2026-06-20', '11:00:00', '11:30:00', 2, 0, false),
	('ead34410-64be-432f-a731-90576ef25c4d', '2026-06-20', '11:30:00', '12:00:00', 2, 0, false),
	('f2d2928f-513c-439c-90a9-871c3ed581f8', '2026-06-20', '12:00:00', '12:30:00', 2, 0, false),
	('caa38e36-78be-4c73-9e33-2e6798292f3f', '2026-06-20', '12:30:00', '13:00:00', 2, 0, false),
	('7af474eb-aa49-46b3-b7a2-d79879ff2580', '2026-06-20', '13:00:00', '13:30:00', 2, 0, false),
	('dea18e7c-0366-4ecf-ad0a-0f968b1ab2c5', '2026-06-20', '13:30:00', '14:00:00', 2, 0, false),
	('eaf95a5d-6a97-4340-b925-f76c1fbacbba', '2026-06-20', '14:00:00', '14:30:00', 2, 0, false),
	('803e67c3-51f3-4062-af32-fa28f87597fa', '2026-06-20', '14:30:00', '15:00:00', 2, 0, false),
	('3d214cdc-f6a7-4d19-b0e4-7b3776ca800c', '2026-06-20', '15:00:00', '15:30:00', 2, 0, false),
	('83fdd54e-b9a6-45fd-a8b6-45d0c32c3b6e', '2026-06-20', '15:30:00', '16:00:00', 2, 0, false),
	('28a58911-9ee3-4c96-9cfe-111409dae6da', '2026-06-20', '16:00:00', '16:30:00', 2, 0, false),
	('039d12e4-41a7-4b51-bebc-f33488b9154a', '2026-06-20', '16:30:00', '17:00:00', 2, 0, false),
	('55bac88d-15c9-4e48-8616-924f70c4e80e', '2026-06-20', '17:00:00', '17:30:00', 2, 0, false),
	('b4eb573a-07d7-4c5c-8d35-15b042954875', '2026-06-20', '17:30:00', '18:00:00', 2, 0, false),
	('2f276f21-ce56-46a8-80b4-e83d51977a92', '2026-06-20', '18:00:00', '18:30:00', 2, 0, false),
	('c20c7763-3b70-4dac-bfbf-9b4f6c75ecdc', '2026-06-20', '18:30:00', '19:00:00', 2, 0, false),
	('ce8f9d62-99f7-408c-9f16-4b1aa14a3340', '2026-06-20', '19:00:00', '19:30:00', 2, 0, false),
	('85e87a50-9bc9-43ec-896c-241e855e186d', '2026-06-20', '19:30:00', '20:00:00', 2, 0, false),
	('79193012-0564-4dd7-bba0-c76da523537c', '2026-06-20', '20:00:00', '20:30:00', 2, 0, false),
	('a91478ee-87e8-49e9-bfc8-580819cd098c', '2026-06-20', '20:30:00', '21:00:00', 2, 0, false),
	('4b29b7a5-003d-4fa0-9e50-85d3d867ce86', '2026-06-20', '21:00:00', '21:30:00', 2, 0, false),
	('9a12500e-9405-40bd-a172-7a8448a31f78', '2026-06-20', '21:30:00', '22:00:00', 2, 0, false),
	('9e21c2c0-bc6f-4515-aaf4-bc2a76052773', '2026-06-20', '22:00:00', '22:30:00', 2, 0, false),
	('825c9cfa-74f8-4419-95d7-c9d374c09eea', '2026-06-20', '22:30:00', '23:00:00', 2, 0, false),
	('cb881499-f258-4b9c-9e51-9dd6df9bab85', '2026-06-13', '21:30:00', '22:00:00', 2, 1, false),
	('e752efd2-5d06-4644-a8de-4b41b646a38e', '2026-06-02', '02:00:00', '02:30:00', 2, 0, false),
	('a06bcb6a-98c3-401a-bdc5-ead55a7a2cc5', '2026-06-02', '02:30:00', '03:00:00', 2, 0, false),
	('2f970fd2-7ba3-449b-91ce-7d36bfcfee8c', '2026-06-02', '03:00:00', '03:30:00', 2, 0, false),
	('686afd9c-98c5-4f4c-a35a-66fccd8e081a', '2026-06-02', '03:30:00', '04:00:00', 2, 0, false),
	('550fd960-0ef0-4552-8c4f-50fa30a7bab4', '2026-06-02', '08:00:00', '08:30:00', 2, 0, false),
	('db499fed-a5d0-49c1-ac94-2ef472dc1757', '2026-06-02', '08:30:00', '09:00:00', 2, 0, false),
	('6a8eec8b-4839-44b0-b722-f8e82e6e5b9a', '2026-06-02', '09:00:00', '09:30:00', 2, 0, false),
	('a1e283fa-5440-4cd8-8365-8397792d62b2', '2026-06-02', '09:30:00', '10:00:00', 2, 0, false),
	('0a48a14b-5ade-4156-b0c9-3656444cf563', '2026-06-02', '10:00:00', '10:30:00', 2, 0, false),
	('f25d83d2-903c-411d-8bee-7d7a8328c937', '2026-06-02', '10:30:00', '11:00:00', 2, 0, false),
	('49614229-05dc-405f-a75e-a021b4e58a35', '2026-05-18', '23:00:00', '23:30:00', 2, 0, false),
	('6d2e2ae0-ad14-441f-8984-391978beada4', '2026-05-19', '03:00:00', '03:30:00', 2, 0, false),
	('d3baabff-db45-44cd-912f-0666b22bd09a', '2026-05-19', '03:30:00', '04:00:00', 2, 0, false),
	('2aa89d5d-8151-4b49-b6f6-3d9231472c7e', '2026-05-19', '08:00:00', '08:30:00', 2, 0, false),
	('71402eeb-e3e6-4657-8fec-1b0a821cf4a0', '2026-05-19', '09:30:00', '10:00:00', 2, 0, false),
	('190bc96e-dd24-450c-a168-163cd0dc556a', '2026-05-19', '10:00:00', '10:30:00', 2, 0, false),
	('a435654a-3e6d-4903-ab41-5fb6cf3d5181', '2026-05-19', '10:30:00', '11:00:00', 2, 0, false),
	('30e660bf-56db-412f-a0de-dd4ad363364a', '2026-05-19', '11:00:00', '11:30:00', 2, 0, false),
	('3fc7dd59-95c0-4bc8-89a8-1331005a4fe5', '2026-05-19', '11:30:00', '12:00:00', 2, 0, false),
	('ef5d7a6c-5791-4c08-a75f-84e40a7272cb', '2026-05-19', '12:30:00', '13:00:00', 2, 0, false),
	('13266807-d73c-47e5-9fa4-cd38b95314c3', '2026-05-19', '13:00:00', '13:30:00', 2, 0, false),
	('e0f9b040-b5df-4d22-80b5-6d03ce6bfe4b', '2026-05-19', '14:30:00', '15:00:00', 2, 0, false),
	('a014fbc4-8f9d-4705-b3c4-305c3bca2e3e', '2026-05-19', '15:00:00', '15:30:00', 2, 0, false),
	('c52c927b-03f3-44d9-bd91-b1c78c6c1c71', '2026-05-19', '08:30:00', '09:00:00', 2, 0, false),
	('bf472090-55a0-43e5-846c-f5354e93644b', '2026-05-19', '09:00:00', '09:30:00', 2, 0, false),
	('065d6b55-e110-4d0a-87ae-b595c9d48766', '2026-05-19', '12:00:00', '12:30:00', 2, 0, false),
	('4b7c06da-211c-49c1-a123-85bf25452716', '2026-05-19', '14:00:00', '14:30:00', 2, 0, false),
	('1b3bcbd3-f01a-4d5a-a12f-44bb6b31ce9f', '2026-06-03', '00:00:00', '00:30:00', 2, 0, false),
	('21b1568d-0300-442d-833c-8a7162a38ffc', '2026-06-03', '00:30:00', '01:00:00', 2, 0, false),
	('be8f0976-a6fd-404d-bf9d-9fcfc757b8bd', '2026-06-03', '01:00:00', '01:30:00', 2, 0, false),
	('1196c6dd-6481-46a3-b6c9-6381e61ab50d', '2026-06-03', '01:30:00', '02:00:00', 2, 0, false),
	('54d61f01-7e4d-4781-a6ec-849ebb5d035b', '2026-06-03', '02:00:00', '02:30:00', 2, 0, false),
	('a404a8ae-7498-4693-98ff-eeec7852fc4b', '2026-06-03', '02:30:00', '03:00:00', 2, 0, false),
	('afcd682e-6155-46c5-92af-2fb080107e0e', '2026-06-03', '03:00:00', '03:30:00', 2, 0, false),
	('ae307d8a-f3dd-404a-9054-7c6540be78ea', '2026-06-03', '03:30:00', '04:00:00', 2, 0, false),
	('fbe3c009-2869-4e22-9575-64740b43a0be', '2026-06-03', '08:00:00', '08:30:00', 2, 0, false),
	('6bb3c33c-9eb8-4c5a-a584-8bb48c011641', '2026-06-03', '08:30:00', '09:00:00', 2, 0, false),
	('eab6df82-0398-4790-a2cc-42e4ee39972e', '2026-06-13', '08:00:00', '08:30:00', 2, 0, false),
	('e3a4eae1-e48d-4c0e-a836-37220e2a985d', '2026-06-13', '08:30:00', '09:00:00', 2, 0, false),
	('97b1d0c5-ab87-4875-b596-b01a955adc37', '2026-06-13', '09:00:00', '09:30:00', 2, 0, false),
	('7555f9cd-9caa-4bcf-a2d4-cefebef64999', '2026-06-13', '09:30:00', '10:00:00', 2, 0, false),
	('0cf781f6-d362-473d-93c0-f445b310f02e', '2026-06-13', '10:00:00', '10:30:00', 2, 0, false),
	('3540a46d-6586-4546-9302-4ec23f3b65a4', '2026-06-13', '10:30:00', '11:00:00', 2, 0, false),
	('a6e62fa5-fe02-43e8-aeff-049dd644c36a', '2026-06-13', '11:00:00', '11:30:00', 2, 0, false),
	('5ae6f38e-210e-412c-8629-d1d0244e3029', '2026-06-13', '11:30:00', '12:00:00', 2, 0, false),
	('2d789a9f-dcf6-4cf7-8c91-0f70683c6cdd', '2026-06-13', '12:00:00', '12:30:00', 2, 0, false),
	('a729edb3-76d7-4365-b179-47c9fbcf1121', '2026-06-13', '12:30:00', '13:00:00', 2, 0, false),
	('3563ab80-55d6-4116-a502-1c172b68f41e', '2026-06-13', '13:00:00', '13:30:00', 2, 0, false),
	('ad1038e1-f770-4551-9a88-4dc297ae0514', '2026-06-13', '13:30:00', '14:00:00', 2, 0, false),
	('327b8674-c6f8-4487-a99a-1312a7170189', '2026-06-13', '14:00:00', '14:30:00', 2, 0, false),
	('d8ed8fa1-128f-452f-912e-3210b9ca3f2f', '2026-06-13', '14:30:00', '15:00:00', 2, 0, false),
	('576b1028-a0ec-4d5a-bba9-68d3b1caa379', '2026-06-13', '15:00:00', '15:30:00', 2, 0, false),
	('6002a2b6-41a3-4277-be12-f3f872f379ea', '2026-06-13', '15:30:00', '16:00:00', 2, 0, false),
	('b37f3c1c-0770-42cc-86de-4caec16d2fc0', '2026-06-13', '16:00:00', '16:30:00', 2, 0, false),
	('1a6bb61b-93e9-43c3-bc22-4df0c326ca82', '2026-06-13', '16:30:00', '17:00:00', 2, 0, false),
	('86e34020-dc92-4de9-b9fa-5a0046bfe40d', '2026-06-13', '17:00:00', '17:30:00', 2, 0, false),
	('066db7d9-b541-402e-8d5f-60fbc1577a76', '2026-06-13', '17:30:00', '18:00:00', 2, 0, false),
	('fc0276bf-c5f6-4070-b3b6-da4ee70d557a', '2026-06-13', '18:00:00', '18:30:00', 2, 0, false),
	('e003e73e-f737-47dc-9174-1d141f484763', '2026-06-13', '18:30:00', '19:00:00', 2, 0, false),
	('dd02149a-bab3-442b-b206-5f86841596d5', '2026-06-13', '19:00:00', '19:30:00', 2, 0, false),
	('b9fff9b5-a951-400f-a4b9-8b9d82a0237c', '2026-06-13', '19:30:00', '20:00:00', 2, 0, false),
	('43e541a0-6737-4b11-83fe-9232f73d161f', '2026-06-13', '20:00:00', '20:30:00', 2, 0, false),
	('84e0e2f2-1851-4c19-8bfe-ea6b386e4bba', '2026-06-13', '20:30:00', '21:00:00', 2, 0, false),
	('54f7c33c-2bac-4d38-b91e-32c34c8559d9', '2026-06-13', '21:00:00', '21:30:00', 2, 0, false),
	('e0ba3f09-ac28-477a-91f3-00f8c2d4fd7d', '2026-07-29', '12:00:00', '12:30:00', 2, 0, false),
	('93fbc3ed-86b3-415a-a845-5c726a92d905', '2026-06-13', '22:00:00', '22:30:00', 2, 0, false),
	('d75a550f-b92e-448f-9a2b-7fb9f9ac9816', '2026-06-13', '22:30:00', '23:00:00', 2, 0, false),
	('0f384ac7-f47a-4084-8636-be1af60156fd', '2026-06-21', '08:00:00', '08:30:00', 2, 0, false),
	('94fe85b1-902d-460b-b65e-e000142f294b', '2026-06-21', '08:30:00', '09:00:00', 2, 0, false),
	('013f436f-2e4e-44cb-a240-a5210995224c', '2026-06-21', '09:00:00', '09:30:00', 2, 0, false),
	('fa22d9c1-755b-4156-b1f9-3d7bff9bfe53', '2026-06-21', '09:30:00', '10:00:00', 2, 0, false),
	('da60172b-e58b-4b5d-98ad-c428d695e510', '2026-06-21', '10:00:00', '10:30:00', 2, 0, false),
	('b072256a-ae67-4979-bec9-623556db9285', '2026-06-21', '10:30:00', '11:00:00', 2, 0, false),
	('adc5325e-9577-4a78-805f-522fe39571e6', '2026-06-21', '11:00:00', '11:30:00', 2, 0, false),
	('fa30f591-d2d0-495e-bdb1-e464c638196f', '2026-06-21', '11:30:00', '12:00:00', 2, 0, false),
	('547c365a-e6b2-47e1-801c-7f868f138616', '2026-06-21', '12:00:00', '12:30:00', 2, 0, false),
	('9486a46f-cbbf-45e6-aa78-8dcafcdbe129', '2026-06-21', '12:30:00', '13:00:00', 2, 0, false),
	('267c93d6-7e6b-457c-9acb-4233731cbdc6', '2026-06-21', '13:00:00', '13:30:00', 2, 0, false),
	('fec37f8f-fd54-4f94-8987-ed856da9b4e4', '2026-06-21', '13:30:00', '14:00:00', 2, 0, false),
	('bb131313-e7d2-4ec9-9aa9-515d90d88101', '2026-06-21', '14:00:00', '14:30:00', 2, 0, false),
	('bd09cefe-0df4-42b0-adf4-a7801ff9e95c', '2026-06-21', '14:30:00', '15:00:00', 2, 0, false),
	('f8cca063-8bff-4cc6-97cd-17f5a4465de8', '2026-06-21', '15:00:00', '15:30:00', 2, 0, false),
	('b8828032-04f6-4b90-b571-9cf10dc918e3', '2026-06-21', '15:30:00', '16:00:00', 2, 0, false),
	('0e0e8a7f-8fa0-474d-920b-4a4ff0ef7146', '2026-06-21', '16:00:00', '16:30:00', 2, 0, false),
	('2623659b-455b-49ba-b258-c6bf00426691', '2026-06-21', '16:30:00', '17:00:00', 2, 0, false),
	('2b7145a0-c0b5-498c-8e64-5f9f1d469c28', '2026-06-21', '17:00:00', '17:30:00', 2, 0, false),
	('86646690-2455-4c24-bbc9-2d4b210add18', '2026-06-21', '17:30:00', '18:00:00', 2, 0, false),
	('9e2ff58d-dc58-4c09-8463-602b87360a67', '2026-06-21', '18:00:00', '18:30:00', 2, 0, false),
	('6652081d-8539-4a8f-aa2b-0269788987fc', '2026-06-21', '18:30:00', '19:00:00', 2, 0, false),
	('b1e5789d-a739-47fe-a799-7cc8798a161b', '2026-06-21', '19:00:00', '19:30:00', 2, 0, false),
	('d6e74aaa-33e9-4dea-a8ee-686df3729a1b', '2026-06-21', '19:30:00', '20:00:00', 2, 0, false),
	('da66dbad-c9c4-469d-bf1a-08ac53594060', '2026-06-21', '20:00:00', '20:30:00', 2, 0, false),
	('d8d102db-aa93-491e-b245-d01493f435b2', '2026-06-21', '20:30:00', '21:00:00', 2, 0, false),
	('03725b39-a97f-47b2-8dd3-7d4a1574ef4c', '2026-06-21', '21:00:00', '21:30:00', 2, 0, false),
	('f3dfb0bd-77f4-4a13-9f07-580a8809eda3', '2026-06-21', '21:30:00', '22:00:00', 2, 0, false),
	('3e1b828b-f104-4c26-8aac-7c39eb7d524c', '2026-06-14', '08:00:00', '08:30:00', 2, 0, false),
	('45705589-91d7-45fc-a9fa-02e6048e066a', '2026-06-14', '08:30:00', '09:00:00', 2, 0, false),
	('a0310616-47b7-4790-956c-2c61040b1ee8', '2026-06-14', '09:00:00', '09:30:00', 2, 0, false),
	('c2ab5644-ad2f-4a86-852e-d4c1c3180435', '2026-06-14', '09:30:00', '10:00:00', 2, 0, false),
	('17018f66-da0d-4320-bc2c-41519a6fcc8e', '2026-06-14', '10:00:00', '10:30:00', 2, 0, false),
	('827bf763-c314-45d1-ad8a-a8ad369f5f02', '2026-06-14', '10:30:00', '11:00:00', 2, 0, false),
	('2f6b8668-200d-4968-8a9b-a3b181a09278', '2026-06-14', '11:00:00', '11:30:00', 2, 0, false),
	('0e5a71e6-7224-4ee1-9bd8-4b4d28122bd9', '2026-06-14', '11:30:00', '12:00:00', 2, 0, false),
	('126c7c53-7682-4851-825c-e502e85b9844', '2026-06-14', '12:00:00', '12:30:00', 2, 0, false),
	('589ae5c2-057b-41a5-897f-5ab0fdb40dcb', '2026-06-14', '12:30:00', '13:00:00', 2, 0, false),
	('939d0bc7-0657-4cd0-8c32-0bb3eff8cf4a', '2026-06-14', '13:00:00', '13:30:00', 2, 0, false),
	('9a0b73e2-f3c7-4af7-8e97-79e13e01b73f', '2026-06-14', '13:30:00', '14:00:00', 2, 0, false),
	('c5a4fab9-f686-447f-9a78-de7f755377f4', '2026-06-14', '14:00:00', '14:30:00', 2, 0, false),
	('6a988797-47dc-4d6c-a4b4-bd11348cf4fc', '2026-06-14', '14:30:00', '15:00:00', 2, 0, false),
	('a1e26399-47b0-4d13-ab9c-5adbe17ab602', '2026-06-14', '15:00:00', '15:30:00', 2, 0, false),
	('02b1ce25-b9c6-4544-ade0-aa0894c9d7e6', '2026-06-14', '15:30:00', '16:00:00', 2, 0, false),
	('527a151f-9aeb-442a-9f13-22298ca094cc', '2026-06-14', '16:00:00', '16:30:00', 2, 0, false),
	('80d4f2c5-e867-44ed-a69f-0f4c58a7f97c', '2026-06-14', '16:30:00', '17:00:00', 2, 0, false),
	('49bea257-fce1-4f9c-a578-102352bb03d6', '2026-06-14', '17:00:00', '17:30:00', 2, 0, false),
	('a7955f5c-c114-4b53-9037-8defff4994f6', '2026-06-14', '17:30:00', '18:00:00', 2, 0, false),
	('0f75b15b-10f6-4d8c-8a82-752db6111ade', '2026-06-14', '18:00:00', '18:30:00', 2, 0, false),
	('3a112464-63bc-4ce8-9059-59207ee25e36', '2026-06-14', '18:30:00', '19:00:00', 2, 0, false),
	('39cbf967-e18d-46ad-b688-3d763ce6040b', '2026-06-14', '19:00:00', '19:30:00', 2, 0, false),
	('f3f5e19e-b1b5-4cae-8903-9dad7c739d7c', '2026-06-14', '19:30:00', '20:00:00', 2, 0, false),
	('d0b19e7e-f22f-4ccf-ae37-f4cdab233b44', '2026-06-14', '20:00:00', '20:30:00', 2, 0, false),
	('9225c18a-c886-47cc-a4f5-df59fd37a29e', '2026-06-14', '20:30:00', '21:00:00', 2, 0, false),
	('22923b0d-9dcf-4e8e-864e-e1d6ebb66ca7', '2026-06-14', '21:00:00', '21:30:00', 2, 0, false),
	('f84d2f42-3eff-4866-8972-0458ce8f0f32', '2026-06-14', '21:30:00', '22:00:00', 2, 0, false),
	('df902755-b760-4264-8c6b-abaaaaace69b', '2026-06-14', '22:00:00', '22:30:00', 2, 0, false),
	('956af2fc-000b-4b0d-95f3-69d80b5317b4', '2026-06-14', '22:30:00', '23:00:00', 2, 0, false),
	('6a2cc92a-eb7a-43cb-b8a0-39d72be6e497', '2026-06-22', '08:00:00', '08:30:00', 2, 0, false),
	('cec90959-59c7-4030-a271-ab67729173e5', '2026-06-22', '08:30:00', '09:00:00', 2, 0, false),
	('b9dbf147-74b9-49ab-bfae-f20439dc4859', '2026-06-22', '09:00:00', '09:30:00', 2, 0, false),
	('343a08ea-1ef7-417c-b432-cff3bfd28a21', '2026-06-22', '10:00:00', '10:30:00', 2, 0, false),
	('9bd59966-420b-4b65-a42d-4a749c0371b5', '2026-06-22', '10:30:00', '11:00:00', 2, 0, false),
	('fd3f2d7f-326a-4e56-a85a-db78e8e43227', '2026-06-22', '11:00:00', '11:30:00', 2, 0, false),
	('ba5beade-66ad-4bd6-9ddd-4f0e214bee07', '2026-06-22', '11:30:00', '12:00:00', 2, 0, false),
	('b476f9fc-3efa-4a48-950c-f5fe9e1833d9', '2026-06-22', '12:00:00', '12:30:00', 2, 0, false),
	('e006f3e7-8265-49f2-aa4e-9ecebd59844b', '2026-06-22', '13:00:00', '13:30:00', 2, 0, false),
	('8ea8e6a7-5c05-4954-bcc3-d8732ec8ef53', '2026-06-22', '13:30:00', '14:00:00', 2, 0, false),
	('e7fbfe7b-9373-417b-bb6e-bde93bc71e82', '2026-06-22', '14:00:00', '14:30:00', 2, 0, false),
	('0fab6a6f-6a42-4268-bc57-9ef70c6d1d7b', '2026-06-22', '14:30:00', '15:00:00', 2, 0, false),
	('b9903ef5-a65c-4e25-8121-74d1874c27b6', '2026-06-22', '15:00:00', '15:30:00', 2, 0, false),
	('0d7228c3-569d-4dcd-aa93-32cfb59ea27c', '2026-06-22', '15:30:00', '16:00:00', 2, 0, false),
	('bdb2a547-2bf7-48a2-ada6-f64a58609887', '2026-06-22', '16:00:00', '16:30:00', 2, 0, false),
	('53fe27be-ae92-42ab-ae9c-87eba3c913f8', '2026-06-22', '16:30:00', '17:00:00', 2, 0, false),
	('7cb9a7a6-b7e1-4987-bff3-f41fd1b35f40', '2026-06-22', '17:00:00', '17:30:00', 2, 0, false),
	('ecf533e9-e544-4ea1-8265-55a92baa08db', '2026-06-22', '18:00:00', '18:30:00', 2, 0, false),
	('c01f36b2-9f63-4f97-a758-2989d1b94d44', '2026-06-22', '18:30:00', '19:00:00', 2, 0, false),
	('864de196-7db4-415b-a96b-335ce081c420', '2026-06-22', '19:00:00', '19:30:00', 2, 0, false),
	('ee25a943-3ed7-4399-813d-e87863698505', '2026-06-22', '19:30:00', '20:00:00', 2, 0, false),
	('3deb6fab-ee5e-41ee-93e4-7ff8bc8f81ae', '2026-06-22', '20:00:00', '20:30:00', 2, 0, false),
	('5e56fe81-6183-44d1-b0e9-cf8ca08f24c2', '2026-06-22', '20:30:00', '21:00:00', 2, 0, false),
	('b3de007a-f9d5-4896-acf0-018bd1b82331', '2026-06-22', '21:00:00', '21:30:00', 2, 0, false),
	('114db89e-b683-4f50-a606-b3593f9540f0', '2026-06-22', '21:30:00', '22:00:00', 2, 0, false),
	('341fa20e-932d-441b-8876-12c82fe069c3', '2026-06-22', '22:00:00', '22:30:00', 2, 0, false),
	('0128971b-7d87-49f8-b2d5-7b678acb0d6e', '2026-06-22', '22:30:00', '23:00:00', 2, 0, false),
	('1e7e49e5-8b49-4007-9239-7327fb3cf8e6', '2026-06-28', '08:00:00', '08:30:00', 2, 0, false),
	('9777c798-9e0f-49fa-99a7-364d4c089e72', '2026-06-28', '08:30:00', '09:00:00', 2, 0, false),
	('ede908db-2c5e-4d03-b0ea-61b012591948', '2026-06-28', '09:00:00', '09:30:00', 2, 0, false),
	('38331762-3dca-4d05-97e0-10f7509b92f6', '2026-06-28', '09:30:00', '10:00:00', 2, 0, false),
	('d9916d48-c771-4f7d-8212-b5f11e899caf', '2026-06-28', '10:00:00', '10:30:00', 2, 0, false),
	('523a3411-3704-4584-9f72-5db105e20ff5', '2026-06-28', '10:30:00', '11:00:00', 2, 0, false),
	('25131c3d-09a3-47aa-a8cd-1d9dd120b794', '2026-06-28', '11:00:00', '11:30:00', 2, 0, false),
	('d81435c2-c19f-47b5-82b9-3c56c1091410', '2026-06-28', '11:30:00', '12:00:00', 2, 0, false),
	('887cf458-bde6-47ae-84d8-c4d2e19650b4', '2026-06-28', '12:00:00', '12:30:00', 2, 0, false),
	('0f2c1a89-6a04-4708-8fbb-0fac04b1c278', '2026-06-28', '12:30:00', '13:00:00', 2, 0, false),
	('0fbb8295-7fe8-4970-8e1c-b2a69308ebe0', '2026-06-28', '13:00:00', '13:30:00', 2, 0, false),
	('ec5df3d6-05ff-4b56-a151-3e29d7e3a3f4', '2026-06-28', '13:30:00', '14:00:00', 2, 0, false),
	('79eb3cee-57a6-4d55-8e27-20ed9bbae46a', '2026-06-28', '14:00:00', '14:30:00', 2, 0, false),
	('adb5ab2a-03c2-4c6c-aede-0cb3816691ad', '2026-06-28', '14:30:00', '15:00:00', 2, 0, false),
	('d7396f5f-c094-43b8-840d-e136a70d5cde', '2026-06-28', '15:00:00', '15:30:00', 2, 0, false),
	('e1189762-e0cb-4e32-9ae5-d894fa9aab17', '2026-06-28', '15:30:00', '16:00:00', 2, 0, false),
	('f84c0e5b-565c-44b5-950c-682010dd79da', '2026-06-28', '16:00:00', '16:30:00', 2, 0, false),
	('204535aa-2cb2-4589-8dd0-4333374c40ab', '2026-06-28', '16:30:00', '17:00:00', 2, 0, false),
	('42efd5de-8d24-416c-998a-3550f413d032', '2026-06-28', '17:00:00', '17:30:00', 2, 0, false),
	('141e37b0-1bb6-4273-94fb-16226b8a6240', '2026-06-28', '17:30:00', '18:00:00', 2, 0, false),
	('d38ffd57-f519-4427-b256-7e3c44bf641a', '2026-06-28', '18:00:00', '18:30:00', 2, 0, false),
	('fcc725c4-9652-4895-b760-1e39545dd9a7', '2026-06-28', '18:30:00', '19:00:00', 2, 0, false),
	('482313f3-c0b9-4b88-970d-ffb319c1d95b', '2026-06-28', '19:00:00', '19:30:00', 2, 0, false),
	('ef50b4dc-cbff-4051-99d6-52f2c1638e7b', '2026-06-28', '19:30:00', '20:00:00', 2, 0, false),
	('6272280d-6287-48c5-8228-9fac930d5b42', '2026-06-28', '20:00:00', '20:30:00', 2, 0, false),
	('0f91a3b9-6945-496c-b487-9f4b8f76ac04', '2026-07-29', '12:30:00', '13:00:00', 2, 0, false),
	('a44a3170-149f-4e97-a2c2-18a4cfea0824', '2026-06-28', '21:00:00', '21:30:00', 2, 0, false),
	('b4d2ccc9-260d-481c-b1a8-bfbdd9c20e5e', '2026-06-28', '21:30:00', '22:00:00', 2, 0, false),
	('721041dc-0b46-4796-a720-0aee803230db', '2026-06-28', '22:00:00', '22:30:00', 2, 0, false),
	('86911dc2-e438-4d86-b896-dcb843d2f8e9', '2026-06-28', '22:30:00', '23:00:00', 2, 0, false),
	('ccc90359-a27c-47c2-8505-e44831a75606', '2026-07-06', '21:00:00', '21:30:00', 2, 0, false),
	('21b2116d-284d-4334-b1bf-01f7418afd3e', '2026-07-06', '21:30:00', '22:00:00', 2, 0, false),
	('3039db89-c4fd-46c0-a04e-b6a79e0277a3', '2026-07-06', '22:00:00', '22:30:00', 2, 0, false),
	('a5e19df5-fa8a-46d9-9506-8829aae7e1a5', '2026-07-06', '22:30:00', '23:00:00', 2, 0, false),
	('aebc3d06-79a5-4f40-b1de-cf339a0494eb', '2026-06-22', '09:30:00', '10:00:00', 2, 1, false),
	('2577a36b-d99f-4a07-a47f-3e6a4d5ce150', '2026-06-03', '21:00:00', '21:30:00', 2, 0, false),
	('23077cb5-4db3-470d-bae2-2cefb5a931f4', '2026-06-22', '12:30:00', '13:00:00', 2, 1, false),
	('3c7e9694-598d-4185-87e4-27acf52a02cd', '2026-06-22', '17:30:00', '18:00:00', 2, 1, false),
	('0e29c2d2-cb9c-4b95-a559-bc514e1ce492', '2026-07-11', '18:00:00', '18:30:00', 2, 0, false),
	('a62b429c-db60-4b38-99da-0d6021b86150', '2026-06-15', '08:00:00', '08:30:00', 2, 0, false),
	('9b1696db-e4d2-4336-ba9a-a79b2969ab55', '2026-06-15', '08:30:00', '09:00:00', 2, 0, false),
	('c7113341-10e2-4a93-8f12-b77239e06ae1', '2026-06-15', '09:00:00', '09:30:00', 2, 0, false),
	('35d72b2b-fd93-425f-bd0a-3ebc2ce651d2', '2026-06-15', '09:30:00', '10:00:00', 2, 0, false),
	('de9eeb4a-fa50-4520-9db1-1406a2821d21', '2026-06-15', '10:00:00', '10:30:00', 2, 0, false),
	('2c54a132-74bc-43c1-8dd9-45f8a7a98ac7', '2026-06-15', '10:30:00', '11:00:00', 2, 0, false),
	('f5db5676-6819-4403-aa18-987438652017', '2026-06-15', '11:00:00', '11:30:00', 2, 0, false),
	('6dd95e7d-ef89-42ce-b537-395861bb4cd0', '2026-06-15', '11:30:00', '12:00:00', 2, 0, false),
	('5e3a2091-9525-4fe8-b4c0-a7b3f763a456', '2026-06-15', '12:00:00', '12:30:00', 2, 0, false),
	('3dbc21ab-6f23-4e50-a0e1-d6e510b11bdd', '2026-06-15', '12:30:00', '13:00:00', 2, 0, false),
	('b5a3fcd1-99d9-4a2a-ba5e-d82ce569ad46', '2026-06-15', '13:00:00', '13:30:00', 2, 0, false),
	('810e24d2-dd42-4928-bbc7-81a1938d4b36', '2026-06-15', '13:30:00', '14:00:00', 2, 0, false),
	('7caab654-dafa-4107-847c-42bdc08dc3cb', '2026-06-15', '14:00:00', '14:30:00', 2, 0, false),
	('4951a35d-ca92-4d8a-bd2b-9be8135fbb9f', '2026-06-15', '14:30:00', '15:00:00', 2, 0, false),
	('028dfdf6-99e1-4d64-ab01-26dd23d30fdd', '2026-06-15', '15:00:00', '15:30:00', 2, 0, false),
	('50e9e08b-fa23-4966-94ee-bcb754f31b83', '2026-06-15', '15:30:00', '16:00:00', 2, 0, false),
	('7c21c6b8-934d-4b0e-a6ab-cefc4a0b2d56', '2026-06-15', '16:00:00', '16:30:00', 2, 0, false),
	('5629f4e4-92ad-47f0-ab91-6419ad73eb2d', '2026-06-15', '16:30:00', '17:00:00', 2, 0, false),
	('f5829bf5-382d-4f6c-be5f-583b68e14b6d', '2026-06-15', '17:00:00', '17:30:00', 2, 0, false),
	('7ce301d1-be3e-47b1-b33a-f57b95b648b2', '2026-06-15', '17:30:00', '18:00:00', 2, 0, false),
	('f58f67d8-5208-43cb-81b7-96528084d368', '2026-06-15', '18:00:00', '18:30:00', 2, 0, false),
	('434e22d0-10a0-4968-9b6d-175ddc96b905', '2026-06-15', '18:30:00', '19:00:00', 2, 0, false),
	('04df8474-8dc2-486e-b494-724799c5642f', '2026-06-15', '19:00:00', '19:30:00', 2, 0, false),
	('06a153ff-dcfc-4292-a533-0d2dda8d02a8', '2026-06-15', '19:30:00', '20:00:00', 2, 0, false),
	('4971898c-b605-4141-bf5b-4c5e283383d1', '2026-06-15', '20:00:00', '20:30:00', 2, 0, false),
	('a6239df2-3cf6-481f-b35e-ceb105478149', '2026-06-15', '21:00:00', '21:30:00', 2, 0, false),
	('ca8321a3-de0e-490f-bf99-01f31aa5753f', '2026-06-15', '21:30:00', '22:00:00', 2, 0, false),
	('dd05de37-57e3-4cb0-8bce-5b598add1918', '2026-06-15', '22:00:00', '22:30:00', 2, 0, false),
	('929a3b04-a7f7-4e8b-ac5c-0ecdda49c939', '2026-06-15', '22:30:00', '23:00:00', 2, 0, false),
	('269ddd51-8dcc-46e8-aee8-f54d44b2b336', '2026-06-29', '08:00:00', '08:30:00', 2, 0, false),
	('c26531c0-5240-493d-995f-2436d4893ee2', '2026-06-29', '08:30:00', '09:00:00', 2, 0, false),
	('6d4f5587-9b93-4a5e-bbf9-f4df8ac11723', '2026-06-29', '09:00:00', '09:30:00', 2, 0, false),
	('ac3e64e0-91fa-4028-9947-f0a8b2680fd3', '2026-06-29', '09:30:00', '10:00:00', 2, 0, false),
	('1d71ff84-03c2-43ba-9a31-0b6b8a4c3cc8', '2026-06-29', '10:00:00', '10:30:00', 2, 0, false),
	('8cec9406-8bf1-4115-b318-44605250c61b', '2026-06-29', '10:30:00', '11:00:00', 2, 0, false),
	('83ae01fd-e050-48a9-9cfe-2ed4afeece81', '2026-06-29', '11:30:00', '12:00:00', 2, 0, false),
	('2a087b36-b4e0-423a-9f09-71de378ebda8', '2026-06-29', '12:00:00', '12:30:00', 2, 0, false),
	('5e07e483-3d79-4236-8043-edbbaa34fcf8', '2026-06-29', '12:30:00', '13:00:00', 2, 0, false),
	('1546b2b2-d962-45a8-881e-db291b249e7f', '2026-06-29', '13:00:00', '13:30:00', 2, 0, false),
	('1ba0cf37-84c5-4172-be1a-01b67fa8a0b3', '2026-06-29', '13:30:00', '14:00:00', 2, 0, false),
	('bbf7a6aa-b2cc-4baa-9560-df6de7ebacda', '2026-06-29', '14:00:00', '14:30:00', 2, 0, false),
	('0f0e5b9f-b19c-4686-a0ca-ce084ed71916', '2026-06-29', '14:30:00', '15:00:00', 2, 0, false),
	('b9b95d9f-93da-4707-96d5-18695d82fc8c', '2026-06-29', '15:00:00', '15:30:00', 2, 0, false),
	('a9a9984b-452e-4e0f-ab66-24c6d2c8b5db', '2026-06-29', '15:30:00', '16:00:00', 2, 0, false),
	('2986667c-0838-4909-a3c4-653f7bce80d3', '2026-06-29', '16:30:00', '17:00:00', 2, 0, false),
	('5f5e838f-b676-4a4f-b2c9-ea607f8e36a3', '2026-06-29', '17:00:00', '17:30:00', 2, 0, false),
	('769151bd-6b45-4a6e-b07b-6acf21d7c6f2', '2026-06-29', '17:30:00', '18:00:00', 2, 0, false),
	('da913963-9ef2-4a34-8d1a-7c0582185c97', '2026-06-29', '18:00:00', '18:30:00', 2, 0, false),
	('813abea6-cf49-46e1-ad29-5547a9bc9ed5', '2026-06-29', '18:30:00', '19:00:00', 2, 0, false),
	('71b9b957-f48a-4b68-ade9-85f268d8d49d', '2026-06-29', '19:00:00', '19:30:00', 2, 0, false),
	('e1d4c424-7fc0-4f15-8a22-c43724b5e108', '2026-06-29', '19:30:00', '20:00:00', 2, 0, false),
	('86d3992e-f660-4d61-afca-b6d81b45aaf2', '2026-06-29', '20:00:00', '20:30:00', 2, 0, false),
	('b046dffe-8ac8-42b1-9f74-a06b5e13c920', '2026-06-29', '20:30:00', '21:00:00', 2, 0, false),
	('10536c59-3589-4c68-adfa-392e8af6c584', '2026-06-29', '21:00:00', '21:30:00', 2, 0, false),
	('c10e59ed-6aa9-450b-ac13-3c371456dc04', '2026-06-29', '21:30:00', '22:00:00', 2, 0, false),
	('11f44175-f0d6-4a33-893b-a7d91e442a12', '2026-06-29', '22:00:00', '22:30:00', 2, 0, false),
	('955de019-dbce-4119-a6bb-da68256fbc64', '2026-06-29', '22:30:00', '23:00:00', 2, 0, false),
	('8f56725b-1105-4d34-9ca8-2eae51238f93', '2026-06-15', '20:30:00', '21:00:00', 2, 1, false),
	('2ef16740-b824-452d-aa36-06843e34f24c', '2026-07-07', '08:00:00', '08:30:00', 2, 0, false),
	('61eb4e5a-563d-4398-adcd-d11a8b4031ad', '2026-07-07', '08:30:00', '09:00:00', 2, 0, false),
	('bba1052b-a680-463e-9f38-c7a8faaf58a7', '2026-07-07', '09:00:00', '09:30:00', 2, 0, false),
	('2f3d7d94-4e53-4b3d-8434-538d8ab9f0e4', '2026-07-07', '09:30:00', '10:00:00', 2, 0, false),
	('f572ba1c-818d-4f16-8d9a-42c563f8d47f', '2026-07-07', '10:00:00', '10:30:00', 2, 0, false),
	('4fc5f4f5-cbaa-4f29-b6e7-c263c8c4ac03', '2026-07-07', '10:30:00', '11:00:00', 2, 0, false),
	('0ebece08-59ab-4d10-aa8d-af9b3bc3aa12', '2026-07-07', '11:00:00', '11:30:00', 2, 0, false),
	('413c039c-799c-421c-b6e1-b51e24783163', '2026-07-07', '11:30:00', '12:00:00', 2, 0, false),
	('1c9e373b-9444-40da-bcf7-b952b41104dc', '2026-07-07', '12:00:00', '12:30:00', 2, 0, false),
	('411a9d01-71d7-440d-9d1f-db3b81e168e9', '2026-07-07', '12:30:00', '13:00:00', 2, 0, false),
	('ccafe23b-f65c-49ae-a1cd-fdd2245818d9', '2026-07-07', '13:00:00', '13:30:00', 2, 0, false),
	('fd3ba30b-a9fa-4da9-a92e-3563df5e3c7d', '2026-07-07', '13:30:00', '14:00:00', 2, 0, false),
	('9d27c9c8-8249-40ef-96b8-8887057d08bf', '2026-05-14', '18:30:00', '19:00:00', 2, 0, false),
	('6cbb79c0-757d-4814-bc9b-eeff4b88ebe6', '2026-05-14', '19:00:00', '19:30:00', 2, 0, false),
	('7d8219ec-c8ed-4a43-a416-c5753deb361d', '2026-05-26', '22:30:00', '23:00:00', 2, 0, false),
	('57db04d7-7471-4afb-b7e8-39de97e0ea08', '2026-05-26', '23:00:00', '23:30:00', 2, 0, false),
	('78bd1d67-47c1-4dbf-b21c-c0e6779697c9', '2026-05-13', '18:30:00', '19:00:00', 2, 0, false),
	('3d1cf787-b241-49d4-9ba7-c9c97544ac1d', '2026-05-13', '19:00:00', '19:30:00', 2, 0, false),
	('fca8d00f-a47f-4eb9-9201-fa5e92fae060', '2026-05-13', '19:30:00', '20:00:00', 2, 0, false),
	('e87ba09d-561d-4297-b4e9-dd78d8832914', '2026-05-13', '20:00:00', '20:30:00', 2, 0, false),
	('a53547b2-0604-4485-bc52-f1903399807a', '2026-05-13', '20:30:00', '21:00:00', 2, 0, false),
	('7187cf74-3185-4acb-8c85-26da95752b7e', '2026-05-13', '21:00:00', '21:30:00', 2, 0, false),
	('cb447442-55ad-425c-ae1a-1ca82fcf5019', '2026-05-13', '21:30:00', '22:00:00', 2, 0, false),
	('2d502805-1273-40ba-908f-12ee9837ed5d', '2026-05-13', '22:00:00', '22:30:00', 2, 0, false),
	('5ddeac26-caca-454c-b1a2-32c5f20bd48a', '2026-05-13', '22:30:00', '23:00:00', 2, 0, false),
	('24973773-7db6-432b-af70-538261e294f8', '2026-04-26', '12:00:00', '13:00:00', 4, 0, false),
	('9bb8edd1-6c98-4284-85ef-c77c80dd6712', '2026-05-07', '09:00:00', '09:30:00', 2, 0, false),
	('c7aa67e2-60ae-49db-8638-4ae91bc15ddc', '2026-05-07', '10:00:00', '10:30:00', 2, 0, false),
	('6271f609-43e0-4f87-abdd-1c784a5b0018', '2026-05-07', '10:30:00', '11:00:00', 2, 0, false),
	('a28f93fa-05c2-47dc-9a07-0a65fd6b2b75', '2026-05-02', '18:30:00', '19:00:00', 2, 0, false),
	('2dde6da9-f8ce-4e29-a318-4dbb9b872dfb', '2026-05-02', '19:00:00', '19:30:00', 2, 0, false),
	('0c6e9501-676b-460d-a5a1-2ee7d4b28ac4', '2026-05-14', '19:30:00', '20:00:00', 2, 0, false),
	('2c3be887-e915-423c-af22-0a710de8b69f', '2026-05-14', '20:00:00', '20:30:00', 2, 0, false),
	('e60515e6-2488-456e-a65d-3f9f6bc900c3', '2026-05-14', '20:30:00', '21:00:00', 2, 0, false),
	('5d2e9b8a-b253-4909-9122-bf74398a6a54', '2026-05-14', '21:00:00', '21:30:00', 2, 0, false),
	('a1bc6aad-9565-4a54-8a27-e95cf6c519cf', '2026-05-14', '21:30:00', '22:00:00', 2, 0, false),
	('20c7e579-d49c-414c-8d8a-e913a9f8e4a7', '2026-06-29', '16:00:00', '16:30:00', 2, 1, false),
	('32d6d921-7e68-408d-92c5-14e14bc43367', '2026-06-29', '11:00:00', '11:30:00', 2, 1, false),
	('7ce812fa-3c12-4f5f-9beb-a6e082b4da94', '2026-06-16', '08:00:00', '08:30:00', 2, 0, false),
	('8e78827c-98b8-486e-b930-cc59fe6801e9', '2026-06-16', '08:30:00', '09:00:00', 2, 0, false),
	('bcd512ba-2aba-48b4-a84e-0162dcee6835', '2026-06-16', '09:00:00', '09:30:00', 2, 0, false),
	('5a19a3b8-0fce-4d6f-99d2-1b7ffbf372c8', '2026-06-16', '09:30:00', '10:00:00', 2, 0, false),
	('2447ef31-1827-47e6-9de0-911b9ef9c244', '2026-06-16', '10:30:00', '11:00:00', 2, 0, false),
	('ca5be0e7-048e-486c-97d1-6e0f9715151a', '2026-06-16', '11:30:00', '12:00:00', 2, 0, false),
	('5e9e552f-4b00-4b01-97a9-52dcf3330976', '2026-06-16', '12:00:00', '12:30:00', 2, 0, false),
	('68f1656d-f302-41f2-992c-1a89589946cc', '2026-06-16', '12:30:00', '13:00:00', 2, 0, false),
	('d52298ba-fc92-43c4-9b7b-59da62dc365f', '2026-06-16', '13:00:00', '13:30:00', 2, 0, false),
	('61418961-3e8e-42f0-b018-810223a9561e', '2026-06-16', '13:30:00', '14:00:00', 2, 0, false),
	('3fa4bd8a-1add-40ce-b2f6-3928334278e8', '2026-06-16', '14:00:00', '14:30:00', 2, 0, false),
	('672c0ad0-82b6-47db-8d4b-1a1b37c04075', '2026-06-16', '14:30:00', '15:00:00', 2, 0, false),
	('56365687-8dc6-415b-b2fc-be61e83386f0', '2026-06-16', '15:00:00', '15:30:00', 2, 0, false),
	('f53e7690-5272-480f-a3f3-7d68782f1be1', '2026-06-16', '15:30:00', '16:00:00', 2, 0, false),
	('c02e1bbc-4706-46d5-83b8-1308a7296bb3', '2026-06-16', '16:00:00', '16:30:00', 2, 0, false),
	('2e28a75b-8bea-4c31-ad24-c896121e2efa', '2026-06-16', '16:30:00', '17:00:00', 2, 0, false),
	('4f3535dd-c174-417d-9d02-10465d9e3a5f', '2026-06-16', '17:00:00', '17:30:00', 2, 0, false),
	('91e56cdd-c310-4108-9241-6bd83a1a456b', '2026-06-16', '17:30:00', '18:00:00', 2, 0, false),
	('45dc6e77-6f30-4f0b-af01-a65bae266f64', '2026-06-16', '18:00:00', '18:30:00', 2, 0, false),
	('e1adc688-8666-41d5-9af5-5f2e966a7ecc', '2026-06-16', '18:30:00', '19:00:00', 2, 0, false),
	('2cffa42b-4e84-4218-a8c5-23dd6471aa75', '2026-06-16', '19:00:00', '19:30:00', 2, 0, false),
	('7f481a0a-0696-4a59-88c5-54490b350654', '2026-06-16', '19:30:00', '20:00:00', 2, 0, false),
	('b6c4f747-3363-4c4d-8199-248372cc385b', '2026-06-16', '20:00:00', '20:30:00', 2, 0, false),
	('269d28a4-c7a5-4a4b-b5e8-c2a1a5341743', '2026-06-16', '20:30:00', '21:00:00', 2, 0, false),
	('3abda439-87d6-4576-9f4a-8a657029bbc4', '2026-06-16', '21:00:00', '21:30:00', 2, 0, false),
	('ec493f2a-1472-430d-a642-720135c24aa4', '2026-06-16', '21:30:00', '22:00:00', 2, 0, false),
	('0eac622d-7ad8-4bc3-a229-01d5b732bac6', '2026-06-16', '22:00:00', '22:30:00', 2, 0, false),
	('f5e5527d-3115-4255-b12c-85d9c9f8151c', '2026-06-16', '22:30:00', '23:00:00', 2, 0, false),
	('bbff6c3b-b632-42a5-9ab8-faee24b58503', '2026-06-30', '08:00:00', '08:30:00', 2, 0, false),
	('9fd596c9-6470-4524-8d9b-ec390d7ee055', '2026-06-30', '08:30:00', '09:00:00', 2, 0, false),
	('a509fc56-a676-489e-b21b-7cfd5abee7fe', '2026-06-30', '09:00:00', '09:30:00', 2, 0, false),
	('53e0bee1-3c2e-4777-abcd-44aab905706a', '2026-06-30', '09:30:00', '10:00:00', 2, 0, false),
	('7ddaf18d-0078-465d-9661-ce9feeb4bcea', '2026-06-30', '10:00:00', '10:30:00', 2, 0, false),
	('ee903fb2-5953-4e92-b38e-17bd7f7feeb8', '2026-06-30', '10:30:00', '11:00:00', 2, 0, false),
	('a4be5da1-9994-40b3-8471-85aee70e7ab7', '2026-06-30', '11:00:00', '11:30:00', 2, 0, false),
	('987f0d8c-9659-48cf-b8fd-c66d0d233463', '2026-06-30', '11:30:00', '12:00:00', 2, 0, false),
	('a4ab3b12-3fca-45d0-8d75-51cb6f17d251', '2026-06-30', '12:00:00', '12:30:00', 2, 0, false),
	('9cf7e15d-aeb0-47b2-b140-e7b231d7221c', '2026-06-30', '12:30:00', '13:00:00', 2, 0, false),
	('61fc9e74-2d7b-4431-b803-2e4b92fb6b62', '2026-06-30', '13:00:00', '13:30:00', 2, 0, false),
	('bc276aea-3f14-43ad-8440-00fb75e42b15', '2026-06-30', '13:30:00', '14:00:00', 2, 0, false),
	('c785dcfe-8541-46ad-b95d-22635e179a83', '2026-06-30', '14:00:00', '14:30:00', 2, 0, false),
	('967e8bfd-490f-4de4-8eb5-812ad659eef1', '2026-06-30', '14:30:00', '15:00:00', 2, 0, false),
	('8b8b4842-2867-4447-957d-1c823d0b5984', '2026-06-30', '15:00:00', '15:30:00', 2, 0, false),
	('71c34ddd-8ed9-467b-acba-4bb90f231c05', '2026-06-30', '15:30:00', '16:00:00', 2, 0, false),
	('02e1990a-1330-4dda-8cf7-bcf7b3f150aa', '2026-06-30', '16:00:00', '16:30:00', 2, 0, false),
	('4aec84b6-2f78-4999-81e7-bc7c6844b96b', '2026-06-30', '16:30:00', '17:00:00', 2, 0, false),
	('a5dad339-3d88-4c78-b105-47fb83d6ecc4', '2026-06-30', '17:00:00', '17:30:00', 2, 0, false),
	('f2152e53-f3be-4f40-b4f5-355501258668', '2026-06-30', '17:30:00', '18:00:00', 2, 0, false),
	('49b83fb1-8d11-41dc-ba86-f17e7b02916a', '2026-06-30', '18:00:00', '18:30:00', 2, 0, false),
	('7c87723d-3e9b-4c6e-a496-b7de1e70c17f', '2026-06-30', '18:30:00', '19:00:00', 2, 0, false),
	('494be40b-5b79-41e6-91f1-eba08ea552d0', '2026-06-30', '19:00:00', '19:30:00', 2, 0, false),
	('dfeedeb4-faca-4ad9-8959-f964a5f9b656', '2026-06-30', '19:30:00', '20:00:00', 2, 0, false),
	('4272ed3a-74ae-4353-a185-46e997c0d59a', '2026-06-30', '20:00:00', '20:30:00', 2, 0, false),
	('cc650f76-3373-4620-a239-c830b8d7e57e', '2026-06-30', '20:30:00', '21:00:00', 2, 0, false),
	('994bb2a5-f88c-4b94-9f20-8b4187ca5c1d', '2026-06-30', '21:00:00', '21:30:00', 2, 0, false),
	('d12ae2cd-071c-4078-a12d-1a26ab8e61c2', '2026-06-30', '21:30:00', '22:00:00', 2, 0, false),
	('1f9ba508-a6ce-44ed-bedd-2ce80e25d5ee', '2026-05-14', '22:00:00', '22:30:00', 2, 0, false),
	('6fa30d38-c6f2-4e9b-bb5d-9dfd2d726d37', '2026-05-14', '22:30:00', '23:00:00', 2, 0, false),
	('309ad072-10ba-485d-a8b7-539002736a5c', '2026-05-14', '16:00:00', '16:30:00', 2, 0, false),
	('d0cadafc-c7b2-43a7-91a3-0c34cffcf718', '2026-05-14', '13:30:00', '14:00:00', 2, 0, false),
	('a0590482-c8ab-4401-a745-5ca60275618a', '2026-05-09', '15:30:00', '16:00:00', 2, 0, false),
	('733d219b-441b-4f86-b459-12237b7ab984', '2026-05-14', '15:00:00', '15:30:00', 2, 0, false),
	('cc86856d-09db-4c90-852e-4985f5d50bd5', '2026-05-14', '08:00:00', '08:30:00', 2, 0, false),
	('b1cacab9-ec44-4f02-920e-4c33aa6c129c', '2026-05-09', '16:00:00', '16:30:00', 2, 0, false),
	('df8d051f-d3ee-400d-939d-21d636af52f3', '2026-05-14', '08:30:00', '09:00:00', 2, 0, false),
	('1d2a62df-39ff-42dc-99c2-d31617d36c6f', '2026-05-06', '17:00:00', '17:30:00', 2, 0, false),
	('05f6978f-c781-4243-9594-be057da2b82c', '2026-05-29', '10:30:00', '11:00:00', 2, 0, false),
	('bb8fc6d4-b778-400c-bd4e-def8ff0a82c5', '2026-05-29', '11:00:00', '11:30:00', 2, 0, false),
	('0e7a0642-6f88-4213-8e19-7259eff51c34', '2026-06-03', '21:30:00', '22:00:00', 2, 0, false),
	('37000ca3-922a-4f1a-b84a-c118d04c5e73', '2026-06-03', '22:00:00', '22:30:00', 2, 0, false),
	('febe97bd-cfba-4346-a7d9-c8a87f1b36fd', '2026-06-03', '22:30:00', '23:00:00', 2, 0, false),
	('0a182dd5-b85f-4716-ac2e-d90c6e62f71b', '2026-06-03', '23:00:00', '23:30:00', 2, 0, false),
	('0990fd1f-fea3-4bb8-b313-20b7e21b917d', '2026-05-25', '09:00:00', '09:30:00', 2, 0, false),
	('2e51ac3c-9684-4d4e-9f3c-b6ee52f1bebe', '2026-05-25', '09:30:00', '10:00:00', 2, 0, false),
	('3b654d54-d1e0-4645-8198-efe7783edfd8', '2026-05-12', '21:30:00', '22:00:00', 2, 0, false),
	('5f79fa65-7cee-41ca-a052-a7b23305191a', '2026-06-04', '00:00:00', '00:30:00', 2, 0, false),
	('51548ebd-f7e3-4a80-90c0-59dbf763050f', '2026-06-04', '00:30:00', '01:00:00', 2, 0, false),
	('dba70898-9025-4e8c-8ead-6dac81d66b3e', '2026-06-04', '01:00:00', '01:30:00', 2, 0, false),
	('334485b1-ea4e-4bc0-ac5d-082a30a5fbe5', '2026-06-04', '01:30:00', '02:00:00', 2, 0, false),
	('84045f26-b1a9-4ca5-83e5-af4db5f6eb48', '2026-06-04', '02:00:00', '02:30:00', 2, 0, false),
	('eb5b71d3-6a56-4639-9246-0ce9efc78886', '2026-06-04', '02:30:00', '03:00:00', 2, 0, false),
	('d7fb2f20-774a-49ee-a921-5a9c91cca19a', '2026-06-04', '03:00:00', '03:30:00', 2, 0, false),
	('16a453cc-f7fa-4431-90db-f81b3a569375', '2026-06-04', '03:30:00', '04:00:00', 2, 0, false),
	('83c5b281-ea86-478b-9400-bac2ec2944c7', '2026-06-04', '08:00:00', '08:30:00', 2, 0, false),
	('9d6745cb-342d-4b57-be9d-7e0db6f8c813', '2026-06-04', '08:30:00', '09:00:00', 2, 0, false),
	('771ab120-ede4-4494-8a81-ab33ae21d189', '2026-06-04', '09:00:00', '09:30:00', 2, 0, false),
	('57582932-0344-4157-82df-ab99e7226424', '2026-06-04', '09:30:00', '10:00:00', 2, 0, false),
	('c821f8a2-e98e-4bed-8fb3-8491959588e4', '2026-06-04', '10:00:00', '10:30:00', 2, 0, false),
	('f31840c8-baa5-40d3-be46-d1a998c14047', '2026-06-04', '10:30:00', '11:00:00', 2, 0, false),
	('828d3595-2667-4b5a-af35-bc29fb8b4462', '2026-05-26', '09:00:00', '09:30:00', 2, 0, false),
	('10c06b65-9adb-49ad-aff0-4cb60c239f78', '2026-05-26', '10:30:00', '11:00:00', 2, 0, false),
	('2f2fe8c1-efbb-4a7a-ba18-0c82ac06542a', '2026-05-26', '10:00:00', '10:30:00', 2, 0, false),
	('cdd74bd3-65f2-4f63-9164-f26417167d34', '2026-05-29', '11:30:00', '12:00:00', 2, 0, false),
	('5ca54395-e295-4e06-b385-bf02b2b422af', '2026-06-30', '22:00:00', '22:30:00', 2, 0, false),
	('539bef9f-dc01-4082-9d59-e71214f02078', '2026-06-30', '22:30:00', '23:00:00', 2, 0, false),
	('d0f8e0fe-c67b-4e5e-9931-2e96a23feecb', '2026-06-16', '11:00:00', '11:30:00', 2, 1, false),
	('6641a89e-c328-42e2-871a-8d71e9a3152b', '2026-07-07', '14:00:00', '14:30:00', 2, 0, false),
	('b73d55f7-c7e3-42ab-b258-3f9afa4aeada', '2026-06-21', '22:00:00', '22:30:00', 2, 0, false),
	('cd92487f-b993-40ef-803d-1de10c997dd0', '2026-06-21', '22:30:00', '23:00:00', 2, 0, false),
	('3dff8d0e-6136-4cf7-91cd-dbb47cc0008a', '2026-06-16', '10:00:00', '10:30:00', 2, 1, false),
	('96a6f40b-5239-4b9e-8cd3-2fe8b23a896f', '2026-07-07', '15:00:00', '15:30:00', 2, 0, false),
	('b6e802f3-3150-4300-9401-d06e9fcc1acf', '2026-07-07', '15:30:00', '16:00:00', 2, 0, false),
	('e79265a8-44cc-4fdb-ad8e-8d2577fa5e40', '2026-07-07', '16:00:00', '16:30:00', 2, 0, false),
	('560a11b7-3a47-4b81-965c-44d4f0afdb0f', '2026-07-07', '16:30:00', '17:00:00', 2, 0, false),
	('75bcd61d-6296-4229-84b0-8e9720f02b0a', '2026-07-07', '17:00:00', '17:30:00', 2, 0, false),
	('e6113420-bc1e-431b-84c9-b5db0ce17bd7', '2026-07-07', '17:30:00', '18:00:00', 2, 0, false),
	('8932b643-33d1-42c1-965e-3bf25a446d71', '2026-07-07', '18:00:00', '18:30:00', 2, 0, false),
	('f01a212e-00d3-45d1-839c-d0f519810328', '2026-07-07', '18:30:00', '19:00:00', 2, 0, false),
	('79f304e3-6734-4584-84d6-7125e1b7683b', '2026-07-07', '19:00:00', '19:30:00', 2, 0, false),
	('9a7264f1-4cd9-4b76-a7b9-92783faa277e', '2026-07-07', '19:30:00', '20:00:00', 2, 0, false),
	('73eb7a8c-b9d7-4d0c-90e9-681dc28d637b', '2026-07-07', '20:00:00', '20:30:00', 2, 0, false),
	('dc0abb8a-f243-4ee9-b79e-0aba9e589f22', '2026-07-07', '20:30:00', '21:00:00', 2, 0, false),
	('857ee8dc-d37c-47f5-bf6c-4d7274894166', '2026-07-07', '21:00:00', '21:30:00', 2, 0, false),
	('2971eec6-9943-4ea1-acb4-1a6bd6ad8b4e', '2026-07-07', '21:30:00', '22:00:00', 2, 0, false),
	('370c7223-6cfa-4541-aae0-dc3b74b55519', '2026-07-07', '22:00:00', '22:30:00', 2, 0, false),
	('f1166011-f977-456c-bc03-be756168d22b', '2026-07-07', '22:30:00', '23:00:00', 2, 0, false),
	('81d98a83-1eee-4128-8c94-746775b73bf4', '2026-07-11', '18:30:00', '19:00:00', 2, 0, false),
	('747e3fc7-cc5c-4f48-a13f-d52103204f73', '2026-07-11', '19:00:00', '19:30:00', 2, 0, false),
	('f0301c9a-fcde-4562-9e13-267a8d156f89', '2026-07-11', '19:30:00', '20:00:00', 2, 0, false),
	('a3f26f6c-60b4-49f8-9b1b-6fecf24aa076', '2026-07-11', '20:00:00', '20:30:00', 2, 0, false),
	('c7e04ff8-eba6-4ab8-96e9-7e9e2ecb1702', '2026-07-11', '20:30:00', '21:00:00', 2, 0, false),
	('8b08a4ad-1116-4620-96a8-52149d66f90e', '2026-07-11', '21:00:00', '21:30:00', 2, 0, false),
	('8a413150-efa9-4ee2-b2a9-b06f6f626e24', '2026-07-11', '21:30:00', '22:00:00', 2, 0, false),
	('c78445f6-58f0-4c0f-9ad0-cd2cdb2457df', '2026-07-11', '22:00:00', '22:30:00', 2, 0, false),
	('ee4565ef-2f2e-4613-851c-1261d4929ad9', '2026-07-11', '22:30:00', '23:00:00', 2, 0, false),
	('e86a9679-b40e-48f1-83cd-17eeda43b788', '2026-07-12', '08:00:00', '08:30:00', 2, 0, false),
	('19a7eb94-2511-47cd-9668-9dd9da1defd2', '2026-07-12', '08:30:00', '09:00:00', 2, 0, false),
	('0e7e1c17-3130-4b0f-8931-fab27deba4b8', '2026-07-12', '09:00:00', '09:30:00', 2, 0, false),
	('58e30d89-81fd-46e5-ab41-c3652e0de244', '2026-07-12', '09:30:00', '10:00:00', 2, 0, false),
	('7bd59040-5586-4e04-9d8e-f0044fbef86e', '2026-07-12', '10:00:00', '10:30:00', 2, 0, false),
	('a4347abf-3b17-4ace-a555-1c61110dcac0', '2026-07-12', '10:30:00', '11:00:00', 2, 0, false),
	('e6116f70-9760-47f8-9320-8d31182276bb', '2026-07-12', '11:00:00', '11:30:00', 2, 0, false),
	('01615186-dd23-4bae-a291-5bd928ff897c', '2026-07-12', '11:30:00', '12:00:00', 2, 0, false),
	('d6ff20c4-a4bd-4d0c-84a6-535c63d3aa3c', '2026-07-12', '12:00:00', '12:30:00', 2, 0, false),
	('aa339465-f76f-4d28-9aca-1fc0a3024d52', '2026-07-12', '12:30:00', '13:00:00', 2, 0, false),
	('060e2f19-a8f1-4366-9386-b7b6712456a2', '2026-07-12', '13:30:00', '14:00:00', 2, 0, false),
	('2afcfca6-83f0-4702-8dea-8ed0d54c14cf', '2026-07-12', '14:00:00', '14:30:00', 2, 0, false),
	('41030b2b-9418-4f30-9bdf-8f2b264b8741', '2026-07-12', '14:30:00', '15:00:00', 2, 0, false),
	('b1f43a2a-a31f-4a9d-b421-1117d8e8ec30', '2026-07-12', '15:00:00', '15:30:00', 2, 0, false),
	('deb959d1-f8a1-4afe-ae19-7221512a8d50', '2026-07-12', '15:30:00', '16:00:00', 2, 0, false),
	('19dbf0da-7619-462e-8a1f-b88c5b450bd0', '2026-07-12', '16:00:00', '16:30:00', 2, 0, false),
	('815eab34-725b-4281-a583-961c2893a133', '2026-07-12', '16:30:00', '17:00:00', 2, 0, false),
	('66b61a25-4b7c-4b62-ba96-acf7f3a21387', '2026-07-12', '17:00:00', '17:30:00', 2, 0, false),
	('5a7f3483-bee3-415c-9c4f-296a76c489be', '2026-07-12', '17:30:00', '18:00:00', 2, 0, false),
	('ac98c763-574d-4d31-8131-830eed50825b', '2026-07-12', '18:00:00', '18:30:00', 2, 0, false),
	('835d837c-fee0-4fcb-8929-954e69dacee1', '2026-07-12', '18:30:00', '19:00:00', 2, 0, false),
	('481861e1-83d0-417c-a495-9b67e76f9a54', '2026-07-12', '19:00:00', '19:30:00', 2, 0, false),
	('71641238-b7ee-40fa-95a1-fc3a3698f944', '2026-07-12', '19:30:00', '20:00:00', 2, 0, false),
	('a7ffa9a9-03c7-4670-a5ac-b1ca3c80ca92', '2026-07-12', '20:00:00', '20:30:00', 2, 0, false),
	('1cf7279c-ca53-4f19-8d32-5f3f2c9e8075', '2026-07-12', '20:30:00', '21:00:00', 2, 0, false),
	('0252a34e-b8a9-43f1-93e6-803102345d67', '2026-07-12', '21:00:00', '21:30:00', 2, 0, false),
	('a67509c8-15ee-4d24-b870-7ab6954376e0', '2026-07-12', '21:30:00', '22:00:00', 2, 0, false),
	('905b84f2-64e9-4c57-8f46-a9b45f19c083', '2026-05-29', '12:00:00', '12:30:00', 2, 0, false),
	('8dc65908-076e-4b28-9505-369270e1600e', '2026-05-29', '12:30:00', '13:00:00', 2, 0, false),
	('fbc8f27a-d1c1-4c3d-9de1-4fcc103c65fd', '2026-05-29', '13:00:00', '13:30:00', 2, 0, false),
	('9221d957-95a2-4aa4-9684-ea0f8e3bc03a', '2026-05-29', '13:30:00', '14:00:00', 2, 0, false),
	('5f328d64-0901-47a7-a188-c2771cec7d35', '2026-05-21', '00:30:00', '01:00:00', 2, 0, false),
	('105a791e-ffaa-4bd6-9d70-91cf3fdb127d', '2026-05-30', '13:30:00', '14:00:00', 2, 0, false),
	('635deb01-5d39-4adf-8161-84dce6ff4fa3', '2026-05-30', '14:00:00', '14:30:00', 2, 0, false),
	('3d32fa88-0eb1-4624-8d3e-845611353012', '2026-05-18', '13:00:00', '13:30:00', 2, 0, false),
	('a1a40c09-1479-4e59-8ac9-dd355bf2ba76', '2026-05-18', '13:30:00', '14:00:00', 2, 0, false),
	('cc9e0b53-3eb0-456f-9cd9-b9141beae94f', '2026-05-18', '14:00:00', '14:30:00', 2, 0, false),
	('610d8c3f-f9b5-4573-98b0-eb9cbfee1e64', '2026-05-18', '14:30:00', '15:00:00', 2, 0, false),
	('e5787e23-d741-422d-9402-8080f40a00a4', '2026-05-18', '15:00:00', '15:30:00', 2, 0, false),
	('4ea61875-943b-4009-a149-d6d2f770f261', '2026-05-19', '15:30:00', '16:00:00', 2, 0, false),
	('fc1f231a-58da-4823-8bfc-2885da1c7398', '2026-05-19', '16:00:00', '16:30:00', 2, 0, false),
	('b9f1e9ad-ff08-4034-8543-eb88a59563fe', '2026-05-19', '16:30:00', '17:00:00', 2, 0, false),
	('d08f4961-b994-403a-89e3-9b0ddcca2e78', '2026-05-19', '17:00:00', '17:30:00', 2, 0, false),
	('aafc0c88-8c77-4b88-a35b-a6815e414ac5', '2026-05-19', '18:00:00', '18:30:00', 2, 0, false),
	('f5829107-84e1-47fc-8559-224c85b5b502', '2026-05-19', '19:00:00', '19:30:00', 2, 0, false),
	('50086493-d60f-42b3-bae3-563dae72dcce', '2026-05-19', '19:30:00', '20:00:00', 2, 0, false),
	('17810302-721c-4206-881e-bb1106f36f57', '2026-05-19', '20:00:00', '20:30:00', 2, 0, false),
	('5210468c-1ef2-4343-8fc5-4c91c3a07888', '2026-05-19', '20:30:00', '21:00:00', 2, 0, false),
	('d088efb8-0d59-4df0-85c6-bc261b5636e0', '2026-05-02', '19:30:00', '20:00:00', 2, 0, false),
	('05c20e05-ab21-40e2-8a42-6fdf8bc220fa', '2026-05-09', '09:30:00', '10:00:00', 2, 0, false),
	('8437fc5c-82d8-4a47-8ce8-00ab0efc3228', '2026-05-03', '17:30:00', '18:00:00', 2, 0, false),
	('c13d5829-46fd-4723-a3dc-21fcb5ac3afd', '2026-05-03', '18:00:00', '18:30:00', 2, 0, false),
	('5dc64733-d13f-4643-9d90-b52f8c376939', '2026-05-03', '18:30:00', '19:00:00', 2, 0, false),
	('5c6a7282-ee6c-47ac-a270-59c1ca2141e1', '2026-05-03', '19:00:00', '19:30:00', 2, 0, false),
	('e7462a10-df60-4ffd-9ccc-01a53696d7d1', '2026-05-03', '19:30:00', '20:00:00', 2, 0, false),
	('bf7766fe-b435-4552-b51a-73fc8450e5db', '2026-05-09', '10:30:00', '11:00:00', 2, 0, false),
	('fd7b097f-d640-4a37-856a-0df102510ec2', '2026-05-27', '00:00:00', '00:30:00', 2, 0, false),
	('fc09a905-3871-4389-8144-211146e3aa82', '2026-05-27', '00:30:00', '01:00:00', 2, 0, false),
	('2d72ce4b-c9f4-4af8-9703-4fa4ef2ef212', '2026-05-27', '01:00:00', '01:30:00', 2, 0, false),
	('994fac24-d4a8-4555-b257-e26bcd8c527e', '2026-05-27', '01:30:00', '02:00:00', 2, 0, false),
	('cf96fcc9-c70e-42e7-9f06-062cabac1260', '2026-05-27', '02:00:00', '02:30:00', 2, 0, false),
	('b5542ac5-0bf7-42da-aef4-709a1c3fd9db', '2026-05-27', '02:30:00', '03:00:00', 2, 0, false),
	('c9bda400-6973-49f4-94c7-67d58c83b63e', '2026-05-27', '03:00:00', '03:30:00', 2, 0, false),
	('6220fd30-c216-48ee-9a63-8e092d669113', '2026-05-27', '03:30:00', '04:00:00', 2, 0, false),
	('841ca1eb-a947-4e3e-a549-388daac02692', '2026-05-27', '08:00:00', '08:30:00', 2, 0, false),
	('7fa70f40-f993-48ba-af7e-4b30454072ef', '2026-07-12', '22:00:00', '22:30:00', 2, 0, false),
	('66feea8c-d4a6-440e-8c8c-c656655c90e2', '2026-07-12', '22:30:00', '23:00:00', 2, 0, false),
	('2a260102-73bf-45df-8ab1-03b4d59975b4', '2026-07-12', '13:00:00', '13:30:00', 2, 1, false),
	('9c1948f9-f762-4df4-a5dd-22478e15cb69', '2026-07-29', '13:00:00', '13:30:00', 2, 0, false),
	('b17f14a4-ea17-45f7-a0dc-b00aec3e8436', '2026-07-29', '13:30:00', '14:00:00', 2, 0, false),
	('5b1eafb7-11ba-41cd-990d-3f3e899f0a22', '2026-07-29', '14:30:00', '15:00:00', 2, 0, false),
	('ddd6bc7f-136f-474d-81c5-ffdc7a8deec4', '2026-06-09', '13:30:00', '14:00:00', 2, 1, false),
	('ac32b8ec-d182-4d49-b329-e0db14412bbd', '2026-07-01', '08:00:00', '08:30:00', 2, 0, false),
	('1ceea168-e27b-4c4c-92c8-7379ec453795', '2026-07-01', '08:30:00', '09:00:00', 2, 0, false),
	('1156e3a2-e0dd-4a40-a1b0-2f5147bb8409', '2026-07-01', '09:00:00', '09:30:00', 2, 0, false),
	('9d68efd0-2c7c-4b8e-8854-8a8022e39556', '2026-07-01', '09:30:00', '10:00:00', 2, 0, false),
	('5de9d0fb-65dc-48bd-8543-b15f7051b631', '2026-07-01', '10:00:00', '10:30:00', 2, 0, false),
	('8cfa5917-0808-4952-8249-26441f045a66', '2026-07-01', '10:30:00', '11:00:00', 2, 0, false),
	('bae04dc0-ae3e-40d2-b02a-d7a3e7936216', '2026-07-01', '11:00:00', '11:30:00', 2, 0, false),
	('4d87c488-8ad9-401c-b35c-02ad4a6f8390', '2026-07-01', '11:30:00', '12:00:00', 2, 0, false),
	('5a8b466d-1726-4471-b121-cdfb8e584d61', '2026-07-01', '12:00:00', '12:30:00', 2, 0, false),
	('49289c6c-8869-414d-bcb9-aceb37446fcb', '2026-07-01', '12:30:00', '13:00:00', 2, 0, false),
	('d6993318-452f-4138-bfe8-135af595325f', '2026-07-01', '13:00:00', '13:30:00', 2, 0, false),
	('28678188-739d-4b88-bdcf-222e61e70744', '2026-07-01', '13:30:00', '14:00:00', 2, 0, false),
	('158bfbe3-fb31-44a5-ab55-d49a7eb3386f', '2026-07-01', '14:00:00', '14:30:00', 2, 0, false),
	('49d652ea-ac14-4f05-b1d2-e1bd48f6d02c', '2026-07-01', '14:30:00', '15:00:00', 2, 0, false),
	('df7d0db2-2717-4d3d-96cf-2c8cca617fb1', '2026-07-01', '15:00:00', '15:30:00', 2, 0, false),
	('c9638642-ed7d-4b79-863e-39b53aa5abee', '2026-07-01', '15:30:00', '16:00:00', 2, 0, false),
	('1ae1a28c-cde2-4712-bf1d-04c1923b1252', '2026-07-01', '16:00:00', '16:30:00', 2, 0, false),
	('4338d5fc-dffd-4738-ac69-b3f2aa3d15a9', '2026-07-01', '16:30:00', '17:00:00', 2, 0, false),
	('137c679d-74a2-4900-a505-54bfa3b78be4', '2026-07-01', '17:00:00', '17:30:00', 2, 0, false),
	('64aa1ca2-5e04-4407-ad88-91a623892e74', '2026-07-01', '17:30:00', '18:00:00', 2, 0, false),
	('8ef0e0e2-f583-4b84-b9b1-ff530497c7b8', '2026-07-01', '18:00:00', '18:30:00', 2, 0, false),
	('9b89f8bd-60b8-4dbd-91de-51ab94c03ac0', '2026-07-01', '18:30:00', '19:00:00', 2, 0, false),
	('4e34699d-e477-479d-aef0-5f060c3d7287', '2026-07-01', '19:00:00', '19:30:00', 2, 0, false),
	('e1ac09a0-23de-4748-88ed-cbd3d0e80023', '2026-07-01', '19:30:00', '20:00:00', 2, 0, false),
	('75543ed2-cbcb-4732-bfa3-57c53b12d606', '2026-07-01', '20:00:00', '20:30:00', 2, 0, false),
	('70f603d8-d82e-4e62-b585-851fdecf5c55', '2026-07-01', '20:30:00', '21:00:00', 2, 0, false),
	('fe42bede-9d17-4818-a7bb-dc8b9b350fad', '2026-07-01', '21:00:00', '21:30:00', 2, 0, false),
	('af0d5199-5cb0-4a07-9d73-ad2b384394f8', '2026-07-01', '21:30:00', '22:00:00', 2, 0, false),
	('f8c106c4-a903-44d1-897e-bbcbc957affd', '2026-07-01', '22:00:00', '22:30:00', 2, 0, false),
	('54ed2cc6-113a-4003-b42f-7fdbc3b19742', '2026-07-01', '22:30:00', '23:00:00', 2, 0, false),
	('16b48e1a-4d1c-4677-95bc-495c79e3b68f', '2026-07-08', '08:00:00', '08:30:00', 2, 0, false),
	('07433be1-17cf-4684-a364-cf3613d71529', '2026-07-08', '08:30:00', '09:00:00', 2, 0, false),
	('f525a4cf-e998-4bd5-b925-0d6afaf14eb9', '2026-07-08', '09:00:00', '09:30:00', 2, 0, false),
	('d8df803d-c9c9-4793-9b42-e021d276121e', '2026-07-08', '09:30:00', '10:00:00', 2, 0, false),
	('ad0738ed-721d-40bf-89f8-27639cb138bf', '2026-07-08', '10:00:00', '10:30:00', 2, 0, false),
	('70a43271-deb7-43b5-b088-f940da4752f6', '2026-07-08', '10:30:00', '11:00:00', 2, 0, false),
	('8776cfff-9014-4671-bf75-06dbb55f0627', '2026-07-08', '11:00:00', '11:30:00', 2, 0, false),
	('c2cc6a63-5b5c-4b93-a074-1d92f924acac', '2026-07-08', '11:30:00', '12:00:00', 2, 0, false),
	('1f6ea745-5b7d-44c3-a1d7-0401c5bf064b', '2026-07-08', '12:00:00', '12:30:00', 2, 0, false),
	('54b9e709-f4aa-4e3e-86e8-5c6c663b2ede', '2026-07-08', '12:30:00', '13:00:00', 2, 0, false),
	('07337b4e-2431-42c9-ba83-4a6151956d40', '2026-07-08', '13:00:00', '13:30:00', 2, 0, false),
	('1d1ce55b-404a-4bcf-a513-82155cf8bde6', '2026-07-08', '13:30:00', '14:00:00', 2, 0, false),
	('a7a8dae9-d108-4e47-8fbe-3d89045a7085', '2026-07-08', '14:00:00', '14:30:00', 2, 0, false),
	('9416a653-9815-4d03-92eb-b4b27a2e7912', '2026-07-08', '14:30:00', '15:00:00', 2, 0, false),
	('24a018a1-502f-4982-b08e-fa029029ce1a', '2026-07-08', '15:00:00', '15:30:00', 2, 0, false),
	('f9eb70b2-27a1-4473-97ad-66db8e9a3dc9', '2026-07-08', '15:30:00', '16:00:00', 2, 0, false),
	('96637dda-0ad5-4431-944f-c88617ebaa42', '2026-07-08', '16:00:00', '16:30:00', 2, 0, false),
	('e054cddd-0fe1-4783-9e35-82d7ff5e8fd4', '2026-07-08', '16:30:00', '17:00:00', 2, 0, false),
	('d55c5476-bb29-474d-9cf6-bf65ee87379d', '2026-07-08', '17:00:00', '17:30:00', 2, 0, false),
	('96131f6b-09b6-4e77-880d-d2a48e472a5c', '2026-07-08', '17:30:00', '18:00:00', 2, 0, false),
	('0bb4396b-6cf5-42fc-a35e-04402c25f922', '2026-07-08', '18:00:00', '18:30:00', 2, 0, false),
	('da89ed22-929f-47ff-8dad-146348f72eb1', '2026-07-08', '18:30:00', '19:00:00', 2, 0, false),
	('b934f8cb-f566-4f1c-a51c-42b4433664bb', '2026-07-08', '19:00:00', '19:30:00', 2, 0, false),
	('05819e5c-f5c9-4fea-a2c3-1cdc6e930727', '2026-05-27', '08:30:00', '09:00:00', 2, 0, false),
	('620d338b-aa4a-4c98-be64-a319f42e56ce', '2026-05-27', '09:00:00', '09:30:00', 2, 0, false),
	('353878f2-a3b2-462b-9be6-4208831f4a5b', '2026-05-19', '21:00:00', '21:30:00', 2, 0, false),
	('66c3fd30-ba1f-4ee9-bf02-ac6c536a30f5', '2026-05-19', '22:00:00', '22:30:00', 2, 0, false),
	('31c6660b-feae-47e7-8217-966d5d9011bc', '2026-05-19', '22:30:00', '23:00:00', 2, 0, false),
	('2af2ae08-55bf-46cc-be44-69a539483fb8', '2026-05-19', '23:00:00', '23:30:00', 2, 0, false),
	('04da97f8-d9d3-420c-a1c4-865aa32982d9', '2026-05-19', '01:00:00', '01:30:00', 2, 0, false),
	('d48b1482-0041-42c4-b24e-768685680243', '2026-05-20', '01:00:00', '01:30:00', 2, 0, false),
	('8dda66d1-d0c2-48c3-a1ec-5128f820a1d8', '2026-05-20', '01:30:00', '02:00:00', 2, 0, false),
	('7337a5cd-7522-4cfc-a0ae-2dd17d5e38c5', '2026-05-26', '12:30:00', '13:00:00', 2, 0, false),
	('fab711e3-8416-4e40-88b5-d37a83a5ed8b', '2026-06-05', '00:00:00', '00:30:00', 2, 0, false),
	('0f917926-0e79-45ba-8208-7c0890857f41', '2026-06-05', '22:00:00', '22:30:00', 2, 0, false),
	('cfd1a637-5e76-4c45-a98f-837795c5853a', '2026-06-05', '22:30:00', '23:00:00', 2, 0, false),
	('0d147e4a-a1bb-4493-bb9e-68838419c8bc', '2026-06-05', '23:00:00', '23:30:00', 2, 0, false),
	('22097827-9e36-4db7-9cec-ad0256b35df3', '2026-05-30', '14:30:00', '15:00:00', 2, 0, false),
	('286c3b3b-e286-466b-a6e4-1167b0a9404c', '2026-05-30', '15:00:00', '15:30:00', 2, 0, false),
	('73f65905-79dc-40d0-bed6-314ce4c0828b', '2026-05-30', '15:30:00', '16:00:00', 2, 0, false),
	('1dd59188-52c9-4b39-b89d-0d84a3faecc4', '2026-05-30', '16:00:00', '16:30:00', 2, 0, false),
	('52406115-bc00-402d-9475-61155f524dc8', '2026-05-30', '16:30:00', '17:00:00', 2, 0, false),
	('33b06a4d-d9f7-4dd0-93d9-0c1f5751b4f2', '2026-05-30', '19:30:00', '20:00:00', 2, 0, false),
	('8b494629-1093-44d3-9227-1e79c0061347', '2026-05-30', '20:30:00', '21:00:00', 2, 0, false),
	('5102532f-0c1e-4032-9cb1-79759c04b945', '2026-05-30', '21:00:00', '21:30:00', 2, 0, false),
	('623e245a-2bdc-4e26-9eeb-7c1b4cef5acb', '2026-05-30', '21:30:00', '22:00:00', 2, 0, false),
	('0f11f64e-714c-4e30-abff-22ddc1269078', '2026-05-18', '02:00:00', '02:30:00', 2, 0, false),
	('69d009b0-b127-49c2-bb28-75794fe22b9e', '2026-05-18', '02:30:00', '03:00:00', 2, 0, false),
	('b1ccf18e-8480-48be-8a6a-8712514b5dde', '2026-05-18', '03:00:00', '03:30:00', 2, 0, false),
	('c8c302d8-c8f3-4dd4-a0dc-c0d389f8922b', '2026-05-18', '03:30:00', '04:00:00', 2, 0, false),
	('1ad2d3fb-f959-4c00-ac78-3a59b20c508c', '2026-05-18', '08:00:00', '08:30:00', 2, 0, false),
	('58622ad3-6a38-4d95-bf20-b301ae864c18', '2026-05-18', '08:30:00', '09:00:00', 2, 0, false),
	('9b6656ce-0d9c-42f3-a045-91bc72506dbb', '2026-05-18', '09:00:00', '09:30:00', 2, 0, false),
	('6011509d-05f4-4581-b899-f368eb7dcf2e', '2026-05-18', '09:30:00', '10:00:00', 2, 0, false),
	('4118b750-f720-4bc0-a505-cd0a22a98f8d', '2026-05-18', '10:00:00', '10:30:00', 2, 0, false),
	('67d8bfc5-9181-4969-b0dd-0eb84745a278', '2026-05-18', '10:30:00', '11:00:00', 2, 0, false),
	('57c52a9b-27fa-4f5b-9b8b-0a67b1e28059', '2026-05-18', '11:00:00', '11:30:00', 2, 0, false),
	('c4266055-8f7b-4bde-8874-dbfccdc03725', '2026-05-18', '11:30:00', '12:00:00', 2, 0, false),
	('b76db878-e1ca-4234-9a1c-a1561ea77466', '2026-05-18', '12:00:00', '12:30:00', 2, 0, false),
	('a43d7282-0742-410b-b46e-d18ea9d3fae8', '2026-05-18', '12:30:00', '13:00:00', 2, 0, false),
	('775ff577-b644-404d-98dd-6008027afb46', '2026-07-08', '19:30:00', '20:00:00', 2, 0, false),
	('5959b41c-5331-4018-a93b-7b365caa5b55', '2026-07-08', '20:00:00', '20:30:00', 2, 0, false),
	('9328c098-9af6-48ea-b718-646a983a6fc6', '2026-07-29', '15:00:00', '15:30:00', 2, 0, false),
	('d87888b5-ec1e-4df9-9f3d-5dc921f9ef92', '2026-07-29', '15:30:00', '16:00:00', 2, 0, false),
	('b23bf3f3-69ff-41a4-98fe-421124b8f68e', '2026-07-29', '16:00:00', '16:30:00', 2, 0, false),
	('9c08da9d-a96e-45da-bc12-75f6caa1b2e0', '2026-07-29', '16:30:00', '17:00:00', 2, 0, false),
	('9a94c801-9cb8-43a7-8c73-1991a525d740', '2026-06-23', '08:00:00', '08:30:00', 2, 0, false),
	('09c16bce-4ca9-4c39-ae69-fef16b9c422a', '2026-06-23', '08:30:00', '09:00:00', 2, 0, false),
	('7ff72d84-6462-43c7-bbea-b8abd3c8dcd8', '2026-06-23', '09:00:00', '09:30:00', 2, 0, false),
	('5749d75c-acb3-4381-82c7-af36ad042dba', '2026-06-23', '09:30:00', '10:00:00', 2, 0, false),
	('472b79aa-ad47-4a7a-bbaa-24d6f4090d5a', '2026-06-23', '10:00:00', '10:30:00', 2, 0, false),
	('df600109-2235-4ce3-b81e-6dc3f3d01541', '2026-06-23', '10:30:00', '11:00:00', 2, 0, false),
	('c55e0251-1f59-456d-962e-735152c1ff44', '2026-06-23', '11:00:00', '11:30:00', 2, 0, false),
	('fbf341a9-ba5e-4b2e-937e-9fd186f7eb7e', '2026-06-23', '11:30:00', '12:00:00', 2, 0, false),
	('733c625a-6930-4d7f-a39d-e63b5316a59d', '2026-06-23', '12:00:00', '12:30:00', 2, 0, false),
	('0ef22936-8d58-4a87-b532-cc8c46c6d3e1', '2026-06-23', '12:30:00', '13:00:00', 2, 0, false),
	('57fe1778-434d-4487-ba17-6d8cd2021020', '2026-06-23', '13:00:00', '13:30:00', 2, 0, false),
	('0e7862ba-1529-4133-9c6d-757446cdc607', '2026-06-23', '13:30:00', '14:00:00', 2, 0, false),
	('aa518661-8eac-46aa-a337-e5573be91673', '2026-06-23', '14:00:00', '14:30:00', 2, 0, false),
	('ad47c53d-c931-412b-9c46-d48d34679f8f', '2026-06-23', '14:30:00', '15:00:00', 2, 0, false),
	('3f549971-087b-4441-92fc-2fd0adee5232', '2026-06-23', '15:00:00', '15:30:00', 2, 0, false),
	('35849130-a9e3-4a16-8d98-cbd037348b32', '2026-06-23', '15:30:00', '16:00:00', 2, 0, false),
	('617605da-a273-464f-811c-44f822fa9e48', '2026-06-23', '16:00:00', '16:30:00', 2, 0, false),
	('c7f595d5-d0ea-4edb-8d59-1727d7ad1577', '2026-06-23', '16:30:00', '17:00:00', 2, 0, false),
	('2c22c4c5-d544-4a04-95c1-8818871a121f', '2026-06-23', '17:00:00', '17:30:00', 2, 0, false),
	('7fa66ce7-9b93-4be0-8af0-aaa38da09055', '2026-06-23', '17:30:00', '18:00:00', 2, 0, false),
	('b27eae42-080c-4f5e-83c5-c71ea22eeba9', '2026-06-23', '18:00:00', '18:30:00', 2, 0, false),
	('7bfa6da1-ebb2-4177-8a7f-30e7ecb5d9a6', '2026-06-23', '18:30:00', '19:00:00', 2, 0, false),
	('24b1ccdc-5227-4b8f-9424-ef7f1f320a6f', '2026-06-23', '19:00:00', '19:30:00', 2, 0, false),
	('06e03eb1-c683-4a10-a6e8-a40636ea720a', '2026-06-23', '19:30:00', '20:00:00', 2, 0, false),
	('a64af021-15a2-4721-9201-8129bbcc5636', '2026-06-23', '20:00:00', '20:30:00', 2, 0, false),
	('a3a9c6f7-1b25-4c72-9778-4187cf7239a1', '2026-06-23', '20:30:00', '21:00:00', 2, 0, false),
	('ab7cb2b6-e8ed-40c4-9073-e3cf01e1af00', '2026-06-23', '21:00:00', '21:30:00', 2, 0, false),
	('ac7bc180-4fae-4fa5-8edd-43a652ebd79d', '2026-06-23', '21:30:00', '22:00:00', 2, 0, false),
	('6b5b766d-2113-4d3a-a7e6-71d736f4b884', '2026-06-23', '22:00:00', '22:30:00', 2, 0, false),
	('4737edbd-aa44-4974-a1c3-e06fb49dfa01', '2026-06-23', '22:30:00', '23:00:00', 2, 0, false),
	('70e346a7-2291-4245-9116-b6269ed92506', '2026-06-24', '08:00:00', '08:30:00', 2, 0, false),
	('7d8719cf-fdc4-4f0e-97e6-1ed59af40ae9', '2026-06-24', '08:30:00', '09:00:00', 2, 0, false),
	('cc6c2572-c3f8-4051-ae49-587ac2e25731', '2026-06-24', '09:00:00', '09:30:00', 2, 0, false),
	('5332a91b-793d-4a55-9456-6ebb6aa49219', '2026-06-24', '09:30:00', '10:00:00', 2, 0, false),
	('0f74e5cf-b78f-437e-bfb4-22880fa3fc99', '2026-06-24', '10:00:00', '10:30:00', 2, 0, false),
	('4b589295-3bd0-4b1b-8e7d-d4322077fa89', '2026-06-24', '10:30:00', '11:00:00', 2, 0, false),
	('3cff9112-3281-4ce5-b276-80397f43d2c0', '2026-06-24', '11:00:00', '11:30:00', 2, 0, false),
	('90ce593d-07ae-4440-8de2-ef764f606782', '2026-06-24', '11:30:00', '12:00:00', 2, 0, false),
	('fda0638f-8aef-4084-b79d-da229ebbc314', '2026-06-24', '12:00:00', '12:30:00', 2, 0, false),
	('8fdbe4fd-542f-4e3b-ae5b-c76a9249937a', '2026-06-24', '12:30:00', '13:00:00', 2, 0, false),
	('4fd9e846-c3a1-4c13-8974-77a2f438fcba', '2026-06-24', '13:00:00', '13:30:00', 2, 0, false),
	('a8650625-2ee6-40e3-a022-4992fe5f0e5a', '2026-06-24', '13:30:00', '14:00:00', 2, 0, false),
	('d0549b67-8773-4cac-a260-dd4583c38da9', '2026-06-24', '14:00:00', '14:30:00', 2, 0, false),
	('be21846a-32bb-497f-b40f-45fee3771c7c', '2026-06-24', '14:30:00', '15:00:00', 2, 0, false),
	('47ae8a96-3008-48f0-b441-8cf48be0cf5d', '2026-06-24', '15:00:00', '15:30:00', 2, 0, false),
	('620b2cad-1522-40a1-b6fd-a7d7522a7802', '2026-06-24', '15:30:00', '16:00:00', 2, 0, false),
	('463ebdfa-2bb3-407a-b7d7-f1f0a308e541', '2026-06-24', '16:00:00', '16:30:00', 2, 0, false),
	('40870535-13d2-40de-bcd4-400c4d5f683b', '2026-06-24', '16:30:00', '17:00:00', 2, 0, false),
	('24c0c8ec-922d-40a7-bacf-b34daf1a1df1', '2026-06-24', '17:00:00', '17:30:00', 2, 0, false),
	('6f83e795-e4b4-4738-9529-9937c01e2ee0', '2026-06-24', '17:30:00', '18:00:00', 2, 0, false),
	('6ccb759b-6b23-453d-8a95-a2aa4ace094c', '2026-06-24', '18:00:00', '18:30:00', 2, 0, false),
	('5d03c1f5-7af5-44b2-9787-bde23ae0e54e', '2026-06-24', '18:30:00', '19:00:00', 2, 0, false),
	('4bf54b01-ac4f-45d4-8bde-9190d2a34bf8', '2026-06-24', '19:00:00', '19:30:00', 2, 0, false),
	('bd495f54-dd99-4c52-86b5-d4ff80475648', '2026-06-24', '19:30:00', '20:00:00', 2, 0, false),
	('32e140df-5f88-41f4-98d8-57ba70fe7f0e', '2026-06-24', '20:00:00', '20:30:00', 2, 0, false),
	('74ac905c-c6e0-44e1-bcb7-1114aaa8bf20', '2026-06-24', '20:30:00', '21:00:00', 2, 0, false),
	('6d662303-74fa-433c-bb3e-4017c88494eb', '2026-06-24', '21:00:00', '21:30:00', 2, 0, false),
	('acc1a90a-827c-4591-bd87-17d07fd32e3b', '2026-05-12', '22:00:00', '22:30:00', 2, 0, false),
	('acc30f1f-b828-4b0c-86aa-d5efac691270', '2026-05-12', '22:30:00', '23:00:00', 2, 0, false),
	('463989d6-69df-47a6-951a-0fd6fcf8c03b', '2026-05-06', '12:00:00', '12:30:00', 2, 0, false),
	('d4f9a0de-3ec8-47bf-af98-0de6fccb44d0', '2026-05-06', '12:30:00', '13:00:00', 2, 0, false),
	('8442faad-75df-49c0-89ed-71f45e10b48d', '2026-05-06', '13:00:00', '13:30:00', 2, 0, false),
	('635c2da5-7085-45e7-bdc4-ee87d46194ab', '2026-05-06', '13:30:00', '14:00:00', 2, 0, false),
	('41eba35b-6973-4b00-a97f-5ebfc5cbd742', '2026-05-06', '14:00:00', '14:30:00', 2, 0, false),
	('4d4a5c1e-485d-4317-a2f7-0699ff526bdb', '2026-05-06', '14:30:00', '15:00:00', 2, 0, false),
	('75fed10e-6faa-4388-8e66-bc1797083cbd', '2026-04-29', '19:30:00', '20:00:00', 2, 0, false),
	('44f89f6c-4e77-4740-9fdd-1ee98904a267', '2026-05-20', '02:00:00', '02:30:00', 2, 0, false),
	('da778338-8af0-4c3f-abac-8db275bbb2a3', '2026-05-20', '02:30:00', '03:00:00', 2, 0, false),
	('c7fbf808-878f-48ff-af00-90b412c1b38d', '2026-05-20', '03:00:00', '03:30:00', 2, 0, false),
	('3fdfb5b5-0681-49b3-9eb2-79be494bed8d', '2026-05-20', '03:30:00', '04:00:00', 2, 0, false),
	('6815267f-0537-4423-8caa-49e5c2488b1d', '2026-05-20', '08:00:00', '08:30:00', 2, 0, false),
	('505320f4-809e-41c0-a980-a97ed32deaab', '2026-05-20', '08:30:00', '09:00:00', 2, 0, false),
	('d39a2057-87b8-4c13-9614-726a165f6c62', '2026-05-20', '09:00:00', '09:30:00', 2, 0, false),
	('e960c942-6b1a-49d0-91b9-5873f8d1e789', '2026-05-20', '09:30:00', '10:00:00', 2, 0, false),
	('fac593b8-1ebf-434a-ab8f-7322af2886e5', '2026-05-20', '10:00:00', '10:30:00', 2, 0, false),
	('d8b0d894-cfe5-4d00-a7bc-fb146517c0dc', '2026-05-20', '00:30:00', '01:00:00', 2, 0, false),
	('b47d81df-9cc5-4653-b7a6-9a54cc402773', '2026-04-28', '18:00:00', '18:30:00', 2, 0, false),
	('ebc9fb6c-87dd-4d79-977c-3292bbf942b5', '2026-04-28', '18:30:00', '19:00:00', 2, 0, false),
	('e5728684-78b9-4201-a882-fde9f45d80fa', '2026-04-28', '19:00:00', '19:30:00', 2, 0, false),
	('aa9ba957-7ea2-499c-9050-d5f1d8d5a562', '2026-04-28', '19:30:00', '20:00:00', 2, 0, false),
	('e01869ee-d299-4112-a63d-31ccb297ac8c', '2026-04-30', '09:00:00', '09:30:00', 2, 0, false),
	('46a4d982-8745-4519-889e-ea5a9ad08c5d', '2026-04-30', '10:00:00', '10:30:00', 2, 0, false),
	('d81fed54-a159-4bca-be20-5a04f4d4938b', '2026-04-30', '10:30:00', '11:00:00', 2, 0, false),
	('53f2dc3c-1875-43f1-adf6-1371938dcc1d', '2026-04-30', '11:00:00', '11:30:00', 2, 0, false),
	('5fad369a-7171-4d85-91a8-72238284ee93', '2026-04-30', '11:30:00', '12:00:00', 2, 0, false),
	('cfc6d535-fa35-441b-ac58-81381bebba5d', '2026-04-30', '12:00:00', '12:30:00', 2, 0, false),
	('0ecf0076-304b-45e6-9c0f-f7a8de9e8ee9', '2026-04-30', '12:30:00', '13:00:00', 2, 0, false),
	('29480101-94a5-495d-801e-4881dc79bbde', '2026-05-07', '11:00:00', '11:30:00', 2, 0, false),
	('9917e07f-67f0-4121-863a-d7fc671bacbe', '2026-05-07', '11:30:00', '12:00:00', 2, 0, false),
	('d3c39e46-fe3e-429c-8082-a373b7ff99d9', '2026-05-07', '12:00:00', '12:30:00', 2, 0, false),
	('46724ad5-f3b8-49e6-9d31-b0d338051517', '2026-06-04', '11:00:00', '11:30:00', 2, 0, false),
	('91690028-10e6-414a-b856-f6376039875d', '2026-06-24', '21:30:00', '22:00:00', 2, 0, false),
	('5801d801-63fd-487d-ae24-89422f3f9834', '2026-06-24', '22:00:00', '22:30:00', 2, 0, false),
	('2ffeb744-6bad-457f-bf4b-5d16c398740a', '2026-07-29', '17:00:00', '17:30:00', 2, 0, false),
	('b98ef360-4d1a-4569-9c59-966153283f70', '2026-06-24', '22:30:00', '23:00:00', 2, 0, false),
	('7a5aa641-4c02-4de7-853c-a9a58bad39fd', '2026-07-02', '08:00:00', '08:30:00', 2, 0, false),
	('2b7ba276-879b-4769-a8b5-495543454929', '2026-07-02', '08:30:00', '09:00:00', 2, 0, false),
	('d5e166d0-d9a9-48ce-b4b9-63ee1a65cad7', '2026-07-02', '09:00:00', '09:30:00', 2, 0, false),
	('940b124a-05d9-483c-b8c1-7d1672a5ea4a', '2026-07-02', '10:00:00', '10:30:00', 2, 0, false),
	('87c792e0-acbb-4305-bce3-c35ff5fa4862', '2026-07-02', '10:30:00', '11:00:00', 2, 0, false),
	('1dc12be9-613a-4d81-a901-98f2fc8bd000', '2026-07-02', '11:00:00', '11:30:00', 2, 0, false),
	('e5777e34-f540-4ae3-8395-9f0d450070ed', '2026-07-02', '11:30:00', '12:00:00', 2, 0, false),
	('725fa9e8-f8a3-41fe-b853-f2af7af82230', '2026-07-02', '12:00:00', '12:30:00', 2, 0, false),
	('122688bd-0625-42c9-afba-81be1e6dd03c', '2026-07-02', '12:30:00', '13:00:00', 2, 0, false),
	('ac9d960d-4f49-4a12-bfe9-902984a606aa', '2026-07-02', '14:00:00', '14:30:00', 2, 0, false),
	('4d8e0e5e-f4de-47f7-b5e5-6106e5283f4a', '2026-07-02', '15:00:00', '15:30:00', 2, 0, false),
	('59ca64f4-26c5-4433-bbad-bec09d759db3', '2026-07-02', '15:30:00', '16:00:00', 2, 0, false),
	('fdf60335-ad32-4d76-a1a0-74c23417c739', '2026-07-02', '16:00:00', '16:30:00', 2, 0, false),
	('b77d1eb9-5e02-4f9b-9420-a2fa49ede322', '2026-07-02', '16:30:00', '17:00:00', 2, 0, false),
	('a6aa784b-5d6c-4fc8-8ec8-615091e1677b', '2026-07-02', '17:00:00', '17:30:00', 2, 0, false),
	('7276d76a-a11d-42f7-b24b-9a5dd2df0c3d', '2026-07-02', '17:30:00', '18:00:00', 2, 0, false),
	('25549fc1-0b29-4760-b51a-be87518d2550', '2026-07-02', '18:00:00', '18:30:00', 2, 0, false),
	('350e899f-510b-41a3-b4e8-fa14106b0061', '2026-07-02', '18:30:00', '19:00:00', 2, 0, false),
	('3374a16b-4718-425d-931f-b02e9b78ffdd', '2026-07-02', '19:00:00', '19:30:00', 2, 0, false),
	('644e3a79-8dad-4575-ac25-919be8d4c792', '2026-07-02', '19:30:00', '20:00:00', 2, 0, false),
	('f8729c08-7ec6-49f6-8512-f33d5eda7515', '2026-07-02', '20:00:00', '20:30:00', 2, 0, false),
	('2fa82b41-680f-4145-b7e9-eb7c06b53bfb', '2026-07-02', '20:30:00', '21:00:00', 2, 0, false),
	('35cfaaf9-23a4-4b23-a206-6b88809002fa', '2026-07-02', '21:00:00', '21:30:00', 2, 0, false),
	('e8d47a4e-d4c8-4a96-aa91-97e02abc8fce', '2026-07-02', '21:30:00', '22:00:00', 2, 0, false),
	('2ed3c86a-9b5a-4e8b-82cd-8da3bac0eb95', '2026-07-02', '22:00:00', '22:30:00', 2, 0, false),
	('0ad7fb7b-cb8b-4131-94fc-a8ba6684eeb2', '2026-07-02', '22:30:00', '23:00:00', 2, 0, false),
	('3c4e1a69-ed9b-4418-9ca9-e119dac8f25c', '2026-07-08', '20:30:00', '21:00:00', 2, 0, false),
	('bcba6809-083a-4650-a4b3-ab6919a8a5cc', '2026-07-08', '21:00:00', '21:30:00', 2, 0, false),
	('60a12518-271d-4534-b129-77c8a3a39a6c', '2026-07-08', '21:30:00', '22:00:00', 2, 0, false),
	('6111edb8-af0e-49bd-a5ac-013b13508d3f', '2026-07-08', '22:00:00', '22:30:00', 2, 0, false),
	('9e8f5bb2-5b4b-47fd-a5a3-5601a59c30fd', '2026-07-08', '22:30:00', '23:00:00', 2, 0, false),
	('27745ee9-3e1a-41aa-b730-5da7e760be04', '2026-06-28', '20:30:00', '21:00:00', 2, 1, false),
	('66cb8166-8a85-4db8-a087-0d87533397d3', '2026-07-13', '10:30:00', '11:00:00', 2, 0, false),
	('70b8c33f-e1ac-421f-a64d-1829392c597e', '2026-07-13', '11:00:00', '11:30:00', 2, 0, false),
	('b31730e9-12c7-47b1-8b6d-a4074f7d8478', '2026-07-13', '11:30:00', '12:00:00', 2, 0, false),
	('195bd485-e211-44b7-9dbd-e9fd8a99888c', '2026-07-13', '12:00:00', '12:30:00', 2, 0, false),
	('e18dfcba-9f29-43d6-84a9-6d6a8e760e36', '2026-07-13', '13:00:00', '13:30:00', 2, 0, false),
	('8d473679-4862-4ba3-b93b-217cf882074d', '2026-07-13', '13:30:00', '14:00:00', 2, 0, false),
	('bf0fe50c-b544-494d-a01e-032c74d112b3', '2026-07-13', '14:00:00', '14:30:00', 2, 0, false),
	('f7dda1b9-56d8-4fa7-9efb-a4b43d683326', '2026-07-13', '14:30:00', '15:00:00', 2, 0, false),
	('60a58e10-eab0-4be1-8c19-dc6fb525ddc7', '2026-07-13', '15:00:00', '15:30:00', 2, 0, false),
	('f9f4532d-8328-45fa-900f-6d45cceda4ee', '2026-07-13', '15:30:00', '16:00:00', 2, 0, false),
	('48224060-79ab-4f7c-b75f-38cbe8376a98', '2026-07-13', '16:30:00', '17:00:00', 2, 0, false),
	('41ace9ea-3cf1-40c9-9f41-8e2048816bd0', '2026-07-13', '17:00:00', '17:30:00', 2, 0, false),
	('099dae77-5577-4b04-abce-a779c85d2f4b', '2026-07-13', '17:30:00', '18:00:00', 2, 0, false),
	('b20e6a9b-8c05-46c1-a34d-766c04e10b05', '2026-07-13', '18:00:00', '18:30:00', 2, 0, false),
	('51134890-78f5-4f09-962b-c69413769347', '2026-07-13', '18:30:00', '19:00:00', 2, 0, false),
	('101667d7-be17-4cb7-a12d-3d213fa74b0b', '2026-07-13', '19:00:00', '19:30:00', 2, 0, false),
	('7d7d586f-718f-4063-a462-d287b8f3cff5', '2026-07-13', '19:30:00', '20:00:00', 2, 0, false),
	('9d015d49-5c79-4b96-ab36-36dc52f33b06', '2026-07-13', '20:00:00', '20:30:00', 2, 0, false),
	('7b299527-e418-42b2-9abd-f8762f90f2d1', '2026-07-13', '20:30:00', '21:00:00', 2, 0, false),
	('8bfca812-788b-4229-8ad5-2a9668f8e545', '2026-07-13', '21:00:00', '21:30:00', 2, 0, false),
	('eb0a3d7d-b104-45bd-b81c-7c32966606bc', '2026-07-13', '21:30:00', '22:00:00', 2, 0, false),
	('7a14f04b-7fda-4235-a10d-34c1a7917e6c', '2026-07-13', '22:00:00', '22:30:00', 2, 0, false),
	('6c203f07-0243-4038-bee3-f34d631f0ed8', '2026-07-13', '22:30:00', '23:00:00', 2, 0, false),
	('72da6c00-0234-4ce1-a34f-0f6a3f914e98', '2026-07-14', '08:00:00', '08:30:00', 2, 0, false),
	('ceec710f-16ab-4b50-9b64-3107dbf99f32', '2026-07-14', '08:30:00', '09:00:00', 2, 0, false),
	('0a1b83a1-f32d-4434-8931-f28a9954c540', '2026-07-14', '09:00:00', '09:30:00', 2, 0, false),
	('6b33cfd3-7d15-4734-9c06-864063940f21', '2026-07-14', '09:30:00', '10:00:00', 2, 0, false),
	('b1d292e2-d543-458d-8e76-88af984d00f0', '2026-07-14', '10:00:00', '10:30:00', 2, 0, false),
	('5727dd14-4dac-4910-b99a-17c706bf2333', '2026-07-14', '10:30:00', '11:00:00', 2, 0, false),
	('a7fa0386-8181-4377-98ab-e8a098095929', '2026-07-14', '11:00:00', '11:30:00', 2, 0, false),
	('68eb79e1-cf11-49fa-a9d5-cab11851c296', '2026-07-14', '11:30:00', '12:00:00', 2, 0, false),
	('e1a660b4-5ff0-4afd-9631-b4a720072aa3', '2026-07-14', '12:00:00', '12:30:00', 2, 0, false),
	('254c0095-d4f7-47db-9b08-e3b54711bcfa', '2026-07-14', '12:30:00', '13:00:00', 2, 0, false),
	('dcbfe4c3-e102-4165-86b3-5e0399c55492', '2026-07-14', '13:00:00', '13:30:00', 2, 0, false),
	('ac0b0326-7930-481a-b674-46dc442bd7f7', '2026-07-14', '13:30:00', '14:00:00', 2, 0, false),
	('b7227004-131f-44c1-9b17-6b3fea4a4aff', '2026-07-14', '14:00:00', '14:30:00', 2, 0, false),
	('3db10bb3-2da9-4cb9-b1ab-0e9f4c71b150', '2026-07-14', '14:30:00', '15:00:00', 2, 0, false),
	('cce3ad18-3dc9-4db9-8b45-c60383c89d0e', '2026-07-14', '15:00:00', '15:30:00', 2, 0, false),
	('95515b3e-f889-4366-a742-546a3627c226', '2026-07-14', '15:30:00', '16:00:00', 2, 0, false),
	('44a07eb4-e559-4545-be3f-65a08a780c50', '2026-07-14', '16:00:00', '16:30:00', 2, 0, false),
	('26e25950-5262-4fae-a386-ea57907832a6', '2026-07-14', '16:30:00', '17:00:00', 2, 0, false),
	('031f2467-2b8a-4a37-8b0d-f66b4d09a3d8', '2026-07-14', '17:00:00', '17:30:00', 2, 0, false),
	('6e19f678-d357-410d-b7c5-07bc1acdf741', '2026-07-14', '17:30:00', '18:00:00', 2, 0, false),
	('05d78c3e-0a44-4829-8686-8a7f50486cad', '2026-07-14', '18:00:00', '18:30:00', 2, 0, false),
	('54ee6a90-06f6-467f-970f-5fec1ed311d0', '2026-07-14', '18:30:00', '19:00:00', 2, 0, false),
	('ae3f41ef-2508-4821-92e7-1459ceb2174d', '2026-07-14', '19:00:00', '19:30:00', 2, 0, false),
	('5316677f-3528-4e24-a12c-be77ec19e66c', '2026-07-14', '19:30:00', '20:00:00', 2, 0, false),
	('4623e98b-dd67-4e58-8bab-276d0462c2d7', '2026-07-14', '20:00:00', '20:30:00', 2, 0, false),
	('1a5c70cd-97b8-41cb-a1f1-2e3a3c3111b4', '2026-07-14', '20:30:00', '21:00:00', 2, 0, false),
	('458106bd-e0b7-493e-bd90-c5e6db8fe709', '2026-07-14', '21:00:00', '21:30:00', 2, 0, false),
	('860ff392-29e4-4be5-9fdf-4da7f74fcf23', '2026-07-14', '21:30:00', '22:00:00', 2, 0, false),
	('36f7b0b3-4296-430c-873f-367adb951ca8', '2026-07-14', '22:00:00', '22:30:00', 2, 0, false),
	('8b36dfdd-36a0-419f-917b-61c661b9d607', '2026-07-14', '22:30:00', '23:00:00', 2, 0, false),
	('d68ed477-8546-4f13-b547-b2c03f6c5974', '2026-05-24', '00:30:00', '01:00:00', 2, 0, false),
	('b91b7fef-7bea-4cfe-b5b6-f6ac0649da06', '2026-07-15', '08:00:00', '08:30:00', 2, 0, false),
	('a8f3a2a7-42fc-4109-8f00-af86150221b0', '2026-07-15', '08:30:00', '09:00:00', 2, 0, false),
	('ec6cda26-5e08-4b9b-8097-c013d530957a', '2026-07-15', '09:00:00', '09:30:00', 2, 0, false),
	('14079987-ca12-43cc-8c74-6e418fd66996', '2026-07-15', '09:30:00', '10:00:00', 2, 0, false),
	('f145848a-003d-434a-8d08-7807202bf030', '2026-07-02', '13:00:00', '13:30:00', 2, 1, false),
	('fad73c53-9d35-479d-aeae-8c4b20caa9e5', '2026-07-02', '14:30:00', '15:00:00', 2, 1, false),
	('b99bf7d9-8f5f-444b-b81d-716fd0c200d0', '2026-07-13', '12:30:00', '13:00:00', 2, 1, false),
	('4518fd2d-9aba-4126-9b3a-9b5771c7eca8', '2026-07-13', '16:00:00', '16:30:00', 2, 1, false),
	('12181ec7-5f69-4ce4-8833-0325ee793a7f', '2026-06-04', '11:30:00', '12:00:00', 2, 1, false),
	('5c6dce16-dc12-4437-b726-c0dabe2aee24', '2026-07-29', '17:30:00', '18:00:00', 2, 0, false),
	('30a51e6a-d56c-4eab-bd3a-025ee9fc9ede', '2026-07-29', '18:00:00', '18:30:00', 2, 0, false),
	('9bd35871-90a4-4bbd-9c58-caeff5ab51dc', '2026-07-29', '18:30:00', '19:00:00', 2, 0, false),
	('21299647-46b0-4967-b694-eca20f597810', '2026-06-25', '08:00:00', '08:30:00', 2, 0, false),
	('921fe364-80bc-40ca-bf2c-d13efc74d841', '2026-06-25', '08:30:00', '09:00:00', 2, 0, false),
	('16a1e007-8893-4907-b649-769aa857b055', '2026-06-25', '09:00:00', '09:30:00', 2, 0, false),
	('4c2a47d3-aa6f-430a-9c4b-5081b3016111', '2026-06-25', '09:30:00', '10:00:00', 2, 0, false),
	('971b7187-0857-4c6d-a34d-583129bde51b', '2026-06-25', '10:00:00', '10:30:00', 2, 0, false),
	('137df736-2dd8-4f74-a772-c0ed6c2735bb', '2026-06-25', '10:30:00', '11:00:00', 2, 0, false),
	('d39e49da-95d9-47aa-a8e9-601c47337144', '2026-06-25', '11:00:00', '11:30:00', 2, 0, false),
	('7fde4247-28b2-48f0-9bc5-6aa8f7950233', '2026-06-25', '11:30:00', '12:00:00', 2, 0, false),
	('730b6d13-f794-4829-b04b-0ae9c7fcb4f3', '2026-06-25', '12:00:00', '12:30:00', 2, 0, false),
	('dae76b42-2ba1-4a15-a7eb-66c1d7ecc75a', '2026-06-25', '12:30:00', '13:00:00', 2, 0, false),
	('96a14226-30ba-4dd0-92c2-80b8fd080b7a', '2026-06-25', '13:00:00', '13:30:00', 2, 0, false),
	('ba9475c7-2334-4c17-9ae9-4a9e2d1f5937', '2026-06-25', '13:30:00', '14:00:00', 2, 0, false),
	('45958bc8-3805-4f2a-8f97-431ad3af89a2', '2026-06-25', '14:00:00', '14:30:00', 2, 0, false),
	('ad35b012-4ce2-40e3-9ee4-c8bb3b46e617', '2026-06-25', '14:30:00', '15:00:00', 2, 0, false),
	('bf2b50fc-ddd2-4adc-98e7-440f5ed5baec', '2026-06-25', '15:00:00', '15:30:00', 2, 0, false),
	('be8ddd16-c653-4274-bd6e-ee9737a43f40', '2026-06-25', '15:30:00', '16:00:00', 2, 0, false),
	('d325f8f8-c598-4f8e-ae31-6f0d06bfd48f', '2026-06-25', '16:00:00', '16:30:00', 2, 0, false),
	('252ca902-7107-45c7-8752-ed4c23262868', '2026-06-25', '16:30:00', '17:00:00', 2, 0, false),
	('4638f6b0-f365-474a-ac3a-b1bb8482b82a', '2026-06-25', '17:00:00', '17:30:00', 2, 0, false),
	('3a4a5b0c-7e18-4e81-ada2-dc2b9df77c67', '2026-06-25', '17:30:00', '18:00:00', 2, 0, false),
	('47f701b8-36ea-4f25-9ebe-500c7da9041c', '2026-06-25', '18:00:00', '18:30:00', 2, 0, false),
	('0828f6f8-d2ed-4367-a3ce-dab6a3f56aeb', '2026-06-25', '18:30:00', '19:00:00', 2, 0, false),
	('394fc21a-09df-4688-9a87-1380f89b1eec', '2026-06-25', '19:00:00', '19:30:00', 2, 0, false),
	('aa481736-a061-4ddb-accf-02ea2218894f', '2026-06-25', '19:30:00', '20:00:00', 2, 0, false),
	('fa95add8-461f-4ea0-a2c5-6bd82958ed96', '2026-06-25', '20:00:00', '20:30:00', 2, 0, false),
	('62a67bf2-9793-4b30-b215-be1c2dc83f49', '2026-06-25', '20:30:00', '21:00:00', 2, 0, false),
	('e495611b-d058-4d29-b26b-ae89b0c68915', '2026-06-25', '21:00:00', '21:30:00', 2, 0, false),
	('b0774c71-7f1e-4007-9add-c69751fd3aa4', '2026-06-25', '22:00:00', '22:30:00', 2, 0, false),
	('087c5665-0f8b-45f1-b653-8e21df63fe77', '2026-06-25', '22:30:00', '23:00:00', 2, 0, false),
	('b510fd5a-a2d9-4276-9dd3-a2a34d7fc7ce', '2026-07-03', '08:00:00', '08:30:00', 2, 0, false),
	('ab5a0190-2951-476d-8327-84a7203b6972', '2026-07-03', '08:30:00', '09:00:00', 2, 0, false),
	('c084ef1b-9a35-48cb-abee-4bb58ff5d14c', '2026-07-03', '09:00:00', '09:30:00', 2, 0, false),
	('fc5d8e6c-4370-4c80-8c92-a6373052cdc0', '2026-07-03', '09:30:00', '10:00:00', 2, 0, false),
	('a4b75e4f-e503-44c8-b06c-ddaebdd69649', '2026-07-03', '10:00:00', '10:30:00', 2, 0, false),
	('7e2279a7-f538-4722-ad16-0c13d78ad4c1', '2026-07-03', '10:30:00', '11:00:00', 2, 0, false),
	('ec6346c3-55d3-4b91-b1f0-6577faac3e11', '2026-07-03', '11:00:00', '11:30:00', 2, 0, false),
	('27772644-1e3f-4eed-baf1-b390f1516c00', '2026-07-03', '11:30:00', '12:00:00', 2, 0, false),
	('048a6568-e3b5-4536-b285-15a378a2a229', '2026-07-03', '12:00:00', '12:30:00', 2, 0, false),
	('b5aa915f-9a7c-4377-b27e-bcbdc540eceb', '2026-07-03', '12:30:00', '13:00:00', 2, 0, false),
	('96833478-a590-4ca4-9a9b-c6508b430a5c', '2026-07-03', '13:00:00', '13:30:00', 2, 0, false),
	('f806cd02-34c0-4c00-b58c-46a528e7b117', '2026-07-03', '13:30:00', '14:00:00', 2, 0, false),
	('df7f6a4d-f279-4050-a67e-881ec24545d0', '2026-07-03', '14:00:00', '14:30:00', 2, 0, false),
	('bcc8afad-82df-44e7-a8ad-4abc4dbea15f', '2026-07-03', '14:30:00', '15:00:00', 2, 0, false),
	('6084979e-38fc-4cdd-bb4b-1719000bc67e', '2026-07-03', '15:30:00', '16:00:00', 2, 0, false),
	('0933ce09-01c4-49e1-ae55-90761b52bcc6', '2026-07-03', '16:00:00', '16:30:00', 2, 0, false),
	('169fa062-fc0f-40fd-85d3-3a460fe7d81e', '2026-07-03', '16:30:00', '17:00:00', 2, 0, false),
	('dd91f3ea-55fa-4d67-905d-430ed2a74dcd', '2026-07-03', '17:00:00', '17:30:00', 2, 0, false),
	('166b44e8-2b0a-4c51-a3eb-1bb6e8fcaa43', '2026-07-03', '17:30:00', '18:00:00', 2, 0, false),
	('f248b4f0-8351-4e61-8c97-a651beef4b78', '2026-07-03', '18:00:00', '18:30:00', 2, 0, false),
	('57823899-48b4-414e-9cf5-9a5cefd45d6c', '2026-07-03', '18:30:00', '19:00:00', 2, 0, false),
	('79151fb4-7d36-4ce5-bcd8-4a39599c09dc', '2026-07-03', '19:00:00', '19:30:00', 2, 0, false),
	('f501100b-b1ef-4700-ba48-919e6518fa69', '2026-07-03', '19:30:00', '20:00:00', 2, 0, false),
	('7dead50b-92fe-4f05-a001-02f260e12a4e', '2026-07-03', '20:00:00', '20:30:00', 2, 0, false),
	('5bab66d2-7bc9-4e44-92d6-3738247263d7', '2026-07-03', '20:30:00', '21:00:00', 2, 0, false),
	('390e3ab1-f954-4728-a5ae-322ed1aeab2c', '2026-07-03', '21:00:00', '21:30:00', 2, 0, false),
	('ab8a5f90-d59b-4f4b-a464-87054c7c0f34', '2026-07-03', '21:30:00', '22:00:00', 2, 0, false),
	('01dd143d-a3d3-4429-93e8-e1f9b883bd61', '2026-07-03', '22:00:00', '22:30:00', 2, 0, false),
	('b243e938-ae4b-48a8-9ad9-2c85277ef43c', '2026-07-03', '22:30:00', '23:00:00', 2, 0, false),
	('6239bc63-df05-4aaf-a367-438cbe9f082e', '2026-07-09', '08:00:00', '08:30:00', 2, 0, false),
	('b477986b-2107-4958-b83a-883bd04c9aab', '2026-07-09', '08:30:00', '09:00:00', 2, 0, false),
	('a6ccf393-1802-4f91-8955-809a676dabdf', '2026-07-09', '09:00:00', '09:30:00', 2, 0, false),
	('3d8042f1-c325-4d3a-85bf-d4f588bd5081', '2026-07-09', '09:30:00', '10:00:00', 2, 0, false),
	('e2d0c46c-fc53-4333-bb5c-07016bdad518', '2026-07-09', '10:00:00', '10:30:00', 2, 0, false),
	('71d5c99b-9837-4c79-895c-89a9557c9571', '2026-07-09', '10:30:00', '11:00:00', 2, 0, false),
	('a6ae3191-de3a-45b0-995f-b4f1a19ed03e', '2026-07-09', '11:00:00', '11:30:00', 2, 0, false),
	('c215ae9c-0072-453c-b2b1-63ffc72e093d', '2026-07-09', '11:30:00', '12:00:00', 2, 0, false),
	('74192eae-e94b-4de7-bd07-5a58e80a7a30', '2026-07-09', '12:00:00', '12:30:00', 2, 0, false),
	('e56130e1-854a-45f0-adf5-518c6d295db4', '2026-07-09', '12:30:00', '13:00:00', 2, 0, false),
	('3757518e-7572-492c-82b0-4932c41cfc2c', '2026-07-09', '13:00:00', '13:30:00', 2, 0, false),
	('6b3ec81d-549a-4a34-8051-8088ff073341', '2026-07-09', '13:30:00', '14:00:00', 2, 0, false),
	('42551541-00bc-4abd-8880-dce7e555fc9c', '2026-07-09', '14:00:00', '14:30:00', 2, 0, false),
	('dd403890-71d7-4c8a-870a-05e5dc17f618', '2026-07-09', '14:30:00', '15:00:00', 2, 0, false),
	('b5a0cebf-c843-4be2-ac27-2f25313fe7d5', '2026-07-09', '15:00:00', '15:30:00', 2, 0, false),
	('163e97ec-df8a-4d1d-b5f1-4cfe52082ebd', '2026-07-09', '15:30:00', '16:00:00', 2, 0, false),
	('63c1a8f8-32d4-4a34-b06a-c5ee4100cf6d', '2026-07-09', '16:00:00', '16:30:00', 2, 0, false),
	('21585474-2778-4aca-8dd2-d1a7a18d67ce', '2026-07-09', '16:30:00', '17:00:00', 2, 0, false),
	('a48010e5-8916-4f5b-89a0-cb9a2788f94f', '2026-07-09', '17:00:00', '17:30:00', 2, 0, false),
	('3e24c0ca-d0d3-4881-b5bb-11c09340ce84', '2026-07-09', '17:30:00', '18:00:00', 2, 0, false),
	('683377a6-d959-48f7-b335-9a64348ef836', '2026-07-09', '18:00:00', '18:30:00', 2, 0, false),
	('d6c8d0a8-24c7-4e4d-8294-bd2525adf910', '2026-07-09', '18:30:00', '19:00:00', 2, 0, false),
	('e96db326-8331-4128-8815-9ab5b2c53da7', '2026-06-04', '12:00:00', '12:30:00', 2, 0, false),
	('2d3781bb-d70c-4cf8-ab8b-25a3ee8ccda9', '2026-06-04', '12:30:00', '13:00:00', 2, 0, false),
	('ea419e3e-cc0f-4c81-8630-7fd646abb322', '2026-06-04', '13:00:00', '13:30:00', 2, 0, false),
	('5ba50d58-cf40-494b-b84a-80f7809b4844', '2026-06-04', '13:30:00', '14:00:00', 2, 0, false),
	('26f21267-3456-4fff-9819-0f2c4fadd34f', '2026-06-04', '14:00:00', '14:30:00', 2, 0, false),
	('4007528f-0871-4fdd-be28-b7267d8d30f5', '2026-06-04', '14:30:00', '15:00:00', 2, 0, false),
	('3d9d46f6-6b90-4808-90c2-eabd7871ae07', '2026-06-04', '15:00:00', '15:30:00', 2, 0, false),
	('5fbde9ca-b547-4188-9224-d7089cf8e083', '2026-06-04', '15:30:00', '16:00:00', 2, 0, false),
	('93ae44e3-f818-486a-8d15-e6c471651fbe', '2026-07-09', '19:00:00', '19:30:00', 2, 0, false),
	('2c14e327-549e-438a-a632-b9f72c20499b', '2026-06-25', '21:30:00', '22:00:00', 2, 1, false),
	('58473f1a-7845-441e-b706-4e17ea838259', '2026-07-09', '19:30:00', '20:00:00', 2, 0, false),
	('064f1953-b72c-4a68-a208-deb08b61a791', '2026-07-03', '15:00:00', '15:30:00', 2, 1, false),
	('8b3efc8c-2c00-4637-97c4-14849d187bf7', '2026-07-29', '19:30:00', '20:00:00', 2, 0, false),
	('bda359aa-40b4-4c9a-8c6e-dc887e66cc6f', '2026-07-29', '20:00:00', '20:30:00', 2, 0, false),
	('e6a05f8a-417a-4d51-9870-e47f30983866', '2026-07-29', '20:30:00', '21:00:00', 2, 0, false),
	('89ab98a3-4482-42b0-83fc-72ff9f1d9cfb', '2026-07-29', '21:00:00', '21:30:00', 2, 0, false),
	('2d782c71-2473-465a-b0e5-ceaf30844212', '2026-06-26', '08:00:00', '08:30:00', 2, 0, false),
	('dbee7b3f-9a4c-41ae-8ad9-ea585c9e9572', '2026-06-26', '08:30:00', '09:00:00', 2, 0, false),
	('83076757-6c64-41f2-8e82-90208cf86165', '2026-06-26', '09:00:00', '09:30:00', 2, 0, false),
	('18c8d92c-f670-4f39-bc8e-52ca56e236a7', '2026-06-26', '09:30:00', '10:00:00', 2, 0, false),
	('8ac86479-4e6c-4370-8fa4-d58a2031a937', '2026-06-26', '10:00:00', '10:30:00', 2, 0, false),
	('dc1be6f9-e431-4c48-b845-5877f8aa6721', '2026-06-26', '10:30:00', '11:00:00', 2, 0, false),
	('bc28e952-0a70-4d20-9dce-f62709c9d7fa', '2026-06-26', '11:00:00', '11:30:00', 2, 0, false),
	('225cdc3f-e5b9-4667-a75f-ec4950a8d34e', '2026-06-26', '12:30:00', '13:00:00', 2, 0, false),
	('e768d64b-093b-4ef8-a11a-25e49b665137', '2026-06-26', '13:00:00', '13:30:00', 2, 0, false),
	('29a458ec-b437-4055-a1ab-4aee7cb19d62', '2026-06-26', '13:30:00', '14:00:00', 2, 0, false),
	('7c56121a-b06d-4b29-af10-facd73dca185', '2026-06-26', '14:30:00', '15:00:00', 2, 0, false),
	('a87d9992-f9cc-42cf-8335-206eca3bcd62', '2026-06-26', '15:00:00', '15:30:00', 2, 0, false),
	('80775d8b-0b50-40c6-a882-8e8cabd0c17f', '2026-06-26', '15:30:00', '16:00:00', 2, 0, false),
	('f4f6ae71-340a-48ed-acec-5a3709dca876', '2026-06-26', '16:00:00', '16:30:00', 2, 0, false),
	('bf0172a3-1766-4fbe-a38d-6085b6e9d7ea', '2026-06-26', '16:30:00', '17:00:00', 2, 0, false),
	('5f92c02a-48aa-47db-bf4c-78db6cdf00c4', '2026-06-04', '16:00:00', '16:30:00', 2, 0, false),
	('fa08022c-2492-430f-a26f-912eb702b2f4', '2026-06-04', '16:30:00', '17:00:00', 2, 0, false),
	('a787314e-9c47-486b-9684-b795fb51aa4c', '2026-06-04', '17:00:00', '17:30:00', 2, 0, false),
	('b24808ad-0da5-4ecf-baa2-fdf63799e19c', '2026-06-04', '17:30:00', '18:00:00', 2, 0, false),
	('efa1d74d-2672-4fb9-9e0b-1ea99e4cf8e3', '2026-06-04', '18:00:00', '18:30:00', 2, 0, false),
	('56196fe5-91fb-4801-99ab-0fad0998b7b3', '2026-06-04', '18:30:00', '19:00:00', 2, 0, false),
	('17d9b887-4e99-4786-8a78-5d58d71764a9', '2026-06-04', '19:00:00', '19:30:00', 2, 0, false),
	('527e547b-5a85-4a10-9963-6946a226f97f', '2026-06-04', '19:30:00', '20:00:00', 2, 0, false),
	('1e084dce-7491-4f26-a3bf-c603c5f16a14', '2026-06-04', '20:00:00', '20:30:00', 2, 0, false),
	('00354c6d-55e0-4677-ad5b-4a3657dd2200', '2026-06-04', '20:30:00', '21:00:00', 2, 0, false),
	('2c51cd9a-7abf-466f-8026-f40c0d407300', '2026-06-04', '21:00:00', '21:30:00', 2, 0, false),
	('04aa4a9a-2212-41dd-b89b-fbc2b5b925f2', '2026-06-04', '21:30:00', '22:00:00', 2, 0, false),
	('75a90808-331c-40c9-a19a-a8cecd8057d0', '2026-06-04', '22:00:00', '22:30:00', 2, 0, false),
	('18a5bd8d-876c-49c1-aa16-d00f739e7a4a', '2026-06-04', '22:30:00', '23:00:00', 2, 0, false),
	('b4d7acb1-2a2c-49e4-a653-4921c775b5bf', '2026-06-04', '23:00:00', '23:30:00', 2, 0, false),
	('d8fac706-0dc8-4f9f-9642-b3e0e7e9e0f1', '2026-05-21', '19:30:00', '20:00:00', 2, 0, false),
	('578c7f3e-1b01-4e81-a49b-3290c7d898c0', '2026-05-21', '18:00:00', '18:30:00', 2, 0, false),
	('abd816d7-a08d-43a0-aceb-c568a6ba595a', '2026-05-21', '18:30:00', '19:00:00', 2, 0, false),
	('eac24ab8-f979-4a48-964a-5063a73628da', '2026-06-26', '12:00:00', '12:30:00', 2, 1, false),
	('3d252920-92b4-4ad0-980e-616b71456005', '2026-06-26', '11:30:00', '12:00:00', 2, 2, false),
	('2ebc5245-9e86-4a45-8f90-7683e25fc7ea', '2026-06-26', '14:00:00', '14:30:00', 2, 0, false),
	('9b7edebc-e910-4102-8963-861db26fd751', '2026-05-21', '19:00:00', '19:30:00', 2, 0, false),
	('4ae218e2-7a17-49c5-af46-f6bc0de43a9e', '2026-05-21', '20:00:00', '20:30:00', 2, 0, false),
	('78e24c08-fdba-4071-980a-16031152dd4c', '2026-05-21', '20:30:00', '21:00:00', 2, 0, false),
	('add7c585-c1f7-41fe-aaa6-bee0f01d4c82', '2026-05-21', '21:00:00', '21:30:00', 2, 0, false),
	('93f775ea-383d-4a00-bf92-0abf7594ae55', '2026-05-21', '21:30:00', '22:00:00', 2, 0, false),
	('376a1695-1806-41df-a182-7cd8f23c6937', '2026-05-21', '22:00:00', '22:30:00', 2, 0, false),
	('9c7e690f-7f13-47d2-969a-6a29ccc55f97', '2026-05-30', '20:00:00', '20:30:00', 2, 0, false),
	('67aa8739-f4d6-4fd6-a672-0d715a42f26e', '2026-04-30', '13:00:00', '13:30:00', 2, 0, false),
	('a7a4992d-e6b8-494f-be02-98d383fc8cca', '2026-04-30', '13:30:00', '14:00:00', 2, 0, false),
	('7713576c-8396-4c4b-8c15-f98704591a05', '2026-04-30', '14:00:00', '14:30:00', 2, 0, false),
	('3eaa3cc1-1664-44ff-bbc3-5245e064419c', '2026-04-30', '14:30:00', '15:00:00', 2, 0, false),
	('3b60e988-bcb1-4855-821d-14efb599c56c', '2026-04-30', '15:30:00', '16:00:00', 2, 0, false),
	('00ac6355-8496-4501-b190-1b62a44bb79c', '2026-04-30', '16:00:00', '16:30:00', 2, 0, false),
	('a053d737-f6c9-49bb-a74c-82a1640b097b', '2026-04-30', '16:30:00', '17:00:00', 2, 0, false),
	('9c34c62a-7262-4b69-89a4-4c4f78c031ae', '2026-04-30', '17:00:00', '17:30:00', 2, 0, false),
	('fb4abbc2-0ab2-433d-a79c-cba90b5c8a05', '2026-05-27', '09:30:00', '10:00:00', 2, 0, false),
	('19b322b1-2c64-46cf-b1f4-6001ee2e3aa2', '2026-05-27', '10:00:00', '10:30:00', 2, 0, false),
	('53146d88-e76a-4da0-bbba-ddb6f41fa441', '2026-05-27', '10:30:00', '11:00:00', 2, 0, false),
	('9e1637c8-c627-4e65-bc25-245d54ab698a', '2026-05-27', '11:00:00', '11:30:00', 2, 0, false),
	('28cd324f-1780-45b0-95e2-60b8f20032e5', '2026-05-27', '11:30:00', '12:00:00', 2, 0, false),
	('67c79be2-be4c-4bc0-b69b-a6547da4650f', '2026-05-27', '12:00:00', '12:30:00', 2, 0, false),
	('02a55565-18b8-413c-9b8e-58884353d245', '2026-05-27', '12:30:00', '13:00:00', 2, 0, false),
	('8a379572-bc9f-4e66-a22a-a7632d2f16f4', '2026-05-27', '13:00:00', '13:30:00', 2, 0, false),
	('19ea4661-47d9-4aba-b614-0f10ff93665a', '2026-05-27', '13:30:00', '14:00:00', 2, 0, false),
	('238087a0-64c0-4325-98fe-c352378cab5e', '2026-05-27', '14:00:00', '14:30:00', 2, 0, false),
	('de4be304-8b53-4fd8-9985-97a59fc7258b', '2026-05-27', '14:30:00', '15:00:00', 2, 0, false),
	('a93c4966-13e7-4de7-a4f3-bb9a756c998b', '2026-05-30', '17:00:00', '17:30:00', 2, 0, false),
	('3ebace3b-f2ca-47c6-bfb5-bceecf85f966', '2026-05-30', '17:30:00', '18:00:00', 2, 0, false),
	('54fcbd34-65d5-40a4-9086-f6423903825f', '2026-05-30', '18:30:00', '19:00:00', 2, 0, false),
	('40333ed5-1f18-4d73-bcd6-8eeb7a120d7e', '2026-05-30', '18:00:00', '18:30:00', 2, 0, false),
	('c8058165-4a1f-4a98-b61a-8b1ca5741155', '2026-05-06', '15:30:00', '16:00:00', 2, 0, false),
	('6ac4679e-9db3-4a79-87bd-a982e5c0cff9', '2026-05-06', '16:00:00', '16:30:00', 2, 0, false),
	('54403b72-e6b7-4c90-86eb-66e04118a7d4', '2026-05-09', '11:00:00', '11:30:00', 2, 0, false),
	('e0352b10-327a-4787-9bd7-fa4e6cc9b07c', '2026-05-09', '12:00:00', '12:30:00', 2, 0, false),
	('06d98993-8dfb-4f60-a6d0-ce99f8e95da3', '2026-05-09', '13:00:00', '13:30:00', 2, 0, false),
	('627201f3-9264-466d-ba3e-0ff216694ba0', '2026-05-14', '09:00:00', '09:30:00', 2, 0, false),
	('ef629671-79fb-4f74-8432-cc1a0b8b6167', '2026-05-14', '09:30:00', '10:00:00', 2, 0, false),
	('2d3ebbbe-8b9d-40ce-9797-2d125e93b7c1', '2026-05-14', '10:00:00', '10:30:00', 2, 0, false),
	('3162051c-6e8c-4bec-9774-1f7938e92d71', '2026-05-06', '11:00:00', '11:30:00', 2, 0, false),
	('cc259d3a-f6a9-4722-92fa-142cab28cbca', '2026-05-06', '10:30:00', '11:00:00', 2, 0, false),
	('5b7e852a-11d5-48d7-8879-b71346248984', '2026-05-09', '16:30:00', '17:00:00', 2, 0, false),
	('4e4e0896-0e74-4a9f-91ea-ae9ef39b0188', '2026-05-09', '17:00:00', '17:30:00', 2, 0, false),
	('81d1d504-3695-4369-b0d1-2e886985a33d', '2026-05-09', '17:30:00', '18:00:00', 2, 0, false),
	('7c76bf39-aeb1-47a7-9133-6cc8fe255de2', '2026-05-09', '18:00:00', '18:30:00', 2, 0, false),
	('bb3b5006-185a-42ed-847c-ebeee204f665', '2026-05-09', '18:30:00', '19:00:00', 2, 0, false),
	('496b1c8b-e21d-417f-a4e8-f38831aecafd', '2026-05-09', '19:00:00', '19:30:00', 2, 0, false),
	('0df6e3d6-2c34-496b-a53d-53fe22cdf8fe', '2026-05-09', '19:30:00', '20:00:00', 2, 0, false),
	('2bc03260-e552-41d3-b790-08408b99bef4', '2026-05-03', '09:30:00', '10:00:00', 2, 0, false),
	('280f28f8-de91-403f-9873-db9bdbda9fd4', '2026-05-02', '16:30:00', '17:00:00', 2, 0, false),
	('33a4c80a-660a-4988-9010-d2c642c5f26d', '2026-05-02', '17:00:00', '17:30:00', 2, 0, false),
	('2927d33b-a03b-49a1-8760-6de614950a00', '2026-05-02', '17:30:00', '18:00:00', 2, 0, false),
	('83a2c1bb-9a37-4502-a879-f923849b43bc', '2026-05-02', '18:00:00', '18:30:00', 2, 0, false),
	('f6d6f9af-b0b5-45ae-8a5a-cce2fb2cf352', '2026-05-13', '08:00:00', '08:30:00', 2, 0, false),
	('54153eab-7b71-4fef-b01e-797480c4a545', '2026-05-28', '00:30:00', '01:00:00', 2, 0, false),
	('70233ca2-119f-4578-9116-f21758a2d250', '2026-05-27', '19:30:00', '20:00:00', 2, 0, false),
	('d0342b66-5568-453e-ae75-5d8ef9c4ad21', '2026-05-21', '22:30:00', '23:00:00', 2, 0, false),
	('92445e9a-fd54-467c-8184-aa95826d163c', '2026-05-21', '23:00:00', '23:30:00', 2, 0, false),
	('a0cc479c-6db4-4239-ab76-2d1ef3e486ae', '2026-05-21', '00:00:00', '00:30:00', 2, 0, false),
	('a17af491-2c8c-4f8c-a7ca-b56ff4aa6679', '2026-05-22', '00:00:00', '00:30:00', 2, 0, false),
	('bcc7f48b-b276-4411-b2c1-f77495fe9427', '2026-05-22', '00:30:00', '01:00:00', 2, 0, false),
	('31de1276-65db-4339-9ea4-ca2bd80ff582', '2026-05-22', '01:00:00', '01:30:00', 2, 0, false),
	('5ae9d399-046d-4290-be8f-02005ac97ae1', '2026-05-22', '01:30:00', '02:00:00', 2, 0, false),
	('ed6a6eb0-15da-41d5-a0cc-1c1273293a9d', '2026-05-22', '02:00:00', '02:30:00', 2, 0, false),
	('ce70241a-5b1e-47ad-a8bb-822e06410e32', '2026-05-27', '15:00:00', '15:30:00', 2, 0, false),
	('4b07b58a-ff17-4fcc-81d1-b65f30d82b33', '2026-05-27', '15:30:00', '16:00:00', 2, 0, false),
	('cd0de8d7-4f8e-4d8d-b0b4-2d563016a5b9', '2026-05-27', '16:00:00', '16:30:00', 2, 0, false),
	('79cfed8f-5e67-45c6-b967-d83611a2e39c', '2026-05-27', '16:30:00', '17:00:00', 2, 0, false),
	('2773dc0c-1d7f-410a-9d2a-20bf016f9f99', '2026-05-27', '17:00:00', '17:30:00', 2, 0, false),
	('7956e995-95e8-4893-b152-3071026b1fc6', '2026-05-27', '17:30:00', '18:00:00', 2, 0, false),
	('be1fbf1a-d248-4448-9324-a0f276d3dbab', '2026-05-27', '18:00:00', '18:30:00', 2, 0, false),
	('5de59546-f969-4ded-ad2d-212b2a507309', '2026-05-27', '18:30:00', '19:00:00', 2, 0, false),
	('3066d2c8-305d-45b8-bfea-88c73c5f00ec', '2026-05-27', '19:00:00', '19:30:00', 2, 0, false),
	('53be0ad7-0c01-4399-9a71-a4cd3e8be290', '2026-05-14', '17:30:00', '18:00:00', 2, 0, false),
	('7bfeeedb-89b3-44e4-83df-174e5146010c', '2026-05-14', '18:00:00', '18:30:00', 2, 0, false),
	('b20def8e-a898-46b1-ab63-4c93fd1138cd', '2026-05-06', '17:30:00', '18:00:00', 2, 0, false),
	('e626b77f-9083-46ae-8b1f-e5e37e6d5dc2', '2026-05-06', '18:00:00', '18:30:00', 2, 0, false),
	('83f51896-0e54-49ce-84a5-aba1f29bd0d0', '2026-05-06', '18:30:00', '19:00:00', 2, 0, false),
	('2632aad2-1d18-4aa0-b4be-17683bb5c9c8', '2026-05-20', '22:00:00', '22:30:00', 2, 0, false),
	('c63f3419-13fc-4460-8996-b552576e502e', '2026-05-06', '19:00:00', '19:30:00', 2, 0, false),
	('c1ce9d0c-f639-4a2f-9e10-8af2e5fee63f', '2026-05-06', '19:30:00', '20:00:00', 2, 0, false),
	('4358d758-3362-4a30-9254-89ee147f7387', '2026-05-06', '09:30:00', '10:00:00', 2, 0, false),
	('fa64e85b-982a-46d1-bd13-3a1038492dc7', '2026-05-06', '10:00:00', '10:30:00', 2, 0, false),
	('c4c1e7e5-10e7-4929-8020-67abc764e1fc', '2026-05-10', '09:00:00', '09:30:00', 2, 0, false),
	('e679cfc5-1067-4485-b927-0e4320b344a0', '2026-05-10', '09:30:00', '10:00:00', 2, 0, false),
	('670ff2ab-0332-4492-a46c-9b5ee71fd8e9', '2026-05-22', '02:30:00', '03:00:00', 2, 0, false),
	('bd148320-882f-4444-94a3-cfd2ec82e81c', '2026-05-22', '03:00:00', '03:30:00', 2, 0, false),
	('7a18f2c7-7bc5-4d85-95bc-91c86f5f601a', '2026-05-22', '03:30:00', '04:00:00', 2, 0, false),
	('d899b505-2202-4972-96b4-3f3d56d47fd4', '2026-05-22', '08:00:00', '08:30:00', 2, 0, false),
	('25ba0e79-550b-4fac-ab12-35f050876774', '2026-05-22', '08:30:00', '09:00:00', 2, 0, false),
	('7f418bab-bbc9-47e0-9985-3a1d393f769c', '2026-05-22', '09:00:00', '09:30:00', 2, 0, false),
	('09c7b2b3-c12f-423e-8753-c5c0d0bca230', '2026-05-22', '09:30:00', '10:00:00', 2, 0, false),
	('0260e169-b8f4-470e-a52c-b37f68edcfcf', '2026-05-22', '10:30:00', '11:00:00', 2, 0, false),
	('9da8e0f6-d739-4ffd-8623-b2fae249bd88', '2026-05-22', '11:00:00', '11:30:00', 2, 0, false),
	('296bb935-01c4-46c5-9b9b-07fa45e4477f', '2026-05-22', '11:30:00', '12:00:00', 2, 0, false),
	('f998d77c-97b6-485e-b8fe-4cad1ced27ce', '2026-05-22', '12:00:00', '12:30:00', 2, 0, false),
	('df0372a4-901e-4f14-83dd-92014d9cef4a', '2026-05-22', '12:30:00', '13:00:00', 2, 0, false),
	('b707917a-531d-404d-b504-0526cf658561', '2026-05-22', '13:00:00', '13:30:00', 2, 0, false),
	('e07220a3-87f7-4f78-88e3-2ca4845f675c', '2026-05-22', '13:30:00', '14:00:00', 2, 0, false),
	('f203830f-99f6-48fa-a484-ca5f7af1b6ad', '2026-05-22', '14:00:00', '14:30:00', 2, 0, false),
	('f91e7569-0862-4057-a6b2-9d2e630d8728', '2026-05-22', '14:30:00', '15:00:00', 2, 0, false),
	('950cea90-fbe2-417a-a893-b5f02b5aafe1', '2026-05-22', '15:00:00', '15:30:00', 2, 0, false),
	('96b69656-5363-4b23-ac77-48ec5b2094e9', '2026-05-22', '15:30:00', '16:00:00', 2, 0, false),
	('fc477b31-214b-4659-b676-5694e954bd44', '2026-05-22', '16:00:00', '16:30:00', 2, 0, false),
	('f15bd35e-9564-4a50-aaf0-82032e5ee1c3', '2026-05-22', '16:30:00', '17:00:00', 2, 0, false),
	('5d64afc9-e238-4ce8-ba3c-6ae4083e3f06', '2026-05-22', '17:00:00', '17:30:00', 2, 0, false),
	('546bd04f-e250-46ed-a06f-93412fae84a9', '2026-05-23', '17:30:00', '18:00:00', 2, 0, false),
	('3060598b-c9a5-4e11-b7d0-7f52fd4aa6a8', '2026-05-23', '18:00:00', '18:30:00', 2, 0, false),
	('3e5309e3-c232-472f-b179-61beef232e35', '2026-05-23', '18:30:00', '19:00:00', 2, 0, false),
	('d89de146-7878-40eb-a6e0-0675f7f87e44', '2026-05-23', '19:00:00', '19:30:00', 2, 0, false),
	('c3e2b5f2-dc5b-4d1a-9775-696ac083ba78', '2026-05-23', '19:30:00', '20:00:00', 2, 0, false),
	('2ea7fc30-577f-4f19-a6fc-daa8eadba56c', '2026-05-23', '20:00:00', '20:30:00', 2, 0, false),
	('137f5bf2-9ca1-43df-aed3-81f1dd7ec742', '2026-05-23', '20:30:00', '21:00:00', 2, 0, false),
	('c8bc412a-164f-48e4-a577-1453ec52f627', '2026-05-23', '21:00:00', '21:30:00', 2, 0, false),
	('267b3237-2b67-41ff-bdb5-183cb4d713d1', '2026-05-23', '21:30:00', '22:00:00', 2, 0, false),
	('1f8bc89e-4ed0-470e-a769-aaa6b0e1c64f', '2026-05-23', '22:00:00', '22:30:00', 2, 0, false),
	('b472964b-14ff-47b6-a257-22c242a10531', '2026-05-23', '22:30:00', '23:00:00', 2, 0, false),
	('39671f99-f57d-4a9d-aca5-ad88856f38f5', '2026-05-23', '23:00:00', '23:30:00', 2, 0, false),
	('92d874cc-95cc-49fe-9d09-156905cf65a2', '2026-05-24', '00:00:00', '00:30:00', 2, 0, false),
	('9ed0a864-99dc-4911-88d2-e54e41035cde', '2026-04-29', '09:00:00', '09:30:00', 2, 0, false),
	('80db14ba-72ca-49b8-abd3-e2eb76bd7f63', '2026-04-29', '10:00:00', '10:30:00', 2, 0, false),
	('2b577832-9ee0-4843-973a-f6ba38de06a9', '2026-04-29', '10:30:00', '11:00:00', 2, 0, false),
	('53ee83e6-b4c1-44ac-801b-7dfdb5170974', '2026-04-29', '11:00:00', '11:30:00', 2, 0, false),
	('2476bf52-9a96-48ed-91f0-934ac214d01f', '2026-04-28', '13:00:00', '13:30:00', 2, 0, false),
	('5fec7dcf-fda0-4430-85fe-fc28c5ef4799', '2026-04-28', '13:30:00', '14:00:00', 2, 0, false),
	('d18d42c7-e0b4-47af-990d-b544eea3d151', '2026-04-28', '14:00:00', '14:30:00', 2, 0, false),
	('2e546050-c5b9-43c4-a4f9-3ab7caa71c0d', '2026-04-28', '14:30:00', '15:00:00', 2, 0, false),
	('3ec11379-9ce3-42c0-818c-dbab5fdcd119', '2026-04-28', '15:30:00', '16:00:00', 2, 0, false),
	('02a2c1eb-e16e-4f69-be3c-934871c7020c', '2026-04-28', '16:00:00', '16:30:00', 2, 0, false),
	('6011bdf9-2d31-4e2c-b30c-198f377b16bf', '2026-04-28', '16:30:00', '17:00:00', 2, 0, false),
	('d5d12280-33c8-4efe-ab79-ac5eb5b988f9', '2026-05-02', '15:30:00', '16:00:00', 2, 0, false),
	('6a447ee5-cdf7-4bee-b965-e0107518a672', '2026-05-02', '16:00:00', '16:30:00', 2, 0, false),
	('181932e6-3cf8-47c3-9486-79faf3554283', '2026-05-28', '03:30:00', '04:00:00', 2, 0, false),
	('2103c107-57e1-4d4b-b708-b18ded82e137', '2026-05-28', '08:00:00', '08:30:00', 2, 0, false),
	('0dd8b38a-9a6f-40eb-a55b-745df2dd3dab', '2026-05-28', '08:30:00', '09:00:00', 2, 0, false),
	('fe620ae5-8e93-4a79-8291-5cd8646a3079', '2026-05-28', '09:00:00', '09:30:00', 2, 0, false),
	('3a680bfe-b9db-4b57-ace5-94250a0cc158', '2026-04-29', '11:30:00', '12:00:00', 2, 0, false),
	('3fcb9e7e-9811-41ba-b7eb-450af6b9283c', '2026-04-29', '12:00:00', '12:30:00', 2, 0, false),
	('6cac0ed0-e122-4a16-a451-bb2fc8e5a7f1', '2026-04-29', '12:30:00', '13:00:00', 2, 0, false),
	('7cacefd3-b0ab-4e68-9a36-e0d22a0815a8', '2026-04-29', '13:00:00', '13:30:00', 2, 0, false),
	('983cac46-dc9b-41f2-bcca-086940ae07f0', '2026-04-29', '13:30:00', '14:00:00', 2, 0, false),
	('b9bd70e6-887f-4263-b0fe-6af196c27969', '2026-04-29', '14:00:00', '14:30:00', 2, 0, false),
	('34f0c22a-fd74-44c8-a0b0-2adfcebd5e1d', '2026-04-29', '14:30:00', '15:00:00', 2, 0, false),
	('3264aff7-17a1-468a-905a-7117214af7ba', '2026-04-29', '15:30:00', '16:00:00', 2, 0, false),
	('0f89122c-338a-4292-8b33-1db884cc43f1', '2026-04-29', '16:00:00', '16:30:00', 2, 0, false),
	('5b8693a1-ee7a-4dd7-bcd5-233d428f1164', '2026-05-29', '09:30:00', '10:00:00', 2, 0, false),
	('bd627963-7f06-49eb-a9af-63367eb43c38', '2026-05-29', '10:00:00', '10:30:00', 2, 0, false),
	('46570e03-2b3e-4577-92b4-651770d928b2', '2026-05-20', '21:00:00', '21:30:00', 2, 0, false),
	('566ea999-198b-495d-8d1d-8c6eb517eccc', '2026-05-20', '21:30:00', '22:00:00', 2, 0, false),
	('454fc84d-229b-4921-894d-e54ab140cd7a', '2026-05-20', '22:30:00', '23:00:00', 2, 0, false),
	('882d8297-1b86-4d1b-b95b-c970bd6d496d', '2026-05-20', '23:00:00', '23:30:00', 2, 0, false),
	('f1814824-80d3-4d18-bb3b-55eedb1f64a9', '2026-05-21', '01:00:00', '01:30:00', 2, 0, false),
	('32576b1b-e5d5-478f-9b9c-c77ca6bd424e', '2026-05-21', '01:30:00', '02:00:00', 2, 0, false),
	('06268cc8-0d94-4de3-823b-60ebb3e98ff2', '2026-05-21', '02:00:00', '02:30:00', 2, 0, false),
	('705516c4-6f10-47e5-9b5e-5e03c90cfc41', '2026-05-21', '02:30:00', '03:00:00', 2, 0, false),
	('00bcf809-3e1d-4942-8fcb-c167a213a499', '2026-05-21', '03:00:00', '03:30:00', 2, 0, false),
	('930f8114-c359-43f0-a530-4d5872dc1525', '2026-05-21', '03:30:00', '04:00:00', 2, 0, false),
	('be2a0974-0aa9-423c-a673-31f082737701', '2026-05-21', '08:00:00', '08:30:00', 2, 0, false),
	('e31ae2a9-d201-4396-8e2d-64fa185168a2', '2026-05-21', '08:30:00', '09:00:00', 2, 0, false),
	('52d100a2-d97d-4372-9d05-4a64d89e1e89', '2026-05-21', '09:00:00', '09:30:00', 2, 0, false),
	('2dd384b4-5659-4a23-bcf3-f09cdb503159', '2026-05-21', '09:30:00', '10:00:00', 2, 0, false),
	('ea98d939-4034-4d2e-8f21-bd8bed905226', '2026-05-21', '10:00:00', '10:30:00', 2, 0, false),
	('da62d078-4938-43fc-b3d3-a95f7d554a2b', '2026-05-21', '10:30:00', '11:00:00', 2, 0, false),
	('16081b2d-91a4-4075-85d4-83e80cae9c65', '2026-05-21', '11:00:00', '11:30:00', 2, 0, false),
	('7bb31b6c-ec52-4fa5-a658-145f7af1c944', '2026-05-21', '11:30:00', '12:00:00', 2, 0, false),
	('f44bd88c-49f8-432c-8b26-b0e72dd4b6da', '2026-05-21', '12:00:00', '12:30:00', 2, 0, false),
	('1fc9d92f-5127-4141-b9ff-da711ffef0d9', '2026-05-21', '12:30:00', '13:00:00', 2, 0, false),
	('3bce6c52-6b8a-4577-88ce-34c102c15d37', '2026-05-21', '13:00:00', '13:30:00', 2, 0, false),
	('3741b1fc-b3bf-4900-b645-6d19771581b7', '2026-05-21', '13:30:00', '14:00:00', 2, 0, false),
	('3e8a77c6-1ca3-4bc2-a1a8-18734b6e4c5d', '2026-05-21', '14:00:00', '14:30:00', 2, 0, false),
	('275edbd1-1603-4ba1-8a6d-d4415496bb33', '2026-05-22', '17:30:00', '18:00:00', 2, 0, false),
	('93806731-618b-411b-9e71-1b7293c47cf3', '2026-05-22', '18:00:00', '18:30:00', 2, 0, false),
	('ca71a39d-9ef7-4a55-b220-782d6348932c', '2026-05-22', '18:30:00', '19:00:00', 2, 0, false),
	('3bc9bb3c-3491-46d7-adc9-a132237297c9', '2026-05-22', '19:00:00', '19:30:00', 2, 0, false),
	('69fd7436-1c9c-47b5-8f9e-43dd11311045', '2026-05-22', '19:30:00', '20:00:00', 2, 0, false),
	('9da6c5b3-bcdc-47b9-bf39-c8421bebc570', '2026-05-22', '20:30:00', '21:00:00', 2, 0, false),
	('47129efd-3e2f-4455-950f-fa3796cb2a06', '2026-05-22', '21:00:00', '21:30:00', 2, 0, false),
	('ce371152-dc12-42ee-b7a0-dd8c40f3f159', '2026-05-22', '21:30:00', '22:00:00', 2, 0, false),
	('1bbc4ba8-391c-4eca-b7b4-b9e078faab03', '2026-05-22', '22:00:00', '22:30:00', 2, 0, false),
	('6429b2ef-f6ca-4bbd-b680-8936a582a9c4', '2026-05-22', '22:30:00', '23:00:00', 2, 0, false),
	('ef8aa377-839a-4ce2-8539-7469644fdc1d', '2026-05-22', '23:00:00', '23:30:00', 2, 0, false),
	('2446da72-39f6-4d41-ac09-c4d838fccb3a', '2026-05-23', '00:00:00', '00:30:00', 2, 0, false),
	('eadfeeb9-488b-40ef-81e3-355402a40ed1', '2026-05-23', '00:30:00', '01:00:00', 2, 0, false),
	('7e2c1595-c65c-4896-9c6b-6267d5db1d9e', '2026-05-23', '01:00:00', '01:30:00', 2, 0, false),
	('fb21fec6-b77c-4989-8c63-ef4179938b88', '2026-05-23', '01:30:00', '02:00:00', 2, 0, false),
	('77cfab4d-e521-4b6d-b23a-7233f39d5b4c', '2026-05-23', '02:00:00', '02:30:00', 2, 0, false),
	('3a5ae17b-c769-4a42-ba14-c5a337fb5b3d', '2026-05-23', '02:30:00', '03:00:00', 2, 0, false),
	('84c375b8-fb25-422f-907c-15332c3f7358', '2026-05-23', '03:00:00', '03:30:00', 2, 0, false),
	('3816e1ec-16e1-42e5-bbf9-11ac33bcbb4d', '2026-05-23', '03:30:00', '04:00:00', 2, 0, false),
	('4fc05d5d-6d19-4043-b3ed-8fb6e0c498a5', '2026-05-23', '08:00:00', '08:30:00', 2, 0, false),
	('15b47abd-ec63-4969-b472-672d584f42f8', '2026-05-23', '08:30:00', '09:00:00', 2, 0, false),
	('35f3ceaa-399a-4e68-a187-59645cc9c4ae', '2026-05-23', '09:00:00', '09:30:00', 2, 0, false),
	('ab186a97-084c-48dc-9139-96438010500b', '2026-05-23', '09:30:00', '10:00:00', 2, 0, false),
	('661b84dd-6b76-4dca-be09-563a280f2d21', '2026-05-23', '10:00:00', '10:30:00', 2, 0, false),
	('155c932c-5440-4d76-8104-bf44ec61e61e', '2026-05-23', '10:30:00', '11:00:00', 2, 0, false),
	('0c773ddc-3ad7-40fb-bb0d-75a6b87b3dfd', '2026-05-23', '11:00:00', '11:30:00', 2, 0, false),
	('30dd8817-bfd1-4a18-9aa9-943834f2384d', '2026-05-23', '11:30:00', '12:00:00', 2, 0, false),
	('47d85d6b-dde6-421f-8096-48b92e3638e1', '2026-05-23', '12:00:00', '12:30:00', 2, 0, false),
	('839304eb-e9d2-4b87-aa51-226742ef9928', '2026-05-23', '12:30:00', '13:00:00', 2, 0, false),
	('e6f6e40b-1738-4d84-b30c-41d477f68711', '2026-05-23', '13:00:00', '13:30:00', 2, 0, false),
	('b94c18e1-ae15-46bf-a7ae-c3fa467bd5ed', '2026-05-23', '13:30:00', '14:00:00', 2, 0, false),
	('794e6a13-364c-4696-8bfe-bcb9c566dce0', '2026-05-23', '14:00:00', '14:30:00', 2, 0, false),
	('8d7c1070-f8dd-46a2-b648-27159c3ed5a7', '2026-05-23', '14:30:00', '15:00:00', 2, 0, false),
	('2b598b94-0254-466f-b5ad-95dc79413f04', '2026-05-23', '15:00:00', '15:30:00', 2, 0, false),
	('7b9e303d-751d-4dab-a01f-520fb1ae048a', '2026-05-23', '15:30:00', '16:00:00', 2, 0, false),
	('8ac8213c-c13d-4caa-a974-6cab80e2f7ef', '2026-05-23', '16:00:00', '16:30:00', 2, 0, false),
	('4b742e99-e53d-4652-b7f1-954024f60663', '2026-05-23', '16:30:00', '17:00:00', 2, 0, false),
	('0d8f1282-ba94-4263-a6b8-b0e103dfc366', '2026-05-23', '17:00:00', '17:30:00', 2, 0, false),
	('415a99b4-4261-435f-bbce-c00d4fdb19c9', '2026-04-30', '17:30:00', '18:00:00', 2, 0, false),
	('d41c681d-cb04-41f9-9f12-2ffdfa81e009', '2026-04-30', '18:00:00', '18:30:00', 2, 0, false),
	('0a75efa2-b313-42cf-967e-a6351f4fccaf', '2026-04-30', '18:30:00', '19:00:00', 2, 0, false),
	('698be5ae-d60d-4d86-860d-74c3be96abe1', '2026-04-30', '19:00:00', '19:30:00', 2, 0, false),
	('c8d31128-6763-4fb7-9072-4c10739474d7', '2026-04-30', '19:30:00', '20:00:00', 2, 0, false),
	('e80c8755-4032-4343-b778-08a326f4e99f', '2026-05-20', '10:30:00', '11:00:00', 2, 0, false),
	('b02531c2-47b4-49db-94e2-5bf714f302d9', '2026-05-20', '11:00:00', '11:30:00', 2, 0, false),
	('78017c8d-fe6b-4220-b33f-53df0d87aa62', '2026-05-20', '11:30:00', '12:00:00', 2, 0, false),
	('67e0afe4-7565-43e9-8112-a9a92003ab77', '2026-05-20', '12:00:00', '12:30:00', 2, 0, false),
	('160a714c-8023-480c-b03d-60180e901a9e', '2026-05-20', '12:30:00', '13:00:00', 2, 0, false),
	('aa55eb70-5535-4fa6-bffa-6cbcf7201343', '2026-05-24', '02:30:00', '03:00:00', 2, 0, false),
	('9854c165-a1d7-447a-8eb4-62987047dc5d', '2026-05-24', '03:00:00', '03:30:00', 2, 0, false),
	('7ec73ef7-e775-4250-9449-cfd94f026398', '2026-05-24', '03:30:00', '04:00:00', 2, 0, false),
	('efd894ab-6889-4f8c-a73d-9831670bc5cb', '2026-05-24', '08:00:00', '08:30:00', 2, 0, false),
	('0be8d89f-5dc0-495e-814a-a989df5ff84d', '2026-05-24', '08:30:00', '09:00:00', 2, 0, false),
	('5f379a06-ed10-4d16-980a-df4ba24a2875', '2026-05-24', '09:00:00', '09:30:00', 2, 0, false),
	('5af42bed-e526-4edc-9eef-c13745685853', '2026-05-24', '09:30:00', '10:00:00', 2, 0, false),
	('41659df6-bc2d-4496-9a82-765ee8ade91e', '2026-05-24', '10:00:00', '10:30:00', 2, 0, false),
	('43b16108-e17a-4413-83f2-f0dc14fb9d70', '2026-05-24', '10:30:00', '11:00:00', 2, 0, false),
	('bc6dc3e2-a20e-4d87-a73b-c9eb8f99d1b2', '2026-05-24', '11:00:00', '11:30:00', 2, 0, false),
	('f5b6f939-3ae5-44db-b29f-698fd7da7f36', '2026-05-24', '11:30:00', '12:00:00', 2, 0, false),
	('e620f0cc-ac8d-4853-b0d6-a0a9c6b9511b', '2026-05-24', '12:00:00', '12:30:00', 2, 0, false),
	('232629e2-435a-4a2c-a64f-9fc31527fe75', '2026-05-24', '12:30:00', '13:00:00', 2, 0, false),
	('4a40d35b-46f1-4c48-8db9-ce5c0b738884', '2026-05-24', '13:00:00', '13:30:00', 2, 0, false),
	('6462dfc6-ec20-4b7f-8ce2-cacfd7f6d204', '2026-05-24', '13:30:00', '14:00:00', 2, 0, false),
	('94315d09-3ffa-4b51-b06c-f0a64ae4937f', '2026-05-24', '14:00:00', '14:30:00', 2, 0, false),
	('a7970fc5-204b-4cd8-8881-48c2a2262817', '2026-04-28', '17:00:00', '17:30:00', 2, 0, false),
	('8c87521a-9cb3-4f5c-92f4-ece9985e7634', '2026-04-28', '17:30:00', '18:00:00', 2, 0, false),
	('44b25c62-01c7-4dae-a5d5-e657a6913850', '2026-04-26', '11:00:00', '12:00:00', 4, 0, false),
	('69ffda7a-aa54-42ce-9208-c357ad7d89b0', '2026-04-26', '13:00:00', '14:00:00', 4, 0, false),
	('01be81a0-dff2-4ba4-98b3-76d775686cc5', '2026-04-26', '14:00:00', '15:00:00', 4, 0, false),
	('8368e938-d5b3-4496-be9b-7dc48940335f', '2026-04-26', '17:00:00', '18:00:00', 4, 0, false),
	('699b1fc8-7767-4374-92dc-80cbfca1c6fc', '2026-05-31', '01:30:00', '02:00:00', 2, 0, false),
	('ac61eeb5-c61b-4c87-82a3-8c562f49ebe7', '2026-05-24', '01:00:00', '01:30:00', 2, 0, false),
	('b7eab575-5cd8-446b-b681-560694dd6dbe', '2026-05-19', '13:30:00', '14:00:00', 2, 0, false),
	('cb344b9b-e5ef-45b4-b499-3ffcde5425ff', '2026-05-19', '17:30:00', '18:00:00', 2, 0, false),
	('f9feb0ae-2607-40cb-8be8-187ff508c8bb', '2026-05-26', '14:00:00', '14:30:00', 2, 0, false),
	('7f4f7026-702a-4d8a-8afc-fd8aca33b2f7', '2026-05-13', '08:30:00', '09:00:00', 2, 0, false),
	('4a64181f-6548-4788-913e-70936bb36c7e', '2026-05-13', '09:00:00', '09:30:00', 2, 0, false),
	('997b8ca0-cb56-43d1-bac2-0898d7254c74', '2026-05-13', '09:30:00', '10:00:00', 2, 0, false),
	('37cc90e9-1a83-48d4-832b-85088eaece8c', '2026-05-19', '00:30:00', '01:00:00', 2, 0, false),
	('bc8f0a2c-faa5-40c1-968a-d956feab4a3a', '2026-05-10', '16:30:00', '17:00:00', 2, 0, false),
	('d00db9ef-b501-480e-aaf3-fb4ff5aabd55', '2026-05-31', '02:00:00', '02:30:00', 2, 0, false),
	('0068c4e9-cf7e-4e19-be35-43e8d013f5af', '2026-05-31', '02:30:00', '03:00:00', 2, 0, false),
	('c9652b15-d0bb-4477-8132-68faf66c16dc', '2026-05-31', '03:00:00', '03:30:00', 2, 0, false),
	('e7b43c82-391f-4000-8500-280bdcbe3590', '2026-05-31', '03:30:00', '04:00:00', 2, 0, false),
	('9b08c10e-8722-4290-a685-d1cb145174b3', '2026-05-31', '08:00:00', '08:30:00', 2, 0, false),
	('59f402d9-e003-4253-b6ea-00f2ae880451', '2026-05-31', '08:30:00', '09:00:00', 2, 0, false),
	('b62480f0-da56-4144-8be5-6599a7757593', '2026-05-31', '09:00:00', '09:30:00', 2, 0, false),
	('3ded44db-bb23-4f01-9e72-787c48e813a2', '2026-05-06', '11:30:00', '12:00:00', 2, 0, false),
	('6740d954-0cc5-452e-a69e-f7ac6f45beb5', '2026-05-12', '14:30:00', '15:00:00', 2, 0, false),
	('14f255cf-d50a-45e2-a6bf-670dc59c02d8', '2026-05-12', '15:00:00', '15:30:00', 2, 0, false),
	('0d8935ce-9c4f-40cf-b7da-a42d0ad0cfa3', '2026-05-12', '15:30:00', '16:00:00', 2, 0, false),
	('5b87c1e4-7a61-4519-94aa-011e990a8884', '2026-05-12', '16:00:00', '16:30:00', 2, 0, false),
	('dba3cab2-6ff9-4748-b1df-7f70d88ec710', '2026-05-12', '16:30:00', '17:00:00', 2, 0, false),
	('43c39076-23ec-4567-938e-b11c89e94dd6', '2026-05-12', '17:00:00', '17:30:00', 2, 0, false),
	('d3b6076d-a5b5-4b2a-89c7-493a019d2fa2', '2026-05-12', '17:30:00', '18:00:00', 2, 0, false),
	('9473a5cc-5d76-4584-bd86-85debd7ec601', '2026-05-12', '18:00:00', '18:30:00', 2, 0, false),
	('82dcf63e-88be-4117-a25c-619d65498b55', '2026-05-12', '18:30:00', '19:00:00', 2, 0, false),
	('e5786d32-ee8f-4f4d-8c95-3cc56875f501', '2026-05-12', '19:00:00', '19:30:00', 2, 0, false),
	('33923fd7-c426-40eb-8e5e-c4c7612ebaba', '2026-05-12', '19:30:00', '20:00:00', 2, 0, false),
	('00b59b45-2b4c-4ce4-8d4a-eba8db64ed52', '2026-05-12', '20:00:00', '20:30:00', 2, 0, false),
	('fe0fe057-bb01-4d99-895f-9a5c288cbd4c', '2026-05-12', '20:30:00', '21:00:00', 2, 0, false),
	('073099e3-b154-4dfb-9620-ccf04e11a563', '2026-05-12', '21:00:00', '21:30:00', 2, 0, false),
	('91f66a4a-36ec-4771-b114-adced5e6b9b8', '2026-05-25', '01:30:00', '02:00:00', 2, 0, false),
	('66f9fbc2-f133-4371-897e-d98b6d37d9ac', '2026-05-25', '02:00:00', '02:30:00', 2, 0, false),
	('6fbf927a-ad4e-4930-98c5-5673e0619ad7', '2026-05-20', '13:00:00', '13:30:00', 2, 0, false),
	('a2150892-7121-4c18-a67d-4a4a4d67a69c', '2026-05-20', '13:30:00', '14:00:00', 2, 0, false),
	('064ee202-9811-4ed4-a886-589f9282b208', '2026-05-20', '14:00:00', '14:30:00', 2, 0, false),
	('dd1ac29f-f7b6-412d-b4ca-65ee7c08ed68', '2026-05-20', '14:30:00', '15:00:00', 2, 0, false),
	('59960594-e85b-4d66-b967-6b5d7a493d31', '2026-05-20', '15:00:00', '15:30:00', 2, 0, false),
	('e3e10c70-65ef-4679-bac9-f6cc4d93d5b9', '2026-05-20', '15:30:00', '16:00:00', 2, 0, false),
	('f4287c38-93dd-43d7-a46f-b3b99539a266', '2026-05-20', '16:00:00', '16:30:00', 2, 0, false),
	('b92430f6-7bf5-43cd-a708-babe14a11b85', '2026-05-20', '16:30:00', '17:00:00', 2, 0, false),
	('781ae231-5054-44a6-9300-6c467b147621', '2026-05-20', '17:00:00', '17:30:00', 2, 0, false),
	('6f4107d3-f3f5-4fd7-aad6-8a6622604ded', '2026-05-20', '17:30:00', '18:00:00', 2, 0, false),
	('c5ce8598-11b6-4285-bc36-5cbfe7c51a2e', '2026-05-20', '18:00:00', '18:30:00', 2, 0, false),
	('07374ce4-8171-49d0-b700-95c9b53cd23c', '2026-05-20', '18:30:00', '19:00:00', 2, 0, false),
	('1d25b65b-11d2-4121-ad89-927cf56d071d', '2026-05-20', '19:00:00', '19:30:00', 2, 0, false),
	('a85bb7a3-1cbb-4f90-9fe6-8970129ccd21', '2026-05-20', '19:30:00', '20:00:00', 2, 0, false),
	('9bdb0d5c-742d-446b-a5a5-8c4671e69917', '2026-05-20', '20:00:00', '20:30:00', 2, 0, false),
	('56505395-2893-4d8d-8912-130d6de89477', '2026-05-20', '20:30:00', '21:00:00', 2, 0, false),
	('5e532840-8e81-4fca-8dac-e5f2ba788bfa', '2026-05-21', '15:00:00', '15:30:00', 2, 0, false),
	('c9c0f364-e037-4646-ad9d-4aaab37304cf', '2026-05-21', '15:30:00', '16:00:00', 2, 0, false),
	('ea005bc6-d54b-4994-a370-425717596e9a', '2026-05-21', '16:00:00', '16:30:00', 2, 0, false),
	('fbc34166-0d9c-4444-a86d-e44f577ef870', '2026-05-21', '16:30:00', '17:00:00', 2, 0, false),
	('d004d498-7bb8-4b65-b134-6f851eb54148', '2026-05-21', '17:00:00', '17:30:00', 2, 0, false),
	('c9183706-381b-40b9-bc2e-670cc07fa31e', '2026-05-21', '17:30:00', '18:00:00', 2, 0, false),
	('8bb223d3-d21d-4601-873d-f83b96f93d2e', '2026-05-25', '02:30:00', '03:00:00', 2, 0, false),
	('3cc42bcb-0591-40c2-8ecc-2f054eca8878', '2026-05-25', '03:00:00', '03:30:00', 2, 0, false),
	('e0881a50-ec3a-406a-a028-f4684792ad76', '2026-05-25', '03:30:00', '04:00:00', 2, 0, false),
	('12fc7f87-3b31-49ae-bb4d-81681696ed4a', '2026-05-25', '12:30:00', '13:00:00', 2, 0, false),
	('9f4e8c9a-dd06-4685-a6ec-4880784daacb', '2026-05-25', '13:00:00', '13:30:00', 2, 0, false),
	('3bb24609-b5aa-4190-8b1b-7de5d5d1f2d0', '2026-05-19', '02:30:00', '03:00:00', 2, 0, false),
	('2f6c86a0-03e1-49d9-b48e-482a24353448', '2026-05-25', '13:30:00', '14:00:00', 2, 0, false),
	('e01d348a-317a-43d5-a077-0f27b6716605', '2026-05-25', '14:00:00', '14:30:00', 2, 0, false),
	('95362479-f6bf-4426-b551-59b1b4544d1d', '2026-05-25', '14:30:00', '15:00:00', 2, 0, false),
	('ec77d282-4131-4c85-a56d-b2db91a0d210', '2026-05-25', '15:00:00', '15:30:00', 2, 0, false),
	('0e55f4da-6516-4b45-9ecc-42854015ef21', '2026-05-25', '15:30:00', '16:00:00', 2, 0, false),
	('15de8559-639b-4e93-bae0-99e0b1532aec', '2026-05-25', '16:00:00', '16:30:00', 2, 0, false),
	('8024d032-e720-41a2-bce9-cd7d8692b28c', '2026-05-25', '16:30:00', '17:00:00', 2, 0, false),
	('9bcf54ba-638d-4271-9c85-13988c86b300', '2026-05-25', '17:00:00', '17:30:00', 2, 0, false),
	('ce6c825c-78e3-431f-ac98-b2d670ac160c', '2026-05-25', '17:30:00', '18:00:00', 2, 0, false),
	('8f8243e3-15e7-4aac-9fd3-60f19da08de9', '2026-05-25', '18:00:00', '18:30:00', 2, 0, false),
	('1e85ff1f-3d02-4109-808c-a9f4c07ddf5e', '2026-05-25', '18:30:00', '19:00:00', 2, 0, false),
	('0bc441e2-753e-4dca-9e6b-75a8c1a512e1', '2026-05-25', '19:00:00', '19:30:00', 2, 0, false),
	('08fb893f-0baf-462d-b255-4b462d3e523c', '2026-05-25', '19:30:00', '20:00:00', 2, 0, false),
	('5c95e8fb-1b08-403e-a0bb-b5f89807904b', '2026-05-25', '20:00:00', '20:30:00', 2, 0, false),
	('98089626-8520-4e1e-9b8d-731618ce15eb', '2026-05-25', '20:30:00', '21:00:00', 2, 0, false),
	('45238379-931f-4794-aa58-79b7f57fe83f', '2026-05-25', '21:00:00', '21:30:00', 2, 0, false),
	('5f393cd9-e442-46ef-ada1-5c06389c6ed4', '2026-05-25', '21:30:00', '22:00:00', 2, 0, false),
	('01ed49bf-e92e-4dc2-b484-8c7d6887f335', '2026-05-25', '22:00:00', '22:30:00', 2, 0, false),
	('4bd15ab3-dcb2-424b-92c1-e16a1e9b380a', '2026-05-25', '22:30:00', '23:00:00', 2, 0, false),
	('65d64afa-3cd7-4990-98b5-a31427cf12d2', '2026-05-25', '23:00:00', '23:30:00', 2, 0, false),
	('5502636d-33df-4d8a-a3af-c04c2f23cb2f', '2026-05-26', '00:00:00', '00:30:00', 2, 0, false),
	('f6ee2fea-5a79-455a-89f2-92fa557b8d04', '2026-05-06', '16:30:00', '17:00:00', 2, 0, false),
	('c362660e-2368-41ca-acc0-240d1a789144', '2026-05-13', '10:00:00', '10:30:00', 2, 0, false),
	('8cb86497-eee4-41fc-9593-9d5796e51480', '2026-05-13', '10:30:00', '11:00:00', 2, 0, false),
	('e387b0bc-562e-43ff-8925-610f21f5d0ef', '2026-05-13', '11:00:00', '11:30:00', 2, 0, false),
	('3bc95fc1-e11b-4a38-9412-d4b27381ac76', '2026-05-13', '11:30:00', '12:00:00', 2, 0, false),
	('3c3497bb-2cc6-42ab-b02a-22cf72345edc', '2026-05-10', '17:00:00', '17:30:00', 2, 0, false),
	('049d2590-fa35-4345-bdd9-ec75c6c5e979', '2026-05-10', '17:30:00', '18:00:00', 2, 0, false),
	('54de15c0-4d5d-488e-b9a0-c64607e6dee2', '2026-05-10', '18:00:00', '18:30:00', 2, 0, false),
	('b922caf4-b751-46c4-b221-2bad72a2cc8b', '2026-05-10', '18:30:00', '19:00:00', 2, 0, false),
	('98bc9349-6452-4253-ae81-c36a0c9688a0', '2026-05-10', '19:30:00', '20:00:00', 2, 0, false),
	('583e6688-612f-48e9-b51a-f1af71cd2867', '2026-05-10', '19:00:00', '19:30:00', 2, 0, false),
	('5eaefae1-4212-4411-a9d5-e50d02b4a970', '2026-05-26', '00:30:00', '01:00:00', 2, 0, false),
	('bdce0917-b026-4e63-b3a1-f05a49ca4c85', '2026-05-26', '01:00:00', '01:30:00', 2, 0, false),
	('c8803fc5-b219-42f8-a0fc-08f1c731e77f', '2026-05-26', '01:30:00', '02:00:00', 2, 0, false),
	('4e897255-baf2-40eb-bd65-69ab60956b9a', '2026-05-26', '02:00:00', '02:30:00', 2, 0, false),
	('42bed757-51a7-4d35-9b47-0bf46325dcc3', '2026-05-26', '02:30:00', '03:00:00', 2, 0, false),
	('422eb8e6-b036-4e71-aa2c-2852d503cbb1', '2026-05-26', '03:00:00', '03:30:00', 2, 0, false),
	('2e9a9406-3091-435a-83f7-8f167a906c7c', '2026-05-26', '03:30:00', '04:00:00', 2, 0, false),
	('61ec46fd-db75-4bfa-9a91-f9620003260a', '2026-05-19', '21:30:00', '22:00:00', 2, 0, false),
	('7bed5d04-3775-4816-9b27-ace6a8d9cf41', '2026-06-05', '00:30:00', '01:00:00', 2, 0, false),
	('9c4745a0-584b-4fb8-8015-93df071e2207', '2026-06-05', '01:00:00', '01:30:00', 2, 0, false),
	('f92ec304-9c7a-45ad-8927-24e8975ba8bf', '2026-06-05', '01:30:00', '02:00:00', 2, 0, false),
	('2d89e055-e221-4a8e-a848-95c508f9a454', '2026-06-05', '02:00:00', '02:30:00', 2, 0, false),
	('adf77189-a471-4620-afab-16f8a7ff5b6f', '2026-06-05', '02:30:00', '03:00:00', 2, 0, false),
	('8d2c5e86-3997-4946-81a4-17f77caef383', '2026-06-05', '03:00:00', '03:30:00', 2, 0, false),
	('be282276-effd-4428-92bf-104915f13c87', '2026-06-26', '17:00:00', '17:30:00', 2, 0, false),
	('eac7cfcd-d38c-4c56-a070-658830633329', '2026-06-26', '17:30:00', '18:00:00', 2, 0, false),
	('d8919ee8-7d5c-4c8b-84ba-8d14bad5917c', '2026-06-26', '18:00:00', '18:30:00', 2, 0, false),
	('4af69beb-c69f-489d-abfe-17267df45771', '2026-06-26', '18:30:00', '19:00:00', 2, 0, false),
	('1cea140b-2604-4d94-9b80-6cfea1bc483d', '2026-06-26', '19:00:00', '19:30:00', 2, 0, false),
	('d72158c3-a60d-4c38-8c80-303fa0081355', '2026-06-26', '19:30:00', '20:00:00', 2, 0, false),
	('753ba094-800e-4768-915a-1496d0469295', '2026-06-26', '20:30:00', '21:00:00', 2, 0, false),
	('d23290a0-063f-43b2-9195-ebb0ab9c16ff', '2026-06-26', '21:00:00', '21:30:00', 2, 0, false),
	('79225e31-ec3d-4031-adb5-c4147e99f3c0', '2026-06-26', '21:30:00', '22:00:00', 2, 0, false),
	('33e4dea6-f2b2-459b-9d2a-0db87a5cde58', '2026-06-26', '22:00:00', '22:30:00', 2, 0, false),
	('f63a7ddd-b981-4cf3-a4c3-4722d0ff2f01', '2026-06-26', '22:30:00', '23:00:00', 2, 0, false),
	('31b464be-c000-42e1-b517-5922f4e02270', '2026-07-04', '08:00:00', '08:30:00', 2, 0, false),
	('b55b7d53-ad0d-4a6f-81b2-f7800f0aee32', '2026-07-04', '08:30:00', '09:00:00', 2, 0, false),
	('9a3ec19e-d599-439e-bddf-352e3901986e', '2026-07-04', '09:00:00', '09:30:00', 2, 0, false),
	('7c940533-f608-4988-90f2-6449a8604e83', '2026-07-04', '09:30:00', '10:00:00', 2, 0, false),
	('e353d2a8-95d0-478f-acbf-71cd4af476b9', '2026-07-04', '10:30:00', '11:00:00', 2, 0, false),
	('124b55e7-d541-4b4b-82f3-f3b6ba802d46', '2026-07-04', '11:00:00', '11:30:00', 2, 0, false),
	('dafacfce-d59b-49b3-8028-4b45ac8eae61', '2026-07-04', '11:30:00', '12:00:00', 2, 0, false),
	('a1bf0887-2267-4a49-9250-049c1daec1a3', '2026-07-04', '12:00:00', '12:30:00', 2, 0, false),
	('610fe807-bb1d-4e0a-b761-f14b7fec45ee', '2026-07-04', '12:30:00', '13:00:00', 2, 0, false),
	('f5a7c018-fbb6-45ef-9ef8-1200ae1625d4', '2026-07-04', '13:00:00', '13:30:00', 2, 0, false),
	('8fe9ef9a-a8a6-48c2-8138-ea5c8ca1132d', '2026-07-04', '13:30:00', '14:00:00', 2, 0, false),
	('1c84d6dc-36a6-4111-b407-653cc2463dd3', '2026-07-04', '14:00:00', '14:30:00', 2, 0, false),
	('e8fe71eb-e18d-470a-9de5-b0f1f4eaf5a8', '2026-07-04', '14:30:00', '15:00:00', 2, 0, false),
	('5b7a9034-e1ac-4b91-8f3e-926224dac437', '2026-07-04', '15:00:00', '15:30:00', 2, 0, false),
	('37e8811b-c0df-4401-8681-d392cbd1b609', '2026-07-04', '15:30:00', '16:00:00', 2, 0, false),
	('d0d500c6-7344-4145-b142-6066eff31ee8', '2026-07-04', '16:00:00', '16:30:00', 2, 0, false),
	('f748d8d9-8c6c-44e7-952e-1ff0977dfd4a', '2026-07-04', '16:30:00', '17:00:00', 2, 0, false),
	('efd75fc7-2538-4069-854f-a10d894ef1e7', '2026-07-04', '17:00:00', '17:30:00', 2, 0, false),
	('11f1e0ae-a69f-471b-b09e-aa8125a9989c', '2026-07-04', '17:30:00', '18:00:00', 2, 0, false),
	('968941f3-bd1d-4064-8c04-5c8643b607ed', '2026-07-04', '18:00:00', '18:30:00', 2, 0, false),
	('773149a9-ced8-429d-b705-d9f13eb8da01', '2026-07-04', '18:30:00', '19:00:00', 2, 0, false),
	('4d194a02-6771-4794-8da3-b20c23b04e8d', '2026-07-04', '19:00:00', '19:30:00', 2, 0, false),
	('b9b54b04-f05d-481f-8e64-9378c54002b9', '2026-07-04', '19:30:00', '20:00:00', 2, 0, false),
	('94f8eb90-4b90-4b4b-be2c-ecc5e0b3d158', '2026-07-04', '20:00:00', '20:30:00', 2, 0, false),
	('1d1b0c09-7386-4f82-afe3-862825e0c5b8', '2026-07-04', '20:30:00', '21:00:00', 2, 0, false),
	('9cc6ac7a-7dee-4aca-8ba7-40e4534ca34a', '2026-06-05', '03:30:00', '04:00:00', 2, 0, false),
	('091bd969-2234-43c2-939d-f42c68a5eb99', '2026-06-05', '08:00:00', '08:30:00', 2, 0, false),
	('cbcc750d-4191-425f-bf27-1351d45d7405', '2026-05-31', '09:30:00', '10:00:00', 2, 0, false),
	('b022a7c0-8262-48b2-a9fa-17804f462b37', '2026-05-31', '10:00:00', '10:30:00', 2, 0, false),
	('14d9ec29-d01d-428b-8c24-b4d559b74dab', '2026-05-31', '10:30:00', '11:00:00', 2, 0, false),
	('f818f732-6d67-47fc-b03a-4b82bb485552', '2026-05-31', '11:00:00', '11:30:00', 2, 0, false),
	('2ab67f53-2827-4e85-8bba-71f9d1fc11ca', '2026-05-31', '11:30:00', '12:00:00', 2, 0, false),
	('f45b36a4-909a-479c-9029-c3ba1200edf6', '2026-05-22', '20:00:00', '20:30:00', 2, 0, false),
	('bc3ade61-4b02-4032-be55-e2c649e8e20a', '2026-05-31', '12:00:00', '12:30:00', 2, 0, false),
	('a60a552f-983a-4825-8bbe-0d7f4d6d71a0', '2026-05-31', '12:30:00', '13:00:00', 2, 0, false),
	('8756caf0-9183-4414-b18e-903a7c4faa3a', '2026-05-31', '13:00:00', '13:30:00', 2, 0, false),
	('893b0139-e9cc-4ac1-a133-d3cbffffd805', '2026-05-31', '13:30:00', '14:00:00', 2, 0, false),
	('0ceaa630-22e2-41ce-a2cc-8e830d4c3a3a', '2026-05-31', '14:00:00', '14:30:00', 2, 0, false),
	('e1938d22-8d4f-4468-8b57-fb41295be381', '2026-05-31', '22:00:00', '22:30:00', 2, 0, false),
	('48049914-af03-4176-8fac-9390968c1224', '2026-05-31', '22:30:00', '23:00:00', 2, 0, false),
	('ebc662eb-6c0c-420e-a241-7b8c53480d06', '2026-05-12', '08:00:00', '08:30:00', 2, 0, false),
	('4428f99b-00a0-4e86-ac15-1a1959e4c8f9', '2026-05-25', '00:00:00', '00:30:00', 2, 0, false),
	('6289dc2e-4c6e-4c02-9a11-184a5c63c320', '2026-05-25', '00:30:00', '01:00:00', 2, 0, false),
	('541b879f-13b5-41ca-a502-d820442e3e24', '2026-05-25', '01:00:00', '01:30:00', 2, 0, false),
	('2b0cc787-e646-4b2f-af51-b9a7d1e10169', '2026-05-12', '08:30:00', '09:00:00', 2, 0, false),
	('03b95451-4c81-4253-92fd-ad0806816550', '2026-05-12', '09:00:00', '09:30:00', 2, 0, false),
	('82112ccd-ed32-4782-9022-62c99246dbe4', '2026-05-12', '09:30:00', '10:00:00', 2, 0, false),
	('488725dd-4c11-4638-8aa7-b68831261ba4', '2026-05-12', '10:00:00', '10:30:00', 2, 0, false),
	('c422f031-3f99-4510-966d-bd302bf7cddb', '2026-05-12', '10:30:00', '11:00:00', 2, 0, false),
	('00f67da1-27ee-43c0-9de7-733a4e732b87', '2026-05-12', '11:00:00', '11:30:00', 2, 0, false),
	('b23403ef-f662-4a98-b922-957775c65bd3', '2026-05-12', '11:30:00', '12:00:00', 2, 0, false),
	('16a351b4-9336-4383-9bd7-ef0b5a22e3fd', '2026-05-12', '12:30:00', '13:00:00', 2, 0, false),
	('53172808-f802-4c1c-b053-fde49410253b', '2026-05-12', '13:00:00', '13:30:00', 2, 0, false),
	('49a5d3a7-6bb9-43f0-a149-965e198bf873', '2026-05-12', '13:30:00', '14:00:00', 2, 0, false),
	('028e4b8a-ba02-4a49-ba36-7b7085818a87', '2026-04-29', '09:30:00', '10:00:00', 2, 0, false),
	('680232ec-1133-4804-bb83-546ff2a437b6', '2026-05-12', '14:00:00', '14:30:00', 2, 0, false),
	('140b49f9-f18e-48a8-8502-520e2a347844', '2026-05-13', '12:30:00', '13:00:00', 2, 0, false),
	('e84efe80-bfff-47b3-9e46-8a3bb8231f4a', '2026-05-13', '13:00:00', '13:30:00', 2, 0, false),
	('eed75c79-b12a-48ae-8cdf-edd8adc6685d', '2026-05-13', '13:30:00', '14:00:00', 2, 0, false),
	('12f4cb35-9769-4508-9baf-4c9b3fc5f389', '2026-05-13', '14:00:00', '14:30:00', 2, 0, false),
	('469b47fb-9e21-4d97-8a41-db0815e4a455', '2026-05-13', '14:30:00', '15:00:00', 2, 0, false),
	('6aec0716-c4ee-4fe4-ba9c-41c95ceb59bc', '2026-05-13', '15:00:00', '15:30:00', 2, 0, false),
	('24820b36-99ad-4a51-9217-9789ddf044cb', '2026-05-13', '15:30:00', '16:00:00', 2, 0, false),
	('4ab2369a-ccf6-444b-99cc-e33d3d4bcaf4', '2026-05-30', '08:00:00', '08:30:00', 2, 0, false),
	('bac83198-3c25-4494-b7f6-3c63a46abb17', '2026-05-30', '08:30:00', '09:00:00', 2, 0, false),
	('62607491-5cb1-4851-9dd0-b22ac01f4a02', '2026-05-30', '09:00:00', '09:30:00', 2, 0, false),
	('8cd6ed49-ca2f-49ab-ac89-0451eb344a61', '2026-05-30', '09:30:00', '10:00:00', 2, 0, false),
	('d80dd354-4499-44d1-ad9c-6759fdd7e58a', '2026-07-04', '21:00:00', '21:30:00', 2, 0, false),
	('cd133ec8-5485-4650-9873-b925e732b93c', '2026-07-04', '21:30:00', '22:00:00', 2, 0, false),
	('560cf2b4-0abc-4f34-9dfa-d7babfaaaec4', '2026-07-04', '22:00:00', '22:30:00', 2, 0, false),
	('4b6bd720-4083-44f0-854d-d517560d0c47', '2026-07-04', '22:30:00', '23:00:00', 2, 0, false),
	('7b5ce8ff-4f43-455a-abde-8f32db7ad1e9', '2026-07-09', '20:00:00', '20:30:00', 2, 0, false),
	('8955cfdc-4692-409f-89bc-b13ee3692f8f', '2026-07-09', '20:30:00', '21:00:00', 2, 0, false),
	('5217b87d-a4a1-49be-9545-e965cb1939dc', '2026-07-09', '21:00:00', '21:30:00', 2, 0, false),
	('612d2c09-cdcc-48ed-a076-6ce54222c221', '2026-07-09', '21:30:00', '22:00:00', 2, 0, false),
	('38388063-d063-42cf-8cd9-82dcb75602bf', '2026-07-09', '22:00:00', '22:30:00', 2, 0, false),
	('6e38e683-7542-4050-9955-4a7e6e6b6b3b', '2026-07-09', '22:30:00', '23:00:00', 2, 0, false),
	('38657551-3225-427b-8a25-1d7d2a334734', '2026-06-26', '20:00:00', '20:30:00', 2, 0, false),
	('139824a5-2d9c-48a4-8d01-b5862ad3afef', '2026-07-13', '08:00:00', '08:30:00', 2, 0, false),
	('c077ad95-e123-4949-b2f5-6a6bf556fcee', '2026-07-13', '08:30:00', '09:00:00', 2, 0, false),
	('daa1927d-0463-476d-aa3d-cafe9a178e50', '2026-07-13', '09:00:00', '09:30:00', 2, 0, false),
	('ed6d70d0-3cb4-4828-b8dd-00f24a3588c6', '2026-07-13', '09:30:00', '10:00:00', 2, 0, false),
	('0c057a34-8a38-493e-9342-c8abd34f0ac0', '2026-07-13', '10:00:00', '10:30:00', 2, 0, false),
	('fe15cddf-2782-420f-8fce-35a8a2c11786', '2026-07-29', '21:30:00', '22:00:00', 2, 0, false),
	('4adff8aa-3bb7-4363-9f65-f4e7c94aafd4', '2026-05-30', '10:00:00', '10:30:00', 2, 0, false),
	('1e6553c0-f7b6-47bd-9c42-c500c207f868', '2026-05-30', '10:30:00', '11:00:00', 2, 0, false),
	('39b05ee1-f913-498b-9119-025a1d74add7', '2026-05-30', '11:00:00', '11:30:00', 2, 0, false),
	('e2cee935-501e-4355-8783-a98edc5bd1fd', '2026-05-30', '11:30:00', '12:00:00', 2, 0, false),
	('5e7b1849-63ea-45c8-a665-8e255e7de4d8', '2026-05-30', '12:00:00', '12:30:00', 2, 0, false),
	('a7fe1950-5255-4579-bd4b-a4917da5011d', '2026-05-30', '12:30:00', '13:00:00', 2, 0, false),
	('d089c67a-1f11-4e16-ad4a-24b4b5842519', '2026-05-24', '14:30:00', '15:00:00', 2, 0, false),
	('60a667eb-b654-4889-9f37-ace39257e4c6', '2026-05-24', '15:00:00', '15:30:00', 2, 0, false),
	('48b46d77-c992-443d-a4e2-058ba8be8ab9', '2026-05-24', '15:30:00', '16:00:00', 2, 0, false),
	('ffc2a43a-1f22-4dad-b7f2-9e4aed2eeaa8', '2026-05-24', '16:00:00', '16:30:00', 2, 0, false),
	('15850b3b-744c-4abf-95ae-278429832223', '2026-05-24', '16:30:00', '17:00:00', 2, 0, false),
	('1764d748-875a-4774-b471-8b63c6c7af35', '2026-05-24', '17:00:00', '17:30:00', 2, 0, false),
	('67a21a26-3f51-4da1-84bf-65c96fa7a0b2', '2026-05-24', '17:30:00', '18:00:00', 2, 0, false),
	('2d696703-b97b-43f7-8fd4-b0ea4e3aa327', '2026-05-06', '09:00:00', '09:30:00', 2, 0, false),
	('c4768a9c-c909-4a35-a715-dee92ecf1b7f', '2026-07-29', '22:00:00', '22:30:00', 2, 0, false),
	('7e72f63a-20d1-46b6-8dfc-30c927488af2', '2026-06-12', '11:30:00', '12:00:00', 2, 1, false),
	('ad1dbbd6-0c35-4a67-ad29-a64072bcd436', '2026-07-05', '08:00:00', '08:30:00', 2, 0, false),
	('c3748764-12b7-4eda-a773-cda9b73d55c2', '2026-07-05', '08:30:00', '09:00:00', 2, 0, false),
	('05c31402-fe44-4696-97a2-392371d2549c', '2026-07-05', '09:00:00', '09:30:00', 2, 0, false),
	('04164bd9-30a4-4995-a26a-1cf90c28f7d0', '2026-07-05', '09:30:00', '10:00:00', 2, 0, false),
	('c1135c96-4b5a-4e22-9628-49a9dab2d3a5', '2026-07-05', '10:00:00', '10:30:00', 2, 0, false),
	('619ebfb1-226c-4107-8e85-2edc5edfad8a', '2026-07-05', '10:30:00', '11:00:00', 2, 0, false),
	('c713ff7f-a7b2-4027-bc1b-bdb4c4a5d5d4', '2026-07-05', '11:00:00', '11:30:00', 2, 0, false),
	('ce39a759-01b0-474c-bf52-879cca534480', '2026-07-05', '11:30:00', '12:00:00', 2, 0, false),
	('2982aaae-aba9-4c67-96d4-e5b22bdf1d0d', '2026-07-05', '12:00:00', '12:30:00', 2, 0, false),
	('7dafc783-31a2-4b5f-9517-0ab7df261531', '2026-07-05', '12:30:00', '13:00:00', 2, 0, false),
	('8b0d02e8-3206-4350-8885-47b5ca675265', '2026-07-05', '13:00:00', '13:30:00', 2, 0, false),
	('cbaf79d9-8914-4c12-9ba7-7a603eb212b3', '2026-07-05', '13:30:00', '14:00:00', 2, 0, false),
	('fbce3405-3358-4f0c-86dd-b4b38cf875b8', '2026-07-05', '14:00:00', '14:30:00', 2, 0, false),
	('22fdbfc3-d5a2-4c5a-baa1-533c52083659', '2026-07-05', '14:30:00', '15:00:00', 2, 0, false),
	('9d37d861-6152-40d2-ab76-da37c7d3304e', '2026-07-05', '15:00:00', '15:30:00', 2, 0, false),
	('dd954f46-4062-464c-a965-af7dcd33bff5', '2026-07-05', '15:30:00', '16:00:00', 2, 0, false),
	('0c6d2e47-7f65-4e11-9258-6c330555a65f', '2026-07-05', '16:00:00', '16:30:00', 2, 0, false),
	('ed22289e-99a4-4d44-af48-829aab637e8b', '2026-07-05', '16:30:00', '17:00:00', 2, 0, false),
	('52bac74a-e282-4698-a37f-d9933ebc64f7', '2026-07-05', '17:00:00', '17:30:00', 2, 0, false),
	('563cf679-fc0a-4430-9d33-02c0149fe835', '2026-07-05', '17:30:00', '18:00:00', 2, 0, false),
	('2aa1b51d-743c-4b84-a209-122bfe4eb409', '2026-07-05', '18:00:00', '18:30:00', 2, 0, false),
	('2b05ecdc-1fdd-4322-b59e-1232a8708970', '2026-07-05', '18:30:00', '19:00:00', 2, 0, false),
	('6ebbf5d9-f5ed-4f1e-a8ab-cf5149800bd2', '2026-07-05', '19:00:00', '19:30:00', 2, 0, false),
	('4f430f18-5129-44b4-8086-76f2a67df9f9', '2026-07-05', '19:30:00', '20:00:00', 2, 0, false),
	('287a7467-c395-4c72-af42-933689348345', '2026-07-05', '20:00:00', '20:30:00', 2, 0, false),
	('b44289df-7f07-4163-bc9e-c1f1a8839b0f', '2026-07-05', '20:30:00', '21:00:00', 2, 0, false),
	('914b4adb-9e5c-46b6-a3b0-313973d00657', '2026-07-05', '21:00:00', '21:30:00', 2, 0, false),
	('31c8f61e-849b-4149-b2f8-f6b46f8e8772', '2026-07-05', '21:30:00', '22:00:00', 2, 0, false),
	('9a1a98ac-57f2-48c8-87b0-89fac29824f0', '2026-07-05', '22:00:00', '22:30:00', 2, 0, false),
	('a0ac95de-be46-4cdd-9da8-bdad4a7950d9', '2026-07-05', '22:30:00', '23:00:00', 2, 0, false),
	('4dc55cb8-dc65-4141-b54a-d3b068b1569d', '2026-07-10', '08:00:00', '08:30:00', 2, 0, false),
	('82057678-b9c3-4509-a2f8-2c29e47e6123', '2026-07-10', '08:30:00', '09:00:00', 2, 0, false),
	('e452f3b4-60f1-4042-9fa6-fe6860072358', '2026-07-10', '09:00:00', '09:30:00', 2, 0, false),
	('c8d3d79f-8e53-43a4-bbb0-5357735752d8', '2026-07-10', '09:30:00', '10:00:00', 2, 0, false),
	('41440853-40d1-49ff-a8cd-1fa224be96aa', '2026-07-10', '10:00:00', '10:30:00', 2, 0, false),
	('93e9c0d6-fc79-469b-a980-93084435a821', '2026-07-10', '10:30:00', '11:00:00', 2, 0, false),
	('e8ce8e1f-81bc-4c3f-9840-3a99617b44a7', '2026-07-10', '11:00:00', '11:30:00', 2, 0, false),
	('2478ff0e-e7d9-4258-8765-b6678f40c7cd', '2026-07-10', '11:30:00', '12:00:00', 2, 0, false),
	('3545211f-d49e-4614-883b-36c2273e265c', '2026-07-10', '12:00:00', '12:30:00', 2, 0, false),
	('8c8d28de-4b78-4aca-b25d-d5230793d67d', '2026-07-10', '12:30:00', '13:00:00', 2, 0, false),
	('cf66e517-b6cc-4abb-b259-537086f83182', '2026-07-10', '13:00:00', '13:30:00', 2, 0, false),
	('f71c7b32-baa1-403d-ae9d-e65604b1d721', '2026-07-10', '13:30:00', '14:00:00', 2, 0, false),
	('247a6f41-de0b-4e2c-9185-da8195b12934', '2026-07-10', '14:00:00', '14:30:00', 2, 0, false),
	('245520aa-7ae8-4249-a34b-be66422706f0', '2026-07-10', '14:30:00', '15:00:00', 2, 0, false),
	('1200a263-fb02-4356-b85a-e436f4eca0c6', '2026-07-10', '15:00:00', '15:30:00', 2, 0, false),
	('306750d9-dfdb-4f26-89a2-d559b483e207', '2026-07-10', '15:30:00', '16:00:00', 2, 0, false),
	('6cf07919-ecce-4d68-a69f-6e94e22f89e4', '2026-07-10', '16:00:00', '16:30:00', 2, 0, false),
	('5e72f4ee-a73f-4355-8c38-006d65f20710', '2026-07-10', '16:30:00', '17:00:00', 2, 0, false),
	('c01810e8-5e38-4145-8a04-23b3b26b084e', '2026-07-10', '17:00:00', '17:30:00', 2, 0, false),
	('5924f3ff-a0d0-4848-a987-d9044b11f9f3', '2026-07-10', '17:30:00', '18:00:00', 2, 0, false),
	('3ba9e96b-a425-4fd4-87ab-34a4d5093dcb', '2026-07-10', '18:00:00', '18:30:00', 2, 0, false),
	('b44c8026-6f52-481f-9192-a69caeb1a8e5', '2026-07-10', '18:30:00', '19:00:00', 2, 0, false),
	('1ad0e097-65a4-47d5-a60f-3cd171f81f5a', '2026-07-10', '19:00:00', '19:30:00', 2, 0, false),
	('d8cadef2-87ea-46df-a247-6892cfdd3f74', '2026-07-10', '19:30:00', '20:00:00', 2, 0, false),
	('19791bdd-d219-4c20-8a25-0d7337d43d10', '2026-07-10', '20:00:00', '20:30:00', 2, 0, false),
	('ec4f3e61-f096-4077-8625-ed73378ace4e', '2026-07-10', '20:30:00', '21:00:00', 2, 0, false),
	('8e034220-2a62-4598-841e-e0b72c0dbcac', '2026-07-10', '21:00:00', '21:30:00', 2, 0, false),
	('a5e21b7b-633e-4f64-9c73-aa6606463e48', '2026-07-10', '21:30:00', '22:00:00', 2, 0, false),
	('afe1e4c4-8569-4445-810f-1bc6bfe966a3', '2026-07-10', '22:00:00', '22:30:00', 2, 0, false),
	('f32c3548-aab1-4eac-bedb-ee06d9328be6', '2026-07-10', '22:30:00', '23:00:00', 2, 0, false),
	('03f512c5-067e-456b-ad14-62ef6d0519b5', '2026-07-11', '08:00:00', '08:30:00', 2, 0, false),
	('1d01a3d6-dadd-45c3-b900-f5e8769d8820', '2026-07-11', '08:30:00', '09:00:00', 2, 0, false),
	('eb4c5a74-9166-4f3a-8b2b-fd63624f4282', '2026-07-11', '09:00:00', '09:30:00', 2, 0, false),
	('6658ff6f-e94b-4e41-851a-24a1d5707f1d', '2026-07-11', '09:30:00', '10:00:00', 2, 0, false),
	('da07f406-4d2c-45d1-8eb9-44d61a32e558', '2026-07-11', '10:00:00', '10:30:00', 2, 0, false),
	('d1bf4f32-eb20-49e0-8e93-13ab08b316ee', '2026-07-11', '10:30:00', '11:00:00', 2, 0, false),
	('5ec44538-1ec6-4926-b966-fdb7f7574021', '2026-07-11', '11:00:00', '11:30:00', 2, 0, false),
	('704cabcc-3291-4ce2-97f5-88356d0e21a3', '2026-07-11', '11:30:00', '12:00:00', 2, 0, false),
	('359527c8-d017-4f81-89f0-8bb3613f57bf', '2026-07-11', '12:00:00', '12:30:00', 2, 0, false),
	('d0a26b64-e289-4642-a45e-1252457b7199', '2026-07-11', '13:00:00', '13:30:00', 2, 0, false),
	('a9356037-8084-43cc-962c-ffbe3619214d', '2026-07-11', '13:30:00', '14:00:00', 2, 0, false),
	('fcf39e64-827a-48f3-b91e-9c5cba3b61cb', '2026-07-11', '14:00:00', '14:30:00', 2, 0, false),
	('da0905a8-d179-491d-8c12-dbb4e6f6e69f', '2026-07-11', '14:30:00', '15:00:00', 2, 0, false),
	('0d04cfc3-1cd7-498e-826a-9a580a47706d', '2026-07-11', '15:00:00', '15:30:00', 2, 0, false),
	('4f2dbbce-ed92-4aa9-8613-ebe3a23f25a4', '2026-07-11', '15:30:00', '16:00:00', 2, 0, false),
	('7d4f5e04-e8e8-47b9-b9a8-69b65d20a03c', '2026-07-11', '16:00:00', '16:30:00', 2, 0, false),
	('514cb831-97cd-4b85-b775-7c3967d5d84f', '2026-07-11', '17:00:00', '17:30:00', 2, 0, false),
	('f71e063c-5407-4b08-9543-066944d3eae2', '2026-07-11', '17:30:00', '18:00:00', 2, 0, false),
	('45bd67de-f1f8-4279-a54f-47332bf7ac18', '2026-07-11', '12:30:00', '13:00:00', 2, 1, false),
	('b8e6a2ae-84d5-48e8-9ec0-7f2015357b73', '2026-07-11', '16:30:00', '17:00:00', 2, 1, false),
	('d3a87320-a3bb-499d-a584-2351053bec0e', '2026-07-15', '10:00:00', '10:30:00', 2, 0, false),
	('6356557b-22c0-47c7-bf50-479915bc8f19', '2026-07-15', '10:30:00', '11:00:00', 2, 0, false),
	('e5e38acd-f996-4bf7-bc21-f76c3b30a9d4', '2026-07-15', '11:00:00', '11:30:00', 2, 0, false),
	('248a65e2-7400-45b2-a6a1-c1fed4bc380d', '2026-07-15', '11:30:00', '12:00:00', 2, 0, false),
	('0b526fe8-e3a7-4274-a98f-05adbcd35b5a', '2026-07-15', '12:30:00', '13:00:00', 2, 0, false),
	('be6677e3-a492-4c1f-be79-0f12250a2e76', '2026-07-15', '13:00:00', '13:30:00', 2, 0, false),
	('2a547924-3099-4728-aa1c-e4bc4290011f', '2026-07-15', '14:00:00', '14:30:00', 2, 0, false),
	('8e84199f-ac49-44be-af9b-634f0f0a7a3a', '2026-07-15', '14:30:00', '15:00:00', 2, 0, false),
	('85aee33a-c61c-46c8-8a5a-a5c92c853e27', '2026-07-15', '15:00:00', '15:30:00', 2, 0, false),
	('2800ad3c-256d-4b1a-9111-e4782e91c09b', '2026-07-15', '15:30:00', '16:00:00', 2, 0, false),
	('090083b0-f8cc-403b-b9c8-151aa0b0face', '2026-07-15', '16:00:00', '16:30:00', 2, 0, false),
	('d1eb430d-2e2d-4ffd-b1c6-d7eecd3bb749', '2026-07-15', '16:30:00', '17:00:00', 2, 0, false),
	('be3a6529-2569-4f55-a1aa-0fa90f0e91e9', '2026-07-15', '17:00:00', '17:30:00', 2, 0, false),
	('0613d68a-5c61-4278-b048-662820305752', '2026-07-15', '17:30:00', '18:00:00', 2, 0, false),
	('083f306c-5041-4ad0-9453-3b2fbbb5d790', '2026-07-15', '18:00:00', '18:30:00', 2, 0, false),
	('eb6d1443-263d-4325-bdde-15e81c8f156d', '2026-07-15', '18:30:00', '19:00:00', 2, 0, false),
	('edc67379-1c51-459c-bf42-233db97bc7e9', '2026-07-15', '19:00:00', '19:30:00', 2, 0, false),
	('6d84b5c8-08b2-4c47-a727-7036c3784bba', '2026-07-15', '19:30:00', '20:00:00', 2, 0, false),
	('b3a0bded-e4fe-4167-b501-c0f95aaf690b', '2026-07-15', '20:00:00', '20:30:00', 2, 0, false),
	('80c1bb22-89ab-4ac9-97c7-b743a6055ddd', '2026-07-15', '20:30:00', '21:00:00', 2, 0, false),
	('4083bbbf-8d86-4ea6-a23c-51e884764e00', '2026-07-15', '21:00:00', '21:30:00', 2, 0, false),
	('2a731dcd-bed4-4a44-86c6-1675ec2b8a7a', '2026-07-15', '21:30:00', '22:00:00', 2, 0, false),
	('c7941964-498a-4917-9b60-5b3a3f6efb38', '2026-07-15', '22:00:00', '22:30:00', 2, 0, false),
	('f2d88d92-505a-46f1-b385-08e5652db7cb', '2026-07-15', '22:30:00', '23:00:00', 2, 0, false),
	('480ff388-d4ff-4f68-9960-f6562ca0b3f6', '2026-07-16', '08:30:00', '09:00:00', 2, 0, false),
	('364428eb-c608-422e-8423-88a444e492d5', '2026-07-16', '09:00:00', '09:30:00', 2, 0, false),
	('79966e26-e653-440e-93be-1a74b0a82386', '2026-07-16', '09:30:00', '10:00:00', 2, 0, false),
	('c22c9b97-f8ca-414e-a256-dab3d233174b', '2026-07-16', '10:00:00', '10:30:00', 2, 0, false),
	('038de1cf-d410-423e-a2ad-f6d2a549296d', '2026-07-16', '10:30:00', '11:00:00', 2, 0, false),
	('9d784730-721b-4a72-b8f6-3a744cd98142', '2026-07-16', '11:00:00', '11:30:00', 2, 0, false),
	('bc5c798c-ab78-4345-ac04-a6c197215145', '2026-07-16', '11:30:00', '12:00:00', 2, 0, false),
	('b8cbdfcf-1d14-4859-8e0d-e2bf7f280609', '2026-07-16', '12:00:00', '12:30:00', 2, 0, false),
	('1fc03038-3094-476f-ad96-a1f49dbacb27', '2026-07-16', '12:30:00', '13:00:00', 2, 0, false),
	('b9e0d46f-2195-4db6-a5f2-e7e07c08b4aa', '2026-07-16', '13:00:00', '13:30:00', 2, 0, false),
	('8780247c-88ce-422a-b82e-9bf7c5099eb2', '2026-07-16', '13:30:00', '14:00:00', 2, 0, false),
	('9528366d-04c7-4b6a-b6a7-7898dd4e9447', '2026-07-16', '14:00:00', '14:30:00', 2, 0, false),
	('12aa6a12-9cca-461b-a101-a67836484e19', '2026-07-16', '14:30:00', '15:00:00', 2, 0, false),
	('53991dad-365d-409c-a94b-92139dd81f80', '2026-07-16', '15:00:00', '15:30:00', 2, 0, false),
	('d84bbff9-6a60-4b94-ad86-b70531f7430b', '2026-07-16', '15:30:00', '16:00:00', 2, 0, false),
	('64f2bf68-377f-4926-9648-34f0ca95f2a9', '2026-07-16', '16:00:00', '16:30:00', 2, 0, false),
	('ce8a94a6-358c-46a8-bc97-eb49b61b88fb', '2026-07-16', '16:30:00', '17:00:00', 2, 0, false),
	('9505850f-e239-46b9-82fa-cd9afd2a4d67', '2026-07-16', '17:00:00', '17:30:00', 2, 0, false),
	('ec934c10-2462-4779-a652-cb1a24148c52', '2026-07-16', '17:30:00', '18:00:00', 2, 0, false),
	('f97c4c3e-68ba-4b45-9b02-a09afb3d167c', '2026-07-16', '18:00:00', '18:30:00', 2, 0, false),
	('f47eafee-315f-4869-8e72-29cda16f8f43', '2026-07-16', '18:30:00', '19:00:00', 2, 0, false),
	('5d8e2122-e3de-4c9f-a511-1f61cfd14b8f', '2026-07-16', '19:00:00', '19:30:00', 2, 0, false),
	('190f98d5-1f82-44dc-ada8-5757b90a04f6', '2026-07-16', '19:30:00', '20:00:00', 2, 0, false),
	('74158139-6a5b-40a7-9548-b714ca75f4bf', '2026-07-16', '20:00:00', '20:30:00', 2, 0, false),
	('67418636-7093-4304-aedf-01073b01662f', '2026-07-16', '20:30:00', '21:00:00', 2, 0, false),
	('6970cf0c-6adc-469f-9181-3fdad4c38be4', '2026-07-16', '21:00:00', '21:30:00', 2, 0, false),
	('dc710262-b810-4855-a042-d56bf4cada86', '2026-07-16', '21:30:00', '22:00:00', 2, 0, false),
	('abc97de5-4eb8-4421-b04f-4b50154eaa27', '2026-07-16', '22:00:00', '22:30:00', 2, 0, false),
	('c59c2008-d765-4a6e-9e48-c42623086cad', '2026-07-16', '22:30:00', '23:00:00', 2, 0, false),
	('27e75ffd-16dd-4b0a-a723-de2d3d396092', '2026-07-02', '09:30:00', '10:00:00', 2, 1, false),
	('33bc0a00-20d0-48bb-80a8-b9a8ff01d34e', '2026-07-02', '13:30:00', '14:00:00', 2, 1, false),
	('1e8fd0fc-7bee-4e86-864c-874eecfdeaf1', '2026-07-17', '08:00:00', '08:30:00', 2, 0, false),
	('84f6af9d-51fa-4cea-8713-610b2ea01751', '2026-07-17', '08:30:00', '09:00:00', 2, 0, false),
	('78d4d619-4e6e-4a02-976d-719c76bdcb0f', '2026-07-17', '09:00:00', '09:30:00', 2, 0, false),
	('2a73e288-9cb0-41da-b9c0-66c9b88e9836', '2026-07-17', '10:00:00', '10:30:00', 2, 0, false),
	('e8ce21f5-3d0e-43ec-8cf7-12f2b1fe5980', '2026-07-17', '10:30:00', '11:00:00', 2, 0, false),
	('53ff2fa1-d25c-4cf4-9a9d-61ff23180e05', '2026-07-17', '11:00:00', '11:30:00', 2, 0, false),
	('e7d971fb-cba0-48e8-b90e-9f205d41c476', '2026-07-17', '11:30:00', '12:00:00', 2, 0, false),
	('e4050f3e-8278-41f8-a009-81a2b1df90e5', '2026-07-17', '12:00:00', '12:30:00', 2, 0, false),
	('27e72780-9a33-43f5-9b95-374f078a58dd', '2026-07-17', '12:30:00', '13:00:00', 2, 0, false),
	('975bfaaa-962a-4465-8cd5-90ac5c66c4d1', '2026-07-17', '13:00:00', '13:30:00', 2, 0, false),
	('11ecf044-43ed-4eb2-b98c-d8ea0a3f7b88', '2026-07-17', '13:30:00', '14:00:00', 2, 0, false),
	('379c6d21-440f-4b8e-b5d6-3352113eee48', '2026-07-17', '14:00:00', '14:30:00', 2, 0, false),
	('2884af61-4c04-42dc-ae76-3868ea5ed47c', '2026-07-17', '14:30:00', '15:00:00', 2, 0, false),
	('ac669c4e-08e5-4b99-a7c9-de3025f98562', '2026-07-17', '15:00:00', '15:30:00', 2, 0, false),
	('ba7c22a1-0aa6-4f48-bf3d-d13f74dd47d9', '2026-07-17', '15:30:00', '16:00:00', 2, 0, false),
	('61e8ffda-e3f6-4a91-b717-4b5f727647d9', '2026-07-17', '16:00:00', '16:30:00', 2, 0, false),
	('3fbdabc7-2a13-4fbc-8fe8-de3d70729834', '2026-07-17', '16:30:00', '17:00:00', 2, 0, false),
	('9eed61db-0f97-4887-8544-add702b25d7c', '2026-07-17', '17:00:00', '17:30:00', 2, 0, false),
	('68d618d1-7db3-4b7a-8448-44311cbdd8e3', '2026-07-17', '17:30:00', '18:00:00', 2, 0, false),
	('8dc0cdc9-d75e-42db-9677-20bbc8d94549', '2026-07-17', '18:00:00', '18:30:00', 2, 0, false),
	('955835c6-297e-4e20-be9c-5bf2d1dfdc0b', '2026-07-17', '18:30:00', '19:00:00', 2, 0, false),
	('53ecb3dd-1c71-46b6-a899-2ec9e97f8200', '2026-07-17', '19:30:00', '20:00:00', 2, 0, false),
	('c66b8b15-bb06-419f-8760-2e28b8518862', '2026-07-17', '20:00:00', '20:30:00', 2, 0, false),
	('55502f37-0ed9-449d-90b3-942bccf02d69', '2026-07-17', '20:30:00', '21:00:00', 2, 0, false),
	('c045e751-9caf-40ea-8504-23b5b12f7fa0', '2026-07-17', '21:00:00', '21:30:00', 2, 0, false),
	('dc474482-731f-4c7c-869a-6811abf1e65d', '2026-07-17', '21:30:00', '22:00:00', 2, 0, false),
	('0185a014-2464-4230-8d1b-b36c498ef5ba', '2026-07-17', '22:00:00', '22:30:00', 2, 0, false),
	('1f186ae1-ba83-42a3-8b4a-8b715d50609b', '2026-07-17', '22:30:00', '23:00:00', 2, 0, false),
	('c22cbf36-d96d-400a-a87b-37fa20dc6604', '2026-07-18', '08:30:00', '09:00:00', 2, 0, false),
	('f630e76a-e93e-4399-9c80-24a72cb2ffdf', '2026-07-18', '09:00:00', '09:30:00', 2, 0, false),
	('cf2660d1-e6fb-416c-8367-dc5bb84e9b24', '2026-07-18', '09:30:00', '10:00:00', 2, 0, false),
	('ca2acf96-5f11-42f4-b4fb-8b9d08cdfb00', '2026-07-18', '10:00:00', '10:30:00', 2, 0, false),
	('456f3282-6016-497c-a3f7-530404044784', '2026-07-18', '10:30:00', '11:00:00', 2, 0, false),
	('ff1b0cf2-e9ae-44b1-a5a8-d752bd7c1b52', '2026-07-18', '11:00:00', '11:30:00', 2, 0, false),
	('db275204-8541-4734-8adc-fbe3224e8195', '2026-07-18', '11:30:00', '12:00:00', 2, 0, false),
	('1a2d70aa-4e1a-40d7-8f58-1074815f255b', '2026-07-18', '12:00:00', '12:30:00', 2, 0, false),
	('25774d9a-3b4c-4b0b-8a68-c2204d0f5087', '2026-07-15', '13:30:00', '14:00:00', 2, 1, false),
	('69f890d0-4edd-4da4-8664-b64ed2cce0a1', '2026-07-16', '08:00:00', '08:30:00', 2, 1, false),
	('608e9874-b5bd-4205-a038-45dda49c3374', '2026-07-17', '09:30:00', '10:00:00', 2, 1, false),
	('4938fac0-29ef-4dfc-ad1f-64a61f2fbb3f', '2026-07-17', '19:00:00', '19:30:00', 2, 1, false),
	('bbf78e01-42ed-45e6-98e2-945f152329a1', '2026-07-18', '08:00:00', '08:30:00', 2, 1, false),
	('8d29b85f-588d-4e8e-88d8-8c6e3627b2fa', '2026-07-18', '12:30:00', '13:00:00', 2, 0, false),
	('cdabc92b-bcbe-4ab8-a40a-5f8a870989b5', '2026-07-18', '13:00:00', '13:30:00', 2, 0, false),
	('ebc2b962-bbab-49eb-b9d3-4591e6db05e3', '2026-07-18', '13:30:00', '14:00:00', 2, 0, false),
	('46d966ff-f0dd-4609-aa25-3f7f9bfcb337', '2026-07-18', '14:00:00', '14:30:00', 2, 0, false),
	('16162f30-e600-4575-972a-97db3bee0056', '2026-07-18', '14:30:00', '15:00:00', 2, 0, false),
	('5be1c47e-34bd-4fb6-a561-d9d188d30de7', '2026-07-18', '15:00:00', '15:30:00', 2, 0, false),
	('92b3c2ce-0a4c-4fe0-8c96-01856b3eda3b', '2026-07-18', '15:30:00', '16:00:00', 2, 0, false),
	('75526911-6903-4f75-b7aa-ea59d9b36cc8', '2026-07-18', '16:30:00', '17:00:00', 2, 0, false),
	('715893e8-27d6-4fc7-a606-69d34cb29d0a', '2026-07-18', '17:00:00', '17:30:00', 2, 0, false),
	('802124e7-ce2d-4ee8-bb58-f602b7f2310a', '2026-07-18', '17:30:00', '18:00:00', 2, 0, false),
	('c1d71cb7-09ad-455d-a1b6-44d0f4a91cba', '2026-07-18', '18:00:00', '18:30:00', 2, 0, false),
	('a7bce468-3456-455e-8dcf-56b6aca97b7e', '2026-07-18', '18:30:00', '19:00:00', 2, 0, false),
	('b98aee03-94d6-4955-8524-29a640c8c082', '2026-07-18', '19:00:00', '19:30:00', 2, 0, false),
	('75c487e1-7198-4de6-890f-fccf134a119b', '2026-07-18', '20:00:00', '20:30:00', 2, 0, false),
	('584e49e6-5b0f-428e-8c0f-738af3fa136e', '2026-07-18', '20:30:00', '21:00:00', 2, 0, false),
	('d34d6c26-7a64-48af-aa00-e6cc4e161904', '2026-07-18', '21:00:00', '21:30:00', 2, 0, false),
	('a9a9a91d-03b0-4aeb-b570-512709200f7f', '2026-07-18', '21:30:00', '22:00:00', 2, 0, false),
	('a3b03e78-a223-44a2-a51d-7ae6f0ab2ab6', '2026-07-18', '22:00:00', '22:30:00', 2, 0, false),
	('836dc7af-0ccf-4d02-91df-3cd0c606928a', '2026-07-04', '10:00:00', '10:30:00', 2, 0, false),
	('95b0b395-3273-430b-9c34-1eabd521fb65', '2026-07-19', '08:00:00', '08:30:00', 2, 0, false),
	('4c722dcd-8270-42f8-9633-4ee7fa752661', '2026-07-19', '08:30:00', '09:00:00', 2, 0, false),
	('f332e833-3701-46fa-a98a-c114fce1c632', '2026-07-19', '09:00:00', '09:30:00', 2, 0, false),
	('24076854-d81c-43d9-a096-64da226bfdc8', '2026-07-19', '09:30:00', '10:00:00', 2, 0, false),
	('f803bf0a-3bd4-41f2-87d4-dcb9d92b8362', '2026-07-19', '10:00:00', '10:30:00', 2, 0, false),
	('b8efae90-4bd0-4300-bfe6-e65072110d6d', '2026-07-19', '10:30:00', '11:00:00', 2, 0, false),
	('e5be3a47-0053-417b-890b-ccddf1a7ae21', '2026-07-19', '11:00:00', '11:30:00', 2, 0, false),
	('5d66859f-784c-4566-9c80-18f021f50a79', '2026-07-19', '11:30:00', '12:00:00', 2, 0, false),
	('bd5d2ed0-b1be-4fb5-b86a-a7f2048110f5', '2026-07-19', '12:00:00', '12:30:00', 2, 0, false),
	('25781d28-7095-41af-a48b-93b8f7928153', '2026-07-19', '12:30:00', '13:00:00', 2, 0, false),
	('894f058b-2275-4c91-9904-53fe92e352b0', '2026-07-19', '13:30:00', '14:00:00', 2, 0, false),
	('260d0109-ec04-4387-a5c2-6e153b8ffca3', '2026-07-19', '14:00:00', '14:30:00', 2, 0, false),
	('2c75a17f-37dd-478c-99ab-47fe790c7e2a', '2026-07-19', '14:30:00', '15:00:00', 2, 0, false),
	('1c61f3ed-80bb-40ab-a1df-117864cdfbef', '2026-07-19', '15:00:00', '15:30:00', 2, 0, false),
	('80aca296-b852-45d8-9ae4-b67e52c0ed24', '2026-07-19', '15:30:00', '16:00:00', 2, 0, false),
	('a7025897-0b39-4f56-a75a-6f59d0a4e9f6', '2026-07-19', '16:00:00', '16:30:00', 2, 0, false),
	('c0856ac3-a56b-49bc-b316-d7f8ddb5b8e4', '2026-07-19', '16:30:00', '17:00:00', 2, 0, false),
	('c0451cb6-40f6-4082-afe6-8c53a944e446', '2026-07-19', '17:00:00', '17:30:00', 2, 0, false),
	('af3ecb60-d2d5-41c1-935e-a949c2f99579', '2026-07-19', '17:30:00', '18:00:00', 2, 0, false),
	('fe7f4fda-9024-4224-9845-cb97a9e66fcd', '2026-07-19', '18:00:00', '18:30:00', 2, 0, false),
	('8ad7dabe-1ab8-43c8-b4b8-9056f912bd78', '2026-07-19', '18:30:00', '19:00:00', 2, 0, false),
	('d582b0ee-064e-47f9-b010-f65db7873aca', '2026-07-19', '19:00:00', '19:30:00', 2, 0, false),
	('7317175a-bda6-468a-aced-b3bf4119c3ab', '2026-07-19', '19:30:00', '20:00:00', 2, 0, false),
	('8bbc3332-441f-4aef-8ec8-acfc4bd9542f', '2026-07-19', '20:00:00', '20:30:00', 2, 0, false),
	('ad0b9930-20b3-42f8-b037-16741ced9bf5', '2026-07-19', '20:30:00', '21:00:00', 2, 0, false),
	('b06e9adb-edd7-4b0e-9a03-04a5cb7d3a3a', '2026-07-19', '21:00:00', '21:30:00', 2, 0, false),
	('b7c8604a-197f-4683-9a0f-1022ecccbc5e', '2026-07-19', '21:30:00', '22:00:00', 2, 0, false),
	('9d493599-aaad-40ae-8bbb-9b87e7d28707', '2026-07-19', '22:00:00', '22:30:00', 2, 0, false),
	('526d11aa-a99b-44b7-b3e4-c51cbaf98a46', '2026-07-19', '22:30:00', '23:00:00', 2, 0, false),
	('f275f499-d5f2-406a-a4fd-ce91a1a1a255', '2026-07-20', '08:00:00', '08:30:00', 2, 0, false),
	('461680d6-aaf1-4314-a9b5-37b332bd2a21', '2026-07-20', '08:30:00', '09:00:00', 2, 0, false),
	('c0e65ed1-abb3-41a0-8548-c6f06d01fe08', '2026-07-20', '09:00:00', '09:30:00', 2, 0, false),
	('950a36ae-49c7-4286-b609-a0763ddc27b7', '2026-07-20', '09:30:00', '10:00:00', 2, 0, false),
	('3d6531f4-4658-4363-bb9a-0e071fe647d2', '2026-07-20', '10:00:00', '10:30:00', 2, 0, false),
	('796ab0b4-a87e-4c8e-809d-2d4859d81051', '2026-07-20', '10:30:00', '11:00:00', 2, 0, false),
	('c5327bf5-251a-4f41-9ffc-eee203d2bd45', '2026-07-20', '11:00:00', '11:30:00', 2, 0, false),
	('f4ab7159-9d11-4d61-82ef-334bb9f299ab', '2026-07-20', '11:30:00', '12:00:00', 2, 0, false),
	('4f1e6da0-be53-402a-825e-ed823619bb4b', '2026-07-20', '12:00:00', '12:30:00', 2, 0, false),
	('a778ead0-2c6f-4121-8125-5b3b953e15a3', '2026-07-20', '12:30:00', '13:00:00', 2, 0, false),
	('69db0f87-9981-490f-8d5b-3eb2813f66db', '2026-07-20', '13:00:00', '13:30:00', 2, 0, false),
	('3de506f4-6491-4b01-9521-d5bf3f172c8c', '2026-07-20', '13:30:00', '14:00:00', 2, 0, false),
	('3dda17df-d458-484b-9178-5d75f4a42bf9', '2026-07-20', '14:00:00', '14:30:00', 2, 0, false),
	('dcaa0e6c-210c-4da5-a7e1-e428989f875f', '2026-07-20', '14:30:00', '15:00:00', 2, 0, false),
	('eaeba33c-c592-4df4-9ae5-c508fa0ef25a', '2026-07-20', '15:00:00', '15:30:00', 2, 0, false),
	('4e9d47e3-0454-46c1-98fd-abfad5172084', '2026-07-20', '15:30:00', '16:00:00', 2, 0, false),
	('1e88ace3-b9e2-4c35-8640-63ed75005092', '2026-07-20', '16:00:00', '16:30:00', 2, 0, false),
	('bbb235bc-991e-4a87-ae85-a8d38449ba1f', '2026-07-20', '16:30:00', '17:00:00', 2, 0, false),
	('c307e14e-fc1e-448d-ac67-789894fb5bea', '2026-07-20', '17:00:00', '17:30:00', 2, 0, false),
	('128808bc-3aad-4380-8a97-03d5860cc459', '2026-07-20', '17:30:00', '18:00:00', 2, 0, false),
	('b60fc7c2-b622-4748-adac-c846ac7d1f35', '2026-07-20', '18:00:00', '18:30:00', 2, 0, false),
	('5e82eca0-0c30-4167-8666-f7e35a0b56bf', '2026-07-20', '18:30:00', '19:00:00', 2, 0, false),
	('2479838b-2e30-462f-97d1-821392ada99b', '2026-07-20', '19:00:00', '19:30:00', 2, 0, false),
	('18abdc63-6d25-4038-a27d-39f9e5442715', '2026-07-20', '19:30:00', '20:00:00', 2, 0, false),
	('d08b3ca6-b81b-46c9-9956-e0525f0f40d7', '2026-07-20', '20:00:00', '20:30:00', 2, 0, false),
	('ccde3549-153e-4151-965e-ef111d423c19', '2026-07-20', '20:30:00', '21:00:00', 2, 0, false),
	('7fc33614-9e0b-42d6-a0d0-0f28e19720c0', '2026-07-20', '21:00:00', '21:30:00', 2, 0, false),
	('6f282ebf-f7f5-49cf-9441-e43358ecf4e2', '2026-07-20', '21:30:00', '22:00:00', 2, 0, false),
	('65166ba9-0dde-4156-a843-cbf217179809', '2026-07-20', '22:00:00', '22:30:00', 2, 0, false),
	('198caf94-be08-4276-8e7a-ea64474631b7', '2026-07-21', '08:00:00', '08:30:00', 2, 0, false),
	('b83a37ac-bc35-4d0b-86fc-5c26c3212b54', '2026-07-21', '08:30:00', '09:00:00', 2, 0, false),
	('ca40b65e-8d1a-414a-b7aa-99131f804cc8', '2026-07-21', '09:00:00', '09:30:00', 2, 0, false),
	('b6849490-9e2e-401a-9119-07715b94c9a8', '2026-07-21', '09:30:00', '10:00:00', 2, 0, false),
	('d6398d74-3ecf-427f-8aeb-748ca7733e30', '2026-07-21', '10:00:00', '10:30:00', 2, 0, false),
	('f88c9a73-668e-4e7e-8bb7-7dfb6ba6376e', '2026-07-21', '10:30:00', '11:00:00', 2, 0, false),
	('36ac3488-89bc-4f2e-811d-90ab01d66d22', '2026-07-21', '11:00:00', '11:30:00', 2, 0, false),
	('16704e9b-c739-4a74-833e-5431b2f4bc29', '2026-07-21', '11:30:00', '12:00:00', 2, 0, false),
	('53549843-850c-4dbb-89c1-34515fdf9b7c', '2026-07-21', '12:00:00', '12:30:00', 2, 0, false),
	('8ffaf7fa-fc95-4ebf-b898-de68e476fec9', '2026-07-21', '12:30:00', '13:00:00', 2, 0, false),
	('9c22fe1c-48ec-4df5-b6a7-4dd19128d81c', '2026-07-21', '13:00:00', '13:30:00', 2, 0, false),
	('0d26b4a4-de2e-49e7-b168-5d40b9b7cc4e', '2026-07-21', '13:30:00', '14:00:00', 2, 0, false),
	('13755df3-3283-423a-9e65-b71f02f09a79', '2026-07-21', '14:00:00', '14:30:00', 2, 0, false),
	('9cc81829-5710-4f65-9a5b-b4566a282299', '2026-07-30', '08:00:00', '08:30:00', 2, 0, false),
	('47b90ff2-0aa4-4473-9dce-23c8ea581edd', '2026-07-18', '16:00:00', '16:30:00', 2, 1, false),
	('ce658eeb-74a3-4b40-9de5-9b1a0969b886', '2026-07-18', '19:30:00', '20:00:00', 2, 1, false),
	('7853cce9-3e54-496b-8b95-e57194b6e673', '2026-07-19', '13:00:00', '13:30:00', 2, 1, false),
	('f8fd52a4-c04e-4f17-8dad-648dd3d80d93', '2026-07-20', '22:30:00', '23:00:00', 2, 1, false),
	('5a0e6379-9f6f-4fbc-8ab7-2eca3bd791ce', '2026-07-21', '14:30:00', '15:00:00', 2, 0, false),
	('dac53e77-bc00-4339-b7a0-cf6f1ccbf74e', '2026-07-21', '15:00:00', '15:30:00', 2, 0, false),
	('f3184e7b-3fa4-48fa-843f-ee5a57ac243f', '2026-07-21', '15:30:00', '16:00:00', 2, 0, false),
	('94086391-2411-4904-86ef-d6c8c89d7e7c', '2026-07-21', '16:00:00', '16:30:00', 2, 0, false),
	('0be62d6a-9719-40de-a97b-4bdd4c1208de', '2026-07-21', '16:30:00', '17:00:00', 2, 0, false),
	('69d7a947-cc46-4feb-80a0-19b27fbe2094', '2026-07-21', '17:00:00', '17:30:00', 2, 0, false),
	('081fccab-3f49-4e71-ad51-d339fe73e6fb', '2026-07-21', '17:30:00', '18:00:00', 2, 0, false),
	('1993188a-0814-4e14-bc51-cb10a2e54926', '2026-07-21', '18:00:00', '18:30:00', 2, 0, false),
	('6b751adf-e924-4987-b8f9-78afe409ab5d', '2026-07-21', '18:30:00', '19:00:00', 2, 0, false),
	('c25a8677-dd07-429c-b768-c3262510cfc4', '2026-07-21', '19:00:00', '19:30:00', 2, 0, false),
	('cbc49347-92b3-410d-bd72-1830b2662e89', '2026-07-21', '19:30:00', '20:00:00', 2, 0, false),
	('89e7f852-fab0-48c9-b344-a7593b250c5c', '2026-07-21', '20:00:00', '20:30:00', 2, 0, false),
	('44eadc29-d0a3-407a-9bb1-bfc807592296', '2026-07-21', '20:30:00', '21:00:00', 2, 0, false),
	('d6d07850-ac76-43be-83c5-aec08f556703', '2026-07-21', '21:00:00', '21:30:00', 2, 0, false),
	('54efa1e6-b032-4dda-86dc-5b187fad67f0', '2026-07-21', '21:30:00', '22:00:00', 2, 0, false),
	('3e122c36-41c1-454f-beab-924b90377575', '2026-07-21', '22:00:00', '22:30:00', 2, 0, false),
	('7e0e306b-3ae2-4937-aa99-b6d7a001f652', '2026-07-21', '22:30:00', '23:00:00', 2, 0, false),
	('af92d093-ba35-4c1c-91f7-5e050f6e4f04', '2026-07-07', '14:30:00', '15:00:00', 2, 1, false),
	('66ea82ac-0b1e-4b1a-9a0e-4e1f4559f8c2', '2026-07-22', '08:00:00', '08:30:00', 2, 0, false),
	('c0ef61ca-47aa-4a98-8da0-de841be13fdf', '2026-07-22', '08:30:00', '09:00:00', 2, 0, false),
	('44c195bf-2516-48fd-8dc2-5c19294585ee', '2026-07-22', '09:00:00', '09:30:00', 2, 0, false),
	('bd9379a7-e0b9-4a1a-9dfe-b7f4ae2ceeec', '2026-07-22', '09:30:00', '10:00:00', 2, 0, false),
	('2a908d88-f8bb-454c-ab9e-4faacdf33d8e', '2026-07-22', '10:00:00', '10:30:00', 2, 0, false),
	('5cc77986-fa3d-41bb-bc7f-cc2219303c9d', '2026-07-22', '10:30:00', '11:00:00', 2, 0, false),
	('8429c771-ac77-44c2-abb2-fdf43d66fda6', '2026-07-22', '11:00:00', '11:30:00', 2, 0, false),
	('015cd229-25b0-445c-9309-36126d4e02d0', '2026-07-22', '11:30:00', '12:00:00', 2, 0, false),
	('7b737447-9d1b-4b53-82c3-8dfeabef8fca', '2026-07-22', '12:00:00', '12:30:00', 2, 0, false),
	('42c2f925-13cb-4794-a945-7312f8810096', '2026-07-22', '12:30:00', '13:00:00', 2, 0, false),
	('6f29e699-9ff6-492c-9b3f-13ced9d7ee55', '2026-07-22', '13:00:00', '13:30:00', 2, 0, false),
	('7ecce4e6-8f75-4c92-8956-d3f703787806', '2026-07-22', '13:30:00', '14:00:00', 2, 0, false),
	('f62074c4-69b5-42ae-adf7-fa37bbb17145', '2026-07-22', '14:30:00', '15:00:00', 2, 0, false),
	('4e5bf596-da4f-45d3-bfd5-5848851e464b', '2026-07-22', '15:00:00', '15:30:00', 2, 0, false),
	('cb88e35e-fa11-4a7e-8df7-a504f8af7089', '2026-07-22', '15:30:00', '16:00:00', 2, 0, false),
	('7f2541bc-772b-4373-8562-19c604218c8e', '2026-07-22', '16:00:00', '16:30:00', 2, 0, false),
	('a18a9b77-0e2d-461f-a72c-dba1d3594532', '2026-07-22', '16:30:00', '17:00:00', 2, 0, false),
	('70233ca5-282a-4d47-820c-6d9f44640dc2', '2026-07-22', '17:00:00', '17:30:00', 2, 0, false),
	('75482fb5-17c2-4cee-9ddf-4fecfa3ec0f0', '2026-07-22', '17:30:00', '18:00:00', 2, 0, false),
	('6dfc6697-ca0d-480a-bd36-cdbe3afc29ff', '2026-07-22', '18:00:00', '18:30:00', 2, 0, false),
	('268cd7ed-2cf9-422d-8c9a-6bc6bf97dbfc', '2026-07-22', '18:30:00', '19:00:00', 2, 0, false),
	('e6992f54-d16d-467f-aa01-99d85c5d01be', '2026-07-22', '19:00:00', '19:30:00', 2, 0, false),
	('e5f98cbc-2257-4da8-9ae9-a803eafd2e3b', '2026-07-22', '19:30:00', '20:00:00', 2, 0, false),
	('97fa2f8f-09dc-4bac-936a-1f401a35a3d2', '2026-07-22', '20:30:00', '21:00:00', 2, 0, false),
	('48bd3c7d-e70d-4a90-a61c-8cc487c1b3d7', '2026-07-22', '21:00:00', '21:30:00', 2, 0, false),
	('dac7f266-7a70-48c0-9b41-8e0dbc5b1d33', '2026-07-22', '21:30:00', '22:00:00', 2, 0, false),
	('99bda438-0fb6-4eef-a5f6-755e923b4735', '2026-07-22', '22:00:00', '22:30:00', 2, 0, false),
	('20af5cf1-5d2d-4e9f-b19f-291433729a02', '2026-07-22', '22:30:00', '23:00:00', 2, 0, false),
	('c01cf868-586c-4d5a-8e89-dc1729a23a29', '2026-07-23', '08:00:00', '08:30:00', 2, 0, false),
	('e5b5c751-9a74-4843-b408-b6d874a57d98', '2026-07-23', '08:30:00', '09:00:00', 2, 0, false),
	('f899fa85-3508-42c1-a86b-338a104f4f65', '2026-07-23', '09:00:00', '09:30:00', 2, 0, false),
	('5ce71c28-9ebd-4114-a7a0-ed2a60af9050', '2026-07-23', '09:30:00', '10:00:00', 2, 0, false),
	('4dd245bc-c7a9-4e25-8861-8fdb100ae5ec', '2026-07-23', '10:00:00', '10:30:00', 2, 0, false),
	('74ebc14d-dddb-4507-9537-2abe0b5c430d', '2026-07-23', '10:30:00', '11:00:00', 2, 0, false),
	('602e0dd0-bb4c-4690-b2f4-e40578bfb7ac', '2026-07-23', '11:00:00', '11:30:00', 2, 0, false),
	('6c08fc7f-334b-475c-9314-060679bed347', '2026-07-23', '11:30:00', '12:00:00', 2, 0, false),
	('5c72df66-c1cb-4b04-a29a-de681d6cf985', '2026-07-23', '12:00:00', '12:30:00', 2, 0, false),
	('97b4ed52-fd6a-4023-8449-c3dd3466c460', '2026-07-23', '12:30:00', '13:00:00', 2, 0, false),
	('36b19bcc-4b1d-42ca-a821-6e5ab36edb4e', '2026-07-23', '13:00:00', '13:30:00', 2, 0, false),
	('96fb9ad2-7705-4967-92a1-84e353a14dbc', '2026-07-23', '13:30:00', '14:00:00', 2, 0, false),
	('19f424cf-3e80-4de2-976e-9cb611deb142', '2026-07-23', '14:00:00', '14:30:00', 2, 0, false),
	('cd82b9be-88b6-4a51-b360-305982854084', '2026-07-23', '14:30:00', '15:00:00', 2, 0, false),
	('0a2cd50e-d0de-497c-92d1-b186878d4050', '2026-07-23', '15:00:00', '15:30:00', 2, 0, false),
	('002b8a0a-6a3f-44e7-a778-ec16b8fcaa88', '2026-07-23', '15:30:00', '16:00:00', 2, 0, false),
	('d048f76e-65a6-4ddf-abb7-5a8936746fed', '2026-07-23', '16:00:00', '16:30:00', 2, 0, false),
	('bb03ef50-1e54-4b44-bdca-cdff8794fa36', '2026-07-23', '16:30:00', '17:00:00', 2, 0, false),
	('eb1ace5b-6207-45f1-8d88-9e7817c84929', '2026-07-23', '17:00:00', '17:30:00', 2, 0, false),
	('404ddabb-b83f-407c-9369-f47f5a6dbcbf', '2026-07-23', '17:30:00', '18:00:00', 2, 0, false),
	('e03fc756-4538-4feb-ab1b-b37f28abdbf3', '2026-07-23', '18:00:00', '18:30:00', 2, 0, false),
	('77ad3584-1089-486d-8f3e-9b5cc8f3b0ab', '2026-07-23', '18:30:00', '19:00:00', 2, 0, false),
	('3240155c-40a8-49eb-90f8-7f62abb5b01e', '2026-07-23', '19:00:00', '19:30:00', 2, 0, false),
	('1b006a71-4de5-4c4b-868f-9e0f3fc10f85', '2026-07-23', '19:30:00', '20:00:00', 2, 0, false),
	('63627bae-cff2-4782-af01-638558c19e70', '2026-07-23', '20:00:00', '20:30:00', 2, 0, false),
	('f55446bc-3709-4c77-af85-7f46b0c402d9', '2026-07-23', '20:30:00', '21:00:00', 2, 0, false),
	('2e6fbeb5-564e-426a-ac4f-66a90f9d1b62', '2026-07-23', '21:00:00', '21:30:00', 2, 0, false),
	('0f39e825-a4d6-4202-824d-5a5b6d52b39c', '2026-07-23', '21:30:00', '22:00:00', 2, 0, false),
	('a33dfb46-9913-4328-89f5-f47f692da87b', '2026-07-23', '22:00:00', '22:30:00', 2, 0, false),
	('9d9f79c8-e701-4ef8-aa64-77847e877ca1', '2026-07-23', '22:30:00', '23:00:00', 2, 0, false),
	('ce6f9a54-92be-4dc5-89fa-7633965cf6a4', '2026-07-24', '08:00:00', '08:30:00', 2, 0, false),
	('457588a5-2b4d-4298-b074-9568e7017d1e', '2026-07-24', '08:30:00', '09:00:00', 2, 0, false),
	('1613c249-2080-4f5f-83ce-acd0f168a6c0', '2026-07-24', '09:00:00', '09:30:00', 2, 0, false),
	('9c40f528-3e18-4327-a611-867ee7fddc60', '2026-07-24', '09:30:00', '10:00:00', 2, 0, false),
	('150c228f-a337-4d4b-bfd4-6a4c3a06e103', '2026-07-24', '10:00:00', '10:30:00', 2, 0, false),
	('c32db15c-1f7d-4bfc-aac6-9d6315f07aa6', '2026-07-24', '10:30:00', '11:00:00', 2, 0, false),
	('c1831664-e84d-4c02-aa15-4adef696ba94', '2026-07-24', '11:00:00', '11:30:00', 2, 0, false),
	('680356f2-ac84-4881-a62f-02c39ec0e7a7', '2026-07-24', '11:30:00', '12:00:00', 2, 0, false),
	('87247858-71e4-4695-a5f5-8813a8a10d5b', '2026-07-24', '12:00:00', '12:30:00', 2, 0, false),
	('607db4ad-dfed-49f1-8faf-c9f9fc43d234', '2026-07-24', '12:30:00', '13:00:00', 2, 0, false),
	('d1cbc6e8-0432-48b5-a579-f2a04c688a49', '2026-07-24', '13:00:00', '13:30:00', 2, 0, false),
	('aad51701-47e5-433c-bbb2-504480a0ef5e', '2026-07-24', '13:30:00', '14:00:00', 2, 0, false),
	('bde109c2-7d3c-430f-a6da-4391cda9bfb4', '2026-07-24', '14:00:00', '14:30:00', 2, 0, false),
	('9078ba4f-ceb0-4eec-9578-9579554da125', '2026-07-24', '14:30:00', '15:00:00', 2, 0, false),
	('51bc5fe4-90fd-45fe-b7e5-2ad4c891e292', '2026-07-24', '15:00:00', '15:30:00', 2, 0, false),
	('8a96370f-4577-4a60-bc4b-49abd91e49fb', '2026-07-24', '15:30:00', '16:00:00', 2, 0, false),
	('ad142ea3-38bc-4ece-9764-40724a332dac', '2026-07-24', '16:00:00', '16:30:00', 2, 0, false),
	('42693177-0609-4412-a691-45a13019e9ed', '2026-07-24', '16:30:00', '17:00:00', 2, 0, false),
	('651dd4b5-c4fa-45c5-8c48-c9487206039a', '2026-07-24', '17:00:00', '17:30:00', 2, 0, false),
	('50b85732-01e7-4dce-953d-c70c24d6b064', '2026-07-22', '20:00:00', '20:30:00', 2, 1, false),
	('60accc82-bea8-488f-be38-fd9c9ea45499', '2026-07-24', '18:00:00', '18:30:00', 2, 0, false),
	('eeca1437-f36e-4e15-9020-73b3dcfc1047', '2026-07-24', '18:30:00', '19:00:00', 2, 0, false),
	('a49d4ce2-0128-4a10-bd87-0f76a48ac548', '2026-07-24', '19:00:00', '19:30:00', 2, 0, false),
	('3c9a4565-1c92-4ceb-b39f-44616a2dbcae', '2026-07-24', '19:30:00', '20:00:00', 2, 0, false),
	('6c9afca4-845a-4ee4-a014-cf3cabc9c726', '2026-07-24', '20:00:00', '20:30:00', 2, 0, false),
	('0e03758e-4a4f-4c30-b4ea-34a70c21aa87', '2026-07-24', '20:30:00', '21:00:00', 2, 0, false),
	('2f3395b0-771c-4363-ae68-e1baf43d06ae', '2026-07-24', '21:00:00', '21:30:00', 2, 0, false),
	('1059c925-09a9-4cec-aec5-6666f0b338ea', '2026-07-24', '21:30:00', '22:00:00', 2, 0, false),
	('aacf15c1-02f0-4db2-9d2f-abc59857b7c7', '2026-07-24', '22:00:00', '22:30:00', 2, 0, false),
	('67244f15-4967-4fc9-a87d-6447b54cfeac', '2026-07-24', '22:30:00', '23:00:00', 2, 0, false),
	('ec18e64f-e52d-4608-a93d-f65ec18b374d', '2026-07-25', '08:00:00', '08:30:00', 2, 0, false),
	('feba37a4-7b5a-4311-bbd2-2b6fa96f9dfe', '2026-07-25', '08:30:00', '09:00:00', 2, 0, false),
	('b41b5dd1-5334-47e8-a023-bef2d8ee424e', '2026-07-25', '09:00:00', '09:30:00', 2, 0, false),
	('bed894b5-9379-4079-92bd-1a029dd94487', '2026-07-25', '09:30:00', '10:00:00', 2, 0, false),
	('9b1e59e8-64a5-4721-97c2-b7719808df7d', '2026-07-25', '10:00:00', '10:30:00', 2, 0, false),
	('e5c4d63e-7b29-4bb1-a050-084033c506cc', '2026-07-25', '10:30:00', '11:00:00', 2, 0, false),
	('e5ba7a0a-0d04-4fd8-92df-9428f5ab516f', '2026-07-25', '11:00:00', '11:30:00', 2, 0, false),
	('3a5f3c6a-4958-4964-ab68-86f95752db57', '2026-07-25', '11:30:00', '12:00:00', 2, 0, false),
	('f1ae67f8-6986-46ca-82be-abcc5e54e857', '2026-07-25', '12:00:00', '12:30:00', 2, 0, false),
	('91fc577f-fd51-448f-bcec-5901690c9708', '2026-07-25', '12:30:00', '13:00:00', 2, 0, false),
	('e91887ec-418a-4de5-b436-b075fafa8a44', '2026-07-25', '13:00:00', '13:30:00', 2, 0, false),
	('d97af791-184a-46f5-b706-31d409e9a116', '2026-07-25', '13:30:00', '14:00:00', 2, 0, false),
	('9473339e-143e-4b59-8e3b-3e7f3ef8c371', '2026-07-25', '14:00:00', '14:30:00', 2, 0, false),
	('f0da8063-4310-4ffc-877f-070749ee2dc3', '2026-07-25', '14:30:00', '15:00:00', 2, 0, false),
	('94986ce8-b5f4-456f-83f1-6aa4a508041e', '2026-07-25', '15:00:00', '15:30:00', 2, 0, false),
	('7b6dfb7f-2869-406b-af71-a1ac9e5cf883', '2026-07-25', '15:30:00', '16:00:00', 2, 0, false),
	('3029bea1-7d1d-43f2-888b-45135d1cc545', '2026-07-25', '16:00:00', '16:30:00', 2, 0, false),
	('030050a5-bd07-425d-b785-66545ce4e3f0', '2026-07-25', '16:30:00', '17:00:00', 2, 0, false),
	('32cc2ff1-5009-46e1-9cc7-5690a71bf78a', '2026-07-25', '17:00:00', '17:30:00', 2, 0, false),
	('059ca33a-bc09-455d-a4a5-485057bf9cd0', '2026-07-25', '17:30:00', '18:00:00', 2, 0, false),
	('5456e525-5267-4143-bcfa-64b095d5c469', '2026-07-25', '18:00:00', '18:30:00', 2, 0, false),
	('11dbbbab-d36a-40d0-a68f-69a8fd02288d', '2026-07-25', '18:30:00', '19:00:00', 2, 0, false),
	('8109979a-d719-4961-9e2a-48b9aee7cd49', '2026-07-25', '19:00:00', '19:30:00', 2, 0, false),
	('86120885-6f2c-4b7f-a3e3-ffdba31c5ed1', '2026-07-25', '19:30:00', '20:00:00', 2, 0, false),
	('51c4080a-217d-4963-8184-feaadb6e09aa', '2026-07-25', '20:00:00', '20:30:00', 2, 0, false),
	('6fd7edf1-5cdd-41e8-89d2-b0f77b610b0d', '2026-07-25', '20:30:00', '21:00:00', 2, 0, false),
	('0eea996e-d4db-42ef-8a2f-2f07a531d543', '2026-07-25', '21:00:00', '21:30:00', 2, 0, false),
	('ebc94f42-2cac-4294-bc75-ea2af82c62ed', '2026-07-25', '21:30:00', '22:00:00', 2, 0, false),
	('499d4002-3696-4f2f-b65f-445c4f830717', '2026-07-25', '22:00:00', '22:30:00', 2, 0, false),
	('82c5e1a2-dd9d-4e22-a850-55526ec821be', '2026-07-25', '22:30:00', '23:00:00', 2, 0, false),
	('fe915f98-68cc-429e-9c6c-62621f3252dd', '2026-07-26', '08:00:00', '08:30:00', 2, 0, false),
	('48136616-b1d7-4bd5-b0dc-d61ba08803d5', '2026-07-26', '08:30:00', '09:00:00', 2, 0, false),
	('c78c3796-9a69-494b-a8f2-601479625d6b', '2026-07-26', '09:00:00', '09:30:00', 2, 0, false),
	('7374cc2c-c683-4a6e-9f81-43e781d80e64', '2026-07-26', '09:30:00', '10:00:00', 2, 0, false),
	('6e6b8d12-f0db-40e8-86e3-fa6ebad8b370', '2026-07-26', '10:00:00', '10:30:00', 2, 0, false),
	('b50cfa9b-30ca-4493-b355-5d43dec8934a', '2026-07-26', '10:30:00', '11:00:00', 2, 0, false),
	('42f49750-f4de-4c14-9e9c-ca34342fbf79', '2026-07-26', '11:00:00', '11:30:00', 2, 0, false),
	('9e6269b4-4b47-4ec8-983c-1924ead386e9', '2026-07-26', '11:30:00', '12:00:00', 2, 0, false),
	('8fa59ed0-c121-4237-adb9-0dd25664f196', '2026-07-26', '12:00:00', '12:30:00', 2, 0, false),
	('c6850966-ad87-4acd-a281-dd3741f4846d', '2026-07-26', '12:30:00', '13:00:00', 2, 0, false),
	('9f4f67fa-9ff8-4630-80a8-fb11beff9e2a', '2026-07-26', '13:00:00', '13:30:00', 2, 0, false),
	('4199de1d-fabc-44d6-b976-1868d09fdf03', '2026-07-26', '13:30:00', '14:00:00', 2, 0, false),
	('f9d51f33-d69a-491a-b3ff-9d93e832553a', '2026-07-26', '14:00:00', '14:30:00', 2, 0, false),
	('a315406e-9289-4644-b7ab-73ed0281bbe9', '2026-07-26', '14:30:00', '15:00:00', 2, 0, false),
	('8f3f94ac-3396-4f35-849c-2bc36de755cc', '2026-07-26', '15:00:00', '15:30:00', 2, 0, false),
	('47f4dcf1-0e7d-47d7-ae0e-ce0b5dc99c7f', '2026-07-26', '15:30:00', '16:00:00', 2, 0, false),
	('38fc8981-6240-427b-8378-91ce2c634078', '2026-07-26', '16:00:00', '16:30:00', 2, 0, false),
	('7b984ea3-8c19-450a-823a-11defa1c8f88', '2026-07-26', '16:30:00', '17:00:00', 2, 0, false),
	('0ab90bb3-0248-43d7-9651-93733d21cdcf', '2026-07-26', '17:00:00', '17:30:00', 2, 0, false),
	('2bb689a2-ef84-49a5-ad42-a52b839c1735', '2026-07-26', '17:30:00', '18:00:00', 2, 0, false),
	('004fec87-36a9-473d-bc66-ee58d839ea39', '2026-07-26', '18:00:00', '18:30:00', 2, 0, false),
	('0bdf6f02-7f7a-4435-99b3-bae1bb10dc30', '2026-07-26', '18:30:00', '19:00:00', 2, 0, false),
	('a407ce55-a8c5-442a-a909-1dbe1192dd0f', '2026-07-26', '19:00:00', '19:30:00', 2, 0, false),
	('35ea7fab-d495-4ef2-bbad-8bb5467caefd', '2026-07-26', '19:30:00', '20:00:00', 2, 0, false),
	('41805eb5-ba49-48e5-a4ff-3881c798457e', '2026-07-26', '20:00:00', '20:30:00', 2, 0, false),
	('5c4e8385-dcf2-4b5a-9725-441c50285dfe', '2026-07-26', '20:30:00', '21:00:00', 2, 0, false),
	('f856a204-c090-4829-ac3e-dd9d12528f2c', '2026-07-26', '21:00:00', '21:30:00', 2, 0, false),
	('7f79fa06-314e-4a4f-95f2-2c11d7d9d3ea', '2026-07-26', '21:30:00', '22:00:00', 2, 0, false),
	('886dea5e-1922-4b9f-83b9-f3a44898ace9', '2026-07-26', '22:00:00', '22:30:00', 2, 0, false),
	('9e736169-8f8c-4956-81ec-696f2fcedc93', '2026-07-26', '22:30:00', '23:00:00', 2, 0, false),
	('3630562d-363e-45cb-ac25-edfadb37745b', '2026-07-27', '08:00:00', '08:30:00', 2, 0, false),
	('39c45f5d-dbf2-4d38-ad05-553416cf253a', '2026-07-27', '08:30:00', '09:00:00', 2, 0, false),
	('aae5f82f-739e-43d4-9945-2b9485a191d3', '2026-07-27', '09:00:00', '09:30:00', 2, 0, false),
	('58294169-5212-4a75-8f40-a65bfffaca86', '2026-07-27', '09:30:00', '10:00:00', 2, 0, false),
	('3ff31dab-4aca-4847-914d-ba96b9fca7f2', '2026-07-27', '10:00:00', '10:30:00', 2, 0, false),
	('4b90a747-3753-427a-89a7-47c5714f880b', '2026-07-27', '10:30:00', '11:00:00', 2, 0, false),
	('a3d94db6-d3e8-4f8e-a2e3-2a7203664fee', '2026-07-27', '11:00:00', '11:30:00', 2, 0, false),
	('7a29a180-22fe-47f8-a551-3aad3ec3772e', '2026-07-27', '11:30:00', '12:00:00', 2, 0, false),
	('e0b9026f-cac7-4963-a1e5-b273cbb947f6', '2026-07-27', '12:30:00', '13:00:00', 2, 0, false),
	('57f38c9b-f70d-48ff-b949-876a3409031e', '2026-07-27', '13:00:00', '13:30:00', 2, 0, false),
	('e4d84b42-156e-47e1-baac-ed9b05920f3a', '2026-07-27', '13:30:00', '14:00:00', 2, 0, false),
	('2ec5be32-0696-439c-9225-8b731d98046f', '2026-07-27', '14:00:00', '14:30:00', 2, 0, false),
	('a481ba59-91ad-4165-a0f1-10de50d0a4ae', '2026-07-27', '14:30:00', '15:00:00', 2, 0, false),
	('1e50a076-96f9-414e-b6a5-98fa6dae3c48', '2026-07-27', '15:00:00', '15:30:00', 2, 0, false),
	('b7936dc8-6ad2-435a-9ceb-0e9713bd527f', '2026-07-27', '15:30:00', '16:00:00', 2, 0, false),
	('26ff0a92-0e28-424a-9adb-f666ff4bccc4', '2026-07-27', '16:00:00', '16:30:00', 2, 0, false),
	('f5c6f6eb-f0da-4e6c-bd82-dda36615a84b', '2026-07-27', '16:30:00', '17:00:00', 2, 0, false),
	('d6ef387d-931f-41df-9b8e-f23f6883e8d2', '2026-07-27', '17:00:00', '17:30:00', 2, 0, false),
	('8c025c05-4f59-482a-8acb-7382528d51af', '2026-07-27', '17:30:00', '18:00:00', 2, 0, false),
	('8c21e4c4-9627-4109-a521-f70f1c123af4', '2026-07-27', '18:00:00', '18:30:00', 2, 0, false),
	('4658d61b-40b6-40d8-9880-4b451c7389e9', '2026-07-27', '18:30:00', '19:00:00', 2, 0, false),
	('5aa7aed6-6e45-4ab5-ad11-9293b4553ea4', '2026-07-27', '19:00:00', '19:30:00', 2, 0, false),
	('b8dcd856-aa5c-46e4-a018-4534a26ba790', '2026-07-27', '19:30:00', '20:00:00', 2, 0, false),
	('1979b6b2-bc27-4210-8e73-b634aa84d872', '2026-07-27', '20:00:00', '20:30:00', 2, 0, false),
	('fdab1097-2a0f-4ff6-b72b-e57c171b3fb2', '2026-07-27', '20:30:00', '21:00:00', 2, 0, false),
	('10f7f105-07b0-4010-b561-0a9b79fed4f2', '2026-07-27', '12:00:00', '12:30:00', 2, 1, false),
	('798574d7-47aa-450f-a68b-a5c63e87cb23', '2026-07-27', '21:00:00', '21:30:00', 2, 0, false),
	('a0e229ec-2305-45d3-a542-e80a51128d6d', '2026-07-27', '21:30:00', '22:00:00', 2, 0, false),
	('3413d67f-0a47-4069-b57b-02b54a3f2d07', '2026-07-27', '22:00:00', '22:30:00', 2, 0, false),
	('e9997553-c7b7-4f42-a4bc-caf800f2643a', '2026-07-27', '22:30:00', '23:00:00', 2, 0, false),
	('1ed72201-e666-48b8-9531-70088e6e427c', '2026-07-28', '08:00:00', '08:30:00', 2, 0, false),
	('16640a8b-f375-4066-b324-c3035df3afc0', '2026-07-28', '08:30:00', '09:00:00', 2, 0, false),
	('c05cb0d9-816c-40fc-a19f-ec82fcb02043', '2026-07-28', '09:30:00', '10:00:00', 2, 0, false),
	('f3d41070-4e62-4dbc-98c0-82c7b8fd7823', '2026-07-28', '10:00:00', '10:30:00', 2, 0, false),
	('01069b16-c6f3-40f6-aba0-58b1af9db27c', '2026-07-28', '10:30:00', '11:00:00', 2, 0, false),
	('b3beeeaa-53e1-4f8d-88ad-0cbfa052c8d0', '2026-07-28', '11:00:00', '11:30:00', 2, 0, false),
	('49dd266a-5c77-417c-b1de-77c1c8112dab', '2026-07-28', '11:30:00', '12:00:00', 2, 0, false),
	('54fa22ea-dd37-4741-b09c-35267b39a73c', '2026-07-28', '12:00:00', '12:30:00', 2, 0, false),
	('bcb76204-68e2-4559-8a49-02fbe7515d43', '2026-07-28', '12:30:00', '13:00:00', 2, 0, false),
	('5956bfdc-561f-49dc-b79b-c0b6e351a970', '2026-07-28', '13:00:00', '13:30:00', 2, 0, false),
	('9cdbc403-1488-47cb-bcd0-8b75bed70be5', '2026-07-28', '13:30:00', '14:00:00', 2, 0, false),
	('884aeee3-31ae-4414-9936-1d6bc56abe86', '2026-07-28', '14:00:00', '14:30:00', 2, 0, false),
	('b31ea86a-59a5-47d4-af1c-510af5737ad5', '2026-07-28', '14:30:00', '15:00:00', 2, 0, false),
	('986c7953-b4a2-4182-873c-cbc193c9f8d3', '2026-07-28', '15:00:00', '15:30:00', 2, 0, false),
	('9380db36-09e4-4db9-87b0-866c497459b3', '2026-07-28', '15:30:00', '16:00:00', 2, 0, false),
	('8e1cc51f-a34c-4c4b-bbd0-3ee7612f2058', '2026-07-28', '16:30:00', '17:00:00', 2, 0, false),
	('a97e33d3-afd9-4c6c-bea1-4dcf3daf0092', '2026-07-28', '17:00:00', '17:30:00', 2, 0, false),
	('8185eca2-e57f-4ad0-b9c9-64ce9283aecb', '2026-07-28', '17:30:00', '18:00:00', 2, 0, false),
	('29e6d84f-9161-4fe4-8557-10fe48df68e6', '2026-07-28', '18:00:00', '18:30:00', 2, 0, false),
	('4229337b-d921-4f33-9761-67f32cf14751', '2026-07-28', '18:30:00', '19:00:00', 2, 0, false),
	('2bc9f42b-5a4b-494c-adab-9c2b1f85f891', '2026-07-28', '19:00:00', '19:30:00', 2, 0, false),
	('7236fd63-76f9-434a-8090-ab9c943cd9ee', '2026-07-28', '19:30:00', '20:00:00', 2, 0, false),
	('d0b556b2-ca5c-4a02-9599-002522bb65d7', '2026-07-28', '20:00:00', '20:30:00', 2, 0, false),
	('8b9fb191-608a-43dd-a3a7-6b554ca9db0e', '2026-07-28', '20:30:00', '21:00:00', 2, 0, false),
	('af730561-2d6e-4498-a594-136d613f2a10', '2026-07-28', '21:00:00', '21:30:00', 2, 0, false),
	('1826f341-fee4-4e47-9ed4-c55b8a30771a', '2026-07-28', '21:30:00', '22:00:00', 2, 0, false),
	('be15f107-505f-4133-aea5-d96e33b641ef', '2026-07-28', '22:00:00', '22:30:00', 2, 0, false),
	('43f59fbc-c83f-4583-9754-a8cc87f26e6f', '2026-07-28', '22:30:00', '23:00:00', 2, 0, false),
	('11908f31-08f2-4d68-a19c-bf845a04b804', '2026-07-15', '12:00:00', '12:30:00', 2, 1, false),
	('bbbdd8fb-33fb-4f1b-adb2-1bb6ffd81880', '2026-07-30', '08:30:00', '09:00:00', 2, 0, false),
	('c3f81be7-f1d3-4f16-b96f-9b68bdba3a87', '2026-07-30', '09:00:00', '09:30:00', 2, 0, false),
	('6e95db0d-7206-44c0-8779-ff29f739db8d', '2026-07-30', '09:30:00', '10:00:00', 2, 0, false),
	('49620ee5-2481-4148-be47-75a879ce7478', '2026-07-30', '10:00:00', '10:30:00', 2, 0, false),
	('4fd68d1a-f9b9-4a35-97df-21df35648bb9', '2026-07-30', '10:30:00', '11:00:00', 2, 0, false),
	('30fcfd61-26bc-4288-ad8e-2d90504f5e95', '2026-07-30', '11:00:00', '11:30:00', 2, 0, false),
	('0943c32a-f36e-42c8-99e5-dc1757511197', '2026-07-30', '11:30:00', '12:00:00', 2, 0, false),
	('37071e61-637a-4196-ade3-6d4dabff43da', '2026-07-30', '12:00:00', '12:30:00', 2, 0, false),
	('57638eb2-920f-454a-80a1-11029d5fea4f', '2026-07-30', '12:30:00', '13:00:00', 2, 0, false),
	('5212fa62-8081-4037-93fd-ad46bab89946', '2026-07-30', '13:00:00', '13:30:00', 2, 0, false),
	('f3245e7d-8b58-4d4b-89f5-7e232c52215d', '2026-07-30', '13:30:00', '14:00:00', 2, 0, false),
	('ddf1228a-9234-4d11-b86d-0cc006d23d88', '2026-07-30', '14:00:00', '14:30:00', 2, 0, false),
	('1bd20a74-5f99-4f42-96f1-a58132e98cac', '2026-07-30', '14:30:00', '15:00:00', 2, 0, false),
	('ff6985ea-e4a3-479c-b82a-4e02560e18b3', '2026-07-30', '15:00:00', '15:30:00', 2, 0, false),
	('a604b09f-10d4-44a9-8a0c-2e907ff65837', '2026-07-30', '15:30:00', '16:00:00', 2, 0, false),
	('493b0fc8-fe51-43ca-a632-79d44014f4c7', '2026-07-30', '16:00:00', '16:30:00', 2, 0, false),
	('fbc0dc5e-0061-4668-be6f-0fc7f09f21d0', '2026-07-30', '16:30:00', '17:00:00', 2, 0, false),
	('d4c28664-2907-49b0-a08f-370f9b49738b', '2026-07-30', '17:00:00', '17:30:00', 2, 0, false),
	('9798c47e-84d8-46cd-8f71-8d01808357a7', '2026-07-30', '17:30:00', '18:00:00', 2, 0, false),
	('758af471-2fae-4f2e-9461-18beedcc5d91', '2026-07-30', '18:00:00', '18:30:00', 2, 0, false),
	('85a2f295-2730-42f9-9556-c3bc4493f801', '2026-07-30', '18:30:00', '19:00:00', 2, 0, false),
	('68005a55-0007-4427-a0c5-3d0708aa2a72', '2026-07-30', '19:00:00', '19:30:00', 2, 0, false),
	('c177a336-0223-4723-8ce7-b2b22856db2d', '2026-07-30', '19:30:00', '20:00:00', 2, 0, false),
	('6a7ab7a8-4879-4e22-afe3-a47588ee8bbc', '2026-07-30', '20:00:00', '20:30:00', 2, 0, false),
	('984e3b39-c9c9-4435-ba7d-f63919c595a0', '2026-07-30', '20:30:00', '21:00:00', 2, 0, false),
	('cf2dc70d-a862-40b7-b108-cde41eec5201', '2026-07-30', '21:00:00', '21:30:00', 2, 0, false),
	('8401d233-8999-4905-9441-5b7e0378a8b8', '2026-07-30', '21:30:00', '22:00:00', 2, 0, false),
	('2e07d065-75e5-4e55-ae42-b245bf3a48d8', '2026-07-30', '22:00:00', '22:30:00', 2, 0, false),
	('373003b6-c22e-4564-8615-1f5f27c21352', '2026-07-30', '22:30:00', '23:00:00', 2, 0, false),
	('6596b2e0-bc3e-477b-84a2-e52b9cd725ce', '2026-07-31', '08:00:00', '08:30:00', 2, 0, false),
	('b7c0fc50-f390-4e34-a54d-1f2f61711c50', '2026-07-31', '08:30:00', '09:00:00', 2, 0, false),
	('b5dd5b18-c83d-4da1-b026-207ecf6b1cea', '2026-07-31', '09:00:00', '09:30:00', 2, 0, false),
	('6ba71990-662e-40c6-ae0d-65abd22d5bf6', '2026-07-31', '09:30:00', '10:00:00', 2, 0, false),
	('2f5d5cf3-6b12-4cc2-a87a-726bb96a0ca7', '2026-07-31', '10:00:00', '10:30:00', 2, 0, false),
	('b4b2fdb3-5e2f-4d95-b5f2-9b5a640a684f', '2026-07-31', '10:30:00', '11:00:00', 2, 0, false),
	('95eb11a2-e2b6-40d6-b812-4c7540cb9f72', '2026-07-31', '11:00:00', '11:30:00', 2, 0, false),
	('44600c5f-5467-4b2c-9d09-4017b433a84f', '2026-07-31', '11:30:00', '12:00:00', 2, 0, false),
	('979c97ab-3d36-45c5-8c45-ab7ad16d43a6', '2026-07-31', '12:00:00', '12:30:00', 2, 0, false),
	('e9b42b22-b9cd-4130-a9f8-a4c41aad444e', '2026-07-31', '12:30:00', '13:00:00', 2, 0, false),
	('6cfdd318-4858-4c05-9107-4c0c6df0f0d1', '2026-07-31', '13:00:00', '13:30:00', 2, 0, false),
	('f5975873-eb96-404b-b0d9-aeb9a9cb5f0a', '2026-07-31', '13:30:00', '14:00:00', 2, 0, false),
	('fc09bfed-5f21-4cfc-bf32-789d007ff885', '2026-07-31', '14:00:00', '14:30:00', 2, 0, false),
	('ccb3c3b5-fa53-43ae-b657-fc25c94c5c89', '2026-07-31', '14:30:00', '15:00:00', 2, 0, false),
	('527f6cab-59a7-443c-98d7-fbc4bbc87016', '2026-07-31', '15:00:00', '15:30:00', 2, 0, false),
	('46b8e20a-36a0-42f0-80c8-9dd9f8ec4834', '2026-07-31', '15:30:00', '16:00:00', 2, 0, false),
	('a3acfee1-bec3-4d63-ad54-5e0c1697a219', '2026-07-31', '16:00:00', '16:30:00', 2, 0, false),
	('1a0d54a5-87a8-450d-ae0c-c6f8233f8bb0', '2026-07-31', '16:30:00', '17:00:00', 2, 0, false),
	('2098b630-7065-4edf-94d3-26fa2d83f36b', '2026-07-31', '17:00:00', '17:30:00', 2, 0, false),
	('b31e4d87-1bb5-4cf9-9ee5-778cacb88de5', '2026-07-31', '17:30:00', '18:00:00', 2, 0, false),
	('adaa1342-2264-4e1b-83bb-95cab3c69d93', '2026-07-31', '18:00:00', '18:30:00', 2, 0, false),
	('ee367309-64b6-40de-92a5-f4b322f68037', '2026-07-31', '18:30:00', '19:00:00', 2, 0, false),
	('22abedc8-a565-4ea3-bb1a-fe655455ac72', '2026-07-31', '19:00:00', '19:30:00', 2, 0, false),
	('0a42eff7-ace8-4c6e-be20-fc8defb5eb2f', '2026-07-31', '19:30:00', '20:00:00', 2, 0, false),
	('608e1429-b23f-4d79-b8f6-750a722a4f53', '2026-07-31', '20:00:00', '20:30:00', 2, 0, false),
	('ff380bd5-c4e4-4ca9-b4df-c4a293ebd18d', '2026-07-31', '20:30:00', '21:00:00', 2, 0, false),
	('ab0271aa-2896-45ad-a320-75e13633a99a', '2026-07-31', '21:00:00', '21:30:00', 2, 0, false),
	('4b1a1b06-5c88-4249-808a-aa7ce5880b0e', '2026-07-31', '21:30:00', '22:00:00', 2, 0, false),
	('d52dbda9-dab9-4fea-b389-e5572bef103f', '2026-07-31', '22:00:00', '22:30:00', 2, 0, false),
	('8d5ca47a-52d5-4a68-a966-b897f4c0f689', '2026-07-31', '22:30:00', '23:00:00', 2, 0, false),
	('dd76ef85-5f20-455d-b04c-2ad8220aa28c', '2026-07-18', '22:30:00', '23:00:00', 2, 1, false),
	('6b58f41b-c297-48b7-883c-0fdfa9f9dde9', '2026-08-01', '08:00:00', '08:30:00', 2, 0, false),
	('56496ae0-f6e8-4922-ba61-d6bdcd739416', '2026-08-01', '08:30:00', '09:00:00', 2, 0, false),
	('0e12f2bd-edfa-4e78-8e44-ada276c4b972', '2026-07-28', '16:00:00', '16:30:00', 2, 0, false),
	('e5d4234e-e06d-4aea-91c9-47e94d1a557f', '2026-08-01', '09:00:00', '09:30:00', 2, 0, false),
	('16e235de-d626-4804-9613-1a0385f804a7', '2026-08-01', '10:00:00', '10:30:00', 2, 0, false),
	('e8199406-6c3c-48c0-985b-0ef1fd6bea51', '2026-08-01', '10:30:00', '11:00:00', 2, 0, false),
	('85ba27a3-38f0-4db3-b7c9-cf494810216f', '2026-08-01', '11:00:00', '11:30:00', 2, 0, false),
	('2dc16628-d711-4115-b470-c614030e2df5', '2026-08-01', '11:30:00', '12:00:00', 2, 0, false),
	('493d7ce0-dfcc-42c9-a5fc-ba1e1d38e80c', '2026-08-01', '12:00:00', '12:30:00', 2, 0, false),
	('a3129672-20c3-4a2d-9201-5181db42ea0d', '2026-08-01', '12:30:00', '13:00:00', 2, 0, false),
	('4bd1c5c5-9b3e-4f0b-8069-9e051b49f337', '2026-08-01', '13:00:00', '13:30:00', 2, 0, false),
	('b7911f3a-7fd3-4dc1-8558-2421bbadf0cc', '2026-08-01', '13:30:00', '14:00:00', 2, 0, false),
	('6344baea-5549-4f39-9dee-9aef66e0c2c7', '2026-08-01', '14:00:00', '14:30:00', 2, 0, false),
	('7e6ecb5b-fecf-497b-8dc7-56a7e89c3872', '2026-08-01', '14:30:00', '15:00:00', 2, 0, false),
	('0ab6c54f-d23d-4503-aaf9-61e5b77adae7', '2026-08-01', '15:00:00', '15:30:00', 2, 0, false),
	('68904f29-72dd-4b41-b0d6-510b3cb59e97', '2026-08-01', '15:30:00', '16:00:00', 2, 0, false),
	('bb246771-9e6f-428f-9682-212d7104b984', '2026-08-01', '16:00:00', '16:30:00', 2, 0, false),
	('e07945b0-1bc7-4ee5-9534-6ec7d83bbdc0', '2026-08-01', '16:30:00', '17:00:00', 2, 0, false),
	('568b70ee-41f8-44c9-a470-756ead274bc1', '2026-08-01', '17:00:00', '17:30:00', 2, 0, false),
	('b90d7bbc-ea38-4887-8be2-e4b035e783b2', '2026-08-01', '17:30:00', '18:00:00', 2, 0, false),
	('ae0298a0-6a31-42d7-ab9d-fe600f45267c', '2026-08-01', '18:00:00', '18:30:00', 2, 0, false),
	('3569397d-68b1-4489-8f3a-c5ba8e6c99d6', '2026-08-01', '18:30:00', '19:00:00', 2, 0, false),
	('fe50f0d6-ffa2-435e-98ac-68cd05477797', '2026-08-01', '19:00:00', '19:30:00', 2, 0, false),
	('218b0403-261b-414d-84e7-c1f5dc9fbd4a', '2026-08-01', '19:30:00', '20:00:00', 2, 0, false),
	('f52f6b1a-4198-42e0-8e6b-0723497145b7', '2026-08-01', '20:00:00', '20:30:00', 2, 0, false),
	('70061954-c598-4ee1-aa8f-1cc3cde9ea1f', '2026-08-01', '20:30:00', '21:00:00', 2, 0, false),
	('808824f4-df3c-414f-b039-93a59a24a415', '2026-08-01', '21:00:00', '21:30:00', 2, 0, false),
	('7b87cd20-f528-431b-83c9-5a7523f7d639', '2026-08-01', '21:30:00', '22:00:00', 2, 0, false),
	('10000b70-c2aa-42a3-9186-58a7cbdb6594', '2026-08-01', '22:00:00', '22:30:00', 2, 0, false),
	('ddc74c22-f469-4c04-85de-1d73b1d21402', '2026-08-01', '22:30:00', '23:00:00', 2, 0, false),
	('f8d7dc8d-1f7a-46e5-ab2b-e51a1c5486f3', '2026-08-02', '08:00:00', '08:30:00', 2, 0, false),
	('d3dd6d4e-6902-42b7-b394-094a6c54831a', '2026-08-02', '08:30:00', '09:00:00', 2, 0, false),
	('94effb89-21a1-404a-95c0-b4400ecbfd95', '2026-08-02', '09:00:00', '09:30:00', 2, 0, false),
	('0649b9ac-bdaf-42f0-9898-6675de62ef79', '2026-08-02', '09:30:00', '10:00:00', 2, 0, false),
	('ddb4de69-bcf2-4f31-9a07-3329ec8fd961', '2026-08-02', '10:00:00', '10:30:00', 2, 0, false),
	('e676a227-edba-494f-a1b9-458db4eca40a', '2026-08-02', '10:30:00', '11:00:00', 2, 0, false),
	('76254906-0dac-4905-bf6c-5b523bacf153', '2026-08-02', '11:00:00', '11:30:00', 2, 0, false),
	('2b919cf3-4fe9-4f7d-b0f2-d69c39b7e734', '2026-08-02', '11:30:00', '12:00:00', 2, 0, false),
	('16ed1c4a-d0c6-4c96-b72c-20e6e25adf10', '2026-08-02', '12:00:00', '12:30:00', 2, 0, false),
	('4aeeafcc-82cc-4a79-b2e5-37202f8c9c57', '2026-08-02', '13:00:00', '13:30:00', 2, 0, false),
	('c82364f0-0ebf-419c-a30a-a576217cc214', '2026-08-02', '14:00:00', '14:30:00', 2, 0, false),
	('dbb0416d-f7b1-47a8-bed3-87a3a7171893', '2026-08-02', '14:30:00', '15:00:00', 2, 0, false),
	('64af0268-f380-4914-befb-e28654f27788', '2026-08-02', '15:00:00', '15:30:00', 2, 0, false),
	('e2233117-cf20-4b2b-9618-5b700d281307', '2026-08-02', '15:30:00', '16:00:00', 2, 0, false),
	('24ae64e8-98a6-46aa-a087-4e6be78e0f18', '2026-08-02', '16:00:00', '16:30:00', 2, 0, false),
	('3dbe1d0f-2927-40fd-b654-2a4ff2948bc8', '2026-08-02', '16:30:00', '17:00:00', 2, 0, false),
	('f934ea43-73fe-48eb-8c05-d0e16a444f82', '2026-08-02', '17:00:00', '17:30:00', 2, 0, false),
	('ce1f18ce-77e1-4106-8f62-adcef93af74e', '2026-08-02', '17:30:00', '18:00:00', 2, 0, false),
	('eaca77e3-5c96-43b6-9616-93d8a146ee41', '2026-08-02', '18:00:00', '18:30:00', 2, 0, false),
	('e13bf2b4-26fe-42a3-bb62-f0bef3a91cdb', '2026-08-02', '18:30:00', '19:00:00', 2, 0, false),
	('c2e1bf09-6723-488f-a4cc-66d6dabd4c11', '2026-08-02', '19:00:00', '19:30:00', 2, 0, false),
	('386a935c-78c2-4de2-8394-114afab773e5', '2026-08-02', '19:30:00', '20:00:00', 2, 0, false),
	('8ddf0373-bad1-419e-bf8b-e99601230993', '2026-08-02', '20:00:00', '20:30:00', 2, 0, false),
	('1f214a2f-9e2c-4e33-9740-95f98669e369', '2026-08-02', '20:30:00', '21:00:00', 2, 0, false),
	('728ed3d1-f47e-4607-a6a0-f78e18914e97', '2026-08-02', '21:00:00', '21:30:00', 2, 0, false),
	('28bcdbb9-e0cd-459f-af60-4df15ec98564', '2026-08-02', '22:00:00', '22:30:00', 2, 0, false),
	('b18acb23-aa5f-4dc1-9600-83a97ec72fe2', '2026-08-02', '22:30:00', '23:00:00', 2, 0, false),
	('7ee159a4-9734-47d7-b86d-bc8aab10aa52', '2026-08-03', '08:00:00', '08:30:00', 2, 0, false),
	('c5b34f69-1fb2-44de-a861-8830feeb3a7e', '2026-08-03', '08:30:00', '09:00:00', 2, 0, false),
	('fbec153e-e1cf-4ab0-87d3-f60f9e4ea8ce', '2026-08-03', '09:00:00', '09:30:00', 2, 0, false),
	('3a34cd4d-8a80-4781-9209-32864ad192aa', '2026-08-03', '09:30:00', '10:00:00', 2, 0, false),
	('ee149a46-f233-406b-b9a0-bade5840940d', '2026-08-03', '10:00:00', '10:30:00', 2, 0, false),
	('af00c102-886b-496a-b0aa-cf54f536730f', '2026-08-03', '10:30:00', '11:00:00', 2, 0, false),
	('46b3de8c-29b5-4d4b-9efc-2971f6d74b7a', '2026-08-03', '11:00:00', '11:30:00', 2, 0, false),
	('92146f34-2a8c-4d9a-8e6d-eb78975c80d4', '2026-08-03', '11:30:00', '12:00:00', 2, 0, false),
	('f2e582b1-dc10-4831-9d72-95b128e1409f', '2026-08-03', '12:00:00', '12:30:00', 2, 0, false),
	('926a2684-babf-4682-9337-410179e8967a', '2026-08-03', '13:00:00', '13:30:00', 2, 0, false),
	('36dd4b24-93ba-490c-bf96-509fe5b4d494', '2026-08-03', '13:30:00', '14:00:00', 2, 0, false),
	('067eac72-9f40-462d-84bf-3464f213072b', '2026-08-03', '14:00:00', '14:30:00', 2, 0, false),
	('1a27ba6a-43fd-40b4-97b7-d15a7be665f6', '2026-08-03', '14:30:00', '15:00:00', 2, 0, false),
	('5f3a27a7-6ba9-464c-9475-1a62bf9c3e62', '2026-08-03', '15:00:00', '15:30:00', 2, 0, false),
	('c8399778-89b4-4746-9256-614e15de3f6b', '2026-08-03', '15:30:00', '16:00:00', 2, 0, false),
	('d68d16ea-0ab6-46e5-baba-ad5f423fc983', '2026-08-03', '16:00:00', '16:30:00', 2, 0, false),
	('287b26b3-71c9-4674-896b-b3ddb948ed7a', '2026-08-03', '16:30:00', '17:00:00', 2, 0, false),
	('2e19586f-e524-41e0-ab7e-5cadb3d97d00', '2026-08-03', '17:30:00', '18:00:00', 2, 0, false),
	('adaa5df6-790f-450a-aa16-8e03e211f6d1', '2026-08-03', '18:00:00', '18:30:00', 2, 0, false),
	('2c243d3a-ca9c-4f1e-bbd5-983387bfcafd', '2026-08-03', '18:30:00', '19:00:00', 2, 0, false),
	('6a8f6677-b9ed-4714-892e-315f98dcbdd2', '2026-08-03', '19:00:00', '19:30:00', 2, 0, false),
	('c061a0e5-f28e-4d25-9bbc-a4841a03d973', '2026-08-03', '19:30:00', '20:00:00', 2, 0, false),
	('f0413054-2ac5-4ffe-8f28-16cc821042fe', '2026-08-03', '20:00:00', '20:30:00', 2, 0, false),
	('25d6c3be-63da-4a66-8270-0a6c55b0783f', '2026-08-03', '20:30:00', '21:00:00', 2, 0, false),
	('cc88c79c-f0cd-43e5-9899-36e789533db9', '2026-08-03', '21:00:00', '21:30:00', 2, 0, false),
	('628b2440-d2d4-4822-9a99-2817629f4ab3', '2026-08-03', '21:30:00', '22:00:00', 2, 0, false),
	('3c12b28e-b46a-4c75-bd7b-1621a0a4de77', '2026-08-03', '22:00:00', '22:30:00', 2, 0, false),
	('62e48d96-b304-4adc-be10-053d8bb25d25', '2026-08-03', '22:30:00', '23:00:00', 2, 0, false),
	('c3a27a62-8ab7-4f1e-af7c-2bd332180a99', '2026-08-04', '08:00:00', '08:30:00', 2, 0, false),
	('c4576715-3bb2-4555-be8e-9aa3d5a6a507', '2026-08-04', '08:30:00', '09:00:00', 2, 0, false),
	('724e60b6-5a11-4c66-9709-50e180705852', '2026-08-04', '09:00:00', '09:30:00', 2, 0, false),
	('d9999802-171b-4804-898e-be82980f37f7', '2026-08-04', '10:00:00', '10:30:00', 2, 0, false),
	('5aab6f39-83de-41e7-9451-e3fef52502ca', '2026-08-04', '10:30:00', '11:00:00', 2, 0, false),
	('aeda9eaa-d08a-449d-9f90-b9d0fb885e70', '2026-08-04', '11:00:00', '11:30:00', 2, 0, false),
	('42e9b959-f8a3-43da-ab94-712c8a8dec12', '2026-08-04', '11:30:00', '12:00:00', 2, 0, false),
	('7ae254dd-97dc-467f-acab-d6f495d3cff2', '2026-08-02', '12:30:00', '13:00:00', 2, 1, false),
	('7fe6d35d-73e5-459f-b718-69f2a1625e7a', '2026-08-02', '13:30:00', '14:00:00', 2, 1, false),
	('4cafac37-e4fa-438a-8811-4a3ccd32623e', '2026-08-03', '12:30:00', '13:00:00', 2, 1, false),
	('033abe96-4670-43d8-bf7e-a173f98b0cce', '2026-08-04', '09:30:00', '10:00:00', 2, 1, false),
	('f468b0a6-ec4a-49b7-9e54-5fe10f883ffd', '2026-08-02', '21:30:00', '22:00:00', 2, 0, false),
	('975359a0-6b0b-4ed6-8fb3-78ab42d151e2', '2026-08-04', '12:00:00', '12:30:00', 2, 0, false),
	('fee0789b-6422-4be3-9d6d-fed182ae5f91', '2026-08-04', '12:30:00', '13:00:00', 2, 0, false),
	('c506417b-ddc7-4451-a930-c255e4ffd001', '2026-08-04', '13:00:00', '13:30:00', 2, 0, false),
	('60f44095-fb99-45f8-a1ad-06e2699a0a7d', '2026-08-04', '13:30:00', '14:00:00', 2, 0, false),
	('e64bc523-226c-4380-923b-521b5fd6ed5c', '2026-08-04', '14:00:00', '14:30:00', 2, 0, false),
	('d1718c40-0f7e-42b8-9131-4ea79b251588', '2026-08-04', '14:30:00', '15:00:00', 2, 0, false),
	('1cbbf031-9df9-4722-9d88-9ee5e3157053', '2026-08-04', '15:00:00', '15:30:00', 2, 0, false),
	('1b0caa91-796e-4e6f-8005-b46c740fcd15', '2026-08-04', '15:30:00', '16:00:00', 2, 0, false),
	('95743325-b365-4e17-9773-7b868d6b7dc7', '2026-08-04', '16:00:00', '16:30:00', 2, 0, false),
	('e41c6db8-1b8e-4b97-94f8-4b6dc81df182', '2026-08-04', '16:30:00', '17:00:00', 2, 0, false),
	('9aa88047-d847-4b7e-89a7-bc7d0cf41ce6', '2026-08-04', '17:00:00', '17:30:00', 2, 0, false),
	('b38fcd63-da58-4adb-8966-5ca475d06f49', '2026-08-04', '17:30:00', '18:00:00', 2, 0, false),
	('4214d6be-ab5c-431a-a9c4-81106abe1778', '2026-08-04', '18:00:00', '18:30:00', 2, 0, false),
	('73288d35-e98b-4f9f-b34b-2f24ca589828', '2026-08-04', '18:30:00', '19:00:00', 2, 0, false),
	('200a8d3e-d646-47b5-aeb0-8c5a0fab19f8', '2026-08-04', '19:00:00', '19:30:00', 2, 0, false),
	('d420e4d3-f69b-4d7c-a495-cc9107f48a86', '2026-08-04', '19:30:00', '20:00:00', 2, 0, false),
	('e0a0cac9-3352-44c8-8ca1-1e8689906c4b', '2026-08-04', '20:00:00', '20:30:00', 2, 0, false),
	('50167636-31f7-47ab-8130-a6763e4363e4', '2026-08-04', '20:30:00', '21:00:00', 2, 0, false),
	('d3bc63ef-4935-4c86-ad6c-45f6ba509eaf', '2026-08-04', '21:00:00', '21:30:00', 2, 0, false),
	('575afc8c-beeb-481c-9692-abc74176da09', '2026-08-04', '21:30:00', '22:00:00', 2, 0, false),
	('ebb3d9ec-a636-45aa-8161-53035dc54c18', '2026-08-04', '22:00:00', '22:30:00', 2, 0, false),
	('6ddef8b4-eae7-4d69-84ed-a72ec7a3d354', '2026-08-04', '22:30:00', '23:00:00', 2, 0, false),
	('2dad0675-8a4a-46d6-8e02-4b4350c5ed86', '2026-08-05', '08:00:00', '08:30:00', 2, 0, false),
	('b6f681b9-2cad-42bd-b4c7-474d74b916b2', '2026-08-05', '08:30:00', '09:00:00', 2, 0, false),
	('2279aa98-1456-46ea-84df-04125090df5f', '2026-08-05', '09:00:00', '09:30:00', 2, 0, false),
	('605576e2-7130-4c43-b0fa-71198ac66f88', '2026-08-05', '09:30:00', '10:00:00', 2, 0, false),
	('13b89c07-ef60-4cfc-b750-0512535d0bc6', '2026-08-05', '10:00:00', '10:30:00', 2, 0, false),
	('d677cb4e-4650-4cd7-806d-f01e57034a50', '2026-08-05', '10:30:00', '11:00:00', 2, 0, false),
	('bd9d8428-428a-476a-b5e9-b616d38add33', '2026-08-05', '11:00:00', '11:30:00', 2, 0, false),
	('b0297b56-88c6-440d-b868-7052b40c0599', '2026-08-05', '11:30:00', '12:00:00', 2, 0, false),
	('01702ff6-ce2e-46bc-ba42-6c2a99843529', '2026-08-05', '12:00:00', '12:30:00', 2, 0, false),
	('35f3d932-7c28-4392-bc7f-7051c8a52c61', '2026-08-05', '12:30:00', '13:00:00', 2, 0, false),
	('8c66d5fc-6c60-4ba2-839b-586c894ed76c', '2026-08-05', '13:00:00', '13:30:00', 2, 0, false),
	('950c2eb2-d2aa-4a28-ba86-656d34969b48', '2026-08-05', '13:30:00', '14:00:00', 2, 0, false),
	('173d4739-dc94-4b0b-a552-83e58ecb111b', '2026-08-05', '14:00:00', '14:30:00', 2, 0, false),
	('fab6a57c-6aa0-47e8-9439-0c4cdd5fc551', '2026-08-05', '14:30:00', '15:00:00', 2, 0, false),
	('3b555eba-a628-442a-90dd-817ed774038a', '2026-08-05', '15:00:00', '15:30:00', 2, 0, false),
	('96fca873-a006-4605-9714-a53216404080', '2026-08-05', '15:30:00', '16:00:00', 2, 0, false),
	('6ff2dab0-c41d-48a3-a76f-8818a7ee8d50', '2026-08-05', '16:00:00', '16:30:00', 2, 0, false),
	('419ffbe7-3cc2-4a66-a520-b3a49c27f9ad', '2026-08-05', '16:30:00', '17:00:00', 2, 0, false),
	('8e1ffdbc-1a21-4400-934b-cbc2c94fb164', '2026-08-05', '17:00:00', '17:30:00', 2, 0, false),
	('14c7712b-d302-49e8-b624-94b71efc3508', '2026-08-05', '17:30:00', '18:00:00', 2, 0, false),
	('63cdbbb3-a87b-45e2-b071-c7cbb7fbebcf', '2026-08-05', '18:00:00', '18:30:00', 2, 0, false),
	('2a1456d7-5418-498d-bac5-698ed577650e', '2026-08-05', '18:30:00', '19:00:00', 2, 0, false),
	('2df79fb5-eb39-4723-b257-b2615a05e6d9', '2026-08-05', '19:00:00', '19:30:00', 2, 0, false),
	('d7efb445-1233-4e64-9cca-49c1a591b71d', '2026-08-05', '19:30:00', '20:00:00', 2, 0, false),
	('1bf26b29-d145-4d29-bc04-b426a72aca1b', '2026-08-05', '20:00:00', '20:30:00', 2, 0, false),
	('6353178a-9387-426d-8599-2b159196a400', '2026-08-05', '20:30:00', '21:00:00', 2, 0, false),
	('f9b4a245-5d77-4cba-bf72-e3cc040aa303', '2026-08-05', '21:00:00', '21:30:00', 2, 0, false),
	('a0d151ab-4f8a-4578-96be-4aed41af0f2c', '2026-08-05', '21:30:00', '22:00:00', 2, 0, false),
	('90a902e4-f536-41f9-9f8a-415751f41b21', '2026-08-05', '22:00:00', '22:30:00', 2, 0, false),
	('9a0528e1-3b39-4ee9-95c2-6ade3ccb5e48', '2026-08-05', '22:30:00', '23:00:00', 2, 0, false),
	('f5daf5da-9861-4adf-9f8f-8ef7b03029b8', '2026-07-22', '14:00:00', '14:30:00', 2, 1, false),
	('22227954-49fd-40cc-92a5-724b271a67e0', '2026-08-06', '08:00:00', '08:30:00', 2, 0, false),
	('7cd3d91d-1726-4ebe-99ce-932a2fc29b64', '2026-08-06', '08:30:00', '09:00:00', 2, 0, false),
	('6c5c5b5b-d8d0-4e72-8903-c82c7e2e2dfc', '2026-08-06', '09:00:00', '09:30:00', 2, 0, false),
	('4bba4f69-7406-4c04-b629-801f4143722e', '2026-08-06', '09:30:00', '10:00:00', 2, 0, false),
	('51d5b03f-44ad-4251-9526-e97ae58c3a8f', '2026-08-06', '10:00:00', '10:30:00', 2, 0, false),
	('9352fbb2-63bd-47a1-a022-e0858065d711', '2026-08-06', '10:30:00', '11:00:00', 2, 0, false),
	('cbfdebca-c9ce-4737-bcbe-ac41f152444b', '2026-08-06', '11:00:00', '11:30:00', 2, 0, false),
	('e2b70b8b-f0c6-4c7d-9209-571c0c9753c1', '2026-08-06', '11:30:00', '12:00:00', 2, 0, false),
	('a01e6a9e-f8f0-4715-bf91-80dd76d413c8', '2026-08-06', '12:00:00', '12:30:00', 2, 0, false),
	('345ab3d7-e186-4aa6-b99f-7fda50568c6c', '2026-08-06', '12:30:00', '13:00:00', 2, 0, false),
	('bfb7ee95-0ba9-4b89-8f92-f7492bf02a18', '2026-08-06', '13:30:00', '14:00:00', 2, 0, false),
	('6f21a990-c8d3-4e51-8c68-3dd0c751b143', '2026-08-06', '14:00:00', '14:30:00', 2, 0, false),
	('deb5c4fc-cec9-4cfe-9078-4d24ca94033f', '2026-08-06', '14:30:00', '15:00:00', 2, 0, false),
	('72a450de-3913-48a9-b059-f11c3cf32fa7', '2026-08-06', '15:00:00', '15:30:00', 2, 0, false),
	('375c09b9-59dd-4f66-ad0c-74851497ddc4', '2026-08-06', '15:30:00', '16:00:00', 2, 0, false),
	('16cfbd58-a785-46a3-b4aa-a9faa37aba7e', '2026-08-06', '16:00:00', '16:30:00', 2, 0, false),
	('f6f23bbe-5631-4fc6-8660-8d32585825f0', '2026-08-06', '16:30:00', '17:00:00', 2, 0, false),
	('a5493cc8-6258-4ff3-9b2c-bb6497c8d099', '2026-08-06', '17:00:00', '17:30:00', 2, 0, false),
	('b7897608-1960-4506-919c-d90cd95bbe91', '2026-08-06', '17:30:00', '18:00:00', 2, 0, false),
	('050183d3-a52f-440d-ab2d-c7c8e97e7c0a', '2026-08-06', '18:00:00', '18:30:00', 2, 0, false),
	('cb67a913-cdd1-48de-b882-467e1b2639ad', '2026-08-06', '18:30:00', '19:00:00', 2, 0, false),
	('0a31995d-8c2f-4363-a591-5f079421ce2a', '2026-08-06', '19:00:00', '19:30:00', 2, 0, false),
	('102cc89b-7019-4685-b622-abfc09d7416a', '2026-08-06', '19:30:00', '20:00:00', 2, 0, false),
	('61efc359-04d0-4847-af19-5a7ecbeb0a19', '2026-08-06', '20:00:00', '20:30:00', 2, 0, false),
	('bbdb1ae3-ca36-4d30-bb1c-26a501ba96c5', '2026-08-06', '20:30:00', '21:00:00', 2, 0, false),
	('ddf07eb3-36e4-4c91-a9dc-b9cd316d9052', '2026-08-06', '21:00:00', '21:30:00', 2, 0, false),
	('c20fc701-dae8-40e1-8432-47eeb887c846', '2026-08-06', '21:30:00', '22:00:00', 2, 0, false),
	('80698629-3c20-47f0-a4b0-f5f50a3afcdb', '2026-08-06', '22:00:00', '22:30:00', 2, 0, false),
	('469d5ff8-856b-41e8-8bfa-23fe6339b1b0', '2026-08-06', '22:30:00', '23:00:00', 2, 0, false),
	('b7722e0b-c22f-41a6-b3b5-8604d06c517b', '2026-08-07', '08:00:00', '08:30:00', 2, 0, false),
	('10fb8312-bd12-4563-8be0-c4fd634b4dc8', '2026-08-07', '08:30:00', '09:00:00', 2, 0, false),
	('bced5e6a-ea5c-4262-b8f0-71f63352f52e', '2026-08-07', '09:00:00', '09:30:00', 2, 0, false),
	('cd1b7ebf-39c9-4b48-aae2-4de3b297eafe', '2026-08-07', '09:30:00', '10:00:00', 2, 0, false),
	('c0453ce9-d29a-4a9b-9ce0-8e8dad10a529', '2026-08-07', '10:00:00', '10:30:00', 2, 0, false),
	('a7d8aa05-92bd-4dae-aafe-0a3205444529', '2026-08-07', '10:30:00', '11:00:00', 2, 0, false),
	('e84204d3-3b41-45f4-b2a1-30fc05d09abb', '2026-08-07', '11:00:00', '11:30:00', 2, 0, false),
	('cb297b99-fe76-482f-9155-2b1430e64beb', '2026-08-07', '11:30:00', '12:00:00', 2, 0, false),
	('9915122a-6d31-4dd7-a31c-66689370addb', '2026-08-07', '12:00:00', '12:30:00', 2, 0, false),
	('1d052a67-c922-4aea-88c9-78f0833c73ed', '2026-08-07', '12:30:00', '13:00:00', 2, 0, false),
	('8a8f2460-701b-4172-9a9f-1da57af6af60', '2026-08-07', '13:00:00', '13:30:00', 2, 0, false),
	('f5fde023-4ca7-48e5-9e94-84769b6c3975', '2026-08-07', '13:30:00', '14:00:00', 2, 0, false),
	('e096d89b-96de-4bcf-a52a-d1ec59bc5dab', '2026-08-07', '14:00:00', '14:30:00', 2, 0, false),
	('7270a2c1-892c-4fe2-bb8f-5bc6084654ec', '2026-08-07', '14:30:00', '15:00:00', 2, 0, false),
	('f3472e4e-7afd-4d5b-a4bf-7093e1baf136', '2026-08-07', '15:00:00', '15:30:00', 2, 0, false),
	('6ed3993b-4132-4768-823b-7f8f143bdc19', '2026-08-07', '15:30:00', '16:00:00', 2, 0, false),
	('6186ee58-2680-4be7-9597-b2e9fb9499fb', '2026-08-07', '16:00:00', '16:30:00', 2, 0, false),
	('8f36158a-8f82-4bec-bc66-393727ba2ecf', '2026-08-07', '16:30:00', '17:00:00', 2, 0, false),
	('92f6081f-cb8d-48cf-b4d0-badf4d4ed3a4', '2026-08-07', '17:00:00', '17:30:00', 2, 0, false),
	('e6b3d7e2-1a48-48ce-bc55-96be6ae3ba89', '2026-08-07', '17:30:00', '18:00:00', 2, 0, false),
	('60242fd3-ac1b-4d21-ad7b-509231be1013', '2026-08-07', '18:00:00', '18:30:00', 2, 0, false),
	('7d9ba41d-729a-4a26-8724-9abde5109a72', '2026-08-07', '18:30:00', '19:00:00', 2, 0, false),
	('42532575-b528-4788-bd10-8f9207f617dc', '2026-08-07', '19:00:00', '19:30:00', 2, 0, false),
	('ceb444de-afec-4bb0-a79c-6e2724e0e44a', '2026-08-07', '19:30:00', '20:00:00', 2, 0, false),
	('85f2b752-2dcb-4a95-b56f-3e2e8af943eb', '2026-08-07', '20:00:00', '20:30:00', 2, 0, false),
	('b3797615-847e-4513-8112-1f742bd0d9f5', '2026-08-07', '20:30:00', '21:00:00', 2, 0, false),
	('d59289c9-5ef0-47e2-b864-9a9fca9605c6', '2026-08-07', '21:00:00', '21:30:00', 2, 0, false),
	('dae4d174-3850-4322-a13a-826c8026a905', '2026-08-07', '21:30:00', '22:00:00', 2, 0, false),
	('d6fe6b97-2fa9-460b-b3c0-c53c4a9c7eb9', '2026-08-07', '22:00:00', '22:30:00', 2, 0, false),
	('a7d5b7f5-6b2f-49bb-b79b-0ae689a5e1a3', '2026-08-07', '22:30:00', '23:00:00', 2, 0, false),
	('d51f8649-f226-4a94-bbb7-edcfb746e154', '2026-07-24', '17:30:00', '18:00:00', 2, 1, false),
	('def30979-335a-48a7-a717-678ce3a75706', '2026-08-08', '08:00:00', '08:30:00', 2, 0, false),
	('836c66a1-c051-4c51-ba71-5f4fd394b00f', '2026-08-08', '08:30:00', '09:00:00', 2, 0, false),
	('b36f01a1-e35f-4072-aae9-df9087c21981', '2026-08-08', '09:00:00', '09:30:00', 2, 0, false),
	('d8742c57-600f-447f-8f81-9762cb62aab2', '2026-08-08', '09:30:00', '10:00:00', 2, 0, false),
	('952157e4-7e13-4919-96dd-1627f91215ac', '2026-08-08', '10:00:00', '10:30:00', 2, 0, false),
	('430e76f5-c6e9-48c6-89a0-63ac36333f15', '2026-08-08', '10:30:00', '11:00:00', 2, 0, false),
	('cec151e9-f410-41c9-9677-a0e07be006f6', '2026-08-08', '11:00:00', '11:30:00', 2, 0, false),
	('4a5c114f-1700-442b-904f-bc97bad93946', '2026-08-08', '11:30:00', '12:00:00', 2, 0, false),
	('e2b0f5a0-9fc7-49a6-82f9-cd2ed70efb13', '2026-08-08', '12:00:00', '12:30:00', 2, 0, false),
	('03d286f7-b64d-4fea-8fdb-7c453d6c6fc2', '2026-08-08', '12:30:00', '13:00:00', 2, 0, false),
	('a2291932-33d3-4d59-88c7-6452377653e7', '2026-08-08', '13:00:00', '13:30:00', 2, 0, false),
	('3a66400c-2f25-4ef8-9589-4c3c60da298e', '2026-08-08', '13:30:00', '14:00:00', 2, 0, false),
	('dd308326-956c-4c21-968f-850217f37e44', '2026-08-08', '14:00:00', '14:30:00', 2, 0, false),
	('4bf13829-faf7-40c4-81b1-d552d87fa29a', '2026-08-08', '14:30:00', '15:00:00', 2, 0, false),
	('a61a82dc-a944-427d-acfe-1eabcdffbf7a', '2026-08-08', '15:00:00', '15:30:00', 2, 0, false),
	('f88215da-b65c-4623-9248-ef10dfb9f2f6', '2026-08-08', '15:30:00', '16:00:00', 2, 0, false),
	('02375770-2f3e-4dd2-84c5-bf4de637e020', '2026-08-08', '16:00:00', '16:30:00', 2, 0, false),
	('a992f24e-39f0-4f94-990a-4831b508b84b', '2026-08-08', '16:30:00', '17:00:00', 2, 0, false),
	('1b1ff05c-83aa-482f-b7b7-c2cfa006ea94', '2026-08-08', '17:00:00', '17:30:00', 2, 0, false),
	('6db64953-0ba4-40ee-91fd-cf734e802fa5', '2026-08-08', '17:30:00', '18:00:00', 2, 0, false),
	('f12fe3b2-eb1a-4b70-bdcd-add894e10e21', '2026-08-08', '18:00:00', '18:30:00', 2, 0, false),
	('00756ee1-7e6c-4a40-8001-cda0a87e2294', '2026-08-08', '18:30:00', '19:00:00', 2, 0, false),
	('fc2eb331-e992-4ebc-bcb8-aa627ba4a8f3', '2026-08-08', '19:00:00', '19:30:00', 2, 0, false),
	('887dc800-2120-48fa-9f03-b62851260c8c', '2026-08-08', '19:30:00', '20:00:00', 2, 0, false),
	('2a879a88-36ec-447c-9537-b4f3f77c50dd', '2026-08-08', '20:00:00', '20:30:00', 2, 0, false),
	('e0c8d998-db86-41aa-9d24-89f853b8e325', '2026-08-08', '20:30:00', '21:00:00', 2, 0, false),
	('0ce4bccc-f3f6-4443-b58e-f8f4c555535f', '2026-08-08', '21:30:00', '22:00:00', 2, 0, false),
	('f649303c-61e9-4232-b625-05f22f9c7a19', '2026-08-08', '22:00:00', '22:30:00', 2, 0, false),
	('017efc21-d4ee-4532-85b7-409f6924d599', '2026-08-08', '22:30:00', '23:00:00', 2, 0, false),
	('1c02f877-2d77-4b7d-ba42-bf8f2064d5aa', '2026-08-09', '08:00:00', '08:30:00', 2, 0, false),
	('433a7319-d8cf-4b7a-afc1-f0f546841055', '2026-08-09', '08:30:00', '09:00:00', 2, 0, false),
	('edcd764b-245a-440a-8c39-6bf6ddd9d3a1', '2026-08-09', '09:00:00', '09:30:00', 2, 0, false),
	('0ff9c99c-80be-4e85-b5a6-c16a3ec6b660', '2026-08-09', '09:30:00', '10:00:00', 2, 0, false),
	('4539b8f7-0b49-4be6-8a5b-f9dafae76dc9', '2026-08-09', '10:00:00', '10:30:00', 2, 0, false),
	('90cba87d-c6d1-432b-a10f-339ec9301660', '2026-08-09', '10:30:00', '11:00:00', 2, 0, false),
	('81c717e8-a302-4761-9bba-59129df3ab95', '2026-08-09', '11:00:00', '11:30:00', 2, 0, false),
	('d4726b0e-a2d8-4f96-a279-46e9e915cb1b', '2026-08-09', '11:30:00', '12:00:00', 2, 0, false),
	('84439e9f-f421-4a0d-ad46-cd731600c621', '2026-08-09', '12:30:00', '13:00:00', 2, 0, false),
	('f610ca4e-d0ae-40ac-a7b8-a1a50c8d72bd', '2026-08-09', '13:00:00', '13:30:00', 2, 0, false),
	('3e45b9a1-d0d2-4882-a488-9996339a2759', '2026-08-09', '13:30:00', '14:00:00', 2, 0, false),
	('05468070-0ccf-40f0-8d1b-b78c441478b0', '2026-08-09', '14:00:00', '14:30:00', 2, 0, false),
	('7b9386a0-0270-416c-9ec3-4abef6908995', '2026-08-09', '14:30:00', '15:00:00', 2, 0, false),
	('62c49e35-b0d1-4a0e-bfe0-d71095e48ded', '2026-08-09', '15:00:00', '15:30:00', 2, 0, false),
	('4370199f-91f4-45c8-8b4c-4f69cfaed409', '2026-08-09', '15:30:00', '16:00:00', 2, 0, false),
	('72c5e325-d90d-4a64-b3a5-1a0eb62f1a77', '2026-08-09', '16:00:00', '16:30:00', 2, 0, false),
	('ab05dd93-6af7-4415-9d7a-6db8cfd5c5e7', '2026-08-09', '16:30:00', '17:00:00', 2, 0, false),
	('993fa8c7-99dd-4cef-a0f9-41b4e3accde9', '2026-08-09', '17:00:00', '17:30:00', 2, 0, false),
	('7ffcc0fd-a85b-4f0d-a46f-d147ee379b5c', '2026-08-09', '17:30:00', '18:00:00', 2, 0, false),
	('9ef2a6c9-fa25-4689-a654-43f8eb5ec471', '2026-08-09', '18:00:00', '18:30:00', 2, 0, false),
	('b7e7f809-6b06-4149-a5f9-1d1fa8166504', '2026-08-09', '18:30:00', '19:00:00', 2, 0, false),
	('4eee280a-85b6-4df7-8281-401ff83035d6', '2026-08-09', '19:00:00', '19:30:00', 2, 0, false),
	('4ffa5edb-ca9c-45f1-90ea-03333af23767', '2026-08-09', '19:30:00', '20:00:00', 2, 0, false),
	('62a8eed0-3119-4d5d-9bbf-a81b1e265609', '2026-08-09', '20:00:00', '20:30:00', 2, 0, false),
	('1f48ba84-0c11-47b5-9a99-3e0df2db4943', '2026-08-09', '20:30:00', '21:00:00', 2, 0, false),
	('53da8628-4561-4bf7-8cc4-234fc02d4586', '2026-08-09', '21:00:00', '21:30:00', 2, 0, false),
	('10556145-1a24-424c-9ffe-0d601caa0aa9', '2026-08-09', '21:30:00', '22:00:00', 2, 0, false),
	('202d944e-00cc-4a38-9e97-310234f685d8', '2026-08-09', '22:00:00', '22:30:00', 2, 0, false),
	('5470bccc-fb0d-4086-896c-6f95b9d3cc44', '2026-08-09', '22:30:00', '23:00:00', 2, 0, false),
	('4f653d95-ce8d-4b95-b76f-4f6f65022e2c', '2026-08-10', '08:00:00', '08:30:00', 2, 0, false),
	('ca1b465e-a977-4147-9ee6-f77c34d12c92', '2026-08-10', '08:30:00', '09:00:00', 2, 0, false),
	('554a41ff-be87-4645-a5da-122553378297', '2026-08-10', '09:00:00', '09:30:00', 2, 0, false),
	('71f0046c-e66a-4bcc-9289-ba7b39e55a0e', '2026-08-10', '09:30:00', '10:00:00', 2, 0, false),
	('415f3ffc-401b-4944-8c64-43a2ffb08d6b', '2026-08-10', '10:00:00', '10:30:00', 2, 0, false),
	('3a00326b-2550-42aa-aa70-5aee1ed0e868', '2026-08-10', '10:30:00', '11:00:00', 2, 0, false),
	('301d8100-addc-4d74-82e4-47d3a55ffed8', '2026-08-10', '11:00:00', '11:30:00', 2, 0, false),
	('290ef968-740b-4ec7-a6e8-71f8445dfa62', '2026-08-10', '11:30:00', '12:00:00', 2, 0, false),
	('3ac142c6-4966-431c-b8f7-6407bc6babb3', '2026-08-10', '12:00:00', '12:30:00', 2, 0, false),
	('88c722d7-6f37-478c-97fd-91fe8d8b090c', '2026-08-10', '12:30:00', '13:00:00', 2, 0, false),
	('bceb9780-2e9f-4295-ba63-5de2a74b6853', '2026-08-10', '13:00:00', '13:30:00', 2, 0, false),
	('b453364b-5b37-446e-a119-853c5501a621', '2026-08-10', '13:30:00', '14:00:00', 2, 0, false),
	('b974a895-f84a-4590-b60c-6ece87eea031', '2026-08-10', '14:00:00', '14:30:00', 2, 0, false),
	('2b5898e8-ea39-4700-b72a-853fead674ce', '2026-08-10', '14:30:00', '15:00:00', 2, 0, false),
	('e3161fef-92ab-48cd-994e-f8b9b1bfa05c', '2026-08-10', '15:00:00', '15:30:00', 2, 0, false),
	('98f27e8a-bd1f-4137-89e3-549c1d5d04d8', '2026-08-10', '15:30:00', '16:00:00', 2, 0, false),
	('82250c74-81a2-4a65-851a-c7756ade1913', '2026-08-10', '16:00:00', '16:30:00', 2, 0, false),
	('7be75c8e-d768-4beb-9cd1-02fee09325f4', '2026-08-10', '16:30:00', '17:00:00', 2, 0, false),
	('49b3923d-8d94-4453-8ed6-e3a7c911506b', '2026-08-10', '17:00:00', '17:30:00', 2, 0, false),
	('9bd94bac-463f-4272-a37a-90654f3cb52a', '2026-08-10', '17:30:00', '18:00:00', 2, 0, false),
	('c5f4372d-a25d-4da0-aff3-e3708f02eefe', '2026-08-10', '18:00:00', '18:30:00', 2, 0, false),
	('9f24a572-927e-4cc7-a8f9-2d262ea94a55', '2026-08-09', '12:00:00', '12:30:00', 2, 1, false),
	('43a175c2-912f-4db5-ac1b-8ebd139405a3', '2026-08-10', '18:30:00', '19:00:00', 2, 0, false),
	('62bf2144-7a47-4052-ad16-700cd905b45e', '2026-08-10', '19:00:00', '19:30:00', 2, 0, false),
	('aa962f71-f97c-412a-ad12-516f78cdd679', '2026-08-10', '19:30:00', '20:00:00', 2, 0, false),
	('97bf5eb1-cceb-4f37-895b-bc507a5c76ac', '2026-08-10', '20:00:00', '20:30:00', 2, 0, false),
	('21263cae-1ae4-4480-bdc1-09061974a8e3', '2026-08-10', '20:30:00', '21:00:00', 2, 0, false),
	('66da0fcb-9774-4f42-ba09-04ab0488e6d2', '2026-08-10', '21:00:00', '21:30:00', 2, 0, false),
	('c76ed5a6-5cf2-4c76-a226-fe3ac777ac75', '2026-08-10', '21:30:00', '22:00:00', 2, 0, false),
	('bae6a377-d6f2-4d75-a80f-839212a03d3a', '2026-08-10', '22:00:00', '22:30:00', 2, 0, false),
	('55f2466d-1ee7-44e5-9bc0-6e4e142d2058', '2026-08-10', '22:30:00', '23:00:00', 2, 0, false),
	('526138a5-46f4-4945-a7df-071a99f563f9', '2026-08-11', '08:00:00', '08:30:00', 2, 0, false),
	('392fcc67-2ea0-4c87-9cee-4772a16a3c5c', '2026-08-11', '08:30:00', '09:00:00', 2, 0, false),
	('e78232ce-251b-4064-b746-d77f155e1f04', '2026-08-11', '09:00:00', '09:30:00', 2, 0, false),
	('ee27687b-3662-476b-8be2-ebd8c9c1bffc', '2026-08-11', '09:30:00', '10:00:00', 2, 0, false),
	('84f21381-316e-492d-823d-950abad5b299', '2026-08-11', '10:00:00', '10:30:00', 2, 0, false),
	('d4834f9d-9ed9-40ab-ae11-768742c61c2c', '2026-08-11', '10:30:00', '11:00:00', 2, 0, false),
	('7f65071b-a6ea-43f3-adbd-fd2406a5fb19', '2026-08-11', '11:00:00', '11:30:00', 2, 0, false),
	('761960af-97da-44e9-8c92-6842ce713cf2', '2026-08-11', '11:30:00', '12:00:00', 2, 0, false),
	('c8a43243-c44d-46ce-a279-f66c6cbec63f', '2026-08-11', '12:00:00', '12:30:00', 2, 0, false),
	('636e84f8-bc2b-4629-8324-5876521233aa', '2026-08-11', '12:30:00', '13:00:00', 2, 0, false),
	('3f15f51c-eef2-40c8-955b-90209edf65f6', '2026-08-11', '13:30:00', '14:00:00', 2, 0, false),
	('80930f98-8ce8-4065-8e0f-88e67867d5c5', '2026-08-11', '14:00:00', '14:30:00', 2, 0, false),
	('55b9914d-4779-494e-9600-b96f4d7945ff', '2026-08-11', '14:30:00', '15:00:00', 2, 0, false),
	('db32d4f0-8eac-4ff9-9506-9c3d4eabb65d', '2026-08-11', '15:00:00', '15:30:00', 2, 0, false),
	('b5f1e1ff-d55d-4a1b-ad29-f97afade41b1', '2026-08-11', '15:30:00', '16:00:00', 2, 0, false),
	('84662ad5-a3b9-4e67-a18f-736140dde790', '2026-08-11', '16:00:00', '16:30:00', 2, 0, false),
	('5439c4dc-e9e2-428a-8bd0-379a811b5399', '2026-08-11', '16:30:00', '17:00:00', 2, 0, false),
	('cb2b62bb-a218-48e7-85ce-90bb2c6e4e41', '2026-08-11', '17:00:00', '17:30:00', 2, 0, false),
	('04efca35-45eb-45a2-887e-b2ef4cce5059', '2026-08-11', '18:00:00', '18:30:00', 2, 0, false),
	('4852421a-18f9-45f0-a4c7-7cf904ebba05', '2026-08-11', '18:30:00', '19:00:00', 2, 0, false),
	('46feb1e0-fe03-450a-91e4-04f5fe9945b9', '2026-08-11', '19:00:00', '19:30:00', 2, 0, false),
	('5fbff17f-7c64-483b-a039-97c41496859d', '2026-08-11', '19:30:00', '20:00:00', 2, 0, false),
	('95afcab4-52e7-4460-b318-c53397216757', '2026-08-11', '20:00:00', '20:30:00', 2, 0, false),
	('6eed0d9f-02f9-4f41-b264-db04e783f8bb', '2026-08-11', '20:30:00', '21:00:00', 2, 0, false),
	('6333b765-faaf-4bbc-9aed-d6b0946fa89b', '2026-08-11', '21:00:00', '21:30:00', 2, 0, false),
	('3a02a034-1f3a-4b6d-8169-7d9ba63a9a7d', '2026-08-11', '21:30:00', '22:00:00', 2, 0, false),
	('4c0e5b2f-9f7f-4159-bec7-24a933eed709', '2026-08-11', '22:00:00', '22:30:00', 2, 0, false),
	('244f8d8b-1bac-482a-80f1-99643ce2a243', '2026-08-11', '22:30:00', '23:00:00', 2, 0, false),
	('f2172812-d124-4287-8cd8-cbaaf83675bf', '2026-07-28', '09:00:00', '09:30:00', 2, 1, false),
	('ab964b56-aa93-46f4-938a-1a4eac019e86', '2026-08-12', '08:00:00', '08:30:00', 2, 0, false),
	('a602a2f6-58cd-489d-a0d8-9d226fd697fa', '2026-08-12', '08:30:00', '09:00:00', 2, 0, false),
	('a1e6bdaf-8147-41eb-9be2-72711df0ad24', '2026-08-12', '09:00:00', '09:30:00', 2, 0, false),
	('3593282e-058d-4a64-98af-3e2b3f272f16', '2026-08-12', '09:30:00', '10:00:00', 2, 0, false),
	('e3454357-2382-4891-a54f-20de388b604d', '2026-08-12', '10:00:00', '10:30:00', 2, 0, false),
	('a9df2349-841f-473c-a606-584020aaceb3', '2026-08-12', '10:30:00', '11:00:00', 2, 0, false),
	('2a1d81d0-a9bf-49fe-a0cd-8dc0ac506064', '2026-08-12', '11:00:00', '11:30:00', 2, 0, false),
	('413d7d02-cc13-40dc-9961-06aa132b081c', '2026-08-12', '11:30:00', '12:00:00', 2, 0, false),
	('ab756fa6-dad7-4927-8fad-54442fd48b78', '2026-08-12', '12:00:00', '12:30:00', 2, 0, false),
	('7d1ddceb-c00f-4843-b059-e9b1bbcfadfb', '2026-08-12', '12:30:00', '13:00:00', 2, 0, false),
	('b0f7ef7d-a7cd-4f9a-846f-de4658381b57', '2026-08-12', '13:00:00', '13:30:00', 2, 0, false),
	('a4acc2b3-cee1-4e81-a009-bb6d6092d927', '2026-08-12', '13:30:00', '14:00:00', 2, 0, false),
	('c423dd75-6487-4a41-ab6b-4223f97e0eab', '2026-08-12', '14:00:00', '14:30:00', 2, 0, false),
	('b6c7061e-8fef-4c9a-b0ff-d2cd95d95b82', '2026-08-12', '14:30:00', '15:00:00', 2, 0, false),
	('b31f84b1-f75a-4e5b-9b34-25d9f44b2ebf', '2026-08-12', '15:00:00', '15:30:00', 2, 0, false),
	('634353db-87bc-481a-a596-f690a8cac9a4', '2026-08-12', '15:30:00', '16:00:00', 2, 0, false),
	('04353b2e-6057-4342-b7fe-71ca5caa32a6', '2026-08-12', '16:00:00', '16:30:00', 2, 0, false),
	('e2a7d0bc-47e4-4be2-8aae-19bfd7bc886f', '2026-08-12', '16:30:00', '17:00:00', 2, 0, false),
	('96373ffd-ecb2-4d47-bffb-5c82e33dbcdb', '2026-08-12', '17:00:00', '17:30:00', 2, 0, false),
	('e02e5c14-714f-43e5-8c67-7b47604339e8', '2026-08-12', '17:30:00', '18:00:00', 2, 0, false),
	('2d735915-55df-48df-905b-6087c87ff5e1', '2026-08-12', '18:00:00', '18:30:00', 2, 0, false),
	('9357d9ae-e3b5-4912-b0f3-78d7b62e4396', '2026-08-12', '18:30:00', '19:00:00', 2, 0, false),
	('18345b58-549f-47f9-9e37-f08628c79c10', '2026-08-12', '19:00:00', '19:30:00', 2, 0, false),
	('205637e8-ef17-42ab-8d3c-a94579393b70', '2026-08-12', '19:30:00', '20:00:00', 2, 0, false),
	('6b29278c-012b-4f78-9a93-e072570bb24e', '2026-08-12', '20:00:00', '20:30:00', 2, 0, false),
	('25fccd18-6846-4287-8d5d-23cdb4366434', '2026-08-12', '20:30:00', '21:00:00', 2, 0, false),
	('a5bb67da-fa2d-489d-a28d-7a8f53b07f76', '2026-08-12', '21:00:00', '21:30:00', 2, 0, false),
	('76968e07-416c-4a45-96b0-d024dd8f1dbc', '2026-08-12', '21:30:00', '22:00:00', 2, 0, false),
	('251e7fc9-b7c9-454c-a9bd-16990d273a3b', '2026-08-12', '22:00:00', '22:30:00', 2, 0, false),
	('5c867ec9-1212-47d9-bd40-3402df87617f', '2026-08-12', '22:30:00', '23:00:00', 2, 0, false),
	('172d1bb4-ad7f-4eb8-997e-24ee7d97b7cf', '2026-08-11', '13:00:00', '13:30:00', 2, 1, false),
	('842f43ff-ec9e-4151-8833-b091232d11b6', '2026-08-11', '17:30:00', '18:00:00', 2, 1, false),
	('f0de09b5-a1d9-4955-9771-bc2346b4f44b', '2026-07-29', '19:00:00', '19:30:00', 2, 1, false),
	('1e8aedf6-2f6a-480c-ad7e-28aee754bc6d', '2026-07-29', '14:00:00', '14:30:00', 2, 1, false),
	('ab7dd18c-e99f-4de7-a052-08749caca22e', '2026-07-29', '22:30:00', '23:00:00', 2, 1, false),
	('c3c1793d-e57a-4560-b236-ead6f756371e', '2026-08-13', '08:00:00', '08:30:00', 2, 0, false),
	('afda4518-21d6-4cb1-ad9c-51dbb6480458', '2026-08-13', '08:30:00', '09:00:00', 2, 0, false),
	('5e02f1ed-9b07-42f5-ae19-36bec135e55c', '2026-08-13', '09:00:00', '09:30:00', 2, 0, false),
	('294571c4-1a0b-4508-981a-d2b8d2d4aa9d', '2026-08-13', '09:30:00', '10:00:00', 2, 0, false),
	('c9971f8d-cdc3-41ab-89a4-2eb4d4a02aae', '2026-08-13', '10:00:00', '10:30:00', 2, 0, false),
	('9de551e6-18bb-4807-8ba4-400a762c92f5', '2026-08-13', '10:30:00', '11:00:00', 2, 0, false),
	('0f1c87cc-5b4a-4ec9-b9bc-cff2d7609d5c', '2026-08-13', '11:00:00', '11:30:00', 2, 0, false),
	('eb1c7bef-a659-46ca-98a8-1cbe6c77d1df', '2026-08-13', '11:30:00', '12:00:00', 2, 0, false),
	('dabeb401-36ec-4acf-b00f-9edcf42a5013', '2026-08-13', '12:00:00', '12:30:00', 2, 0, false),
	('dad81dc0-86af-4d0c-872b-591d59391608', '2026-08-13', '12:30:00', '13:00:00', 2, 0, false),
	('e83b25a6-d401-4bc6-8f57-318f65f961b5', '2026-08-13', '13:00:00', '13:30:00', 2, 0, false),
	('87c434be-ce38-4442-b595-51a12b8b8d92', '2026-08-13', '13:30:00', '14:00:00', 2, 0, false),
	('c674002b-a36e-40f2-a424-896fe6ca39cf', '2026-08-13', '14:00:00', '14:30:00', 2, 0, false),
	('1850ceb0-7990-4f67-bd17-51c6f999e47f', '2026-08-13', '14:30:00', '15:00:00', 2, 0, false),
	('cf0a2db2-5063-42ac-b47f-84fc16331b6f', '2026-08-13', '15:00:00', '15:30:00', 2, 0, false),
	('70a18c7d-9af9-4bc0-adc7-87b23f161080', '2026-08-13', '15:30:00', '16:00:00', 2, 0, false),
	('cbbef72c-2504-43c8-8aed-8b53077489cd', '2026-08-13', '16:00:00', '16:30:00', 2, 0, false),
	('1abdc16d-cbbf-475e-b574-f9451477f362', '2026-08-13', '16:30:00', '17:00:00', 2, 0, false),
	('82da0cfa-a7df-448d-a4c6-87349e7d84ff', '2026-08-13', '17:00:00', '17:30:00', 2, 0, false),
	('85a3f6bb-c380-41d0-ae0f-149f76595059', '2026-08-13', '17:30:00', '18:00:00', 2, 0, false),
	('f21f6b6e-7608-4f15-95fe-159527d48ea0', '2026-08-13', '18:00:00', '18:30:00', 2, 0, false),
	('86f82bf9-2cd9-47fc-bf3c-4caf32cb4226', '2026-08-13', '18:30:00', '19:00:00', 2, 0, false),
	('7bf2ac68-447c-41cd-9e03-138cb83fcba0', '2026-08-13', '19:00:00', '19:30:00', 2, 0, false),
	('8382e9ce-9ddf-4d6e-980b-f4100ddb9cf0', '2026-08-13', '19:30:00', '20:00:00', 2, 0, false),
	('04664f09-0e08-4aa6-8724-627e3aca9933', '2026-08-13', '20:00:00', '20:30:00', 2, 0, false),
	('5ef1e752-4bfa-491f-92bd-00ebfdb2f9c4', '2026-08-13', '20:30:00', '21:00:00', 2, 0, false),
	('65909c1e-6c64-47c6-a4e3-cbf76d297cee', '2026-08-13', '21:00:00', '21:30:00', 2, 0, false),
	('3e524f73-1023-46eb-b3f2-bbfb7b76a353', '2026-08-13', '21:30:00', '22:00:00', 2, 0, false),
	('1cfc3e5a-d559-44b4-bf37-cf9f38c750da', '2026-08-13', '22:00:00', '22:30:00', 2, 0, false),
	('02552b90-55f5-45fc-9217-6fc7e78fc9c7', '2026-08-13', '22:30:00', '23:00:00', 2, 0, false),
	('1976d8a8-fda5-4aad-98c5-6b11a65a521c', '2026-08-14', '08:00:00', '08:30:00', 2, 0, false),
	('a4fb485f-55e9-4bf1-a991-5a8d477e8b11', '2026-08-14', '08:30:00', '09:00:00', 2, 0, false),
	('186bdaaf-3268-4010-b52a-bf983ff635d8', '2026-08-14', '09:00:00', '09:30:00', 2, 0, false),
	('b1b9d163-450b-453c-a37f-d02ad08c2eeb', '2026-08-14', '09:30:00', '10:00:00', 2, 0, false),
	('cf0428b4-8b12-473f-a6e1-4f2046e7bd60', '2026-08-14', '10:00:00', '10:30:00', 2, 0, false),
	('eff6f6fa-5b8a-411a-98c8-1e3d90e68eea', '2026-08-14', '10:30:00', '11:00:00', 2, 0, false),
	('7ace6fab-7529-4ed3-bfb2-32cdc90e51c5', '2026-08-14', '11:00:00', '11:30:00', 2, 0, false),
	('5359acb8-96c6-45df-b620-2399eadaa592', '2026-08-14', '11:30:00', '12:00:00', 2, 0, false),
	('cabc5980-7446-4acb-a64c-95e0e05fd5b1', '2026-08-14', '12:00:00', '12:30:00', 2, 0, false),
	('a24a9ae0-386a-4fc4-b5be-e3377c14e8c0', '2026-08-14', '12:30:00', '13:00:00', 2, 0, false),
	('79c08f27-34b5-4fbc-b5ba-9115e7d8abc6', '2026-08-14', '13:00:00', '13:30:00', 2, 0, false),
	('b1ebc5fa-5770-46bb-94ae-a0e8baf34ad3', '2026-08-14', '13:30:00', '14:00:00', 2, 0, false),
	('9dd4d765-08f9-4a25-9df8-0716123c371f', '2026-08-14', '14:00:00', '14:30:00', 2, 0, false),
	('a47e544e-50b9-4c43-ac20-16dc5a10a7f4', '2026-08-14', '14:30:00', '15:00:00', 2, 0, false),
	('8cd4971b-0310-460b-b7a0-25e0a3f0134c', '2026-08-14', '15:00:00', '15:30:00', 2, 0, false),
	('a47669d2-d63e-4025-911a-8e5004b42990', '2026-08-14', '15:30:00', '16:00:00', 2, 0, false),
	('4d80872e-ebbd-46b4-be8d-3368ec94000f', '2026-08-14', '16:00:00', '16:30:00', 2, 0, false),
	('7f5636a1-6237-4904-991b-57ae449d1641', '2026-08-14', '16:30:00', '17:00:00', 2, 0, false),
	('1950b250-b76c-4eb2-8f81-1dba1eaa002b', '2026-08-14', '17:00:00', '17:30:00', 2, 0, false),
	('bb5a4de3-4dad-4f06-adbe-1235672c8aa8', '2026-08-14', '17:30:00', '18:00:00', 2, 0, false),
	('991d1200-811f-4dce-8e87-70936721ef6b', '2026-08-14', '18:00:00', '18:30:00', 2, 0, false),
	('7de71105-a8f5-4b65-b6b3-536492b39ff8', '2026-08-14', '18:30:00', '19:00:00', 2, 0, false),
	('6cd74a74-17b6-4c35-a363-2499efd6f21a', '2026-08-14', '19:00:00', '19:30:00', 2, 0, false),
	('fc10ce0c-d828-4384-8ce4-c940d1979a93', '2026-08-14', '19:30:00', '20:00:00', 2, 0, false),
	('f1fc266e-e4c3-4d4c-affb-e741cabbd283', '2026-08-14', '20:00:00', '20:30:00', 2, 0, false),
	('fd42c42c-6fdc-47df-bccb-5bd512453ced', '2026-08-14', '20:30:00', '21:00:00', 2, 0, false),
	('ac54dc7f-02b5-4671-84a8-3a62502d6916', '2026-08-14', '21:00:00', '21:30:00', 2, 0, false),
	('2d7ce4d1-dd15-4e2c-bfcc-72d7df3fbd4b', '2026-08-14', '21:30:00', '22:00:00', 2, 0, false),
	('d1cdd207-6c33-4f47-a3f6-5022330a0fa5', '2026-08-14', '22:00:00', '22:30:00', 2, 0, false),
	('eed7814c-15b9-41bc-ac27-9043c79f9b3e', '2026-08-14', '22:30:00', '23:00:00', 2, 0, false),
	('a3d902e0-9993-4b8d-a249-cf59f5b14708', '2026-08-15', '08:00:00', '08:30:00', 2, 0, false),
	('2924ae70-ae37-40df-9c78-a5fa9f1d1a4b', '2026-08-15', '08:30:00', '09:00:00', 2, 0, false),
	('ba956ffe-9720-4e58-a515-15c7ad0cf5ea', '2026-08-15', '09:00:00', '09:30:00', 2, 0, false),
	('60c74136-8549-435a-8eef-8d961cda2ba3', '2026-08-15', '09:30:00', '10:00:00', 2, 0, false),
	('43109c63-9e6f-4aa2-a620-097f87173f9d', '2026-08-15', '10:00:00', '10:30:00', 2, 0, false),
	('bc42abea-13b3-43cf-aea6-90bba432a55e', '2026-08-15', '10:30:00', '11:00:00', 2, 0, false),
	('866b125a-1af0-492e-abb9-b2be30ebdf76', '2026-08-15', '11:00:00', '11:30:00', 2, 0, false),
	('a35dd86d-5027-4834-885b-239691baa55d', '2026-08-15', '11:30:00', '12:00:00', 2, 0, false),
	('adaeb350-aefb-4b8a-8220-c701c9213bd9', '2026-08-15', '12:00:00', '12:30:00', 2, 0, false),
	('53b3a804-4459-4659-b809-56a26bc012b7', '2026-08-15', '12:30:00', '13:00:00', 2, 0, false),
	('cfa1ca70-63eb-4308-811a-6001b5b748ac', '2026-08-15', '13:00:00', '13:30:00', 2, 0, false),
	('3c9952e5-9ca5-4aba-a79d-a7701bc018c4', '2026-08-15', '13:30:00', '14:00:00', 2, 0, false),
	('5c01d7aa-0339-4d18-ad07-434adfd52c11', '2026-08-15', '14:00:00', '14:30:00', 2, 0, false),
	('063b0dae-bc70-40a4-a072-c6556e5daa4f', '2026-08-15', '14:30:00', '15:00:00', 2, 0, false),
	('3be34160-555e-40a4-acad-62e4b484c8e1', '2026-08-15', '15:00:00', '15:30:00', 2, 0, false),
	('ab0017d4-f49c-47d1-bf28-06c534de43c3', '2026-08-15', '15:30:00', '16:00:00', 2, 0, false),
	('9165906d-7a1e-4e3e-9293-b1864921ad6d', '2026-08-15', '16:00:00', '16:30:00', 2, 0, false),
	('beec9a53-8d48-4e57-9b1a-58ccca8c4164', '2026-08-15', '16:30:00', '17:00:00', 2, 0, false),
	('82f8d243-e502-42eb-863f-4ded82d2fc00', '2026-08-15', '17:00:00', '17:30:00', 2, 0, false),
	('b484e49b-de31-41f0-840a-6d49509c2d5f', '2026-08-15', '17:30:00', '18:00:00', 2, 0, false),
	('10967938-481e-4e26-8a28-4c050c58f6c9', '2026-08-15', '18:00:00', '18:30:00', 2, 0, false),
	('48fba329-15f5-433d-a4af-a34fedcc3caf', '2026-08-15', '18:30:00', '19:00:00', 2, 0, false),
	('fa15588b-b930-4ebf-9a22-1833937c1e58', '2026-08-15', '19:00:00', '19:30:00', 2, 0, false),
	('10d9b126-a4ed-4ff9-964b-1bd2afbca4b7', '2026-08-15', '19:30:00', '20:00:00', 2, 0, false),
	('c5803ca1-e42b-40e5-a223-1d8e0732b06a', '2026-08-15', '20:00:00', '20:30:00', 2, 0, false),
	('c073e6fa-39fa-40e6-af41-bac443e255b4', '2026-08-15', '20:30:00', '21:00:00', 2, 0, false),
	('bb3b7426-73c0-4835-bdd4-bd9122e1fe6c', '2026-08-15', '21:00:00', '21:30:00', 2, 0, false),
	('9c1ca77b-0785-4af3-8551-7674c4bd4d4c', '2026-08-15', '21:30:00', '22:00:00', 2, 0, false),
	('4d17d8ef-fe21-4f1a-94ef-531fecd5fd50', '2026-08-15', '22:00:00', '22:30:00', 2, 0, false),
	('39ed97ed-9283-48ba-a475-2fc191937e4b', '2026-08-15', '22:30:00', '23:00:00', 2, 0, false),
	('ce3f83ce-2959-4867-ab65-664efd6ecf86', '2026-08-01', '09:30:00', '10:00:00', 2, 1, false),
	('b0dcf7f4-506e-4be3-b0f7-75d461247f1d', '2026-08-16', '08:00:00', '08:30:00', 2, 0, false),
	('86806109-6f43-4b82-a526-2507370a7d41', '2026-08-16', '08:30:00', '09:00:00', 2, 0, false),
	('6c835e10-4700-4130-b710-dcbc5c13a777', '2026-08-16', '09:00:00', '09:30:00', 2, 0, false),
	('29f703db-1060-4028-b45d-3df40f67a3c4', '2026-08-16', '09:30:00', '10:00:00', 2, 0, false),
	('b5f1efd3-1080-4713-aef6-871cc38ea940', '2026-08-16', '10:00:00', '10:30:00', 2, 0, false),
	('26ba8c71-90ea-4e5d-bc97-2acd1a4aeab7', '2026-08-16', '10:30:00', '11:00:00', 2, 0, false),
	('8893c86d-4e79-49c7-b491-10c09e3a37be', '2026-08-16', '11:00:00', '11:30:00', 2, 0, false),
	('78cef45a-d541-47b4-976c-6511e4d98ec4', '2026-08-16', '11:30:00', '12:00:00', 2, 0, false),
	('6ae3e209-f43c-48d6-9630-956229de96ac', '2026-08-16', '12:00:00', '12:30:00', 2, 0, false),
	('e0ca6692-8a84-4518-acf2-ac9177298b59', '2026-08-16', '12:30:00', '13:00:00', 2, 0, false),
	('b4027942-893a-488e-a9b4-7fe4634269b6', '2026-08-16', '13:00:00', '13:30:00', 2, 0, false),
	('7a71d1b9-d4b7-4844-b38a-96de16a3a98e', '2026-08-16', '13:30:00', '14:00:00', 2, 0, false),
	('b9e32706-d1b3-4abc-bdba-7ff4624e4a4a', '2026-08-16', '14:00:00', '14:30:00', 2, 0, false),
	('94f2c683-66cc-4a89-80be-f8788a04a91d', '2026-08-16', '14:30:00', '15:00:00', 2, 0, false),
	('109aac24-a8de-42f1-a5b7-069164a89a80', '2026-08-16', '15:00:00', '15:30:00', 2, 0, false),
	('cb405cd2-1591-44de-b937-149e68630b0a', '2026-08-16', '15:30:00', '16:00:00', 2, 0, false),
	('7fde7d70-dabd-4027-82de-a87d3b05f834', '2026-08-16', '16:00:00', '16:30:00', 2, 0, false),
	('7a0b9c1d-e068-466d-a437-ee27ecdc1431', '2026-08-16', '16:30:00', '17:00:00', 2, 0, false),
	('cc2b7177-9f44-476e-a6ea-afb828e015be', '2026-08-16', '17:00:00', '17:30:00', 2, 0, false),
	('e8d82c01-c4ae-4e2b-9189-e41dcc1a20ac', '2026-08-16', '17:30:00', '18:00:00', 2, 0, false),
	('6c7b408c-1e0d-4a56-a65e-9379d188fd54', '2026-08-16', '18:00:00', '18:30:00', 2, 0, false),
	('c279e2eb-6d5a-4618-9d58-d02eadaf99c0', '2026-08-16', '18:30:00', '19:00:00', 2, 0, false),
	('bb6bb756-5190-4648-a42a-de90a742f930', '2026-08-16', '19:00:00', '19:30:00', 2, 0, false),
	('b0fbd00e-baa7-4e59-99b2-f5782fcf7a30', '2026-08-16', '19:30:00', '20:00:00', 2, 0, false),
	('ece016cc-e5b3-471b-b488-3a9f799ff880', '2026-08-16', '20:00:00', '20:30:00', 2, 0, false),
	('adb746d4-b421-4300-90be-bac50403f2dc', '2026-08-16', '20:30:00', '21:00:00', 2, 0, false),
	('7c6cc463-6022-4957-bf4f-4880c019269c', '2026-08-16', '21:00:00', '21:30:00', 2, 0, false),
	('3b977b82-f3ad-4b78-a442-810170632f97', '2026-08-16', '21:30:00', '22:00:00', 2, 0, false),
	('e03b2de5-760f-421b-8a5f-26aed5cbe12f', '2026-08-16', '22:00:00', '22:30:00', 2, 0, false),
	('c3e157c1-925d-44f3-ab7b-ccc79551edc4', '2026-08-16', '22:30:00', '23:00:00', 2, 0, false),
	('6654074d-fe9d-428f-8343-ef480bfebb31', '2026-08-17', '08:00:00', '08:30:00', 2, 0, false),
	('797facce-3e3e-484a-a50f-c46671311198', '2026-08-17', '08:30:00', '09:00:00', 2, 0, false),
	('ae7590c6-bf35-4c74-b108-88b4ff6469a9', '2026-08-17', '09:00:00', '09:30:00', 2, 0, false),
	('9a3f7a9f-bfb3-4293-8da8-38abe4a8d08d', '2026-08-17', '09:30:00', '10:00:00', 2, 0, false),
	('a510fccd-41cf-4d02-a519-532a397e98c2', '2026-08-17', '10:00:00', '10:30:00', 2, 0, false),
	('0a5fd096-1090-4476-8c93-3f3cf810ba46', '2026-08-17', '10:30:00', '11:00:00', 2, 0, false),
	('73e8ec0f-3f26-4b1a-aff5-004d789986e0', '2026-08-17', '11:00:00', '11:30:00', 2, 0, false),
	('2a5d0d6f-38b5-462a-8fce-3a38f5c61378', '2026-08-17', '11:30:00', '12:00:00', 2, 0, false),
	('9be57dec-3ae5-4440-83d3-0bc982a09b1c', '2026-08-17', '12:00:00', '12:30:00', 2, 0, false),
	('fc1693e7-0c99-43df-b1bb-e4ef6b362ab0', '2026-08-17', '12:30:00', '13:00:00', 2, 0, false),
	('c50523d2-c093-4ee7-a1e7-1903a3b750fb', '2026-08-17', '13:00:00', '13:30:00', 2, 0, false),
	('97a4aa34-a95c-4bc8-bdec-baf5cecaf708', '2026-08-17', '13:30:00', '14:00:00', 2, 0, false),
	('25207be3-cad7-4c32-8524-2038901164c5', '2026-08-17', '14:00:00', '14:30:00', 2, 0, false),
	('6a6b2cb2-7510-4abb-803b-da8ca49800c5', '2026-08-17', '14:30:00', '15:00:00', 2, 0, false),
	('441223b2-22a7-40ad-94b3-3e37e36f9535', '2026-08-17', '15:00:00', '15:30:00', 2, 0, false),
	('618367d8-ffa9-4cd9-8242-0ed3a180391c', '2026-08-17', '15:30:00', '16:00:00', 2, 0, false),
	('1f186e26-2dd3-4b32-b693-fe6021b1168f', '2026-08-17', '16:00:00', '16:30:00', 2, 0, false),
	('2e1e8d0a-5c59-4287-bdcc-fdb7fad04c7d', '2026-08-17', '16:30:00', '17:00:00', 2, 0, false),
	('32031cec-8b28-43fd-8b94-d66ef55426c8', '2026-08-17', '17:00:00', '17:30:00', 2, 0, false),
	('c4720a20-1159-4438-835b-1fed9f4341a0', '2026-08-17', '17:30:00', '18:00:00', 2, 0, false),
	('18efe953-337a-484c-9214-c24239276e5f', '2026-08-17', '18:00:00', '18:30:00', 2, 0, false),
	('6bc62dc6-4ff9-448e-8516-9068e95d6806', '2026-08-17', '18:30:00', '19:00:00', 2, 0, false),
	('12a07265-fd65-4c51-9842-cd7070d1bf53', '2026-08-17', '19:00:00', '19:30:00', 2, 0, false),
	('5895c77f-a35e-451d-b2d2-5ab1bc2dd81f', '2026-08-17', '19:30:00', '20:00:00', 2, 0, false),
	('460f2971-e17d-4093-8ffc-c45669696d1e', '2026-08-17', '20:00:00', '20:30:00', 2, 0, false),
	('1b107707-e6d0-4aef-8c08-09447801faff', '2026-08-17', '20:30:00', '21:00:00', 2, 0, false),
	('79dc9537-f00c-4036-8182-89a55ec0783a', '2026-08-17', '21:00:00', '21:30:00', 2, 0, false),
	('eb10d3c5-d48f-46b4-a060-b19239b99bda', '2026-08-17', '21:30:00', '22:00:00', 2, 0, false),
	('e049c38f-3295-442f-a0f1-ca213643e6c7', '2026-08-17', '22:00:00', '22:30:00', 2, 0, false),
	('aaf73d0a-e38b-49d9-b8b6-7f3cb42413d6', '2026-08-17', '22:30:00', '23:00:00', 2, 0, false),
	('c6547f75-e288-4ff0-a75e-4b394abf6911', '2026-08-03', '17:00:00', '17:30:00', 2, 1, false),
	('6f550e46-8a1c-4edb-ac6a-b7c240a686a0', '2026-08-18', '08:00:00', '08:30:00', 2, 0, false),
	('d45d02bd-b355-435f-a1b6-fb71d17608ee', '2026-08-18', '08:30:00', '09:00:00', 2, 0, false),
	('eba6db09-e906-47d6-ba3e-20bcd4b4d77e', '2026-08-18', '09:00:00', '09:30:00', 2, 0, false),
	('66eff288-a3a2-4ea8-b645-a828bc3e2c94', '2026-08-18', '09:30:00', '10:00:00', 2, 0, false),
	('6b3e4b05-dcb9-47b9-81d3-ca93a6f70193', '2026-08-18', '10:00:00', '10:30:00', 2, 0, false),
	('2d93440b-cb47-4974-afb4-08cedf214de0', '2026-08-18', '10:30:00', '11:00:00', 2, 0, false),
	('f007f7a6-84f4-4d99-8fdc-c36cdf4b0a9c', '2026-08-18', '11:00:00', '11:30:00', 2, 0, false),
	('75f2676a-40fd-4e6b-93ba-b52866040b29', '2026-08-18', '11:30:00', '12:00:00', 2, 0, false),
	('363ba42b-59b9-41e3-84b6-176494ef1b05', '2026-08-18', '12:00:00', '12:30:00', 2, 0, false),
	('bd278118-c201-48fb-a463-9f2a64bceef8', '2026-08-18', '12:30:00', '13:00:00', 2, 0, false),
	('ee005d28-34a1-482f-a33b-234ddd7cd1c3', '2026-08-18', '13:00:00', '13:30:00', 2, 0, false),
	('fb845100-c07a-4bd1-9c9f-d4d542c374af', '2026-08-18', '13:30:00', '14:00:00', 2, 0, false),
	('64cf8dab-728b-48dd-98c3-58ebdbbd0140', '2026-08-18', '14:00:00', '14:30:00', 2, 0, false),
	('5aabaaeb-5c89-4fdb-ad83-1d068ad6d543', '2026-08-18', '14:30:00', '15:00:00', 2, 0, false),
	('9ad0dfd8-cec2-4f87-8b29-a7543f1e31b0', '2026-08-18', '15:00:00', '15:30:00', 2, 0, false),
	('be6ca8c3-c4dc-47e9-9042-10f3c5db8d90', '2026-08-18', '15:30:00', '16:00:00', 2, 0, false),
	('6839700d-4762-407f-9211-dcecead31029', '2026-08-18', '16:00:00', '16:30:00', 2, 0, false),
	('f0ccd01c-07a5-442c-bda7-c744bc48f8ed', '2026-08-18', '16:30:00', '17:00:00', 2, 0, false),
	('d6bd1e5f-6f7a-4d15-8754-271cf7fd7f9c', '2026-08-18', '17:00:00', '17:30:00', 2, 0, false),
	('e2fc2594-a392-49dc-b211-fe8057bf131c', '2026-08-18', '17:30:00', '18:00:00', 2, 0, false),
	('1813ce40-aa0f-4285-bca1-b8280dd9c2f8', '2026-08-18', '18:00:00', '18:30:00', 2, 0, false),
	('9ef529e0-e203-420e-a476-81ba9197dce0', '2026-08-18', '18:30:00', '19:00:00', 2, 0, false),
	('eb38f8cf-ed17-4b24-81e6-fb0e7359d306', '2026-08-18', '19:00:00', '19:30:00', 2, 0, false),
	('28f9a035-04bf-412f-882e-d4eed3316c32', '2026-08-18', '19:30:00', '20:00:00', 2, 0, false),
	('e2a0f217-1acc-441c-a959-95a1f6f6f920', '2026-08-18', '20:00:00', '20:30:00', 2, 0, false),
	('a774973b-6a33-40d0-bdcc-fe963e97dd55', '2026-08-18', '20:30:00', '21:00:00', 2, 0, false),
	('34ea25a9-11db-4722-a4dd-9583f9109321', '2026-08-18', '21:00:00', '21:30:00', 2, 0, false),
	('394d7d37-29ce-40a3-a7e6-ada144bdd2d0', '2026-08-18', '21:30:00', '22:00:00', 2, 0, false),
	('24b497e4-e1ce-44c1-a8bb-9cbe96371b92', '2026-08-18', '22:00:00', '22:30:00', 2, 0, false),
	('117a2b03-1851-40da-990c-6dccb6361094', '2026-08-18', '22:30:00', '23:00:00', 2, 0, false),
	('3453381f-7db7-4351-9381-1d0060561803', '2026-08-19', '08:00:00', '08:30:00', 2, 0, false),
	('5cad0edf-41f5-407e-83af-2706566aa0ef', '2026-08-19', '08:30:00', '09:00:00', 2, 0, false),
	('833c691e-ce0d-4f75-b271-def577f828ae', '2026-08-19', '09:00:00', '09:30:00', 2, 0, false),
	('340213ea-47d8-498f-aed2-bcc33affc1ff', '2026-08-19', '09:30:00', '10:00:00', 2, 0, false),
	('ff5e8535-b93d-4a04-991a-d1b274577da1', '2026-08-19', '10:00:00', '10:30:00', 2, 0, false),
	('f84f9208-bc7e-4bf7-9057-13f6c82c88f3', '2026-08-19', '10:30:00', '11:00:00', 2, 0, false),
	('79c3ee05-7c36-4982-9c8e-13cb5231f275', '2026-08-19', '11:00:00', '11:30:00', 2, 0, false),
	('6f88492b-487d-423d-acca-595b5ec1b402', '2026-08-19', '11:30:00', '12:00:00', 2, 0, false),
	('c0e2c6d2-5736-4517-af7b-09a669a1b722', '2026-08-19', '12:00:00', '12:30:00', 2, 0, false),
	('3e87f0c7-dd66-4313-ab25-59e895a859f0', '2026-08-19', '12:30:00', '13:00:00', 2, 0, false),
	('fe96572a-65ac-400a-b568-f9229a2921c3', '2026-08-19', '13:00:00', '13:30:00', 2, 0, false),
	('32b5d0c6-6fde-42f3-8668-e9643aa00e3c', '2026-08-19', '13:30:00', '14:00:00', 2, 0, false),
	('dbdedea6-cfb6-408f-bc8a-b52749d0335b', '2026-08-19', '14:00:00', '14:30:00', 2, 0, false),
	('c97e348c-bb2d-4de5-8535-7e673a51ad38', '2026-08-19', '14:30:00', '15:00:00', 2, 0, false),
	('21614b17-6bcf-4f51-b137-ce43e76c603b', '2026-08-19', '15:00:00', '15:30:00', 2, 0, false),
	('7ceea102-9bd8-4b17-8362-9e6bd1fc1840', '2026-08-19', '15:30:00', '16:00:00', 2, 0, false),
	('872a6e1d-98dc-4b23-a107-7c37b4878c31', '2026-08-19', '16:00:00', '16:30:00', 2, 0, false),
	('0c087d84-a509-420e-9eea-cfe5f48c3b95', '2026-08-19', '16:30:00', '17:00:00', 2, 0, false),
	('1ba32ef1-5ce4-4b5c-ae93-ba67aaa21553', '2026-08-19', '17:00:00', '17:30:00', 2, 0, false),
	('43a63f42-f957-4615-98d2-acb6e066c2fd', '2026-08-19', '17:30:00', '18:00:00', 2, 0, false),
	('53491e39-129f-4a53-bcfd-e1831f2791d3', '2026-08-19', '18:00:00', '18:30:00', 2, 0, false),
	('dc8069d4-6135-4ec1-b47e-f985aaf7094f', '2026-08-19', '18:30:00', '19:00:00', 2, 0, false),
	('b0a0b87b-9f4f-45d0-9da6-959bee586a03', '2026-08-19', '19:00:00', '19:30:00', 2, 0, false),
	('4bedf3d3-e60c-4678-9d37-d71f8f07cdd2', '2026-08-19', '19:30:00', '20:00:00', 2, 0, false),
	('f800567e-2425-4492-9489-76d15bf6f821', '2026-08-19', '20:00:00', '20:30:00', 2, 0, false),
	('d098e0d3-76a5-45d6-a742-295387d5919d', '2026-08-19', '20:30:00', '21:00:00', 2, 0, false),
	('4d25a83c-3585-4038-a370-98ecf732f53e', '2026-08-19', '21:00:00', '21:30:00', 2, 0, false),
	('407aeaec-c8a1-44d7-9f70-e7f0053283ba', '2026-08-19', '21:30:00', '22:00:00', 2, 0, false),
	('acda92c1-4a1c-4dc5-bdf9-7be65b0ac2c5', '2026-08-19', '22:00:00', '22:30:00', 2, 0, false),
	('9d1bafe7-2cf6-4e3e-93f9-6eb3358da161', '2026-08-19', '22:30:00', '23:00:00', 2, 0, false),
	('a832bd4e-2707-442c-b14e-e63a3535342e', '2026-08-20', '08:00:00', '08:30:00', 2, 0, false),
	('4c394ad8-2e98-4b01-8841-c335cf6e1adb', '2026-08-20', '08:30:00', '09:00:00', 2, 0, false),
	('f876c373-b316-4b9a-8393-9c15148c9d3e', '2026-08-20', '09:00:00', '09:30:00', 2, 0, false),
	('99000e9c-0273-406d-b136-434a5735184b', '2026-08-20', '09:30:00', '10:00:00', 2, 0, false),
	('b72c8162-adad-4735-8b05-00317897782a', '2026-08-20', '10:00:00', '10:30:00', 2, 0, false),
	('9f63265a-1f60-4ab0-be7c-c46840e7b5e1', '2026-08-20', '10:30:00', '11:00:00', 2, 0, false),
	('2dd0091a-e62a-40fb-a4fb-b3fce7f62d1e', '2026-08-20', '11:00:00', '11:30:00', 2, 0, false),
	('78b22a62-bd41-442f-b793-6aa5070ad4f9', '2026-08-20', '11:30:00', '12:00:00', 2, 0, false),
	('f36130bc-8b93-47b0-9d85-62323488ad80', '2026-08-20', '12:00:00', '12:30:00', 2, 0, false),
	('94ae77f9-2e35-46de-b239-14d6787b4a1b', '2026-08-20', '12:30:00', '13:00:00', 2, 0, false),
	('29611cd6-db09-4986-a702-bb46df646ebf', '2026-08-20', '13:00:00', '13:30:00', 2, 0, false),
	('05562b06-7dcb-47eb-a818-ed7b34acce85', '2026-08-20', '13:30:00', '14:00:00', 2, 0, false),
	('751c4dd5-7a0c-45df-9f55-164e620fb191', '2026-08-20', '14:00:00', '14:30:00', 2, 0, false),
	('7b3b52d7-7439-47a5-bf24-940136dcf739', '2026-08-20', '14:30:00', '15:00:00', 2, 0, false),
	('0cf0e90a-9203-4fb8-87a3-0d80235ac721', '2026-08-20', '15:00:00', '15:30:00', 2, 0, false),
	('08f5d229-d10f-42f0-8c5e-e2ac4b824b88', '2026-08-20', '15:30:00', '16:00:00', 2, 0, false),
	('3c39f94a-4d26-4e7c-b064-0ce6f3171403', '2026-08-20', '16:00:00', '16:30:00', 2, 0, false),
	('c197e4e5-a77d-49c0-bb33-fa1a49acf453', '2026-08-20', '16:30:00', '17:00:00', 2, 0, false),
	('e4c00833-5f21-4181-b429-f35bf1ba9720', '2026-08-20', '17:00:00', '17:30:00', 2, 0, false),
	('31ecc106-afd0-4a43-8f89-8c147138ea8f', '2026-08-20', '17:30:00', '18:00:00', 2, 0, false),
	('76d5b4d4-8c29-4ade-88fc-733468b777e6', '2026-08-20', '18:00:00', '18:30:00', 2, 0, false),
	('11bf0a85-6338-4d8f-98c9-3aa9c87607d0', '2026-08-20', '18:30:00', '19:00:00', 2, 0, false),
	('09a7f821-ca32-4548-b526-b5eba070b710', '2026-08-20', '19:00:00', '19:30:00', 2, 0, false),
	('f6db7e95-978d-4698-bf35-103e25357125', '2026-08-20', '19:30:00', '20:00:00', 2, 0, false),
	('f05a19da-ec73-44f8-a716-60516a77adbd', '2026-08-20', '20:00:00', '20:30:00', 2, 0, false),
	('1ffef26d-4dee-4357-b150-aa7fb4ab8c9f', '2026-08-20', '20:30:00', '21:00:00', 2, 0, false),
	('5f1a85b7-19a7-4514-9c6c-cbaa884c8cc3', '2026-08-20', '21:00:00', '21:30:00', 2, 0, false),
	('9d2a75d0-a546-4a4e-9b94-b90661f08b4e', '2026-08-20', '21:30:00', '22:00:00', 2, 0, false),
	('49ae344a-1707-4d48-aa44-65fde7fb7974', '2026-08-20', '22:00:00', '22:30:00', 2, 0, false),
	('7caedd45-f2a4-4712-ac20-aadde2ac44b7', '2026-08-20', '22:30:00', '23:00:00', 2, 0, false),
	('b67d38af-b7e6-4fbb-a9d5-19d2ad031ec9', '2026-08-06', '13:00:00', '13:30:00', 2, 1, false),
	('d4c168fa-02d8-4e24-8ba9-69cf087bb03d', '2026-08-21', '08:00:00', '08:30:00', 2, 0, false),
	('b7d1c10a-a97d-407e-ad86-fe50796c8ea8', '2026-08-21', '08:30:00', '09:00:00', 2, 0, false),
	('a0c32e4c-2ac3-48d8-b727-1dd6c336e210', '2026-08-21', '09:00:00', '09:30:00', 2, 0, false),
	('5acfdc49-6a6b-4186-ad23-ec899003fd0b', '2026-08-21', '09:30:00', '10:00:00', 2, 0, false),
	('774a3de3-22ce-4107-b68b-6cd81cc87c14', '2026-08-21', '10:00:00', '10:30:00', 2, 0, false),
	('931118ad-f62f-4674-be25-326b5d2eb09d', '2026-08-21', '10:30:00', '11:00:00', 2, 0, false),
	('f9c020de-f963-4bdd-b4c4-ea6f342c65ff', '2026-08-21', '11:00:00', '11:30:00', 2, 0, false),
	('7d656dad-5553-463a-b41f-784bd10b22e4', '2026-08-21', '11:30:00', '12:00:00', 2, 0, false),
	('14692e99-4f12-4c2c-a32c-2e7f21c359ec', '2026-08-21', '12:00:00', '12:30:00', 2, 0, false),
	('26717c39-d72a-4146-99d1-94e2ea73bb7d', '2026-08-21', '12:30:00', '13:00:00', 2, 0, false),
	('3aefba47-d396-46c2-a7a7-71a1985f196d', '2026-08-21', '13:00:00', '13:30:00', 2, 0, false),
	('0017f4f0-3cf2-403b-a13b-81c8a2999b33', '2026-08-21', '13:30:00', '14:00:00', 2, 0, false),
	('d9637952-bced-4882-88ba-a1e9c988e6f0', '2026-08-21', '14:00:00', '14:30:00', 2, 0, false),
	('b7062441-9cc4-412b-bc73-02503cfbcf8e', '2026-08-21', '14:30:00', '15:00:00', 2, 0, false),
	('69418f6d-ae0e-4511-9a32-5045f68db829', '2026-08-21', '15:00:00', '15:30:00', 2, 0, false),
	('d72dd98d-acce-4d0a-96ff-11bc4f7e4197', '2026-08-21', '15:30:00', '16:00:00', 2, 0, false),
	('50ef0566-d423-4738-b782-4427c6eddd56', '2026-08-21', '16:00:00', '16:30:00', 2, 0, false),
	('2fa03865-01cb-4b4e-92c9-7228bbeafba5', '2026-08-21', '16:30:00', '17:00:00', 2, 0, false),
	('c4f31da1-e0a0-41cd-b05d-ed7888d72999', '2026-08-21', '17:00:00', '17:30:00', 2, 0, false),
	('de36eee9-495b-4d2e-850c-d1f558d88f18', '2026-08-21', '17:30:00', '18:00:00', 2, 0, false),
	('abedbeaa-5434-4109-8239-0fe496c16472', '2026-08-21', '18:00:00', '18:30:00', 2, 0, false),
	('81ae90cd-b220-473d-9d9d-e1f330849d1a', '2026-08-21', '18:30:00', '19:00:00', 2, 0, false),
	('79d9415d-2708-43fa-bcf0-310b430fb655', '2026-08-21', '19:00:00', '19:30:00', 2, 0, false),
	('95d871eb-3beb-43e8-8fc4-63cb2c313605', '2026-08-21', '19:30:00', '20:00:00', 2, 0, false),
	('8edc7b90-fd1a-4f14-b20e-46262f70b962', '2026-08-21', '20:00:00', '20:30:00', 2, 0, false),
	('ebfb5669-cb7b-469c-bde3-ff5c2dbb2912', '2026-08-21', '20:30:00', '21:00:00', 2, 0, false),
	('e08c144d-dd48-4b1e-b42b-b496c27f4200', '2026-08-21', '21:00:00', '21:30:00', 2, 0, false),
	('5ce1e22e-4a5d-48ee-874c-d9b2c4b2b75f', '2026-08-21', '21:30:00', '22:00:00', 2, 0, false),
	('8502b0bd-08df-4949-ab2e-0cbea72f60fd', '2026-08-21', '22:00:00', '22:30:00', 2, 0, false),
	('d7081bee-b9c0-447a-b543-087a8c1379ba', '2026-08-21', '22:30:00', '23:00:00', 2, 0, false),
	('961a5dfc-3564-4c1b-8279-1371327c68b5', '2026-08-22', '08:00:00', '08:30:00', 2, 0, false),
	('a36c3098-2bc3-4a8f-83ed-aa7ef5771ac2', '2026-08-22', '08:30:00', '09:00:00', 2, 0, false),
	('d27ff440-ef04-4a15-8439-04664f49f5de', '2026-08-22', '09:00:00', '09:30:00', 2, 0, false),
	('af50a3c1-d744-4246-8a11-f52546e71d6f', '2026-08-22', '09:30:00', '10:00:00', 2, 0, false),
	('093f3c05-34d6-47f7-9a50-a313dbd82dbe', '2026-08-22', '10:00:00', '10:30:00', 2, 0, false),
	('393fdd0b-fb7c-4f21-9c65-71396ed6bfc5', '2026-08-22', '10:30:00', '11:00:00', 2, 0, false),
	('c2017028-1b10-46c3-ba97-9940fb8a03cd', '2026-08-22', '11:00:00', '11:30:00', 2, 0, false),
	('019d1a21-925c-4a06-a49e-a4eee4a455cd', '2026-08-22', '11:30:00', '12:00:00', 2, 0, false),
	('50f6aede-3c08-4560-8785-57380fe57140', '2026-08-22', '12:00:00', '12:30:00', 2, 0, false),
	('d5ce0954-7c33-4882-a273-708ddc05e7b8', '2026-08-22', '12:30:00', '13:00:00', 2, 0, false),
	('82a562ef-049e-45a0-964e-73800eba9540', '2026-08-22', '13:00:00', '13:30:00', 2, 0, false),
	('8ff9e494-c39e-4f35-8b66-cb5591b96d0f', '2026-08-22', '13:30:00', '14:00:00', 2, 0, false),
	('c14742ab-ba68-4cb6-96d7-c41a49e2d864', '2026-08-22', '14:00:00', '14:30:00', 2, 0, false),
	('3ac42eb1-278b-48e4-8d13-144aebe1f98c', '2026-08-22', '14:30:00', '15:00:00', 2, 0, false),
	('fb746ebf-e270-4092-8cf2-85aa13df97af', '2026-08-22', '15:00:00', '15:30:00', 2, 0, false),
	('4ab57405-76d2-4e00-ac2b-897bec356716', '2026-08-22', '15:30:00', '16:00:00', 2, 0, false),
	('7fbdf237-f9b5-4ecf-b27d-a281824a4bea', '2026-08-22', '16:00:00', '16:30:00', 2, 0, false),
	('75be81d2-48d7-4732-b2b5-3e809df1f9ab', '2026-08-22', '16:30:00', '17:00:00', 2, 0, false),
	('2cecf025-1a9d-4d61-be49-85c9ae303911', '2026-08-22', '17:00:00', '17:30:00', 2, 0, false),
	('b672b94d-1824-4462-b253-2c245d285a3a', '2026-08-22', '17:30:00', '18:00:00', 2, 0, false),
	('b6f9f277-67fd-4ded-9d7c-00f8e121db9b', '2026-08-22', '18:00:00', '18:30:00', 2, 0, false),
	('65199811-d27f-4d1d-8491-303cc72c4db5', '2026-08-22', '18:30:00', '19:00:00', 2, 0, false),
	('bd2a5801-ab3d-4301-b20f-1ad3d845764d', '2026-08-22', '19:00:00', '19:30:00', 2, 0, false),
	('dd7d71e7-00da-4add-b4e7-37e6a2bb03fe', '2026-08-22', '19:30:00', '20:00:00', 2, 0, false),
	('82fe202e-787f-493b-8caa-730db13a086b', '2026-08-22', '20:00:00', '20:30:00', 2, 0, false),
	('171a0a44-7468-486d-8693-8951c274fd54', '2026-08-22', '20:30:00', '21:00:00', 2, 0, false),
	('c7465665-c787-4bc3-9b85-a2c107da43bd', '2026-08-22', '21:00:00', '21:30:00', 2, 0, false),
	('3332ca7f-91a3-439a-91fd-2f683afa07c4', '2026-08-22', '21:30:00', '22:00:00', 2, 0, false),
	('d71b4a5e-89a2-4693-be82-84444b450100', '2026-08-22', '22:00:00', '22:30:00', 2, 0, false),
	('adee38bb-da09-41d4-95b5-071709bcbc8f', '2026-08-22', '22:30:00', '23:00:00', 2, 0, false),
	('e1267ed5-8938-4309-9fa6-48fa6930e4d2', '2026-08-08', '21:00:00', '21:30:00', 2, 1, false),
	('8cd86276-14d7-497b-98a8-051658f699e6', '2026-08-23', '08:00:00', '08:30:00', 2, 0, false),
	('30cd4790-4a8b-44c0-a263-3e2d8f64c235', '2026-08-23', '08:30:00', '09:00:00', 2, 0, false),
	('40104d37-5fbc-4980-9c90-071c2723fc96', '2026-08-23', '09:00:00', '09:30:00', 2, 0, false),
	('217a676f-1e4b-433d-a28d-3be470ae6d26', '2026-08-23', '09:30:00', '10:00:00', 2, 0, false),
	('cb58d8ed-1a67-4c8b-8aeb-2f3f5f295a68', '2026-08-23', '10:00:00', '10:30:00', 2, 0, false),
	('62c3b75a-0b65-49a6-a8a7-dd41bd4f8a46', '2026-08-23', '10:30:00', '11:00:00', 2, 0, false),
	('3363907a-3214-4071-afa2-84d777084df3', '2026-08-23', '11:00:00', '11:30:00', 2, 0, false),
	('de8a07cd-2396-489d-a963-56b024cb6c61', '2026-08-23', '11:30:00', '12:00:00', 2, 0, false),
	('72fa285a-5407-4fea-aa4e-29c6d259e0a2', '2026-08-23', '12:00:00', '12:30:00', 2, 0, false),
	('bf6f73b6-9db9-4e92-9097-c44724321073', '2026-08-23', '12:30:00', '13:00:00', 2, 0, false),
	('500fe2b3-c17e-4ac9-a3e9-284cd2fedd41', '2026-08-23', '13:00:00', '13:30:00', 2, 0, false),
	('8b62dea0-2b9f-44b8-9594-db3ca4f890f1', '2026-08-23', '13:30:00', '14:00:00', 2, 0, false),
	('bfcdd54e-0ebc-430b-a065-d37039c66503', '2026-08-23', '14:00:00', '14:30:00', 2, 0, false),
	('66a9f388-947d-490c-a473-80ab12942251', '2026-08-23', '14:30:00', '15:00:00', 2, 0, false),
	('538be3ae-91a2-4d4c-8645-56425b6ff599', '2026-08-23', '15:00:00', '15:30:00', 2, 0, false),
	('ea4105df-1bb8-45f6-8dd6-0bf0e2c95674', '2026-08-23', '15:30:00', '16:00:00', 2, 0, false),
	('b45d90e3-8235-4f97-af92-8d554b536c56', '2026-08-23', '16:00:00', '16:30:00', 2, 0, false),
	('1e1b1117-b0a6-4e5a-abe2-3d57396265ff', '2026-08-23', '16:30:00', '17:00:00', 2, 0, false),
	('4e880e47-0c6e-487e-87a9-15a4b32d2ef2', '2026-08-23', '17:00:00', '17:30:00', 2, 0, false),
	('46a8f976-642b-40b7-a501-f6b4b493e13e', '2026-08-23', '17:30:00', '18:00:00', 2, 0, false),
	('ffb88a12-9eb0-498d-aade-7edcdfbe0c85', '2026-08-23', '18:00:00', '18:30:00', 2, 0, false),
	('f837f763-396e-4fd6-8f1d-40390cdf6a7a', '2026-08-23', '18:30:00', '19:00:00', 2, 0, false),
	('c267a9bd-713e-4191-92ed-d34c1b37e5a8', '2026-08-23', '19:00:00', '19:30:00', 2, 0, false),
	('ff705979-e73e-4031-a61b-5739ac6bb247', '2026-08-23', '19:30:00', '20:00:00', 2, 0, false),
	('403cb7ab-192d-4383-8667-69a9d687c9e2', '2026-08-23', '20:00:00', '20:30:00', 2, 0, false),
	('9ebd19b6-bdf6-418b-ab5e-c753cb7f1393', '2026-08-23', '20:30:00', '21:00:00', 2, 0, false),
	('b48d37fa-8d9f-4b15-86bd-ae2667c77677', '2026-08-23', '21:00:00', '21:30:00', 2, 0, false),
	('b734230c-f94c-458a-8238-6e2646504a99', '2026-08-23', '21:30:00', '22:00:00', 2, 0, false),
	('39ff1fa0-08e2-4ceb-9355-9b4e1966da0c', '2026-08-23', '22:00:00', '22:30:00', 2, 0, false),
	('65917594-ae64-426a-b113-baed3cb24ea1', '2026-08-23', '22:30:00', '23:00:00', 2, 0, false),
	('e5d3497c-891e-43f3-8fae-1f058ca8318e', '2026-08-24', '08:00:00', '08:30:00', 2, 0, false),
	('a97200df-74e6-45ab-8491-009f5e944eef', '2026-08-24', '08:30:00', '09:00:00', 2, 0, false),
	('a330b713-7db9-4c16-a39d-f818d01b21db', '2026-08-24', '09:00:00', '09:30:00', 2, 0, false),
	('50174409-d92f-4a87-9abf-24fe83e939c5', '2026-08-24', '09:30:00', '10:00:00', 2, 0, false),
	('60fea4ff-352f-4981-8210-4a393adbfb85', '2026-08-24', '10:00:00', '10:30:00', 2, 0, false),
	('dc73b381-f167-456a-98a2-362eb92d8029', '2026-08-24', '10:30:00', '11:00:00', 2, 0, false),
	('062a101c-adc6-4ca9-8499-61a0599e46de', '2026-08-24', '11:00:00', '11:30:00', 2, 0, false),
	('40b8a898-f800-40a1-aa3e-9cea171bdfe9', '2026-08-24', '11:30:00', '12:00:00', 2, 0, false),
	('33dca773-1a3f-47bf-9948-ef380c63ecf7', '2026-08-24', '12:00:00', '12:30:00', 2, 0, false),
	('cbedd409-8adb-4433-8b0f-154895eed80f', '2026-08-24', '12:30:00', '13:00:00', 2, 0, false),
	('6d26e236-d6d8-48d7-86ca-70598d50f03a', '2026-08-24', '13:00:00', '13:30:00', 2, 0, false),
	('5aa433ed-21ff-4e10-a810-829f1d1a1846', '2026-08-24', '13:30:00', '14:00:00', 2, 0, false),
	('6ca8134a-22c2-4691-a88f-71a149ef24af', '2026-08-24', '14:00:00', '14:30:00', 2, 0, false),
	('29e2dba1-6622-49c1-9c73-62875864b877', '2026-08-24', '14:30:00', '15:00:00', 2, 0, false),
	('65e80338-afd5-4333-a09f-142827b2fd92', '2026-08-24', '15:00:00', '15:30:00', 2, 0, false),
	('1a8f8a4b-bf84-4511-8845-01743f3d350d', '2026-08-24', '15:30:00', '16:00:00', 2, 0, false),
	('772311d0-74c3-4a34-b6ad-c8ce41b449e6', '2026-08-24', '16:00:00', '16:30:00', 2, 0, false),
	('bc30075e-ad5e-4b1a-a744-a5816456f338', '2026-08-24', '16:30:00', '17:00:00', 2, 0, false),
	('264c8ce0-62fd-4073-9c7f-f089d1e33176', '2026-08-24', '17:00:00', '17:30:00', 2, 0, false),
	('a6f61de1-5f7e-4354-be9a-6e841e63b591', '2026-08-24', '17:30:00', '18:00:00', 2, 0, false),
	('f9658dff-ea7f-4171-b7b3-1d2a9fd92085', '2026-08-24', '18:00:00', '18:30:00', 2, 0, false),
	('d5e31ad5-1fae-462b-a329-ca9ad67433fa', '2026-08-24', '18:30:00', '19:00:00', 2, 0, false),
	('452db18e-4955-43ab-9e83-9b6085a31cae', '2026-08-24', '19:00:00', '19:30:00', 2, 0, false),
	('f31b1d3f-90f6-4016-890b-808dd3ad71b1', '2026-08-24', '19:30:00', '20:00:00', 2, 0, false),
	('e6c5b838-7772-45e5-9ca6-94c10abaf839', '2026-08-24', '20:00:00', '20:30:00', 2, 0, false),
	('681927d5-9700-4fdd-8873-eae0ef14d836', '2026-08-24', '20:30:00', '21:00:00', 2, 0, false),
	('e14bee24-741f-4e38-8948-a426d833c037', '2026-08-24', '21:00:00', '21:30:00', 2, 0, false),
	('eac15f4f-1a40-4e67-9f0c-fbdce7c5b114', '2026-08-24', '21:30:00', '22:00:00', 2, 0, false),
	('09ddd5f8-8408-4a2c-a0fe-52a5f9ca8781', '2026-08-24', '22:00:00', '22:30:00', 2, 0, false),
	('f36ec57e-e6ef-4f45-8680-237d707d6a7f', '2026-08-24', '22:30:00', '23:00:00', 2, 0, false),
	('f0070e69-5a88-41c1-851c-d659600ec29b', '2026-08-25', '08:00:00', '08:30:00', 2, 0, false),
	('0b7d5dc8-c6ea-4fe3-8ca9-44650fbc4981', '2026-08-25', '08:30:00', '09:00:00', 2, 0, false),
	('86cb04b8-bc3a-4d87-b8da-093c8e50c6a8', '2026-08-25', '09:00:00', '09:30:00', 2, 0, false),
	('34add1ce-a4e8-4472-b984-82db5348fef2', '2026-08-25', '09:30:00', '10:00:00', 2, 0, false),
	('f0073a7c-2dfb-4754-9ed1-9a39933079a8', '2026-08-25', '10:00:00', '10:30:00', 2, 0, false),
	('8cc872eb-1339-443d-a1bf-a81298b2ad68', '2026-08-25', '10:30:00', '11:00:00', 2, 0, false),
	('1bc93b74-783b-4bd8-a6a6-6ffb480a2eda', '2026-08-25', '11:00:00', '11:30:00', 2, 0, false),
	('a4e9ee9b-2dff-46be-944e-f43646f86641', '2026-08-25', '11:30:00', '12:00:00', 2, 0, false),
	('c518a626-dc66-4056-9fe4-5be8ea61dcda', '2026-08-25', '12:00:00', '12:30:00', 2, 0, false),
	('54303b45-4a17-4012-93a5-b9988fa0805f', '2026-08-25', '12:30:00', '13:00:00', 2, 0, false),
	('16f181eb-d6e9-4066-af58-11c92b6e74b0', '2026-08-25', '13:00:00', '13:30:00', 2, 0, false),
	('ba14617e-fb9b-4a17-bc6b-7a09a6ff1586', '2026-08-25', '13:30:00', '14:00:00', 2, 0, false),
	('e3a82835-5009-41fb-af3d-900b4d1876c9', '2026-08-25', '14:00:00', '14:30:00', 2, 0, false),
	('897b649d-41aa-43c0-9de9-01685f98c3db', '2026-08-25', '14:30:00', '15:00:00', 2, 0, false),
	('2a01252d-ffb0-4ec5-a764-835209218659', '2026-08-25', '15:00:00', '15:30:00', 2, 0, false),
	('a4e1cec0-a49d-412a-9d2a-254b9e416df0', '2026-08-25', '15:30:00', '16:00:00', 2, 0, false),
	('0ab94956-e810-4a9b-8edc-7605162070b2', '2026-08-25', '16:00:00', '16:30:00', 2, 0, false),
	('674ace4b-6a84-4f22-ad76-274d6b69b39d', '2026-08-25', '16:30:00', '17:00:00', 2, 0, false),
	('7b1b5d03-6f20-4c6f-ac9e-4af2d7d0f276', '2026-08-25', '17:00:00', '17:30:00', 2, 0, false),
	('066b5f9b-9285-40f3-b6b2-ec9c5c9adfb1', '2026-08-25', '17:30:00', '18:00:00', 2, 0, false),
	('fdca7f8a-010e-49af-95f1-f2713f23d4f7', '2026-08-25', '18:00:00', '18:30:00', 2, 0, false),
	('5b529df4-9b43-4749-be86-9d25c51856eb', '2026-08-25', '18:30:00', '19:00:00', 2, 0, false),
	('bcc7f439-2b34-42eb-8c51-0fedbba08c38', '2026-08-25', '19:00:00', '19:30:00', 2, 0, false),
	('183f54ff-c39f-4d8e-bcb2-30e39eb9a6e6', '2026-08-25', '19:30:00', '20:00:00', 2, 0, false),
	('c327c298-edf9-4bd4-9607-098adeeb5b0f', '2026-08-25', '20:00:00', '20:30:00', 2, 0, false),
	('b486f59d-508d-40c0-94b2-c7c00867d148', '2026-08-25', '20:30:00', '21:00:00', 2, 0, false),
	('09dbfb00-e21b-4ee9-b06b-289df41ccb4f', '2026-08-25', '21:00:00', '21:30:00', 2, 0, false),
	('29b2cffb-636e-4c87-835d-a64696362282', '2026-08-25', '21:30:00', '22:00:00', 2, 0, false),
	('472a0906-6bf2-4986-8ee9-6b410c5483ef', '2026-08-25', '22:00:00', '22:30:00', 2, 0, false),
	('8b1ee28a-37d6-4620-b26a-0483e383175c', '2026-08-25', '22:30:00', '23:00:00', 2, 0, false);


--
-- Data for Name: delivery_zones; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."delivery_zones" ("id", "min_km", "max_km", "price", "min_order", "active", "created_at") VALUES
	('f5bf1d97-9393-414b-92cc-e5bec96b981e', 0, 3, 3, 10, true, '2026-04-26 19:55:48.64708+00'),
	('9328765d-1578-45d4-ad36-d5ed9077221e', 3, 6, 5, 10, true, '2026-05-12 09:47:01.545032+00'),
	('1a6ff9ea-83ff-4ce5-818e-f99bbd7988ef', 6, 10, 7, 20, true, '2026-05-19 00:39:38.876479+00');


--
-- Data for Name: driver_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."driver_sessions" ("id", "driver_id", "started_at", "ended_at", "zone", "notes", "opening_cash", "collected_cash", "expected_cash", "declared_cash", "driver_fee_total", "delivery_subsidy_total", "net_to_remit", "cash_difference", "session_status", "created_at", "closed_at", "settled_at") VALUES
	('a3357283-986d-4ed3-9c41-4cbc0cc21764', 'd17026e5-2564-4166-bcaa-7855b5038d11', '2026-07-17 18:28:11.153+00', NULL, NULL, NULL, 10, 33, 0, NULL, 0, 0, 40, NULL, 'open', '2026-07-17 18:28:11.616986+00', NULL, NULL),
	('6756cb45-e14c-496e-9a0c-bc5f38ff6bf2', '09e90815-2a1a-4b4b-b1a8-42bfc95f71ca', '2026-07-28 15:10:15.66+00', NULL, NULL, NULL, 80, 0, 0, NULL, 0, 0, 0, NULL, 'open', '2026-07-28 15:10:16.188376+00', NULL, NULL),
	('0d153f9f-9412-46ec-b8cc-cc053f3f8ac7', '7544aa44-f856-4f61-9e6f-f20039c92005', '2026-06-26 12:26:16.677+00', NULL, NULL, NULL, 10, 1138, 0, NULL, 0, 0, 970, NULL, 'open', '2026-06-26 12:26:17.081703+00', NULL, NULL),
	('d259e373-37b5-43c3-bbdc-c2f71fdda03d', '57eeff07-a0a2-44cb-ae57-cc5c90dcf939', '2026-05-19 20:12:45.232+00', NULL, NULL, NULL, 10, 45, 0, NULL, 0, 0, 42, NULL, 'settled', '2026-05-19 20:12:45.70659+00', NULL, '2026-05-19 20:15:53.062+00'),
	('6575b1ca-6263-4e13-a4d8-abb7a78afa7c', '7544aa44-f856-4f61-9e6f-f20039c92005', '2026-05-20 20:40:12.921+00', NULL, NULL, NULL, 1, 0, 0, NULL, 0, 0, 0, NULL, 'settled', '2026-05-20 20:40:13.06952+00', NULL, '2026-05-22 14:04:01.615+00'),
	('3effb16e-3cc4-46f7-aa5b-51510dfe1d56', 'ded379e8-a14f-428b-bd9f-f17b1c875514', '2026-05-19 20:09:53.927+00', NULL, NULL, NULL, 10, 0, 0, NULL, 0, 0, 0, NULL, 'settled', '2026-05-19 20:09:54.317627+00', NULL, '2026-06-26 12:24:25.344+00'),
	('5e017941-03af-4007-a550-e3c847f656dd', '7544aa44-f856-4f61-9e6f-f20039c92005', '2026-05-26 13:50:12.037+00', NULL, NULL, NULL, 5, 426, 0, NULL, 0, 0, 338, NULL, 'settled', '2026-05-26 13:50:12.539982+00', NULL, '2026-06-26 12:25:31.25+00'),
	('8d662245-9851-49e9-90b0-9824e7c53e94', '57eeff07-a0a2-44cb-ae57-cc5c90dcf939', '2026-05-21 13:09:58.485+00', NULL, NULL, NULL, 10, 43, 0, NULL, 0, 0, 46, NULL, 'settled', '2026-05-21 13:09:58.753906+00', NULL, '2026-06-26 12:25:42.818+00');


--
-- Data for Name: invoice_counters; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: menu_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."menu_categories" ("id", "slug", "name", "parent_id", "display_order", "active", "icon_type", "icon_value", "level", "is_visible") VALUES
	('b15f69e6-9fdb-425f-81df-6bb2f22c4a94', 'smothie', 'Smothie', '926e17fb-8c91-40e0-9007-aaeffa795de7', 2, true, 'builtin', 'Apple', 1, true),
	('cbaf91b6-6972-4a3a-9107-59fc794a8866', 'espace_fumeur', 'Espace fumeur', NULL, 4, true, 'builtin', 'Coffee', 0, true),
	('a1bbe3ff-9571-4477-9b15-1b12e186ab1d', 'milshakes', 'Milshakes', '926e17fb-8c91-40e0-9007-aaeffa795de7', 3, true, 'builtin', 'IceCream', 1, false),
	('926e17fb-8c91-40e0-9007-aaeffa795de7', 'boissons', 'Boissons', NULL, 1, true, 'builtin', 'Soup', 0, true),
	('a2c2ccf0-ba13-41dd-8a03-ae857358d718', 'boissons_sans_alcool', 'Boissons sans alcool', '926e17fb-8c91-40e0-9007-aaeffa795de7', 0, true, 'builtin', 'CupSoda', 1, true),
	('00576aa1-edc2-468a-b456-06561fd36c8b', 'bieres', 'Bières', '926e17fb-8c91-40e0-9007-aaeffa795de7', 0, true, 'builtin', 'Beer', 1, false),
	('e2f9884e-046e-4138-b477-746941a0e7fd', 'spiritueux', 'Spiritueux', '926e17fb-8c91-40e0-9007-aaeffa795de7', 1, true, 'builtin', 'Wine', 1, false),
	('4c7b7020-5f53-49fe-a111-dfea00487d70', 'plats_chauds', 'Plats chauds', NULL, 2, true, 'builtin', 'ChefHat', 0, true);


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."orders" ("id", "created_at", "status", "customer_name", "customer_phone", "customer_address", "customer_note", "customer_email", "lat", "lng", "geo_address", "slot_id", "total", "delivery_mode", "delivery_fee", "distance_km", "zone_id", "delivery_detail", "wantfacture", "payment_method", "invoice_number", "driver_id", "previous_status_before_cancel", "cancelled_at", "purge_after") VALUES
	('03133dc9-517b-4d16-80a5-e8dae33b3a93', '2026-06-01 13:49:11.03435+00', 'livrée', 'Yodja ghost ', '+243904557411', 'Rue Palabala, Bisengo, Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.346168144010458, 15.275602970630118, 'Rue Palabala, Bisengo, Bandalungwa, Kinshasa, République démocratique du Congo', '7af85120-493a-41bb-be57-fcf886cdb923', 17, 'delivery', 7, 0.9464250918152223, NULL, NULL, false, 'livraison', 'BD-20260601-0002', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('5193adf0-2aec-426a-92c9-443fa8bfea74', '2026-06-01 14:14:21.228396+00', 'annulée', 'TEST COMMANDE / WHATSAPP', '+2430691434011', ''' route de matadi ngaliema kinshasa', 'RDC', NULL, -4.4175876, 15.259904, ''' route de matadi ngaliema kinshasa', 'a1246f3a-c391-47a5-8c93-4c51ddcbea73', 68, 'delivery', 13, 8.768334076336087, NULL, NULL, false, 'livraison', 'BD-20260601-0004', NULL, NULL, NULL, NULL),
	('1593631c-357e-4553-b825-c92efdd0d71b', '2026-07-02 08:26:01.516264+00', 'livrée', 'Kaz2', '+243810979710', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '27e75ffd-16dd-4b0a-a723-de2d3d396092', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260702-0001', NULL, NULL, NULL, NULL),
	('992e3ea6-775f-41bc-a824-d6e4e61d7239', '2026-06-01 13:49:08.480676+00', 'livrée', 'Yodja ghost ', '+243904557411', 'Rue Palabala, Bisengo, Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.346168144010458, 15.275602970630118, 'Rue Palabala, Bisengo, Bandalungwa, Kinshasa, République démocratique du Congo', '7af85120-493a-41bb-be57-fcf886cdb923', 17, 'delivery', 7, 0.9464250918152223, NULL, NULL, false, 'livraison', 'BD-20260601-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('bbeb34b7-611b-40bf-8aa6-c17a02594d83', '2026-08-11 11:59:47.978437+00', 'livrée', 'Kaz2', '+243810979710', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '172d1bb4-ad7f-4eb8-997e-24ee7d97b7cf', 80, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260811-0001', NULL, NULL, NULL, NULL),
	('e693860c-6978-4a9f-a987-7845216a671d', '2026-06-01 16:57:27.093128+00', 'annulée', 'TEST COMMANDE / WHATSAPP', '+352691434011', ''' route de matadi ngaliema kinshasa', 'RDC', NULL, -4.4175876, 15.259904, ''' route de matadi ngaliema kinshasa', 'a1246f3a-c391-47a5-8c93-4c51ddcbea73', 49, 'delivery', 13, 8.768334076336087, NULL, NULL, false, 'livraison', 'BD-20260601-0005', NULL, NULL, NULL, NULL),
	('79fec7d3-57f9-4331-901c-b69a409420e9', '2026-06-08 17:30:03.642228+00', 'livrée', 'Meta', '+243839777508', 'Limeté ', '', NULL, -4.3543467, 15.3466854, 'Limeté ', '1e0d8e29-ba8c-444b-afcd-44d9631f0c1b', 28, 'delivery', 13, 7.170739739660074, NULL, NULL, false, 'livraison', 'BD-20260608-0004', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('b57bbe89-c9e2-44f0-bc6b-86633c714d70', '2026-06-08 17:26:15.672917+00', 'livrée', 'Meta', '+243839777508', 'Limeté ', '', NULL, -4.3543467, 15.3466854, 'Limeté ', '1e0d8e29-ba8c-444b-afcd-44d9631f0c1b', 26, 'delivery', 13, 7.170739739660074, NULL, NULL, false, 'livraison', 'BD-20260608-0003', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('d03ea1ba-22bc-44fb-a2f0-af25e0f97cbe', '2026-06-01 17:28:31.177627+00', 'annulée', 'TEST WHATSAPP', '+352691434011', '4 route de matadi ngaliema kinshasa', '', NULL, -4.3954152, 15.2589174, '4 route de matadi ngaliema kinshasa', 'b28aa4f6-81e8-4a81-856c-10ec36e4c26c', 34, 'delivery', 10, 6.497308636107075, NULL, NULL, false, 'livraison', 'BD-20260601-0007', NULL, NULL, NULL, NULL),
	('94bc3908-9e71-4cfd-9d66-89c97228ffa8', '2026-06-01 17:00:14.322405+00', 'annulée', 'TEST COMMANDE / WHATSAPP', '+352691434011', ''' route de matadi ngaliema kinshasa', 'RDC', NULL, -4.4175876, 15.259904, ''' route de matadi ngaliema kinshasa', 'b28aa4f6-81e8-4a81-856c-10ec36e4c26c', 37, 'delivery', 13, 8.768334076336087, NULL, NULL, false, 'livraison', 'BD-20260601-0006', NULL, NULL, NULL, NULL),
	('5d6d69f2-abee-4a04-aad9-420288e4b31d', '2026-06-01 14:00:03.611969+00', 'annulée', 'TEST COMMANDE / WHATSAPP', '+2430691434011', ''' route de matadi ngaliema kinshasa', 'RDC', NULL, -4.4175876, 15.259904, ''' route de matadi ngaliema kinshasa', '615822bd-ebb8-466e-be99-fd583a1998fb', 77, 'delivery', 13, 8.768334076336087, NULL, NULL, false, 'livraison', 'BD-20260601-0003', NULL, NULL, NULL, NULL),
	('68accda1-0f5a-4c5e-8f4d-f9ff1c6e4a82', '2026-06-01 17:41:17.846643+00', 'annulée', 'TEST WHATSAPP', '+352691434011', '4 route de matadi ngaliema kinshasa', '', NULL, -4.3954152, 15.2589174, '4 route de matadi ngaliema kinshasa', 'df0930dc-65e8-4c29-8192-03ee38fd38f2', 34, 'delivery', 10, 6.497308636107075, NULL, NULL, false, 'livraison', 'BD-20260601-0008', NULL, NULL, NULL, NULL),
	('d2c27ccb-58c0-4f26-a05e-0600c85b1faa', '2026-06-02 12:47:04.545761+00', 'livrée', 'Yodja ghost ', '+243904557411', 'Rue Palabala, Bisengo, Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.346168144010458, 15.275602970630118, 'Rue Palabala, Bisengo, Bandalungwa, Kinshasa, République démocratique du Congo', 'a3ea683d-522d-4dbc-a8ec-7eff87567469', 37, 'delivery', 7, 0.9464250918152223, NULL, NULL, false, 'livraison', 'BD-20260602-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('b5405dd7-4be9-4c16-b0c9-f339ce3c5aca', '2026-06-09 13:15:08.00951+00', 'livrée', 'Rolex', '+243906295503', 'Bandalungwa, Kinshasa, République démocratique du Congo', 'Appel', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '742ec2a1-ff28-41e3-959d-fe55ad20fde1', 9, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260609-0002', NULL, NULL, NULL, NULL),
	('1e84a962-0b76-4258-8eb3-9f9e4ddf9e80', '2026-06-09 12:32:24.334451+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', 'ddd6bc7f-136f-474d-81c5-ffdc7a8deec4', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260609-0001', NULL, NULL, NULL, NULL),
	('620319b1-f789-4f0f-9bec-c6af1a3e7c2f', '2026-06-09 18:28:06.199876+00', 'livrée', 'Freddy Bompanze', '+243825158026', 'La Maison de l''Écolier, 40, Avenue de l’OUA, Lisala, Ngaliema, Kinshasa, République démocratique du Congo', '2ieme étage ', NULL, -4.334750609148307, 15.268950462341296, 'La Maison de l''Écolier, 40, Avenue de l’OUA, Lisala, Ngaliema, Kinshasa, République démocratique du Congo', 'f9c3ad1a-d899-4119-8b9d-543a2304fffc', 33, 'delivery', 3, 1.7815099659062337, NULL, NULL, false, 'livraison', 'BD-20260609-0003', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('c6548c46-e9be-4189-9675-ba09c5635deb', '2026-07-28 08:15:29.532031+00', 'livrée', 'Le baron', '+243977252929', 'Ngaliema, Anciens Combattants, Ngaliema, Kinshasa, République démocratique du Congo', '', NULL, -4.337153756663976, 15.24825574017493, 'Ngaliema, Anciens Combattants, Ngaliema, Kinshasa, République démocratique du Congo', 'f2172812-d124-4287-8cd8-cbaaf83675bf', 25, 'delivery', 5, 3.911383900526704, NULL, NULL, false, 'livraison', 'BD-20260728-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('9378dff2-f078-4ec5-980c-7fe00f48a140', '2026-06-03 19:45:09.95477+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bisengo, Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.346237182617186, 15.27690124511718, 'Bisengo, Bandalungwa, Kinshasa, République démocratique du Congo', '556b96bd-cc41-4d67-87a1-fc252f9e5c94', 37, 'delivery', 7, 0.8257468800856577, NULL, NULL, false, 'livraison', 'BD-20260603-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('256a418a-a296-452e-b191-f6e8c7ca0e1e', '2026-06-04 10:32:44.035093+00', 'livrée', 'Kaz2', '+243810979710', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '12181ec7-5f69-4ce4-8833-0325ee793a7f', 55, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260604-0001', NULL, NULL, NULL, NULL),
	('1dc0559d-85e7-41a7-b0b4-8810b09f0c1e', '2026-06-10 09:13:10.469921+00', 'livrée', 'Lima', '+243851547328', 'Bandalungwa, Kinshasa, République démocratique du Congo', 'Y', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '9c5b34fa-d190-405a-af0e-f2a042e63464', 1, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260610-0002', NULL, NULL, NULL, NULL),
	('c90c7025-9592-4482-bc7c-9a4ee5a0b0d1', '2026-06-10 09:12:21.487399+00', 'livrée', 'Lima', '+243851547328', 'Bandalungwa, Kinshasa, République démocratique du Congo', 'Y', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '9c5b34fa-d190-405a-af0e-f2a042e63464', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260610-0001', NULL, NULL, NULL, NULL),
	('55b64f53-a3d7-4be7-af65-20b1e1a61ea2', '2026-06-08 11:31:37.634267+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bisengo, Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.346237182617186, 15.27690124511718, 'Bisengo, Bandalungwa, Kinshasa, République démocratique du Congo', 'c4bc88b7-6fd0-42f5-bdc4-e9db3a140cbf', 37, 'delivery', 7, 0.8257468800856577, NULL, NULL, false, 'livraison', 'BD-20260608-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('edf69390-9f71-4740-bf88-900516cb6b20', '2026-06-11 11:21:18.615408+00', 'livrée', 'Rolex', '+243906295503', 'Bandalungwa, Kinshasa, République démocratique du Congo', 'Appel', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '5a24643d-7a74-498a-a87c-27c4031c64dd', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260611-0001', NULL, NULL, NULL, NULL),
	('7d2aea1a-602b-4907-9257-74884d09e932', '2026-06-08 15:19:43.189271+00', 'livrée', 'Amira', '+243979478418', 'Avenue Television, Lingwala, La Voix du Peuple, Lingwala, Kinshasa, République démocratique du Congo', '', NULL, -4.3289137639594655, 15.30191835040767, 'Avenue Television, Lingwala, La Voix du Peuple, Lingwala, Kinshasa, République démocratique du Congo', 'f2c63a58-4592-4d33-9479-d8ef3c150053', 17, 'delivery', 7, 2.5520002730859224, NULL, NULL, false, 'livraison', 'BD-20260608-0002', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('2926ae27-4bdc-4341-a8d0-ea9406f81b80', '2026-06-29 09:46:42.529913+00', 'livrée', 'Kaz2', '+243810979710', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '32d6d921-7e68-408d-92c5-14e14bc43367', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260629-0001', NULL, NULL, NULL, NULL),
	('0ce8f2f7-db47-4e3e-943c-5ee36f4202b9', '2026-06-11 12:09:47.69234+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '8b7f3d30-aaed-4290-af28-b641a789fc52', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260611-0002', NULL, NULL, NULL, NULL),
	('467bec1f-243b-46be-b46b-2e23c4edde4c', '2026-06-19 08:18:25.358398+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', 'f2857fd7-b461-4350-9ba7-0609ff2cb9f6', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260619-0001', NULL, NULL, NULL, NULL),
	('e8b92f94-a250-454b-91b9-357a36cb00a0', '2026-06-12 10:13:31.708854+00', 'livrée', 'Freddy Bompanze', '+243825158026', 'La Maison de l''Écolier, 40, Avenue de l’OUA, Lisala, Ngaliema, Kinshasa, République démocratique du Congo', '2ieme étage ', NULL, -4.334750609148307, 15.268950462341296, 'La Maison de l''Écolier, 40, Avenue de l’OUA, Lisala, Ngaliema, Kinshasa, République démocratique du Congo', '7e72f63a-20d1-46b6-8dfc-30c927488af2', 33, 'delivery', 3, 1.7815099659062337, NULL, NULL, false, 'livraison', 'BD-20260612-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('a9adbcc4-ce92-4b7b-a9f6-8f05feae943e', '2026-06-22 08:35:59.022866+00', 'livrée', 'Tic-tac', '+243975302311', 'Bandalungwa, Kinshasa, République démocratique du Congo', 'Appelle mon numero ', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', 'aebc3d06-79a5-4f40-b1de-cf339a0494eb', 60, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260622-0001', NULL, NULL, NULL, NULL),
	('5ad5eefb-2987-4c5e-b144-a24a269cb91d', '2026-06-13 20:36:05.594386+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', 'cb881499-f258-4b9c-9e51-9dd6df9bab85', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260613-0001', NULL, NULL, NULL, NULL),
	('274265b1-0876-47a6-9390-f19d1f5e7880', '2026-06-15 19:23:16.159387+00', 'livrée', 'Kaz2', '+243810979710', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '8f56725b-1105-4d34-9ca8-2eae51238f93', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260615-0001', NULL, NULL, NULL, NULL),
	('a09600f0-7aeb-4446-902a-f4961dd68584', '2026-06-22 11:16:13.164163+00', 'livrée', 'Freddy Bompanze', '+243825158026', 'La Maison de l''Écolier, 40, Avenue de l’OUA, Lisala, Ngaliema, Kinshasa, République démocratique du Congo', '2ieme étage ', NULL, -4.334750609148307, 15.268950462341296, 'La Maison de l''Écolier, 40, Avenue de l’OUA, Lisala, Ngaliema, Kinshasa, République démocratique du Congo', '23077cb5-4db3-470d-bae2-2cefb5a931f4', 33, 'delivery', 3, 1.7815099659062337, NULL, NULL, false, 'livraison', 'BD-20260622-0002', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('2f722104-ba50-4587-893a-e33cc746b1af', '2026-06-22 16:35:18.463287+00', 'livrée', 'Lima', '+243851547328', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '3c7e9694-598d-4185-87e4-27acf52a02cd', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260622-0003', NULL, NULL, NULL, NULL),
	('59a502ba-5aee-41b8-8743-9421fdcff065', '2026-06-16 10:01:18.471525+00', 'livrée', 'Lima', '+243851547328', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', 'd0f8e0fe-c67b-4e5e-9931-2e96a23feecb', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260616-0002', NULL, NULL, NULL, NULL),
	('3c552116-a2fe-4247-957b-fd003bbfcfb6', '2026-06-16 08:06:30.370856+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '3dff8d0e-6136-4cf7-91cd-dbb47cc0008a', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260616-0001', NULL, NULL, NULL, NULL),
	('587807da-ad0c-4b31-9662-9a8a2f630b12', '2026-06-29 14:57:34.689729+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '20c7e579-d49c-414c-8d8a-e913a9f8e4a7', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260629-0002', NULL, NULL, NULL, NULL),
	('a0a10916-61e5-44d0-9fe2-94055499ef07', '2026-06-27 06:15:23.2811+00', 'livrée', 'Kaz2', '+243810979710', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '7b413e54-3111-443b-9bf5-c4a9a1a9400c', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260627-0001', NULL, NULL, NULL, NULL),
	('60326208-9cde-4866-b612-1b066d8cd607', '2026-06-25 20:37:38.978574+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '2c14e327-549e-438a-a632-b9f72c20499b', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260625-0001', NULL, NULL, NULL, NULL),
	('ecf0f447-5650-4585-b3c4-1e985df1cd29', '2026-06-27 06:16:45.295465+00', 'livrée', 'Kaz2', '+243810979710', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '7b413e54-3111-443b-9bf5-c4a9a1a9400c', 10, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260627-0002', NULL, NULL, NULL, NULL),
	('8d9ef52a-9874-47aa-9ec9-f817e098ebdf', '2026-07-02 12:16:15.836788+00', 'livrée', 'T.i king', '+243822809942', 'Mont Fleury ', '', NULL, -4.3388346, 15.2522336, 'Mont Fleury ', '33bc0a00-20d0-48bb-80a8-b9a8ff01d34e', 13, 'delivery', 3, 3.450147779539975, NULL, NULL, false, 'livraison', 'BD-20260702-0002', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('5a973d4d-9033-4f80-8a62-4fda6bae58cd', '2026-06-27 14:39:36.460789+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '745bf557-383d-4182-b7b2-77ca70327b2d', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260627-0003', NULL, NULL, NULL, NULL),
	('1a4e224b-2ed2-45a2-be06-c7c4bfba7971', '2026-07-02 13:48:09.887158+00', 'livrée', 'Samuel Bwaketshi', '+243855764821', 'Bandalungwa, Kinshasa, République démocratique du Congo', '1er étage ', 'samuelbwaketshi34@gmail.com', -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', 'fad73c53-9d35-479d-aeae-8c4b20caa9e5', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260702-0004', NULL, NULL, NULL, NULL),
	('8045b03c-f48b-4af5-bf03-7bf4a307aac8', '2026-06-17 10:13:14.176208+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bisengo, Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.346237182617186, 15.27690124511718, 'Bisengo, Bandalungwa, Kinshasa, République démocratique du Congo', '33b2268b-51bd-4015-b2cc-837378caaaaa', 33, 'delivery', 3, 0.8257468800856577, NULL, NULL, false, 'livraison', 'BD-20260617-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('0b8967d0-208d-4033-b867-4a73ba72165a', '2026-06-17 10:58:32.907045+00', 'livrée', 'Freddy Bompanze', '+243825158026', 'La Maison de l''Écolier, 40, Avenue de l’OUA, Lisala, Ngaliema, Kinshasa, République démocratique du Congo', '2ieme étage ', NULL, -4.334750609148307, 15.268950462341296, 'La Maison de l''Écolier, 40, Avenue de l’OUA, Lisala, Ngaliema, Kinshasa, République démocratique du Congo', '58d8c036-7c86-4ee1-ad8e-3c5792934111', 33, 'delivery', 3, 1.7815099659062337, NULL, NULL, false, 'livraison', 'BD-20260617-0002', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('3b4e29ba-c85d-44e7-be85-825a5722ddc7', '2026-06-26 10:45:22.586664+00', 'livrée', 'Vampire ', '+243850283437', 'Bandalungwa, Kinshasa, République démocratique du Congo', 'Avenue', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', 'eac24ab8-f979-4a48-964a-5063a73628da', 10, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260626-0003', NULL, NULL, NULL, NULL),
	('0b69a5fe-9a36-42d1-8b9d-a6aed786014c', '2026-06-26 10:31:01.177858+00', 'livrée', 'Kaz2', '+243810979710', 'Bandalungwa, Kinshasa, République démocratique du Congo', 'Appelé sur place ', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '3d252920-92b4-4ad0-980e-616b71456005', 1, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260626-0002', NULL, NULL, NULL, NULL),
	('ac684d98-e2c1-4469-86e4-2049fa18546b', '2026-06-26 10:30:06.784672+00', 'livrée', 'Kaz2', '+243810979710', 'Bandalungwa, Kinshasa, République démocratique du Congo', 'Appelé sur place ', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '3d252920-92b4-4ad0-980e-616b71456005', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260626-0001', NULL, NULL, NULL, NULL),
	('9cb26f60-60b8-428f-a9a1-90a0cb95fb3d', '2026-06-28 19:52:10.57056+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '27745ee9-3e1a-41aa-b730-5da7e760be04', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260628-0001', NULL, NULL, NULL, NULL),
	('3c1806ae-4367-40ac-89c0-a2e7c0e89214', '2026-07-02 12:25:15.126559+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', 'f145848a-003d-434a-8d08-7807202bf030', 10, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260702-0003', NULL, NULL, NULL, NULL),
	('b904b7b4-e63c-44ef-80d6-3be3d56cefb8', '2026-07-15 12:08:32.074348+00', 'livrée', 'Rolex', '+243906295503', 'Bandalungwa, Kinshasa, République démocratique du Congo', 'Appel', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '25774d9a-3b4c-4b0b-8a68-c2204d0f5087', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260715-0002', NULL, NULL, NULL, NULL),
	('1b09c5b6-2e6c-41c8-b1ee-a5a1ab372f55', '2026-07-15 23:13:43.437499+00', 'livrée', 'Alz Alz ', '+243980954541', 'Rue Palabala, Bisengo, Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.346168144010458, 15.275602970630118, 'Rue Palabala, Bisengo, Bandalungwa, Kinshasa, République démocratique du Congo', '69f890d0-4edd-4da4-8664-b64ed2cce0a1', 33, 'delivery', 3, 0.9464250918152223, NULL, NULL, false, 'livraison', 'BD-20260715-0003', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('91f4d0e2-74bb-4628-b4c0-68f3b7d71595', '2026-07-17 08:13:23.880598+00', 'livrée', 'Tic-tac', '+243975302311', 'Bandalungwa, Kinshasa, République démocratique du Congo', 'Appelle mon numero ', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '608e9874-b5bd-4205-a038-45dda49c3374', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260717-0001', NULL, NULL, NULL, NULL),
	('7b917647-1981-488e-9600-2da95ebc1f7c', '2026-07-07 13:34:04.136132+00', 'livrée', 'Mc Tukuzu ', '+243811281663', 'Ndolo, Barumbu, Kinshasa, République démocratique du Congo', '', NULL, -4.320082984036639, 15.332777520922878, 'Ndolo, Barumbu, Kinshasa, République démocratique du Congo', 'af92d093-ba35-4c1c-91f7-5e050f6e4f04', 67, 'delivery', 5, 6.026530429123993, NULL, NULL, false, 'livraison', 'BD-20260707-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('175022b9-a339-4b22-be16-7bb2d1fb8ce8', '2026-07-17 18:16:54.378706+00', 'livrée', 'B2obitch', '+243997866570', 'Mampeza 1, Mont Fleury, Joli Parc, Ngaliema, Kinshasa, République démocratique du Congo', '', NULL, -4.331189, 15.254394, 'Mampeza 1, Mont Fleury, Joli Parc, Ngaliema, Kinshasa, République démocratique du Congo', '4938fac0-29ef-4dfc-ad1f-64a61f2fbb3f', 33, 'delivery', 3, 3.4177207363411015, NULL, NULL, false, 'livraison', 'BD-20260717-0002', 'd17026e5-2564-4166-bcaa-7855b5038d11', NULL, NULL, NULL),
	('8e0c210c-168b-4708-9f04-f5b29ed1142b', '2026-07-11 11:50:01.100478+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '45bd67de-f1f8-4279-a54f-47332bf7ac18', 10, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260711-0001', NULL, NULL, NULL, NULL),
	('9b34880b-e82d-4fd0-8360-4e638a5194e4', '2026-07-17 22:05:33.01676+00', 'livrée', 'Y', '+243851547328', 'Bandalungwa, Kinshasa, République démocratique du Congo', 'A', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', 'bbf78e01-42ed-45e6-98e2-945f152329a1', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260717-0003', NULL, NULL, NULL, NULL),
	('bd2acf48-216c-4d2a-8a20-2a888a0b54b9', '2026-08-03 11:45:24.432604+00', 'livrée', 'SÉQUOIA ', '+243852028702', 'Avenue inga bandal', '', NULL, -4.3532229, 15.2830016, 'Avenue inga bandal', '4cafac37-e4fa-438a-8811-4a3ccd32623e', 43, 'delivery', 3, 1.2236007880918383, NULL, NULL, false, 'livraison', 'BD-20260803-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('91c2bbfb-4360-48fc-89af-7f0181a354f1', '2026-07-11 15:39:34.747812+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', 'b8e6a2ae-84d5-48e8-9ec0-7f2015357b73', 10, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260711-0002', NULL, NULL, NULL, NULL),
	('2284d454-4797-442d-aa7e-256d759f4baa', '2026-07-17 22:56:05.472006+00', 'livrée', 'Bigiiz', '+243828686120', 'Bandalungwa, Kinshasa, République démocratique du Congo', 'U', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', 'dd76ef85-5f20-455d-b04c-2ad8220aa28c', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260717-0004', NULL, NULL, NULL, NULL),
	('a4b4bbfd-6753-42a1-a949-80266240b4ac', '2026-07-03 14:17:03.5901+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '064f1953-b72c-4a68-a208-deb08b61a791', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260703-0001', NULL, NULL, NULL, NULL),
	('cdad5133-6f03-40a5-a4b5-ecaaf2a2757b', '2026-07-12 11:32:37.931393+00', 'livrée', 'Kaz2', '+243810979710', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '2a260102-73bf-45df-8ab1-03b4d59975b4', 60, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260712-0001', NULL, NULL, NULL, NULL),
	('8e6826de-b58c-4fa5-926a-89c488f97cd4', '2026-07-18 15:06:10.522615+00', 'livrée', 'B2obitch', '+243997866570', 'Mampeza 1, Mont Fleury, Joli Parc, Ngaliema, Kinshasa, République démocratique du Congo', '', NULL, -4.331189, 15.254394, 'Mampeza 1, Mont Fleury, Joli Parc, Ngaliema, Kinshasa, République démocratique du Congo', '47b90ff2-0aa4-4473-9dce-23c8ea581edd', 33, 'delivery', 3, 3.4177207363411015, NULL, NULL, false, 'livraison', 'BD-20260718-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('3c87d258-1f5f-4982-b71e-c987ca811567', '2026-07-13 11:41:32.870342+00', 'livrée', 'Mc Tukuzu ', '+243811281663', 'Ndolo, Barumbu, Kinshasa, République démocratique du Congo', '', NULL, -4.320082984036639, 15.332777520922878, 'Ndolo, Barumbu, Kinshasa, République démocratique du Congo', 'b99bf7d9-8f5f-444b-b81d-716fd0c200d0', 65, 'delivery', 5, 6.026530429123993, NULL, NULL, false, 'livraison', 'BD-20260713-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('83d6137e-e614-45db-987b-22677d9be9b3', '2026-07-13 15:09:12.744214+00', 'livrée', 'Y', '+243851547328', 'Bandalungwa, Kinshasa, République démocratique du Congo', 'A', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '4518fd2d-9aba-4126-9b3a-9b5771c7eca8', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260713-0002', NULL, NULL, NULL, NULL),
	('ce3cbece-c3f9-4b25-ac76-13a103ba7128', '2026-07-18 18:33:27.56385+00', 'livrée', 'Yodja sdf ', '+243904557411', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', 'ce658eeb-74a3-4b40-9de5-9b1a0969b886', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260718-0002', NULL, NULL, NULL, NULL),
	('23c3ede7-9d82-478a-a608-89b970ae4a74', '2026-07-19 12:24:29.211541+00', 'livrée', 'Bigiiz', '+243828686120', 'Kinshasa ', 'U', NULL, -4.3196982, 15.3424196, 'Kinshasa ', '7853cce9-3e54-496b-8b95-e57194b6e673', 37, 'delivery', 7, 7.031103748096914, NULL, NULL, false, 'livraison', 'BD-20260719-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('c1ade1eb-3202-4692-a755-dd5717fdc7fb', '2026-07-15 11:17:07.676562+00', 'livrée', 'Mc Tukuzu ', '+243811281663', 'Ndolo, Barumbu, Kinshasa, République démocratique du Congo', '', NULL, -4.320082984036639, 15.332777520922878, 'Ndolo, Barumbu, Kinshasa, République démocratique du Congo', '11908f31-08f2-4d68-a19c-bf845a04b804', 35, 'delivery', 5, 6.026530429123993, NULL, NULL, false, 'livraison', 'BD-20260715-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('6012330e-716c-4d6a-a1ec-a1f6a657839e', '2026-07-20 21:31:01.948887+00', 'livrée', 'Christo ', '+243818655008', 'Rue Madiakoko, Lingwala, Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.3530072, 15.2883813, 'Rue Madiakoko, Lingwala, Bandalungwa, Kinshasa, République démocratique du Congo', 'f8fd52a4-c04e-4f17-8dad-648dd3d80d93', 13, 'delivery', 3, 1.3316357408590558, NULL, NULL, false, 'livraison', 'BD-20260720-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('9e4846f2-2162-4c1c-bed7-1dece17ad726', '2026-07-22 13:12:27.208372+00', 'livrée', 'Mc Tukuzu ', '+243811281663', 'Ndolo, Barumbu, Kinshasa, République démocratique du Congo', '', NULL, -4.320082984036639, 15.332777520922878, 'Ndolo, Barumbu, Kinshasa, République démocratique du Congo', 'f5daf5da-9861-4adf-9f8f-8ef7b03029b8', 45, 'delivery', 5, 6.026530429123993, NULL, NULL, false, 'livraison', 'BD-20260722-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('9e5a37fb-109e-4d9e-95ee-7beabe2ae969', '2026-07-22 19:14:48.888537+00', 'livrée', 'Y', '+243851547328', 'Bandalungwa, Kinshasa, République démocratique du Congo', 'A', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '50b85732-01e7-4dce-953d-c70c24d6b064', 30, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260722-0002', NULL, NULL, NULL, NULL),
	('ccb7dae8-3930-418c-b9a5-09c9a1e28e74', '2026-07-24 16:30:45.076943+00', 'livrée', 'Mc Tukuzu ', '+243811281663', 'Ndolo, Barumbu, Kinshasa, République démocratique du Congo', '', NULL, -4.320082984036639, 15.332777520922878, 'Ndolo, Barumbu, Kinshasa, République démocratique du Congo', 'd51f8649-f226-4a94-bbb7-edcfb746e154', 30, 'delivery', 5, 6.026530429123993, NULL, NULL, false, 'livraison', 'BD-20260724-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('28b0fe76-9a90-46c9-a466-3c7f819c33f5', '2026-07-27 11:00:26.373974+00', 'livrée', 'B2obitch', '+243997866570', 'Mampeza 1, Mont Fleury, Joli Parc, Ngaliema, Kinshasa, République démocratique du Congo', '', NULL, -4.331189, 15.254394, 'Mampeza 1, Mont Fleury, Joli Parc, Ngaliema, Kinshasa, République démocratique du Congo', '10f7f105-07b0-4010-b561-0a9b79fed4f2', 23, 'delivery', 3, 3.4177207363411015, NULL, NULL, false, 'livraison', 'BD-20260727-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('f50f09c1-5235-41bb-8b28-a51c9274e0a8', '2026-08-11 16:34:38.332358+00', 'en_livraison', 'Le baron', '+243977252929', 'Ngaliema, Anciens Combattants, Ngaliema, Kinshasa, République démocratique du Congo', '', NULL, -4.337142151349619, 15.2482669316703, 'Ngaliema, Anciens Combattants, Ngaliema, Kinshasa, République démocratique du Congo', '842f43ff-ec9e-4151-8833-b091232d11b6', 25, 'delivery', 5, 3.910342127175072, NULL, NULL, false, 'livraison', 'BD-20260811-0002', 'd17026e5-2564-4166-bcaa-7855b5038d11', NULL, NULL, NULL),
	('83bc1b48-5542-4f58-bc3b-43ca6eb45b27', '2026-07-29 12:32:19.936269+00', 'livrée', 'Kaz2', '+243810979710', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '1e8aedf6-2f6a-480c-ad7e-28aee754bc6d', 40, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260729-0001', NULL, NULL, NULL, NULL),
	('7fda0484-8091-4457-885e-8bbedca5054c', '2026-08-01 08:39:02.270106+00', 'livrée', 'Le baron', '+243977252929', 'Ngaliema, Anciens Combattants, Ngaliema, Kinshasa, République démocratique du Congo', '', NULL, -4.337154775515267, 15.248255416144682, 'Ngaliema, Anciens Combattants, Ngaliema, Kinshasa, République démocratique du Congo', 'ce3f83ce-2959-4867-ab65-664efd6ecf86', 45, 'delivery', 5, 3.9114031354888277, NULL, NULL, false, 'livraison', 'BD-20260801-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('a3f65dc1-f3a3-4c56-a696-93575f0714e1', '2026-08-02 11:55:32.462734+00', 'livrée', 'Hatim baby', '+243985998472', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '7ae254dd-97dc-467f-acab-d6f495d3cff2', 40, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260802-0001', NULL, NULL, NULL, NULL),
	('46d4678b-f095-4ac5-b593-fcee2c510d19', '2026-08-02 12:32:11.869276+00', 'livrée', 'Mula', '+243997688362', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', '7fe6d35d-73e5-459f-b718-69f2a1625e7a', 40, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260802-0002', NULL, NULL, NULL, NULL),
	('74379553-5405-46ad-a766-20d9c20a90d7', '2026-08-03 15:47:37.398209+00', 'livrée', 'Sdf ', '+243904557411', 'Bandalungwa, Kinshasa, République démocratique du Congo', '', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', 'c6547f75-e288-4ff0-a75e-4b394abf6911', 40, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260803-0002', NULL, NULL, NULL, NULL),
	('2ced81c4-130a-4e5f-b35c-ee98aa57646e', '2026-08-04 08:33:09.952361+00', 'livrée', 'Hatim baby ', '+243985998472', 'Essandja, Barumbu, Kapinga, Barumbu, Kinshasa, République démocratique du Congo', '', NULL, -4.3215188258909585, 15.328671238258229, 'Essandja, Barumbu, Kapinga, Barumbu, Kinshasa, République démocratique du Congo', '033abe96-4670-43d8-bf7e-a173f98b0cce', 45, 'delivery', 5, 5.545876020948016, NULL, NULL, false, 'livraison', 'BD-20260804-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('ea736c70-0490-44a0-944f-fe872d2ba543', '2026-06-01 17:49:16.380493+00', 'annulée', 'TEST COMMANDE PROD / correctif whatsapp', '+352691434011', 'gombe, kinshasa', '', 'heupel.martial@gmail.com', -4.3119751, 15.2894296, 'gombe, kinshasa', 'a87b62cb-8ca6-449c-b433-7d61c91cec90', 31, 'delivery', 7, 3.4340618784037695, NULL, NULL, false, 'livraison', 'BD-20260601-0009', NULL, NULL, NULL, NULL),
	('0ced0f9d-b933-4c84-b395-c2d14d420247', '2026-06-02 14:06:28.53284+00', 'livrée', 'ZEROSIX ', '+243899846187', 'Mont Fleury, Joli Parc, Ngaliema, Kinshasa, République démocratique du Congo', 'Non', 'young6flex@icloud.com', -4.337940210056802, 15.25180757045746, 'Mont Fleury, Joli Parc, Ngaliema, Kinshasa, République démocratique du Congo', 'e0ab0db7-048e-4fef-a50f-75c0a7df6a31', 45, 'delivery', 10, 3.509206531510781, NULL, NULL, false, 'livraison', 'BD-20260602-0002', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('a7b7f9a0-4552-4818-a51e-0516ecc4892a', '2026-07-29 18:08:35.594696+00', 'livrée', 'Le baron', '+243977252929', 'Ngaliema, Anciens Combattants, Ngaliema, Kinshasa, République démocratique du Congo', '', NULL, -4.337154775515267, 15.248255416144682, 'Ngaliema, Anciens Combattants, Ngaliema, Kinshasa, République démocratique du Congo', 'f0de09b5-a1d9-4955-9771-bc2346b4f44b', 25, 'delivery', 5, 3.9114031354888277, NULL, NULL, false, 'livraison', 'BD-20260729-0002', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('13affa84-977f-4b60-a430-5d2940505989', '2026-07-29 21:46:08.532986+00', 'livrée', 'Marcel', '+243822165117', 'Ndolo, Barumbu, Kinshasa, République démocratique du Congo', '', NULL, -4.320389365503388, 15.333292826091958, 'Ndolo, Barumbu, Kinshasa, République démocratique du Congo', 'ab7dd18c-e99f-4de7-a052-08749caca22e', 65, 'delivery', 5, 6.065011048898924, NULL, NULL, false, 'livraison', 'BD-20260729-0003', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('05f6446d-9428-406f-9bcd-3c8dd4507d56', '2026-08-06 12:14:06.161578+00', 'livrée', 'Le baron', '+243977252929', 'Mont Fleury, Joli Parc, Ngaliema, Kinshasa, République démocratique du Congo', '', NULL, -4.337654927315152, 15.251083374023438, 'Mont Fleury, Joli Parc, Ngaliema, Kinshasa, République démocratique du Congo', 'b67d38af-b7e6-4fbb-a9d5-19d2ad031ec9', 45, 'delivery', 5, 3.5931220701359052, NULL, NULL, false, 'livraison', 'BD-20260806-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL),
	('c3dbdf5e-e971-49ff-92a7-c16791b01406', '2026-08-08 20:05:03.641273+00', 'livrée', 'MD10', '+243852959228', 'Bandalungwa, Kinshasa, République démocratique du Congo', 'Ras', NULL, -4.34222, 15.283165, 'Bandalungwa, Kinshasa, République démocratique du Congo', 'e1267ed5-8938-4309-9fa6-48fa6930e4d2', 20, 'pickup', 0, NULL, NULL, NULL, false, 'livraison', 'BD-20260808-0001', NULL, NULL, NULL, NULL),
	('bf656cb2-0ab9-44dc-8338-7235c0a981ac', '2026-08-09 11:03:01.981052+00', 'livrée', 'Le baron ', '+243977252929', 'Ngaliema, Anciens Combattants, Ngaliema, Kinshasa, République démocratique du Congo', '', NULL, -4.3371408734855095, 15.248266171760264, 'Ngaliema, Anciens Combattants, Ngaliema, Kinshasa, République démocratique du Congo', '9f24a572-927e-4cc7-a8f9-2d262ea94a55', 25, 'delivery', 5, 3.910446022695424, NULL, NULL, false, 'livraison', 'BD-20260809-0001', '7544aa44-f856-4f61-9e6f-f20039c92005', NULL, NULL, NULL);


--
-- Data for Name: order_deliveries; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."order_deliveries" ("id", "order_id", "driver_id", "status", "assigned_at", "picked_up_at", "delivered_at", "failed_at", "delivery_address", "delivery_notes", "distance_km", "amount_to_collect", "amount_collected", "delivery_fee_charged_to_customer", "real_delivery_cost", "driver_fee_due", "delivery_fee_subsidized", "amount_to_remit_by_driver", "created_at", "updated_at", "driver_fee_total") VALUES
	('6f4d2df2-5661-4589-9863-be682b1e7451', '03133dc9-517b-4d16-80a5-e8dae33b3a93', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-06-01 14:56:19.224+00', NULL, NULL, NULL, NULL, 17, 17, 7, 0, 7, 0, 0, '2026-06-01 14:12:15.286027+00', '2026-06-01 14:12:15.286027+00', 7),
	('900f889f-4e10-49c4-9178-54cedb1af60c', '7d2aea1a-602b-4907-9257-74884d09e932', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-06-08 15:56:24.794+00', NULL, NULL, NULL, NULL, 17, 17, 7, 0, 7, 0, 0, '2026-06-08 15:21:06.389247+00', '2026-06-08 15:21:06.389247+00', 7),
	('267377b7-4b32-455a-b57d-37da7933eb39', '79fec7d3-57f9-4331-901c-b69a409420e9', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-06-08 19:11:14.227+00', NULL, NULL, NULL, NULL, 28, 28, 13, 0, 13, 0, 0, '2026-06-08 19:10:40.354358+00', '2026-06-08 19:10:40.354358+00', 13),
	('1b363edf-172b-4930-9595-d8e298832927', 'b57bbe89-c9e2-44f0-bc6b-86633c714d70', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-06-08 19:11:24.896+00', NULL, NULL, NULL, NULL, 26, 26, 13, 0, 13, 0, 0, '2026-06-08 19:10:55.585523+00', '2026-06-08 19:10:55.585523+00', 13),
	('bd115713-74a9-4f30-9619-78c1d43c2731', '620319b1-f789-4f0f-9bec-c6af1a3e7c2f', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-06-09 20:11:17.353+00', NULL, NULL, NULL, NULL, 33, 33, 3, 0, 3, 0, 0, '2026-06-09 20:11:06.846765+00', '2026-06-09 20:11:06.846765+00', 3),
	('6a98eba1-963a-4459-b8e3-d7b388e985fd', 'e8b92f94-a250-454b-91b9-357a36cb00a0', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-06-12 12:18:48.191+00', NULL, NULL, NULL, NULL, 33, 33, 3, 0, 3, 0, 0, '2026-06-12 10:15:27.936147+00', '2026-06-12 10:15:27.936147+00', 3),
	('06a9ad25-9481-494e-a5ac-946368df5a77', '8045b03c-f48b-4af5-bf03-7bf4a307aac8', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-06-17 14:40:40.595+00', NULL, NULL, NULL, NULL, 33, 33, 3, 0, 3, 0, 0, '2026-06-17 14:40:10.284885+00', '2026-06-17 14:40:10.284885+00', 3),
	('d0731aa6-3ffe-4ee7-b14b-e583754f40d8', '0b8967d0-208d-4033-b867-4a73ba72165a', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-06-17 14:40:55.973+00', NULL, NULL, NULL, NULL, 33, 33, 3, 0, 3, 0, 0, '2026-06-17 14:39:53.227012+00', '2026-06-17 14:39:53.227012+00', 3),
	('debbeed8-c37f-487d-a666-8102edf2ff02', '992e3ea6-775f-41bc-a824-d6e4e61d7239', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-06-21 07:51:41.95+00', NULL, NULL, NULL, NULL, 17, 17, 7, 0, 7, 0, 0, '2026-06-21 07:51:24.09871+00', '2026-06-21 07:51:24.09871+00', 7),
	('2eda8012-ad06-4a22-a5fd-031b399a12e1', 'a09600f0-7aeb-4446-902a-f4961dd68584', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-06-22 13:15:11.983+00', NULL, NULL, NULL, NULL, 33, 33, 3, 0, 3, 0, 0, '2026-06-22 13:14:13.888296+00', '2026-06-22 13:14:13.888296+00', 3),
	('16ee8de4-6872-4fc6-820c-69bebb873db9', '8d9ef52a-9874-47aa-9ec9-f817e098ebdf', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-07-02 14:48:51.947+00', NULL, NULL, NULL, NULL, 13, 13, 3, 0, 3, 0, 0, '2026-07-02 13:53:13.294337+00', '2026-07-02 13:53:13.294337+00', 3),
	('71d8034b-8323-48dc-a57a-dbb1daccb14d', '7b917647-1981-488e-9600-2da95ebc1f7c', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-07-07 16:16:32.712+00', NULL, NULL, NULL, NULL, 67, 67, 5, 0, 5, 0, 0, '2026-07-07 16:16:18.990226+00', '2026-07-07 16:16:18.990226+00', 5),
	('c4b34f32-d93e-4f5f-8eb9-3e024987aa3c', '3c87d258-1f5f-4982-b71e-c987ca811567', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-07-13 17:04:43.027+00', NULL, NULL, NULL, NULL, 65, 65, 5, 0, 5, 0, 0, '2026-07-13 17:04:33.290604+00', '2026-07-13 17:04:33.290604+00', 5),
	('e9773a78-a6db-47cd-9247-c4c4d1bd32db', 'c1ade1eb-3202-4692-a755-dd5717fdc7fb', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-07-15 11:19:17.303+00', NULL, NULL, NULL, NULL, 35, 35, 5, 0, 5, 0, 0, '2026-07-15 11:18:52.012815+00', '2026-07-15 11:18:52.012815+00', 5),
	('0d5da23e-742f-4479-8971-451c0604535c', '1b09c5b6-2e6c-41c8-b1ee-a5a1ab372f55', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-07-15 23:16:29.522+00', NULL, NULL, NULL, NULL, 33, 33, 3, 0, 3, 0, 0, '2026-07-15 23:16:05.955199+00', '2026-07-15 23:16:05.955199+00', 3),
	('9bb7999b-40ec-4ee6-b529-5ea5af2d1596', '175022b9-a339-4b22-be16-7bb2d1fb8ce8', 'd17026e5-2564-4166-bcaa-7855b5038d11', 'delivered', NULL, NULL, '2026-07-17 18:29:10.894+00', NULL, NULL, NULL, NULL, 33, 33, 3, 0, 3, 0, 0, '2026-07-17 18:28:37.095956+00', '2026-07-17 18:28:37.095956+00', 3),
	('9004633a-9313-46e5-bb08-d225951139ef', '8e6826de-b58c-4fa5-926a-89c488f97cd4', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-07-18 16:20:40.538+00', NULL, NULL, NULL, NULL, 33, 33, 3, 0, 3, 0, 0, '2026-07-18 16:20:19.765024+00', '2026-07-18 16:20:19.765024+00', 3),
	('396e8747-07f3-4951-b4c8-efcc191d9438', '23c3ede7-9d82-478a-a608-89b970ae4a74', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-07-19 13:33:06.844+00', NULL, NULL, NULL, NULL, 37, 37, 7, 0, 7, 0, 0, '2026-07-19 13:32:51.677604+00', '2026-07-19 13:32:51.677604+00', 7),
	('0254469f-a88d-4cdd-a23b-99eeebe9b26b', '6012330e-716c-4d6a-a1ec-a1f6a657839e', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-07-20 21:37:44.702+00', NULL, NULL, NULL, NULL, 13, 13, 3, 0, 3, 0, 0, '2026-07-20 21:36:31.88437+00', '2026-07-20 21:36:31.88437+00', 3),
	('9041fe14-46f0-49fb-b13f-2d6c4bcd3717', '9e4846f2-2162-4c1c-bed7-1dece17ad726', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-07-22 17:54:00.716+00', NULL, NULL, NULL, NULL, 45, 45, 5, 0, 5, 0, 0, '2026-07-22 13:35:11.453055+00', '2026-07-22 13:35:11.453055+00', 5),
	('640e8637-37c6-4c22-a61c-e30672b68c06', 'ccb7dae8-3930-418c-b9a5-09c9a1e28e74', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-07-24 17:58:16.397+00', NULL, NULL, NULL, NULL, 30, 30, 5, 0, 5, 0, 0, '2026-07-24 17:56:33.092821+00', '2026-07-24 17:56:33.092821+00', 5),
	('c3773770-66a7-4e5a-8db2-fac5bb021d8c', '28b0fe76-9a90-46c9-a466-3c7f819c33f5', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-07-27 12:15:38.406+00', NULL, NULL, NULL, NULL, 23, 23, 3, 0, 3, 0, 0, '2026-07-27 12:15:22.054851+00', '2026-07-27 12:15:22.054851+00', 3),
	('bb2076e0-582a-42a6-b982-335a353bf1a4', 'd2c27ccb-58c0-4f26-a05e-0600c85b1faa', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-06-02 13:05:52.701+00', NULL, NULL, NULL, NULL, 37, 37, 7, 0, 7, 0, 0, '2026-06-02 13:05:36.584325+00', '2026-06-02 13:05:36.584325+00', 7),
	('8c4dc97d-1568-4831-b6eb-46a98818d5ea', 'c6548c46-e9be-4189-9675-ba09c5635deb', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-07-28 11:58:18.376+00', NULL, NULL, NULL, NULL, 25, 25, 5, 0, 5, 0, 0, '2026-07-28 11:58:04.500381+00', '2026-07-28 11:58:04.500381+00', 5),
	('138675ae-8fc8-41b7-aa77-9ccef009cb4c', '0ced0f9d-b933-4c84-b395-c2d14d420247', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-06-02 16:44:47.077+00', NULL, NULL, NULL, NULL, 45, 45, 10, 0, 10, 0, 0, '2026-06-02 16:35:33.6178+00', '2026-06-02 16:35:33.6178+00', 10),
	('642f0e28-a8f0-47f7-afd3-8fcef9253d59', '9378dff2-f078-4ec5-980c-7fe00f48a140', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-06-03 20:16:17.282+00', NULL, NULL, NULL, NULL, 37, 37, 7, 0, 7, 0, 0, '2026-06-03 19:51:40.651324+00', '2026-06-03 19:51:40.651324+00', 7),
	('6ff9444d-bb03-42fd-b3b0-49ca9c45d2ad', '55b64f53-a3d7-4be7-af65-20b1e1a61ea2', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-06-08 12:21:03.321+00', NULL, NULL, NULL, NULL, 37, 37, 7, 0, 7, 0, 0, '2026-06-08 11:34:46.526305+00', '2026-06-08 11:34:46.526305+00', 7),
	('762f5d1d-dbac-4712-ad8b-4cff9fe0d0c2', '13affa84-977f-4b60-a430-5d2940505989', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-07-29 22:19:53.882+00', NULL, NULL, NULL, NULL, 65, 65, 5, 0, 5, 0, 0, '2026-07-29 22:11:04.716974+00', '2026-07-29 22:11:04.716974+00', 5),
	('7806aec8-d158-488a-b1f3-2cd4c9486c63', 'a7b7f9a0-4552-4818-a51e-0516ecc4892a', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-07-30 17:56:46.378+00', NULL, NULL, NULL, NULL, 25, 25, 5, 0, 5, 0, 0, '2026-07-29 18:49:01.452923+00', '2026-07-29 18:49:01.452923+00', 5),
	('cc97a750-b799-4b07-938f-8a70382bbf14', '7fda0484-8091-4457-885e-8bbedca5054c', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-08-01 10:03:26.429+00', NULL, NULL, NULL, NULL, 45, 45, 5, 0, 5, 0, 0, '2026-08-01 08:42:44.399984+00', '2026-08-01 08:42:44.399984+00', 5),
	('9bdba90c-6fbd-4d2e-b377-ac077e934ea7', 'bd2acf48-216c-4d2a-8a20-2a888a0b54b9', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-08-03 13:14:52.966+00', NULL, NULL, NULL, NULL, 43, 43, 3, 0, 3, 0, 0, '2026-08-03 11:47:21.346705+00', '2026-08-03 11:47:21.346705+00', 3),
	('4e76f16a-ebbd-457d-bab2-0eda02936a02', '2ced81c4-130a-4e5f-b35c-ee98aa57646e', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-08-04 10:41:51.924+00', NULL, NULL, NULL, NULL, 45, 45, 5, 0, 5, 0, 0, '2026-08-04 10:41:42.772262+00', '2026-08-04 10:41:42.772262+00', 5),
	('43b7f7ae-7356-418c-9e4d-3e4038015687', '05f6446d-9428-406f-9bcd-3c8dd4507d56', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-08-06 12:50:44.583+00', NULL, NULL, NULL, NULL, 45, 45, 5, 0, 5, 0, 0, '2026-08-06 12:50:27.054309+00', '2026-08-06 12:50:27.054309+00', 5),
	('52354dfe-fa39-4975-8773-03deefac773e', 'bf656cb2-0ab9-44dc-8338-7235c0a981ac', '7544aa44-f856-4f61-9e6f-f20039c92005', 'delivered', NULL, NULL, '2026-08-09 12:03:53.435+00', NULL, NULL, NULL, NULL, 25, 25, 5, 0, 5, 0, 0, '2026-08-09 11:16:51.479787+00', '2026-08-09 11:16:51.479787+00', 5),
	('936cacdd-cde9-4b6b-9ff8-8765de1cf25c', 'f50f09c1-5235-41bb-8b28-a51c9274e0a8', 'd17026e5-2564-4166-bcaa-7855b5038d11', 'assigned', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 25, 0, 5, 0, 5, 0, 0, '2026-08-11 17:01:45.093676+00', '2026-08-11 17:01:45.093676+00', 5);


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."order_items" ("id", "order_id", "product_id", "product_name", "product_price", "unit_price", "quantity", "is_vip", "selected_variants", "variant_name", "variant_price", "variant_price_extra") VALUES
	('7c5f9ab6-0313-4134-8f19-dfd5470bded2', '992e3ea6-775f-41bc-a824-d6e4e61d7239', '48863674-ec5f-4369-80a8-2194ae3e4b9e', 'Grinder premium', NULL, 10, 1, false, '{"Type": "Aluminium noir"}', 'Type: Aluminium noir', NULL, 0),
	('91e2b8b3-7be2-4861-8d0a-573cf29b765d', '03133dc9-517b-4d16-80a5-e8dae33b3a93', '48863674-ec5f-4369-80a8-2194ae3e4b9e', 'Grinder premium', NULL, 10, 1, false, '{"Type": "Aluminium noir"}', 'Type: Aluminium noir', NULL, 0),
	('555e980e-8f6d-47a0-ab58-8e4d2274148a', '5d6d69f2-abee-4a04-aad9-420288e4b31d', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 55, 1, true, NULL, NULL, NULL, 0),
	('eb11633d-f434-452f-a9f8-551f82d25d71', '5d6d69f2-abee-4a04-aad9-420288e4b31d', '135d3f04-c14f-4b46-9056-d1528b1d7961', 'Burger signature / Copacabanna Classic', NULL, 9, 1, false, NULL, NULL, NULL, 0),
	('e7b63e4e-2db4-42af-95e3-04afcfe3c50c', '5193adf0-2aec-426a-92c9-443fa8bfea74', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 55, 1, true, NULL, NULL, NULL, 0),
	('787cc6e1-a76f-428a-b8d7-5a1389fb192e', 'e693860c-6978-4a9f-a987-7845216a671d', '757d9cdc-5f74-4a7f-a8bb-f36d61a7102d', 'Speed Energy', NULL, 3, 1, false, NULL, NULL, NULL, 0),
	('6b772f1e-0c9f-4de2-ad48-6daae050704f', 'e693860c-6978-4a9f-a987-7845216a671d', 'f897e680-02e1-4728-b4b7-1b61f4b6b985', 'Coca-Cola', NULL, 2, 1, false, NULL, NULL, NULL, 0),
	('f80335f3-6847-4dc9-89ff-87490a01273f', 'e693860c-6978-4a9f-a987-7845216a671d', '3f994354-4e5e-4c23-a58d-96079e3465df', 'Fanta', NULL, 3, 1, false, NULL, NULL, NULL, 0),
	('8358a7d5-25d5-4839-84e0-ce57441d59ed', 'e693860c-6978-4a9f-a987-7845216a671d', '01aa4dce-9692-4361-b3e2-17eff1e8d185', 'Verveine', NULL, 18, 1, false, NULL, NULL, NULL, 0),
	('074f5422-15e5-4390-b3d8-5d46ce54befb', 'e693860c-6978-4a9f-a987-7845216a671d', 'f9ef4edb-a4d3-4217-ac7e-052224952808', 'Plateaux roulage design', NULL, 10, 1, false, NULL, NULL, NULL, 0),
	('70e6bd8f-9036-4ff6-b602-4b8ef0032bcb', '94bc3908-9e71-4cfd-9d66-89c97228ffa8', 'c9a2c0a1-df77-4564-91a4-23f95859b373', 'Burgers signature / Volcana', NULL, 15, 1, false, NULL, NULL, NULL, 0),
	('f22451bc-7688-4b0b-9c4d-ce8daa53f1ce', '94bc3908-9e71-4cfd-9d66-89c97228ffa8', '135d3f04-c14f-4b46-9056-d1528b1d7961', 'Burger signature / Copacabanna Classic', NULL, 9, 1, false, NULL, NULL, NULL, 0),
	('e2cd7e4b-e6b7-45c5-8138-c68d0a7804cf', 'd03ea1ba-22bc-44fb-a2f0-af25e0f97cbe', 'c9a2c0a1-df77-4564-91a4-23f95859b373', 'Burgers signature / Volcana', NULL, 15, 1, false, NULL, NULL, NULL, 0),
	('02178179-81d9-4b91-95bf-4fda6281b15b', 'd03ea1ba-22bc-44fb-a2f0-af25e0f97cbe', '135d3f04-c14f-4b46-9056-d1528b1d7961', 'Burger signature / Copacabanna Classic', NULL, 9, 1, false, NULL, NULL, NULL, 0),
	('3298f3a8-ff12-4c6e-88e9-367351b0b447', '68accda1-0f5a-4c5e-8f4d-f9ff1c6e4a82', '135d3f04-c14f-4b46-9056-d1528b1d7961', 'Burger signature / Copacabanna Classic', NULL, 9, 1, false, NULL, NULL, NULL, 0),
	('b093ffad-88e8-4f61-b66d-df17a3faf163', '68accda1-0f5a-4c5e-8f4d-f9ff1c6e4a82', 'c9a2c0a1-df77-4564-91a4-23f95859b373', 'Burgers signature / Volcana', NULL, 15, 1, false, NULL, NULL, NULL, 0),
	('88f4dc2d-c2bf-4db4-a2b4-456b6dd0790d', 'ea736c70-0490-44a0-944f-fe872d2ba543', 'c9a2c0a1-df77-4564-91a4-23f95859b373', 'Burgers signature / Volcana', NULL, 15, 1, false, NULL, NULL, NULL, 0),
	('44ba3267-300e-4b50-9a06-dcbde8275631', 'ea736c70-0490-44a0-944f-fe872d2ba543', '135d3f04-c14f-4b46-9056-d1528b1d7961', 'Burger signature / Copacabanna Classic', NULL, 9, 1, false, NULL, NULL, NULL, 0),
	('51a09704-7481-46e5-b57b-0bae793d35b8', 'd2c27ccb-58c0-4f26-a05e-0600c85b1faa', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('d4e001cd-e14b-4dae-9280-4357878371f3', '0ced0f9d-b933-4c84-b395-c2d14d420247', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('c1d0c9ad-e35e-4bb7-b782-533a94044fbb', '0ced0f9d-b933-4c84-b395-c2d14d420247', 'd79ac543-c0bb-48ea-b480-168b81b5d62f', 'Tropical Gold', NULL, 5, 1, false, NULL, NULL, NULL, 0),
	('670df340-0b02-4305-b6dd-cb8dc33cacb5', '9378dff2-f078-4ec5-980c-7fe00f48a140', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('6d98b395-60f7-45d6-8350-122ab8652a6d', '256a418a-a296-452e-b191-f6e8c7ca0e1e', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 55, 1, true, NULL, NULL, NULL, 0),
	('2e44ee44-fec4-49dc-8a04-e2908a67f634', '55b64f53-a3d7-4be7-af65-20b1e1a61ea2', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('57d69329-741c-4a68-b720-648c6a4d1a2f', '7d2aea1a-602b-4907-9257-74884d09e932', 'b58557cc-4ea7-4511-ba74-4982c7dc7359', 'BLACK BOX SOLO ', NULL, 10, 1, true, NULL, NULL, NULL, 0),
	('599b22dc-ee6a-4fc3-b0ea-a6fe3123dd6e', 'b57bbe89-c9e2-44f0-bc6b-86633c714d70', 'd4df5fe6-da22-4bd9-9bb7-e5072527b5f6', 'Strawberry FIZ', NULL, 5, 1, false, NULL, NULL, NULL, 0),
	('300ea1a3-84f5-413d-8ce2-2a8123058ea6', 'b57bbe89-c9e2-44f0-bc6b-86633c714d70', '46a25bb7-6111-4d59-b476-f4540fd471b9', 'Fresh mango', NULL, 4, 1, false, NULL, NULL, NULL, 0),
	('140a8336-882c-4ca6-b991-b9639a0bc486', 'b57bbe89-c9e2-44f0-bc6b-86633c714d70', '04b30644-dc0c-436f-bfea-6b6eb169f713', 'Banana Fiz', NULL, 4, 1, false, NULL, NULL, NULL, 0),
	('95a515e4-7d79-4e58-959e-c887a638c473', '79fec7d3-57f9-4331-901c-b69a409420e9', 'c9a2c0a1-df77-4564-91a4-23f95859b373', 'Burgers signature / Volcana', NULL, 15, 1, false, NULL, NULL, NULL, 0),
	('1b955bae-63fe-4d97-8178-61cf681bce5b', '1e84a962-0b76-4258-8eb3-9f9e4ddf9e80', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('96def5ef-a4e1-405f-9ebb-fc7a77c536dc', 'b5405dd7-4be9-4c16-b0c9-f339ce3c5aca', 'b1d47bad-bb35-444b-b14c-229d8d17756f', 'Briquets premium rechargeables', NULL, 5, 1, false, NULL, NULL, NULL, 0),
	('80e53c4a-c006-402c-8588-baceb9d923d2', 'b5405dd7-4be9-4c16-b0c9-f339ce3c5aca', '6c013011-1911-479a-ac91-551dbb24f7a0', 'Filtres à charbon', NULL, 2, 1, false, NULL, NULL, NULL, 0),
	('9c56572b-064f-4141-9b1c-270eace48491', 'b5405dd7-4be9-4c16-b0c9-f339ce3c5aca', '2857b3de-185a-4347-affd-8f2b395c2219', 'Feuilles à Rouler Premium', NULL, 1, 2, false, NULL, NULL, NULL, 0),
	('f1791813-da83-4174-80f6-0d0255451ecc', '620319b1-f789-4f0f-9bec-c6af1a3e7c2f', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('a77cb32e-51cc-4ad3-8233-d90f44f9cdde', 'c90c7025-9592-4482-bc7c-9a4ee5a0b0d1', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('22435c45-1a76-417a-91e3-acc74b7e8025', '1dc0559d-85e7-41a7-b0b4-8810b09f0c1e', '2857b3de-185a-4347-affd-8f2b395c2219', 'Feuilles à Rouler Premium', NULL, 1, 1, false, NULL, NULL, NULL, 0),
	('5e92ba27-e1cd-4120-aa69-56b9ed38ee2b', 'edf69390-9f71-4740-bf88-900516cb6b20', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('16ac8d54-d652-4449-9205-c88523b9340a', '0ce8f2f7-db47-4e3e-943c-5ee36f4202b9', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('22852340-917f-4baf-8438-9d4f6336dda9', 'e8b92f94-a250-454b-91b9-357a36cb00a0', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('5dec0ca8-6dd6-403b-8970-5dba7a515133', '5ad5eefb-2987-4c5e-b144-a24a269cb91d', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('0e0f1749-83f0-4497-898d-3e9550476caa', '274265b1-0876-47a6-9390-f19d1f5e7880', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('d281d18f-e1a5-400f-8525-49b529bc311a', '3c552116-a2fe-4247-957b-fd003bbfcfb6', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('b10c1b1c-cb5f-40a0-8753-c6c7a41a7d6a', '59a502ba-5aee-41b8-8743-9421fdcff065', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('9a03ab32-dda0-429f-aba1-1c71fe7a13df', '8045b03c-f48b-4af5-bf03-7bf4a307aac8', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('4c7d91bf-f65b-40d2-8d77-73ef5910f05e', '0b8967d0-208d-4033-b867-4a73ba72165a', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('bd15966e-6afe-4709-b202-6c170498e2e7', '467bec1f-243b-46be-b46b-2e23c4edde4c', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('13453c11-8dde-4724-9db1-28e405b48cc4', 'a9adbcc4-ce92-4b7b-a9f6-8f05feae943e', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 60, 1, true, NULL, NULL, NULL, 0),
	('ebc85d50-615c-4ae2-ae54-326c701284f3', 'a09600f0-7aeb-4446-902a-f4961dd68584', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('e93d4f87-fd85-4c47-802c-b191458b6a0a', '2f722104-ba50-4587-893a-e33cc746b1af', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('585105f9-cc8e-4230-9016-dbaafb0800d3', '60326208-9cde-4866-b612-1b066d8cd607', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('06f7e3be-abbc-4505-a84f-b4b82910dc5b', 'ac684d98-e2c1-4469-86e4-2049fa18546b', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('43e27daf-0d3a-4f2d-94d2-d9ce52058daa', '0b69a5fe-9a36-42d1-8b9d-a6aed786014c', '2857b3de-185a-4347-affd-8f2b395c2219', 'Feuilles à Rouler Premium', NULL, 1, 1, false, NULL, NULL, NULL, 0),
	('5d886348-b3c1-403c-be86-b4ebfbe23b3e', '3b4e29ba-c85d-44e7-be85-825a5722ddc7', 'b58557cc-4ea7-4511-ba74-4982c7dc7359', 'BLACK BOX SOLO ', NULL, 10, 1, true, NULL, NULL, NULL, 0),
	('06d021db-4776-4c1f-81ea-d287f8892041', 'a0a10916-61e5-44d0-9fe2-94055499ef07', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('5d472334-8c56-4c9b-83b5-b3d7054220f0', 'ecf0f447-5650-4585-b3c4-1e985df1cd29', '48863674-ec5f-4369-80a8-2194ae3e4b9e', 'Grinder premium', NULL, 10, 1, false, '{"Type": "Aluminium noir"}', 'Type: Aluminium noir', NULL, 0),
	('12fe4389-9f88-4f6b-ab36-1eb09e78f50d', '5a973d4d-9033-4f80-8a62-4fda6bae58cd', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('93cb35c6-c9fc-4212-bb0a-b4eb213d934a', '9cb26f60-60b8-428f-a9a1-90a0cb95fb3d', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('c0275481-e557-403d-a84a-ef6ffed91eb3', '2926ae27-4bdc-4341-a8d0-ea9406f81b80', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('b0d239db-a966-4f3b-a027-62a96ef6f723', '587807da-ad0c-4b31-9662-9a8a2f630b12', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('47f39da4-9950-4580-8ad5-4887f2e94984', '1593631c-357e-4553-b825-c92efdd0d71b', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('4ea88540-279e-4783-ab3f-a826c6b85773', '8d9ef52a-9874-47aa-9ec9-f817e098ebdf', 'b58557cc-4ea7-4511-ba74-4982c7dc7359', 'BLACK BOX SOLO ', NULL, 10, 1, true, NULL, NULL, NULL, 0),
	('50b5df44-4d34-4b1d-86d0-2399453c6b24', '3c1806ae-4367-40ac-89c0-a2e7c0e89214', '48863674-ec5f-4369-80a8-2194ae3e4b9e', 'Grinder premium', NULL, 10, 1, false, '{"Type": "Aluminium noir"}', 'Type: Aluminium noir', NULL, 0),
	('bad0023f-1df8-40b0-8e53-0fd003cbfe46', '1a4e224b-2ed2-45a2-be06-c7c4bfba7971', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('28ae32b5-f485-49a9-9dc9-fdf6a6df1606', 'a4b4bbfd-6753-42a1-a949-80266240b4ac', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('928f384e-c47e-482a-b4a6-f1255c6ebdd4', '7b917647-1981-488e-9600-2da95ebc1f7c', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 60, 1, true, NULL, NULL, NULL, 0),
	('5ba83d05-ed10-44ce-b97b-cd092e5aa1e9', '7b917647-1981-488e-9600-2da95ebc1f7c', '2857b3de-185a-4347-affd-8f2b395c2219', 'Feuilles à Rouler Premium', NULL, 1, 2, false, NULL, NULL, NULL, 0),
	('b7e7bf38-9ff3-4a4e-bc84-217377c4d137', '8e0c210c-168b-4708-9f04-f5b29ed1142b', '48863674-ec5f-4369-80a8-2194ae3e4b9e', 'Grinder premium', NULL, 10, 1, false, '{"Type": "Aluminium noir"}', 'Type: Aluminium noir', NULL, 0),
	('2cbe7ff6-9061-40ef-9398-d108dad77d9e', '91c2bbfb-4360-48fc-89af-7f0181a354f1', '48863674-ec5f-4369-80a8-2194ae3e4b9e', 'Grinder premium', NULL, 10, 1, false, '{"Type": "Aluminium noir"}', 'Type: Aluminium noir', NULL, 0),
	('74b5b98b-cf8c-4c90-ac1d-bc96a120327a', 'cdad5133-6f03-40a5-a4b5-ecaaf2a2757b', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 60, 1, true, NULL, NULL, NULL, 0),
	('b59c311f-3d1e-4f0d-bf9b-90f5f4f27dbe', '3c87d258-1f5f-4982-b71e-c987ca811567', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 60, 1, true, NULL, NULL, NULL, 0),
	('2f10070c-e146-47c0-80b8-706fae9f9c42', '83d6137e-e614-45db-987b-22677d9be9b3', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('dab504c7-d47b-4242-8699-e15aec081421', 'c1ade1eb-3202-4692-a755-dd5717fdc7fb', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('758a0ddc-46ca-47e9-93d2-853e786078d9', 'b904b7b4-e63c-44ef-80d6-3be3d56cefb8', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('bb9a6e50-130f-4dde-8085-6eb17eff6069', '1b09c5b6-2e6c-41c8-b1ee-a5a1ab372f55', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('69cd1c92-fa25-41b3-8763-fe369c602a25', '91f4d0e2-74bb-4628-b4c0-68f3b7d71595', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('12bb63b3-3359-4fa7-bc75-ef3dab7b9d81', '175022b9-a339-4b22-be16-7bb2d1fb8ce8', '36362ca1-77f6-404e-8b79-f87e3a0c98e1', ' Service de préparation produit', NULL, 1, 30, true, NULL, NULL, NULL, 0),
	('2162fa09-3cf6-4f8a-bb86-79447845f765', '9b34880b-e82d-4fd0-8360-4e638a5194e4', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('ca312e21-46df-48d0-bb1c-79e251fbbdc4', '2284d454-4797-442d-aa7e-256d759f4baa', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('54b2ed05-5c29-404b-9ee9-ca871108fb5e', '8e6826de-b58c-4fa5-926a-89c488f97cd4', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('92a57392-af75-404a-86c7-af526808ffcb', 'ce3cbece-c3f9-4b25-ac76-13a103ba7128', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('0fc2acd0-ea0b-4b9c-8636-6356c1ac829c', '23c3ede7-9d82-478a-a608-89b970ae4a74', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('a9db8b89-fb0c-4499-a2bf-bbdfeee14dbe', '6012330e-716c-4d6a-a1ec-a1f6a657839e', 'b58557cc-4ea7-4511-ba74-4982c7dc7359', 'BLACK BOX SOLO ', NULL, 10, 1, true, NULL, NULL, NULL, 0),
	('1cb4f9f1-aaf2-4969-ab23-75e644df8fda', '9e4846f2-2162-4c1c-bed7-1dece17ad726', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('2b6164d0-7ad6-415a-acde-c90f302d8294', '9e4846f2-2162-4c1c-bed7-1dece17ad726', '48863674-ec5f-4369-80a8-2194ae3e4b9e', 'Grinder premium', NULL, 10, 1, false, '{"Type": "Aluminium noir"}', 'Type: Aluminium noir', NULL, 0),
	('3743ab54-ab90-4329-936d-614adff7d3b7', '9e5a37fb-109e-4d9e-95ee-7beabe2ae969', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 30, 1, true, NULL, NULL, NULL, 0),
	('1c84fbed-9e7f-47e9-9c0a-5dad273ee304', 'ccb7dae8-3930-418c-b9a5-09c9a1e28e74', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 25, 1, true, NULL, NULL, NULL, 0),
	('58e7a7c1-9bdc-4aab-a930-cf0c7b5b4b96', '28b0fe76-9a90-46c9-a466-3c7f819c33f5', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 20, 1, true, NULL, NULL, NULL, 0),
	('28ba36ca-82d9-4a21-b59e-b7285cbd0a0d', 'c6548c46-e9be-4189-9675-ba09c5635deb', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 20, 1, true, NULL, NULL, NULL, 0),
	('7fc635e7-445b-4e79-8b38-15409ef04f08', '83bc1b48-5542-4f58-bc3b-43ca6eb45b27', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 40, 1, true, NULL, NULL, NULL, 0),
	('d012a69b-d3be-4833-a243-4c64017ca23b', 'a7b7f9a0-4552-4818-a51e-0516ecc4892a', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 20, 1, true, NULL, NULL, NULL, 0),
	('66f738d0-22e0-40aa-be39-6a2a7d168296', '13affa84-977f-4b60-a430-5d2940505989', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 40, 1, true, NULL, NULL, NULL, 0),
	('ba2c0f18-6b4e-439a-a0e3-fe813270c843', '13affa84-977f-4b60-a430-5d2940505989', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 20, 1, true, NULL, NULL, NULL, 0),
	('ca2ced52-d82b-40ec-9289-de01df31c94a', '7fda0484-8091-4457-885e-8bbedca5054c', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 40, 1, true, NULL, NULL, NULL, 0),
	('9ac952e9-e609-4343-b856-fb0f88e22b9f', 'a3f65dc1-f3a3-4c56-a696-93575f0714e1', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 40, 1, true, NULL, NULL, NULL, 0),
	('45d7506d-ad7c-474b-95eb-c929e73f4460', '46d4678b-f095-4ac5-b593-fcee2c510d19', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 40, 1, true, NULL, NULL, NULL, 0),
	('7209ad1e-0538-45ae-af44-4fca6867faf3', 'bd2acf48-216c-4d2a-8a20-2a888a0b54b9', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 40, 1, true, NULL, NULL, NULL, 0),
	('2e283d78-cd60-4e57-ad40-3351e454c677', '74379553-5405-46ad-a766-20d9c20a90d7', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 40, 1, true, NULL, NULL, NULL, 0),
	('0d330e3b-47ed-4f4a-8ccd-6a5ceee735fa', '2ced81c4-130a-4e5f-b35c-ee98aa57646e', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 40, 1, true, NULL, NULL, NULL, 0),
	('7ceb2296-861f-4788-968c-c6a3bfe26a53', '05f6446d-9428-406f-9bcd-3c8dd4507d56', '3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', NULL, 40, 1, true, NULL, NULL, NULL, 0),
	('fa591ba1-6e99-47b7-9d5a-8f9c1d0f3ed9', 'c3dbdf5e-e971-49ff-92a7-c16791b01406', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 20, 1, true, NULL, NULL, NULL, 0),
	('189f2349-9dcc-46d7-b123-0425f56af5de', 'bf656cb2-0ab9-44dc-8338-7235c0a981ac', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 20, 1, true, NULL, NULL, NULL, 0),
	('c63eba8e-a304-4667-9ab9-01760b186c1f', 'bbeb34b7-611b-40bf-8aa6-c17a02594d83', '0a3e57d7-8dae-4806-8979-b060495fd68d', 'BLACK BOX 20', NULL, 80, 1, true, NULL, NULL, NULL, 0),
	('c251090d-6444-4858-9cfe-2144b06c1cf5', 'f50f09c1-5235-41bb-8b28-a51c9274e0a8', '66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', NULL, 20, 1, true, NULL, NULL, NULL, 0);


--
-- Data for Name: order_status_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."order_status_history" ("id", "order_id", "from_status", "to_status", "changed_at") VALUES
	('d3cf6182-e9e9-428d-aa73-65a37bef4eeb', '1593631c-357e-4553-b825-c92efdd0d71b', NULL, 'nouvelle', '2026-07-02 08:26:01.850904+00'),
	('fdcfc8d0-0686-4cbf-b682-419b212f7713', '1593631c-357e-4553-b825-c92efdd0d71b', 'nouvelle', 'confirmée', '2026-07-02 08:32:07.682742+00'),
	('9a7cd93b-8ce5-4c5f-9c2a-7d71f8751a30', '1593631c-357e-4553-b825-c92efdd0d71b', 'confirmée', 'en_preparation', '2026-07-02 08:32:23.232582+00'),
	('7e6da4bd-1b0d-4c32-8052-361255d1af8e', '1593631c-357e-4553-b825-c92efdd0d71b', 'en_preparation', 'livrée', '2026-07-02 10:58:20.298296+00'),
	('1d039dfe-1810-4dc2-97bb-109b0cb0db52', '1593631c-357e-4553-b825-c92efdd0d71b', 'en_preparation', 'livrée', '2026-07-02 10:58:20.934034+00'),
	('db6593c9-bf08-432f-8ba0-f57413e3fa71', '8d9ef52a-9874-47aa-9ec9-f817e098ebdf', NULL, 'nouvelle', '2026-07-02 12:16:16.174663+00'),
	('27922ea0-5635-431d-bb40-317cd531d01e', '3c1806ae-4367-40ac-89c0-a2e7c0e89214', NULL, 'nouvelle', '2026-07-02 12:25:15.457478+00'),
	('117990c6-2f0e-4823-971e-24976f0815d8', '3c1806ae-4367-40ac-89c0-a2e7c0e89214', 'nouvelle', 'confirmée', '2026-07-02 13:05:25.390488+00'),
	('6ae03dbd-4bde-4332-9850-7b0fd957b3a6', '8d9ef52a-9874-47aa-9ec9-f817e098ebdf', 'nouvelle', 'confirmée', '2026-07-02 13:05:37.073509+00'),
	('87aa7c52-ab70-463f-b9ae-ee43c581f4df', '1a4e224b-2ed2-45a2-be06-c7c4bfba7971', NULL, 'nouvelle', '2026-07-02 13:48:10.223537+00'),
	('489abf3f-65e2-4e77-8a02-a2fbe9a8e080', '1a4e224b-2ed2-45a2-be06-c7c4bfba7971', 'nouvelle', 'confirmée', '2026-07-02 13:49:04.939383+00'),
	('59d96d15-baf7-4e97-89c8-c1a4e912d6f2', '3c1806ae-4367-40ac-89c0-a2e7c0e89214', 'confirmée', 'en_preparation', '2026-07-02 13:52:04.721383+00'),
	('0c1a343d-8a25-4b71-a0ad-555ce9d3829a', '8d9ef52a-9874-47aa-9ec9-f817e098ebdf', 'confirmée', 'en_preparation', '2026-07-02 13:52:29.388342+00'),
	('ba99b9b8-42e6-4d5b-82f1-bc41e304f59b', '3c1806ae-4367-40ac-89c0-a2e7c0e89214', 'en_preparation', 'livrée', '2026-07-02 13:52:57.320135+00'),
	('5d66f029-d3dc-488d-abfc-135a5ce92705', '3c1806ae-4367-40ac-89c0-a2e7c0e89214', 'en_preparation', 'livrée', '2026-07-02 13:52:57.870116+00'),
	('dfb7d487-28f1-4e4f-8840-e9acbf77719d', '8d9ef52a-9874-47aa-9ec9-f817e098ebdf', 'en_preparation', 'en_livraison', '2026-07-02 13:53:16.372244+00'),
	('a8732740-a434-48ef-ac80-22a967e9b769', '8d9ef52a-9874-47aa-9ec9-f817e098ebdf', 'livrée', 'livrée', '2026-07-02 14:48:52.352902+00'),
	('f5dc7098-e8d7-495f-a738-a7d05cf22de7', '8d9ef52a-9874-47aa-9ec9-f817e098ebdf', 'en_livraison', 'livrée', '2026-07-02 14:48:52.819188+00'),
	('0efcc71b-24e5-4dba-b280-d725454b280b', '1a4e224b-2ed2-45a2-be06-c7c4bfba7971', 'confirmée', 'en_preparation', '2026-07-02 14:49:13.933627+00'),
	('4f328125-8d92-41b9-a4a7-e865b8bde7f5', '1a4e224b-2ed2-45a2-be06-c7c4bfba7971', 'en_preparation', 'livrée', '2026-07-02 16:02:47.322444+00'),
	('b2f84fcb-5667-4b37-a001-af38869bd3bb', 'c07877b3-c513-4cbc-86cc-c0931f7fb693', NULL, 'nouvelle', '2026-07-03 13:59:14.581286+00'),
	('006550cf-8864-45e8-94ba-9b9989209e37', 'a4b4bbfd-6753-42a1-a949-80266240b4ac', NULL, 'nouvelle', '2026-07-03 14:17:03.910377+00'),
	('40ab7473-2a18-43bc-b0e2-78924e1b0a8d', 'a4b4bbfd-6753-42a1-a949-80266240b4ac', 'nouvelle', 'confirmée', '2026-07-03 14:52:21.751617+00'),
	('9e7fcc45-6e45-49e6-88c9-0c4325008602', 'c07877b3-c513-4cbc-86cc-c0931f7fb693', 'nouvelle', 'confirmée', '2026-07-03 15:41:33.259522+00'),
	('207d88ca-a939-4840-8053-937e8a651bd1', 'a4b4bbfd-6753-42a1-a949-80266240b4ac', 'confirmée', 'en_preparation', '2026-07-03 15:41:41.858803+00'),
	('811b409a-5171-4d60-bba4-5731797c7fe0', 'a4b4bbfd-6753-42a1-a949-80266240b4ac', 'en_preparation', 'livrée', '2026-07-03 15:42:03.170041+00'),
	('8c5de99b-46f5-4563-be32-1b8915d0c6cc', 'a4b4bbfd-6753-42a1-a949-80266240b4ac', 'livrée', 'livrée', '2026-07-03 15:42:04.703209+00'),
	('1f1e6828-e05e-449a-940b-18741fb2227b', 'c07877b3-c513-4cbc-86cc-c0931f7fb693', 'confirmée', 'annulée', '2026-07-03 15:44:55.196627+00'),
	('2b8563c1-0f1e-4c84-912f-3c067a92d4fa', '1536be42-c0f4-46aa-96ae-b19b011d1fa2', NULL, 'nouvelle', '2026-07-04 08:47:18.017281+00'),
	('96ec2ff2-531b-45bd-a2d3-3c5bd0909b6d', '1536be42-c0f4-46aa-96ae-b19b011d1fa2', 'nouvelle', 'confirmée', '2026-07-04 08:49:33.427939+00'),
	('412590b4-0f36-49cc-8bdf-263e48c4f39d', '1536be42-c0f4-46aa-96ae-b19b011d1fa2', 'confirmée', 'annulée', '2026-07-04 17:37:37.451622+00'),
	('901b7274-20e0-4381-9a6e-eb8058b93f3f', '7b917647-1981-488e-9600-2da95ebc1f7c', NULL, 'nouvelle', '2026-07-07 13:34:04.458493+00'),
	('de10ce63-ff9f-4c49-8d3d-0c82933b37b6', '7b917647-1981-488e-9600-2da95ebc1f7c', 'nouvelle', 'confirmée', '2026-07-07 14:04:37.765987+00'),
	('69b1fc36-419d-4863-8569-1fdf7e4aa756', '7b917647-1981-488e-9600-2da95ebc1f7c', 'confirmée', 'en_preparation', '2026-07-07 16:16:08.781128+00'),
	('22c3977d-ec96-4b64-8a92-e1ae4dd64aef', '7b917647-1981-488e-9600-2da95ebc1f7c', 'en_preparation', 'en_livraison', '2026-07-07 16:16:21.177288+00'),
	('38a63b1d-70cb-403c-a1ec-e437d850667c', '7b917647-1981-488e-9600-2da95ebc1f7c', 'en_livraison', 'livrée', '2026-07-07 16:16:32.989558+00'),
	('2770ead8-2bf2-4088-a1c0-445965700512', '7b917647-1981-488e-9600-2da95ebc1f7c', 'en_livraison', 'livrée', '2026-07-07 16:16:34.311444+00'),
	('d66bb115-1b2e-4072-8e1c-cdd4ad82c7f2', '40837f0c-2412-4a4a-81f0-4acd773955a0', NULL, 'nouvelle', '2026-07-09 18:25:09.329715+00'),
	('1afed5b6-5eb6-4910-954c-18dad2247551', '40837f0c-2412-4a4a-81f0-4acd773955a0', 'nouvelle', 'annulée', '2026-07-10 17:09:53.136159+00'),
	('a5a6c306-3eca-466a-b41e-7d8f16b31c1e', '8e0c210c-168b-4708-9f04-f5b29ed1142b', NULL, 'nouvelle', '2026-07-11 11:50:01.41968+00'),
	('d7bb097f-b4af-42eb-8c77-9b1f67b1a4a2', '8e0c210c-168b-4708-9f04-f5b29ed1142b', 'nouvelle', 'confirmée', '2026-07-11 11:52:31.702275+00'),
	('aee1b022-0026-4f0c-a813-bab28a1b690b', '8e0c210c-168b-4708-9f04-f5b29ed1142b', 'confirmée', 'en_preparation', '2026-07-11 11:52:46.006427+00'),
	('65f991a4-0066-4604-b108-cd5e00da2d9c', '8e0c210c-168b-4708-9f04-f5b29ed1142b', 'en_preparation', 'livrée', '2026-07-11 12:13:30.0855+00'),
	('1e125649-0a08-4f6f-844d-d0a7b876733b', '8e0c210c-168b-4708-9f04-f5b29ed1142b', 'en_preparation', 'livrée', '2026-07-11 12:13:30.720251+00'),
	('5fe44ef4-b229-4d36-ae00-d7d0196efda9', '91c2bbfb-4360-48fc-89af-7f0181a354f1', NULL, 'nouvelle', '2026-07-11 15:39:35.072274+00'),
	('c76d3804-2786-4c66-a0a6-3b79ae2c3e6a', '91c2bbfb-4360-48fc-89af-7f0181a354f1', 'nouvelle', 'confirmée', '2026-07-11 16:10:56.492763+00'),
	('5e63d094-1199-49dd-9fa5-6337a8425c8d', '91c2bbfb-4360-48fc-89af-7f0181a354f1', 'confirmée', 'en_preparation', '2026-07-11 16:14:24.056197+00'),
	('870cad73-83d3-4ca7-bfb6-5bf05a678971', '91c2bbfb-4360-48fc-89af-7f0181a354f1', 'en_preparation', 'livrée', '2026-07-11 16:27:16.042129+00'),
	('8a3e597b-bae7-403b-a9c0-434be9a0fd38', '91c2bbfb-4360-48fc-89af-7f0181a354f1', 'livrée', 'livrée', '2026-07-11 16:27:17.401578+00'),
	('da7eba17-6d2e-4c40-8767-5e11aba63396', 'cdad5133-6f03-40a5-a4b5-ecaaf2a2757b', NULL, 'nouvelle', '2026-07-12 11:32:38.241763+00'),
	('143aebe8-26a8-4c1e-bdf2-9a02a89e0c02', 'cdad5133-6f03-40a5-a4b5-ecaaf2a2757b', 'nouvelle', 'confirmée', '2026-07-12 12:55:36.786509+00'),
	('dc6a8e3e-34aa-44a1-94ff-6fbc03922fbc', 'cdad5133-6f03-40a5-a4b5-ecaaf2a2757b', 'confirmée', 'en_preparation', '2026-07-12 12:55:49.546223+00'),
	('392da0a3-9b6c-4e12-b03e-5bc23dbc123c', 'cdad5133-6f03-40a5-a4b5-ecaaf2a2757b', 'livrée', 'livrée', '2026-07-12 13:25:03.795896+00'),
	('6e9e049a-cb8b-4a14-8d71-d7df56582626', '3c87d258-1f5f-4982-b71e-c987ca811567', NULL, 'nouvelle', '2026-07-13 11:41:33.191433+00'),
	('cc64980d-864f-4fd6-846a-8d0ecfcaaf41', '3c87d258-1f5f-4982-b71e-c987ca811567', 'nouvelle', 'confirmée', '2026-07-13 13:05:20.551314+00'),
	('cc408616-7f97-4ef7-b387-178635b15db7', '83d6137e-e614-45db-987b-22677d9be9b3', NULL, 'nouvelle', '2026-07-13 15:09:12.887471+00'),
	('fdf4c76c-6035-4013-87dd-0d9446c188be', '3c87d258-1f5f-4982-b71e-c987ca811567', 'confirmée', 'en_preparation', '2026-07-13 17:04:19.316798+00'),
	('87a1f492-2f64-4159-a51e-7f605c820ae8', '3c87d258-1f5f-4982-b71e-c987ca811567', 'en_preparation', 'en_livraison', '2026-07-13 17:04:35.875691+00'),
	('4d3378cf-db5e-4fa2-8b27-ca8f4971faf0', '3c87d258-1f5f-4982-b71e-c987ca811567', 'en_livraison', 'livrée', '2026-07-13 17:04:43.313028+00'),
	('d1cf322d-2122-45cd-b49f-9356a5a9c5d7', '83d6137e-e614-45db-987b-22677d9be9b3', 'nouvelle', 'confirmée', '2026-07-13 17:04:53.345673+00'),
	('b3fba083-a01b-4b0b-82ad-7fd6d134b242', '83d6137e-e614-45db-987b-22677d9be9b3', 'confirmée', 'en_preparation', '2026-07-13 17:05:05.285587+00'),
	('b183665b-a9db-429a-9d2e-0161e7ada923', '3c87d258-1f5f-4982-b71e-c987ca811567', 'en_livraison', 'livrée', '2026-07-13 17:05:19.986781+00'),
	('6095236c-76df-4fff-bd16-59dc643a5514', '83d6137e-e614-45db-987b-22677d9be9b3', 'en_preparation', 'livrée', '2026-07-13 17:05:20.242675+00'),
	('40d210dd-16e7-44f5-8f3d-d9cee555003c', '83d6137e-e614-45db-987b-22677d9be9b3', 'en_preparation', 'livrée', '2026-07-13 17:05:20.422462+00'),
	('607ca743-e1c7-4923-ad9f-6c1ad756823b', 'c1ade1eb-3202-4692-a755-dd5717fdc7fb', NULL, 'nouvelle', '2026-07-15 11:17:08.014039+00'),
	('0357f783-6eb4-4a47-9fed-aa4556758849', 'c1ade1eb-3202-4692-a755-dd5717fdc7fb', 'nouvelle', 'confirmée', '2026-07-15 11:18:20.969957+00'),
	('a204ab48-059a-46bd-a07a-a721a883e78b', 'c1ade1eb-3202-4692-a755-dd5717fdc7fb', 'confirmée', 'en_preparation', '2026-07-15 11:18:39.326794+00'),
	('2b7930e2-51c3-44d1-8342-0d32aa7b9fd3', 'c1ade1eb-3202-4692-a755-dd5717fdc7fb', 'en_preparation', 'en_livraison', '2026-07-15 11:18:55.370102+00'),
	('301d6c24-1ccf-4642-aa1e-ae4ebbd4bc94', 'c1ade1eb-3202-4692-a755-dd5717fdc7fb', 'en_livraison', 'livrée', '2026-07-15 11:19:17.569329+00'),
	('547899ba-2c6a-49c1-a595-7074a252aa6c', 'c1ade1eb-3202-4692-a755-dd5717fdc7fb', 'en_livraison', 'livrée', '2026-07-15 11:19:18.290225+00'),
	('cbe628e0-165d-4c04-b453-c7dded36be1b', 'b904b7b4-e63c-44ef-80d6-3be3d56cefb8', NULL, 'nouvelle', '2026-07-15 12:08:32.230351+00'),
	('b9e33015-d8e8-402b-8252-807015f5ddac', 'b904b7b4-e63c-44ef-80d6-3be3d56cefb8', 'nouvelle', 'confirmée', '2026-07-15 12:09:46.568743+00'),
	('0b151cb7-52c7-4a10-85c1-8857ac778db2', 'b904b7b4-e63c-44ef-80d6-3be3d56cefb8', 'confirmée', 'en_preparation', '2026-07-15 12:10:15.397755+00'),
	('f078ce5b-355e-4000-ab3c-e67aadb29133', 'b904b7b4-e63c-44ef-80d6-3be3d56cefb8', 'en_preparation', 'livrée', '2026-07-15 13:06:32.79102+00'),
	('1968ba10-d34e-4853-bbce-099bbae3862d', '1b09c5b6-2e6c-41c8-b1ee-a5a1ab372f55', NULL, 'nouvelle', '2026-07-15 23:13:43.574058+00'),
	('475b9f5e-3c0b-45f5-9f09-a1b708c9f4b4', '1b09c5b6-2e6c-41c8-b1ee-a5a1ab372f55', 'nouvelle', 'confirmée', '2026-07-15 23:15:16.015446+00'),
	('6c8ab104-0906-4209-9d4d-8f5476cca0c5', '1b09c5b6-2e6c-41c8-b1ee-a5a1ab372f55', 'confirmée', 'en_preparation', '2026-07-15 23:15:32.683242+00'),
	('2f38bdca-eb1a-4d06-8c53-8059e9348e35', '1b09c5b6-2e6c-41c8-b1ee-a5a1ab372f55', 'en_preparation', 'en_livraison', '2026-07-15 23:16:08.391578+00'),
	('0a53e5e2-28e0-4925-b6cf-c86eeeabf7d9', '1b09c5b6-2e6c-41c8-b1ee-a5a1ab372f55', 'en_livraison', 'livrée', '2026-07-15 23:16:29.785565+00'),
	('5005a498-a1bf-4dc7-97b6-17268bfa704d', '91f4d0e2-74bb-4628-b4c0-68f3b7d71595', NULL, 'nouvelle', '2026-07-17 08:13:24.203699+00'),
	('3d853c23-370c-4abb-9827-05d6b5a4e4ff', '91f4d0e2-74bb-4628-b4c0-68f3b7d71595', 'nouvelle', 'confirmée', '2026-07-17 11:13:08.281533+00'),
	('81df641d-5495-4632-a1c0-623a8b2a6958', '91f4d0e2-74bb-4628-b4c0-68f3b7d71595', 'confirmée', 'en_preparation', '2026-07-17 12:37:18.756501+00'),
	('a18e444d-f3ed-4fd4-9714-250c5513a68e', '91f4d0e2-74bb-4628-b4c0-68f3b7d71595', 'en_preparation', 'livrée', '2026-07-17 12:47:58.791472+00'),
	('14f1ee35-b244-4e1a-9bbe-edab988bf59b', '91f4d0e2-74bb-4628-b4c0-68f3b7d71595', 'livrée', 'livrée', '2026-07-17 12:47:59.370164+00'),
	('363ab45d-afdf-478b-94bd-a0adcb8a3a04', '91f4d0e2-74bb-4628-b4c0-68f3b7d71595', 'livrée', 'livrée', '2026-07-17 12:48:15.93981+00'),
	('6691d11f-c3ed-401e-87f1-68869526c04d', '91f4d0e2-74bb-4628-b4c0-68f3b7d71595', 'livrée', 'livrée', '2026-07-17 12:48:16.475195+00'),
	('85180352-806c-4aa1-b097-c40f084d3f7b', '175022b9-a339-4b22-be16-7bb2d1fb8ce8', NULL, 'nouvelle', '2026-07-17 18:16:54.710714+00'),
	('f03ff591-a8f9-4063-94f1-2bcd62b4f769', '175022b9-a339-4b22-be16-7bb2d1fb8ce8', 'nouvelle', 'confirmée', '2026-07-17 18:17:45.733491+00'),
	('596ef083-54e6-43b7-a8cb-8fc707b87f46', '175022b9-a339-4b22-be16-7bb2d1fb8ce8', 'confirmée', 'en_preparation', '2026-07-17 18:18:13.446412+00'),
	('78a56ce4-cf68-44eb-9e4b-fbf2c46644a9', '175022b9-a339-4b22-be16-7bb2d1fb8ce8', 'en_preparation', 'en_livraison', '2026-07-17 18:28:39.319497+00'),
	('4d7698f3-18eb-4917-b780-8fee72d4ebc9', '175022b9-a339-4b22-be16-7bb2d1fb8ce8', 'en_livraison', 'livrée', '2026-07-17 18:29:11.206525+00'),
	('f4e97237-5d22-4c8d-af19-151a4be0f0f4', '175022b9-a339-4b22-be16-7bb2d1fb8ce8', 'en_livraison', 'livrée', '2026-07-17 18:29:11.882724+00'),
	('aab1bab1-1d88-4a2c-8958-eeba7d05174e', '9b34880b-e82d-4fd0-8360-4e638a5194e4', NULL, 'nouvelle', '2026-07-17 22:05:33.346516+00'),
	('f8de0fb4-c1b2-450a-920b-ac639bcc8c0c', '9b34880b-e82d-4fd0-8360-4e638a5194e4', 'nouvelle', 'confirmée', '2026-07-17 22:10:34.597024+00'),
	('925ff111-cc65-4f18-8ed4-262c291d8dc5', '9b34880b-e82d-4fd0-8360-4e638a5194e4', 'confirmée', 'en_preparation', '2026-07-17 22:10:57.766094+00'),
	('a6cc30de-1280-4e49-ab7b-15cd6c21e8d3', '9b34880b-e82d-4fd0-8360-4e638a5194e4', 'en_preparation', 'livrée', '2026-07-17 22:11:33.215676+00'),
	('e4c3e72c-b051-4142-98f5-904ac742a4e4', '9b34880b-e82d-4fd0-8360-4e638a5194e4', 'livrée', 'livrée', '2026-07-17 22:11:33.970403+00'),
	('b96907d2-bb70-4912-b1ed-31ab09832029', '2284d454-4797-442d-aa7e-256d759f4baa', NULL, 'nouvelle', '2026-07-17 22:56:05.839362+00'),
	('be3e2af3-75f9-4590-89db-0ac34acbfb6f', '2284d454-4797-442d-aa7e-256d759f4baa', 'nouvelle', 'confirmée', '2026-07-17 22:57:38.067379+00'),
	('0897b490-dd46-4af9-b330-70c8ed2470cf', '2284d454-4797-442d-aa7e-256d759f4baa', 'confirmée', 'en_preparation', '2026-07-17 22:58:00.960034+00'),
	('9594d989-29a1-4bed-846e-dd6d0bdfc007', '2284d454-4797-442d-aa7e-256d759f4baa', 'en_preparation', 'livrée', '2026-07-17 22:58:28.398532+00'),
	('6a277cd7-0230-41c0-a559-ad12e9353ece', '2284d454-4797-442d-aa7e-256d759f4baa', 'en_preparation', 'livrée', '2026-07-17 22:58:29.189238+00'),
	('88d917a7-4f3d-4d3c-b71a-4971709f49f9', '8e6826de-b58c-4fa5-926a-89c488f97cd4', NULL, 'nouvelle', '2026-07-18 15:06:10.641086+00'),
	('71d98cff-2e75-4784-bc54-b6879b5d5767', '8e6826de-b58c-4fa5-926a-89c488f97cd4', 'nouvelle', 'confirmée', '2026-07-18 15:13:34.812808+00'),
	('e7ac0d1e-6c16-47f9-b463-d6fad323ab2f', '8e6826de-b58c-4fa5-926a-89c488f97cd4', 'confirmée', 'en_preparation', '2026-07-18 15:56:09.469378+00'),
	('f9db97b6-49ad-47fb-8bd2-465b4749efba', '8e6826de-b58c-4fa5-926a-89c488f97cd4', 'en_preparation', 'en_livraison', '2026-07-18 16:20:22.479132+00'),
	('b0a6780e-5089-4793-9b10-4bd626dc6add', '8e6826de-b58c-4fa5-926a-89c488f97cd4', 'en_livraison', 'livrée', '2026-07-18 16:20:40.801519+00'),
	('3511cf72-c409-479d-a76e-414ce5dcc171', '8e6826de-b58c-4fa5-926a-89c488f97cd4', 'en_livraison', 'livrée', '2026-07-18 16:20:41.26586+00'),
	('cbe0455b-e41d-4306-af2f-54f8c25faace', 'ce3cbece-c3f9-4b25-ac76-13a103ba7128', NULL, 'nouvelle', '2026-07-18 18:33:27.71151+00'),
	('6e04533b-31f8-4511-a797-a9c399f8fb43', 'ce3cbece-c3f9-4b25-ac76-13a103ba7128', 'nouvelle', 'confirmée', '2026-07-18 18:40:00.827161+00'),
	('65c0136f-24b6-46f9-ab1c-4d912efa6dc2', 'ce3cbece-c3f9-4b25-ac76-13a103ba7128', 'confirmée', 'en_preparation', '2026-07-18 20:20:28.251049+00'),
	('dea6a0f0-6d83-45bc-8a9b-7e90efc9edbb', 'ce3cbece-c3f9-4b25-ac76-13a103ba7128', 'en_preparation', 'livrée', '2026-07-18 20:21:35.429341+00'),
	('a9e31699-bcdf-4e47-ac8b-2eec6873ad70', '23c3ede7-9d82-478a-a608-89b970ae4a74', NULL, 'nouvelle', '2026-07-19 12:24:29.351074+00'),
	('68d4cb47-a4f8-4963-bcee-b26d898aa6de', '23c3ede7-9d82-478a-a608-89b970ae4a74', 'nouvelle', 'confirmée', '2026-07-19 13:30:33.704036+00'),
	('9f22fa4f-0513-425e-aa9a-9f8f6dc65c40', '23c3ede7-9d82-478a-a608-89b970ae4a74', 'confirmée', 'en_preparation', '2026-07-19 13:30:59.474957+00'),
	('ced8d605-e72b-4ab1-9e25-ebbf4aed5435', '23c3ede7-9d82-478a-a608-89b970ae4a74', 'en_preparation', 'en_livraison', '2026-07-19 13:32:54.501241+00'),
	('7554192f-d7a4-4301-bb76-796db9f82d63', '23c3ede7-9d82-478a-a608-89b970ae4a74', 'livrée', 'livrée', '2026-07-19 13:33:06.94119+00'),
	('fdbd5245-fc45-4182-8b0f-6815db63b95d', '6012330e-716c-4d6a-a1ec-a1f6a657839e', NULL, 'nouvelle', '2026-07-20 21:31:02.282167+00'),
	('9b64728e-bc6c-4b78-8283-3307434bfa41', '6012330e-716c-4d6a-a1ec-a1f6a657839e', 'nouvelle', 'confirmée', '2026-07-20 21:33:07.85604+00'),
	('4b10164e-c381-4d31-bbba-ff9c2d73de7b', '6012330e-716c-4d6a-a1ec-a1f6a657839e', 'confirmée', 'en_preparation', '2026-07-20 21:35:58.305155+00'),
	('80eacd82-4050-4bf4-abf6-702035807190', '6012330e-716c-4d6a-a1ec-a1f6a657839e', 'en_preparation', 'en_livraison', '2026-07-20 21:36:35.593902+00'),
	('80193265-31c9-4e0d-9fa1-67af867e75df', '6012330e-716c-4d6a-a1ec-a1f6a657839e', 'en_livraison', 'livrée', '2026-07-20 21:37:44.968918+00'),
	('8260df3f-04d0-43e1-ba42-0cf52393a10d', '6012330e-716c-4d6a-a1ec-a1f6a657839e', 'en_livraison', 'livrée', '2026-07-20 21:37:45.740307+00'),
	('b228f41d-f8d8-4e0c-a2cc-f5f09e3332e9', '9e4846f2-2162-4c1c-bed7-1dece17ad726', NULL, 'nouvelle', '2026-07-22 13:12:27.549777+00'),
	('8d0af15c-a47f-4511-88ae-e79c96e35066', '9e4846f2-2162-4c1c-bed7-1dece17ad726', 'nouvelle', 'confirmée', '2026-07-22 13:34:50.541666+00'),
	('4ec86441-0a54-46f2-b985-6a2624aed7ab', '9e4846f2-2162-4c1c-bed7-1dece17ad726', 'confirmée', 'en_preparation', '2026-07-22 13:35:01.251205+00'),
	('2909729f-c3a0-4ea3-ae88-3e4ad6ce7648', '9e4846f2-2162-4c1c-bed7-1dece17ad726', 'en_preparation', 'en_livraison', '2026-07-22 13:35:14.081502+00'),
	('659fd77a-bcb9-4c3e-952d-dd14f4cd26ec', '9e4846f2-2162-4c1c-bed7-1dece17ad726', 'en_livraison', 'livrée', '2026-07-22 17:54:01.000658+00'),
	('bf78da1d-5cf5-4917-a8c2-904d168d09c4', '9e4846f2-2162-4c1c-bed7-1dece17ad726', 'en_livraison', 'livrée', '2026-07-22 17:54:01.600308+00'),
	('a93aeb28-257d-4015-bf2d-9d63413e02ae', '9e5a37fb-109e-4d9e-95ee-7beabe2ae969', NULL, 'nouvelle', '2026-07-22 19:14:49.21175+00'),
	('9ed264cb-2b60-40bf-abcc-af6cab57475a', '9e5a37fb-109e-4d9e-95ee-7beabe2ae969', 'nouvelle', 'confirmée', '2026-07-22 22:56:44.925153+00'),
	('b0fb0472-699f-4858-ab8a-0dead4fda73e', '9e5a37fb-109e-4d9e-95ee-7beabe2ae969', 'confirmée', 'en_preparation', '2026-07-22 22:56:56.653768+00'),
	('829e08f3-52cd-48fc-ac30-7e2c1b853394', '9e5a37fb-109e-4d9e-95ee-7beabe2ae969', 'en_preparation', 'livrée', '2026-07-22 22:57:05.155935+00'),
	('4a19b3ec-0bc6-4ac6-8df7-de74b0852fb8', '9e5a37fb-109e-4d9e-95ee-7beabe2ae969', 'en_preparation', 'livrée', '2026-07-22 22:57:19.92694+00'),
	('ec87ddad-8ff0-4cfb-9ad9-146dbd7a2221', 'ccb7dae8-3930-418c-b9a5-09c9a1e28e74', NULL, 'nouvelle', '2026-07-24 16:30:45.209753+00'),
	('a25f7f06-bd8d-43f8-95d8-fd07947c9a99', 'ccb7dae8-3930-418c-b9a5-09c9a1e28e74', 'nouvelle', 'confirmée', '2026-07-24 17:08:06.455004+00'),
	('bd0dda10-26f1-47bb-88b8-1282cbb4aa3d', 'ccb7dae8-3930-418c-b9a5-09c9a1e28e74', 'confirmée', 'en_preparation', '2026-07-24 17:08:17.72058+00'),
	('791619d0-b6b0-420e-bdb3-5c3df4529cfe', 'ccb7dae8-3930-418c-b9a5-09c9a1e28e74', 'en_preparation', 'en_livraison', '2026-07-24 17:56:38.067749+00'),
	('2e61209e-8424-47fe-8490-720d4cee1fbf', 'ccb7dae8-3930-418c-b9a5-09c9a1e28e74', 'en_livraison', 'livrée', '2026-07-24 17:58:16.476377+00'),
	('0c49fa91-4e2c-4fd2-bf13-1ab5d5cbebc4', 'ccb7dae8-3930-418c-b9a5-09c9a1e28e74', 'en_livraison', 'livrée', '2026-07-24 17:58:17.168271+00'),
	('dd62cae9-a0f9-4aae-8112-b47f48b45460', '28b0fe76-9a90-46c9-a466-3c7f819c33f5', NULL, 'nouvelle', '2026-07-27 11:00:26.535301+00'),
	('59515775-14e8-47fa-b246-9de57aaadd2d', '28b0fe76-9a90-46c9-a466-3c7f819c33f5', 'nouvelle', 'confirmée', '2026-07-27 12:09:54.440441+00'),
	('8b9dc3c0-736e-403d-9956-c6c80f168f78', '28b0fe76-9a90-46c9-a466-3c7f819c33f5', 'confirmée', 'en_preparation', '2026-07-27 12:14:53.437557+00'),
	('c22af513-e9d1-49e2-8a93-32344fa07053', '28b0fe76-9a90-46c9-a466-3c7f819c33f5', 'en_preparation', 'en_livraison', '2026-07-27 12:15:24.865383+00'),
	('c7d13801-53f1-46fd-8bcb-8dc4536b3b49', '28b0fe76-9a90-46c9-a466-3c7f819c33f5', 'en_livraison', 'livrée', '2026-07-27 12:15:38.474605+00'),
	('5e5b9b0b-e0e0-4fc5-bc5f-25bef753ac33', 'c6548c46-e9be-4189-9675-ba09c5635deb', NULL, 'nouvelle', '2026-07-28 08:15:29.882531+00'),
	('fdd21349-b2ce-49cb-b3a9-68dc10b49b9c', 'c6548c46-e9be-4189-9675-ba09c5635deb', 'nouvelle', 'confirmée', '2026-07-28 08:17:06.349217+00'),
	('6ce2905a-a118-4740-ba25-f6119a77ce33', 'c6548c46-e9be-4189-9675-ba09c5635deb', 'confirmée', 'en_preparation', '2026-07-28 11:57:51.963255+00'),
	('a5bc2607-7022-43d8-9827-4fd7fc5055eb', 'c6548c46-e9be-4189-9675-ba09c5635deb', 'en_preparation', 'en_livraison', '2026-07-28 11:58:09.412149+00'),
	('817385c6-7d8d-4835-b50e-161d7e6c3ded', 'c6548c46-e9be-4189-9675-ba09c5635deb', 'en_livraison', 'livrée', '2026-07-28 11:58:18.647453+00'),
	('e6d61297-dcbf-4b72-b71f-bea0dfa77ae9', 'c6548c46-e9be-4189-9675-ba09c5635deb', 'en_livraison', 'livrée', '2026-07-28 11:58:19.060153+00'),
	('02b1dbb4-9260-4f52-aca6-34d71be6d294', '31e28d08-1a9e-4dec-8ceb-b956223c3246', NULL, 'nouvelle', '2026-07-28 15:04:46.605979+00'),
	('19cc6c5e-c087-49d7-a208-b857133ef9a3', '31e28d08-1a9e-4dec-8ceb-b956223c3246', 'nouvelle', 'confirmée', '2026-07-28 15:05:17.051855+00'),
	('9154c92c-e6b8-409a-9902-048d6e9a0a8c', '31e28d08-1a9e-4dec-8ceb-b956223c3246', 'confirmée', 'en_preparation', '2026-07-28 15:05:34.497577+00'),
	('905a360d-20e9-407e-985b-43c7db38983d', '31e28d08-1a9e-4dec-8ceb-b956223c3246', 'en_preparation', 'en_livraison', '2026-07-28 15:06:00.350132+00'),
	('89e21850-8684-4919-8b67-943d2d47a10e', '31e28d08-1a9e-4dec-8ceb-b956223c3246', 'en_livraison', 'annulée', '2026-07-28 15:09:23.07016+00'),
	('7c255c85-c88e-40b1-9ceb-0ed8a37bb085', '83bc1b48-5542-4f58-bc3b-43ca6eb45b27', NULL, 'nouvelle', '2026-07-29 12:32:20.263036+00'),
	('c5560cc9-00af-45b0-9c5f-fadd0d6eb874', 'b04b0872-98d7-43d8-81a8-2b93771a6a02', NULL, 'nouvelle', '2026-07-29 12:34:01.789325+00'),
	('0892d46d-a64a-4c33-b111-66b52e10f040', '83bc1b48-5542-4f58-bc3b-43ca6eb45b27', 'nouvelle', 'confirmée', '2026-07-29 12:47:51.891257+00'),
	('4f4623dc-f40d-4f56-b96b-a240c2d843a3', '83bc1b48-5542-4f58-bc3b-43ca6eb45b27', 'confirmée', 'en_preparation', '2026-07-29 12:48:01.880817+00'),
	('f454cc5e-2455-4ef4-8fac-df43179a00ac', 'b04b0872-98d7-43d8-81a8-2b93771a6a02', 'nouvelle', 'annulée', '2026-07-29 12:48:18.853984+00'),
	('a0765195-486c-489d-969b-0b55e4c90eca', '83bc1b48-5542-4f58-bc3b-43ca6eb45b27', 'en_preparation', 'livrée', '2026-07-29 14:40:21.428074+00'),
	('cd808097-c228-4def-92d2-f7c298b2c406', '83bc1b48-5542-4f58-bc3b-43ca6eb45b27', 'livrée', 'livrée', '2026-07-29 14:40:21.98178+00'),
	('bc992a41-1eac-4f24-868f-e78c2472b9b2', 'a7b7f9a0-4552-4818-a51e-0516ecc4892a', NULL, 'nouvelle', '2026-07-29 18:08:35.723677+00'),
	('6a59f06b-47da-4990-9add-a524936d54b7', 'a7b7f9a0-4552-4818-a51e-0516ecc4892a', 'nouvelle', 'confirmée', '2026-07-29 18:11:05.42029+00'),
	('9e34bd7b-1e5d-428a-8aa4-e670485c57d7', 'a7b7f9a0-4552-4818-a51e-0516ecc4892a', 'confirmée', 'en_preparation', '2026-07-29 18:48:38.362633+00'),
	('dd42fbe4-2451-4a7b-8be9-4cbe29a538d2', 'a7b7f9a0-4552-4818-a51e-0516ecc4892a', 'en_preparation', 'en_livraison', '2026-07-29 18:49:05.727651+00'),
	('8559bd57-188c-4401-aa5b-a50c1a3c5a05', '13affa84-977f-4b60-a430-5d2940505989', NULL, 'nouvelle', '2026-07-29 21:46:08.671197+00'),
	('729c63c5-f8c7-4fe2-a37b-d4001f537d3c', '13affa84-977f-4b60-a430-5d2940505989', 'nouvelle', 'confirmée', '2026-07-29 22:08:20.695779+00'),
	('0244071b-6559-430c-bff1-7c14850342ed', '13affa84-977f-4b60-a430-5d2940505989', 'confirmée', 'en_preparation', '2026-07-29 22:08:41.845742+00'),
	('4e9831fe-5148-4149-817d-71e34362c8c3', '13affa84-977f-4b60-a430-5d2940505989', 'en_preparation', 'en_livraison', '2026-07-29 22:11:07.271776+00'),
	('2e9fcf88-841c-42b5-8c39-01dfc9e3e59e', '13affa84-977f-4b60-a430-5d2940505989', 'en_livraison', 'livrée', '2026-07-29 22:19:54.138822+00'),
	('0bb85a13-823d-4d2d-8486-75589080e1a5', 'a7b7f9a0-4552-4818-a51e-0516ecc4892a', 'en_livraison', 'livrée', '2026-07-30 17:56:46.44693+00'),
	('49369cb6-585e-462b-9a64-dd39b503d71b', 'a7b7f9a0-4552-4818-a51e-0516ecc4892a', 'en_livraison', 'livrée', '2026-07-30 17:56:46.450408+00'),
	('43462f5d-7709-44e1-99c0-0aa1617a5035', '7fda0484-8091-4457-885e-8bbedca5054c', NULL, 'nouvelle', '2026-08-01 08:39:02.597708+00'),
	('c65f474b-5705-4e70-863c-faf058777b49', '7fda0484-8091-4457-885e-8bbedca5054c', 'nouvelle', 'confirmée', '2026-08-01 08:39:45.454941+00'),
	('85f32033-59b9-442c-8454-c77bed80100a', '7fda0484-8091-4457-885e-8bbedca5054c', 'confirmée', 'en_preparation', '2026-08-01 08:40:18.425538+00'),
	('5f605f6b-c05b-4d14-804d-1f9c5a68aeb0', '7fda0484-8091-4457-885e-8bbedca5054c', 'en_livraison', 'livrée', '2026-08-01 10:03:26.502936+00'),
	('3674f02b-8f88-4b5a-900a-1bb6e4d9a0ff', '7fda0484-8091-4457-885e-8bbedca5054c', 'en_livraison', 'livrée', '2026-08-01 10:03:27.24566+00'),
	('4b332d54-ea9f-4f70-be4e-f4ecb68f29b0', 'a3f65dc1-f3a3-4c56-a696-93575f0714e1', NULL, 'nouvelle', '2026-08-02 11:55:32.79056+00'),
	('6efe5c73-853e-4abb-81fa-2ec8d204b920', 'a3f65dc1-f3a3-4c56-a696-93575f0714e1', 'nouvelle', 'confirmée', '2026-08-02 11:55:59.721791+00'),
	('8208d8d3-ea26-40db-b815-a591e78e4b17', 'a3f65dc1-f3a3-4c56-a696-93575f0714e1', 'confirmée', 'en_preparation', '2026-08-02 11:56:16.90622+00'),
	('2649b97f-747f-479e-8141-3c2b547faefd', 'a3f65dc1-f3a3-4c56-a696-93575f0714e1', 'en_preparation', 'livrée', '2026-08-02 11:56:31.730155+00'),
	('b08c65d3-8038-4d59-8428-e05313cbc8ea', 'a3f65dc1-f3a3-4c56-a696-93575f0714e1', 'livrée', 'livrée', '2026-08-02 11:56:32.498853+00'),
	('893e2338-8347-461e-b27c-bc3587fb9176', '46d4678b-f095-4ac5-b593-fcee2c510d19', NULL, 'nouvelle', '2026-08-02 12:32:12.003508+00'),
	('3d8b6c04-a515-4332-a077-c016f386e21e', '46d4678b-f095-4ac5-b593-fcee2c510d19', 'nouvelle', 'confirmée', '2026-08-02 12:32:30.18455+00'),
	('3f36ef6e-b106-4e58-b8d0-d5f871ca24b8', '46d4678b-f095-4ac5-b593-fcee2c510d19', 'confirmée', 'en_preparation', '2026-08-02 12:32:41.076883+00'),
	('517f574e-847c-49e1-83b6-a60e69a8c463', '46d4678b-f095-4ac5-b593-fcee2c510d19', 'en_preparation', 'livrée', '2026-08-02 12:32:49.790224+00'),
	('e070ecd4-1804-4c5a-9c6f-35d95d75433c', '46d4678b-f095-4ac5-b593-fcee2c510d19', 'en_preparation', 'livrée', '2026-08-02 12:32:50.141393+00'),
	('86cf2ee6-cb1c-4b45-9b21-220ebd37241b', 'b6a91c13-7ee2-4b02-92be-969573e9cbf8', NULL, 'nouvelle', '2026-08-02 20:59:25.111508+00'),
	('24ccee5a-e4c8-42ef-ac4f-58ab41050182', '0c4a9514-7265-410a-8e50-43470f3b6d29', NULL, 'nouvelle', '2026-08-02 20:59:30.252849+00'),
	('22b0f0d3-d6dc-4793-b25f-c7cd9e4f7d6c', '0c4a9514-7265-410a-8e50-43470f3b6d29', 'nouvelle', 'annulée', '2026-08-02 21:00:39.135848+00'),
	('55ac626e-0d9d-4919-8a95-3224caa0ccb5', 'b6a91c13-7ee2-4b02-92be-969573e9cbf8', 'nouvelle', 'annulée', '2026-08-02 21:00:50.858849+00'),
	('900236a1-c389-4d4c-b119-502ee82015d5', 'bd2acf48-216c-4d2a-8a20-2a888a0b54b9', NULL, 'nouvelle', '2026-08-03 11:45:24.565624+00'),
	('f87d90b9-3e14-4697-b897-a12ff37fafb8', 'bd2acf48-216c-4d2a-8a20-2a888a0b54b9', 'nouvelle', 'confirmée', '2026-08-03 11:46:35.660329+00'),
	('fa37619f-5438-4ecf-a712-39aa2142b85e', 'bd2acf48-216c-4d2a-8a20-2a888a0b54b9', 'confirmée', 'en_preparation', '2026-08-03 11:47:02.650292+00'),
	('ee66cd7a-4374-441d-afa7-86ed49bf3f67', 'bd2acf48-216c-4d2a-8a20-2a888a0b54b9', 'en_preparation', 'en_livraison', '2026-08-03 11:47:24.02592+00'),
	('97e3b727-4180-45db-a02f-fad7f8044a07', 'bd2acf48-216c-4d2a-8a20-2a888a0b54b9', 'en_livraison', 'livrée', '2026-08-03 13:14:52.634296+00'),
	('d909eb16-27c1-4223-9ca3-7dc25b63afde', 'bd2acf48-216c-4d2a-8a20-2a888a0b54b9', 'livrée', 'livrée', '2026-08-03 13:14:53.234672+00'),
	('255a20ec-23f1-4c23-a770-37edcf3bf468', '74379553-5405-46ad-a766-20d9c20a90d7', NULL, 'nouvelle', '2026-08-03 15:47:37.733529+00'),
	('71100c01-72d4-44ba-8f2b-2d370f2e54c9', '74379553-5405-46ad-a766-20d9c20a90d7', 'nouvelle', 'confirmée', '2026-08-03 15:48:46.313079+00'),
	('72e9d736-87c4-4065-94f9-6d92ae521a06', '74379553-5405-46ad-a766-20d9c20a90d7', 'confirmée', 'en_preparation', '2026-08-03 15:49:05.323957+00'),
	('e728ba71-8377-4d38-b6c5-6544320b5545', '74379553-5405-46ad-a766-20d9c20a90d7', 'en_preparation', 'livrée', '2026-08-03 16:17:35.926357+00'),
	('c93306c1-08f2-4d83-bfb0-cae12f8c1dcb', '74379553-5405-46ad-a766-20d9c20a90d7', 'livrée', 'livrée', '2026-08-03 16:17:37.635667+00'),
	('3a3a7851-49d8-40e4-a3b3-3841256a2f21', '2ced81c4-130a-4e5f-b35c-ee98aa57646e', NULL, 'nouvelle', '2026-08-04 08:33:10.296271+00'),
	('59b93579-40ba-4f93-9fce-361ca48bd6d6', '2ced81c4-130a-4e5f-b35c-ee98aa57646e', 'nouvelle', 'confirmée', '2026-08-04 08:34:32.129774+00'),
	('ea92fa69-9d8f-4317-9141-55c73c9c3756', '2ced81c4-130a-4e5f-b35c-ee98aa57646e', 'confirmée', 'en_preparation', '2026-08-04 10:41:34.359795+00'),
	('ec5cb34d-5e85-4500-b13a-d7a738c29221', '2ced81c4-130a-4e5f-b35c-ee98aa57646e', 'en_preparation', 'en_livraison', '2026-08-04 10:41:45.029992+00'),
	('58dab318-5277-4195-8ee7-b38dcbf2ad62', '2ced81c4-130a-4e5f-b35c-ee98aa57646e', 'en_livraison', 'livrée', '2026-08-04 10:41:52.205593+00'),
	('0b0cf0c7-9f09-4901-82fd-4450eaf87b13', '2ced81c4-130a-4e5f-b35c-ee98aa57646e', 'en_livraison', 'livrée', '2026-08-04 10:41:52.359483+00'),
	('d541e9eb-c8b4-453f-b012-018d383f441b', 'e12cc537-5479-4cc3-93e6-e2713bbd0658', NULL, 'nouvelle', '2026-08-04 11:11:10.459189+00'),
	('e8858f50-c471-46df-9cf1-a3fc5fa84cd7', 'e12cc537-5479-4cc3-93e6-e2713bbd0658', 'nouvelle', 'annulée', '2026-08-04 11:11:37.824986+00'),
	('7abe9ecc-97f6-4323-b143-2226f8bcec14', '05f6446d-9428-406f-9bcd-3c8dd4507d56', NULL, 'nouvelle', '2026-08-06 12:14:06.494594+00'),
	('823a03e4-3820-463a-8fa6-e9d13fd6c29f', '05f6446d-9428-406f-9bcd-3c8dd4507d56', 'nouvelle', 'confirmée', '2026-08-06 12:38:35.185666+00'),
	('2eca0778-8218-453b-9a84-2af09acae222', '05f6446d-9428-406f-9bcd-3c8dd4507d56', 'confirmée', 'en_preparation', '2026-08-06 12:49:17.870491+00'),
	('64919d57-6213-4759-aa53-b21f7f807bed', '05f6446d-9428-406f-9bcd-3c8dd4507d56', 'en_preparation', 'en_livraison', '2026-08-06 12:50:44.229891+00'),
	('b00eef0b-9231-488e-9d6a-bc8a96e7ca17', '05f6446d-9428-406f-9bcd-3c8dd4507d56', 'en_livraison', 'livrée', '2026-08-06 12:50:44.872151+00'),
	('86df7c64-2218-4477-b8b6-9325ae88b518', '05f6446d-9428-406f-9bcd-3c8dd4507d56', 'en_livraison', 'livrée', '2026-08-06 12:50:51.060161+00'),
	('60bdf136-52df-49cf-b597-ccdb506e1066', 'c3dbdf5e-e971-49ff-92a7-c16791b01406', NULL, 'nouvelle', '2026-08-08 20:05:03.825728+00'),
	('1a167589-92f1-4e24-9bd6-23a848fc0d08', 'c3dbdf5e-e971-49ff-92a7-c16791b01406', 'nouvelle', 'confirmée', '2026-08-08 20:15:43.712263+00'),
	('7c025396-43ed-48fa-881d-150896b58cdf', 'c3dbdf5e-e971-49ff-92a7-c16791b01406', 'confirmée', 'en_preparation', '2026-08-08 20:16:06.489375+00'),
	('3bbfa1b1-2213-478d-9a4f-7a7ac0acd97a', 'c3dbdf5e-e971-49ff-92a7-c16791b01406', 'en_preparation', 'livrée', '2026-08-08 20:44:15.993552+00'),
	('c8198c1c-e73c-4854-94bd-4c15a86fc323', 'c3dbdf5e-e971-49ff-92a7-c16791b01406', 'livrée', 'livrée', '2026-08-08 20:44:16.380514+00'),
	('4ea3f30e-29a5-406a-9027-a44e3fbb0944', 'bf656cb2-0ab9-44dc-8338-7235c0a981ac', NULL, 'nouvelle', '2026-08-09 11:03:02.287583+00'),
	('4daa2e35-5ab0-40bc-9faa-feb9cf20a0f3', 'bf656cb2-0ab9-44dc-8338-7235c0a981ac', 'nouvelle', 'confirmée', '2026-08-09 11:03:38.440581+00'),
	('72cdc895-b3fa-4658-ab53-38998451447a', 'bf656cb2-0ab9-44dc-8338-7235c0a981ac', 'confirmée', 'en_preparation', '2026-08-09 11:16:29.866282+00'),
	('4506a9b5-65b1-466a-b438-3e673aebd261', 'bf656cb2-0ab9-44dc-8338-7235c0a981ac', 'en_preparation', 'en_livraison', '2026-08-09 11:16:59.275071+00'),
	('5caebc86-1ca8-4ba8-a24c-fa420f289d95', 'bf656cb2-0ab9-44dc-8338-7235c0a981ac', 'en_livraison', 'livrée', '2026-08-09 12:03:53.696407+00'),
	('8a36b111-d21c-4c5d-a646-652dfc7d9995', 'bf656cb2-0ab9-44dc-8338-7235c0a981ac', 'livrée', 'livrée', '2026-08-09 12:03:54.455238+00'),
	('0a4a4b12-65dd-4afb-aa3f-63712c1b520a', 'bbeb34b7-611b-40bf-8aa6-c17a02594d83', NULL, 'nouvelle', '2026-08-11 11:59:48.310936+00'),
	('5bb870d1-42d4-49f4-be41-018902792ce4', 'bbeb34b7-611b-40bf-8aa6-c17a02594d83', 'nouvelle', 'confirmée', '2026-08-11 15:01:26.861858+00'),
	('d33916e5-d7d7-4874-aab9-b8ce8007876d', 'f50f09c1-5235-41bb-8b28-a51c9274e0a8', NULL, 'nouvelle', '2026-08-11 16:34:38.673006+00'),
	('cfc80c58-b614-4be5-9615-1cfe0a4bf18d', 'f50f09c1-5235-41bb-8b28-a51c9274e0a8', 'nouvelle', 'confirmée', '2026-08-11 17:00:43.625313+00'),
	('d2a20e1f-9622-432f-9dda-a14f346298d6', 'bbeb34b7-611b-40bf-8aa6-c17a02594d83', 'confirmée', 'en_preparation', '2026-08-11 17:00:57.013992+00'),
	('92755ef2-e4f5-4b13-a862-a632f8fc282b', 'bbeb34b7-611b-40bf-8aa6-c17a02594d83', 'en_preparation', 'livrée', '2026-08-11 17:01:05.791743+00'),
	('c1047ee5-61a9-4d17-8e30-397ae13a93b6', 'bbeb34b7-611b-40bf-8aa6-c17a02594d83', 'en_preparation', 'livrée', '2026-08-11 17:01:06.103951+00'),
	('b5f774ce-cc2b-4e7e-b546-993c6041682b', 'f50f09c1-5235-41bb-8b28-a51c9274e0a8', 'confirmée', 'en_preparation', '2026-08-11 17:01:21.494265+00'),
	('6999020d-30ee-4391-8814-b480ffcafa4b', 'f50f09c1-5235-41bb-8b28-a51c9274e0a8', 'en_preparation', 'en_livraison', '2026-08-11 17:01:51.630151+00');


--
-- Data for Name: platform_connexions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."platform_connexions" ("id", "type", "client_phone", "shop_id", "session_id", "user_agent", "created_at") VALUES
	('4603d838-4d5c-4a50-97a3-defdf9dd7c46', 'classique_visite', NULL, NULL, 'd21f98a7-a390-44a2-a09b-819e4ba1150e', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-01 10:23:27.778941+00'),
	('9394a2c4-54b3-4079-b716-22437afb26ef', 'classique_visite', NULL, NULL, 'd9eab254-0f69-4907-bec3-6dac4ae2034b', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-01 23:25:22.71779+00'),
	('c45fe426-3de2-4863-bcc5-d68259cde9b7', 'classique_visite', NULL, NULL, 'edd99c00-7bf1-4baf-9eba-19312763cba0', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) martch-dev-hub-desktop/0.1.0 Chrome/126.0.6478.234 Electron/31.7.7 Safari/537.36', '2026-07-02 01:23:12.963306+00'),
	('23a294e3-f04c-469a-ba01-4af5b04362b7', 'classique_visite', NULL, NULL, 'ec1b2058-3d56-4213-85d1-cf9c1584ad72', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) martch-dev-hub-desktop/0.1.0 Chrome/126.0.6478.234 Electron/31.7.7 Safari/537.36', '2026-07-02 02:21:01.006867+00'),
	('f63e486b-328b-42c8-a56a-55fa122217c8', 'classique_visite', NULL, NULL, '814dc8d8-417f-4f72-96b2-5c3de2318785', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-02 08:25:24.798501+00'),
	('61d1ac06-e17b-48f5-8c08-46ac3d93fb1f', 'classique_visite', NULL, NULL, 'fd899a6c-a476-4886-9da8-c99251aecee9', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-02 08:25:30.905227+00'),
	('f20f0e02-e24d-4f93-b057-6346acfaba9c', 'vip', '+243810979710', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-02 08:25:36.811842+00'),
	('faf08273-1a03-4e10-9405-33f9427a259b', 'classique_commande', '+243810979710', NULL, NULL, NULL, '2026-07-02 08:26:01.845935+00'),
	('6c483e4e-7902-46f3-957f-ce04bc9e7e2d', 'classique_visite', NULL, NULL, '484e6a71-7893-4599-84ff-e4b2ca60b0c7', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-02 08:27:29.824153+00'),
	('d3ff8d88-3a10-45ba-916a-f3b0bec27095', 'classique_visite', NULL, NULL, '113e32c6-d51a-4d14-be64-b5a805b8b946', 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/149.0.7827.137 Mobile/15E148 Safari/604.1', '2026-07-02 11:18:58.656258+00'),
	('70434c7a-96d4-4d85-94d0-b1e619e36123', 'classique_visite', NULL, NULL, '3e7c1e56-9aa6-4284-9aa5-ff4ada00d53e', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1', '2026-07-02 11:22:08.994765+00'),
	('20767602-1656-4ab1-a753-31492c50043f', 'classique_visite', NULL, NULL, '167f61db-27c6-4771-a9dd-faa1a282a0fe', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1', '2026-07-02 12:02:20.013398+00'),
	('aaf4df42-36f1-47e7-9dcf-8e02f4613f46', 'vip', '+243822809942', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1', '2026-07-02 12:04:48.264705+00'),
	('1f2d704e-362e-4542-9926-af1d34bb5169', 'classique_commande', '+243822809942', NULL, NULL, NULL, '2026-07-02 12:16:15.989702+00'),
	('58a5f19f-c26c-4431-945a-15dfcb4e3aab', 'classique_visite', NULL, NULL, '8034aef6-71db-4254-bca0-c7f2e0e16a94', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-07-02 12:24:04.800907+00'),
	('6c9f2b81-5054-4156-ab18-79b348bfef4a', 'vip', '+243904557411', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-07-02 12:24:08.940788+00'),
	('1e031055-c910-4654-976f-9ec382d4084d', 'classique_visite', NULL, NULL, '2cb29d31-7c76-4868-9a15-dec3145ffe33', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) martch-dev-hub-desktop/0.1.0 Chrome/126.0.6478.234 Electron/31.7.7 Safari/537.36', '2026-07-02 12:24:10.64585+00'),
	('16c6f063-0049-472c-9f32-4b5452e1eca0', 'classique_commande', '+243904557411', NULL, NULL, NULL, '2026-07-02 12:25:15.453689+00'),
	('25032b8a-df71-4930-b202-549e96180fe4', 'classique_visite', NULL, NULL, '52ed0bc4-542a-405e-bb62-2ca0c1c8c77b', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) martch-dev-hub-desktop/0.1.0 Chrome/126.0.6478.234 Electron/31.7.7 Safari/537.36', '2026-07-02 12:40:25.584518+00'),
	('0da35f0c-d86a-4336-aed7-b576ed69f0fb', 'classique_visite', NULL, NULL, 'd6c5fe3b-3254-4952-ad6f-e591d2f01cd1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) martch-dev-hub-desktop/0.1.0 Chrome/126.0.6478.234 Electron/31.7.7 Safari/537.36', '2026-07-02 12:47:49.549818+00'),
	('9fbf8497-f6ff-4588-b8fa-872662d40f4f', 'classique_visite', NULL, NULL, '317f0dfb-e5f2-406d-8ddb-27b58feb0ca6', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) martch-dev-hub-desktop/0.1.0 Chrome/126.0.6478.234 Electron/31.7.7 Safari/537.36', '2026-07-02 13:27:55.265722+00'),
	('b179041a-7d56-4be7-9f49-1a84a821e668', 'classique_visite', NULL, NULL, '042ed64f-34fe-414c-a971-6117f382c06c', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-02 13:31:20.272493+00'),
	('ebc94665-c6b3-4887-91cd-485214c78d6a', 'classique_visite', NULL, NULL, 'f26b728f-5465-439c-adf9-57077dcedcb1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-02 13:39:18.810535+00'),
	('0c11a21d-c8dc-493b-b597-adfd6c33cd13', 'vip', '+243855764821', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-02 13:40:38.779896+00'),
	('ed3c301d-ac3d-4ddd-a082-a8e1ca37d8f2', 'classique_commande', '+243855764821', NULL, NULL, NULL, '2026-07-02 13:48:10.241912+00'),
	('48577362-45b3-4fc7-8eae-2f16384d6fc3', 'classique_visite', NULL, NULL, 'c949c8b9-6e68-42d8-a5e4-17347b0f7c61', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-02 14:31:39.364045+00'),
	('3cd7be64-10d3-468a-8237-24f04ddff7f0', 'classique_visite', NULL, NULL, '3243d2dd-eb9a-430c-ae2e-39710ad88450', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-02 14:31:51.721219+00'),
	('7341c0c5-9549-49c3-879e-407ea27db4f9', 'classique_visite', NULL, NULL, '598d98b9-0b4e-4961-aa9e-e6f5f1c28094', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-02 14:32:34.990348+00'),
	('5ea1fa4e-f86c-4216-a425-77c2414ae2a2', 'classique_visite', NULL, NULL, '8879275b-e178-4fca-ab3e-3fe38d378bb5', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-02 14:48:43.016015+00'),
	('22a0ac65-2b06-4fb8-a0d8-67583df53ebf', 'classique_visite', NULL, NULL, 'a6adbb3a-ff79-4a4d-bfbf-68ed979d822a', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-02 15:19:42.985205+00'),
	('5f39e001-a25d-4123-8e4b-94af0b433657', 'classique_visite', NULL, NULL, '83f2abb4-772d-4680-a304-81d8ddd7e6f3', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) martch-dev-hub-desktop/0.1.0 Chrome/126.0.6478.234 Electron/31.7.7 Safari/537.36', '2026-07-02 16:15:49.491829+00'),
	('b1cb8844-2b81-42ad-ae1a-4f9c0e541760', 'classique_visite', NULL, NULL, 'a6357197-6c79-4221-a204-df7572c7780a', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) martch-dev-hub-desktop/0.1.0 Chrome/126.0.6478.234 Electron/31.7.7 Safari/537.36', '2026-07-02 17:44:52.092008+00'),
	('00293305-e185-44ae-9997-ef57ab35cde8', 'classique_visite', NULL, NULL, 'f3f74e0a-0c7b-441e-870b-9ef55f10b2c8', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) martch-dev-hub-desktop/0.1.0 Chrome/126.0.6478.234 Electron/31.7.7 Safari/537.36', '2026-07-02 18:19:03.746663+00'),
	('c87ca9cd-c0e2-43e4-a4a2-9490b10cf1bc', 'classique_visite', NULL, NULL, 'f4082ea3-dc60-40c6-8cad-d80b350ec561', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-02 19:17:03.014055+00'),
	('1608534e-ac04-444e-8858-f7f126520f3b', 'classique_commande', '+243977252929', NULL, NULL, NULL, '2026-07-28 08:15:29.876012+00'),
	('6de75c19-5c1f-441a-87f8-f0aed302b97c', 'classique_visite', NULL, NULL, '03390b86-9572-4af0-b28f-b5e8cebb5910', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-02 19:55:49.763384+00'),
	('c59c06c5-298e-460d-bacd-08112d168f32', 'classique_visite', NULL, NULL, 'a19b4df1-a337-489d-9d1b-0c605f5f44bc', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-02 19:56:07.767059+00'),
	('aae516ef-747d-4dbf-8aad-0a67449e9e76', 'classique_visite', NULL, NULL, '748e0372-0348-45b6-818f-3b695d3a73dd', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-02 21:09:33.808953+00'),
	('6416d1a2-44f2-4427-92d5-43781a00f8d8', 'classique_visite', NULL, NULL, 'b6e02de6-217c-481e-b8ac-ef8fb708a376', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-02 21:47:17.34982+00'),
	('84eb4b5e-f232-4d11-a387-d7fcc78f84ad', 'classique_visite', NULL, NULL, 'fce03003-b1db-48fe-be0a-815fc5328763', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-07-02 22:04:41.406499+00'),
	('0ff45a0b-529a-42da-b409-9fe85268dc88', 'classique_visite', NULL, NULL, 'f01c97ff-c6d2-43f7-b99a-67bd8bc66865', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-02 22:41:04.347057+00'),
	('685a1b2a-6fd1-44e2-9883-e988a2562b52', 'vip', '+243975465330', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-02 22:42:14.456671+00'),
	('88341859-ff25-4c2a-9f6b-e58ac344d345', 'classique_visite', NULL, NULL, '5895d526-4acb-42a8-887e-5f8f7b40444e', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-02 22:58:20.124676+00'),
	('a4fa402d-6282-4c9b-aa53-840d659c4b49', 'classique_visite', NULL, NULL, '933b5373-cf3c-4f21-b1e1-e9dc411c9a7c', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-02 22:58:37.857086+00'),
	('c2fb6b95-e7aa-4c96-b69f-0969edcf8f3f', 'classique_visite', NULL, NULL, '11e71c3c-1310-4163-afd1-3163f00053e8', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-02 23:00:29.535833+00'),
	('08310303-d5ef-4c24-8581-fef6ed678ae8', 'classique_visite', NULL, NULL, '11d10fb7-110e-4cfb-ac1d-8768dca6fb5f', 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/149.0.7827.137 Mobile/15E148 Safari/604.1', '2026-07-03 05:39:00.501919+00'),
	('d1b28174-0fea-440e-b2e5-0bd3dd4c2c76', 'classique_visite', NULL, NULL, '1f3f3a2b-350f-4cd4-9aac-f2c61625041c', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-03 08:56:07.304891+00'),
	('c19f63d2-2d56-410d-868d-6852532a5659', 'classique_visite', NULL, NULL, 'b1de9175-2310-4e93-afeb-b10a855364b6', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-03 08:56:46.562085+00'),
	('79ef0a3d-3346-4cf6-b8b3-026fbe6feace', 'classique_visite', NULL, NULL, 'e4779260-3ecd-4b1f-9520-c66c8a76f620', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-03 10:31:00.858392+00'),
	('6c8c433d-4553-48bb-bef3-42eff2fa292d', 'classique_visite', NULL, NULL, '077c881a-0562-4f7b-83a6-0c5f7acce418', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1', '2026-07-03 10:33:52.583584+00'),
	('0680645a-f502-484d-b202-6501682d9492', 'classique_visite', NULL, NULL, '091ab1f3-c47c-4831-801f-f9587f242fd1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1', '2026-07-03 10:34:23.79198+00'),
	('c468e505-247e-4e86-b7ca-d607352b832d', 'vip', '+243992976329', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1', '2026-07-03 10:36:48.1056+00'),
	('cf4e927b-f9eb-41f4-ad35-f645a22d5ded', 'classique_visite', NULL, NULL, 'b0da2e00-b1ff-485c-80d2-b9220e6fc046', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.3 Mobile/15E148 Safari/604.1', '2026-07-03 10:41:22.553964+00'),
	('931218c3-ad8b-42f0-822b-5a9514232597', 'classique_visite', NULL, NULL, 'ccad654a-b076-4399-a6c5-1bff42285068', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-03 12:43:45.958378+00'),
	('46c577c7-22bc-4ce5-861e-bb1c4663b18c', 'classique_visite', NULL, NULL, 'e2460628-f3bd-4205-bbc1-f413410c6403', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 (compatible; Google-Read-Aloud; +https://support.google.com/webmasters/answer/1061943)', '2026-07-03 12:43:50.557289+00'),
	('fee97ffb-320f-4fbe-9c58-be1c575ecfd8', 'classique_visite', NULL, NULL, 'd6ded622-fcb9-4061-a1ec-918c80851d38', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-03 12:47:46.068698+00'),
	('43bd1882-552f-43a5-ada2-b21e9195df80', 'classique_visite', NULL, NULL, '6bceff1a-6022-4e5c-8a0f-6048ebd07d6d', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-03 12:50:09.99252+00'),
	('8dfcd908-c83a-4889-ac00-3d7ff436a4fa', 'classique_visite', NULL, NULL, 'ea37c879-0703-4ee8-b531-29d3b7efe770', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-03 13:57:22.556979+00'),
	('80c2d6cd-f829-45fd-8005-d7e217219790', 'classique_commande', '+243906295503', NULL, NULL, NULL, '2026-07-03 13:59:14.618032+00'),
	('3ac078b3-6536-4fe5-973b-e75a921964fd', 'classique_visite', NULL, NULL, '5fdf8a8b-6f40-4fb5-aa14-8397ec4c00d3', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-07-03 14:16:29.132892+00'),
	('2a5aaf85-0f9d-40ff-9d8c-1bebc12c2cf9', 'vip', '+243904557411', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-07-03 14:16:44.879384+00'),
	('c92b5e10-5645-4884-bd78-9e91b68f3990', 'classique_commande', '+243904557411', NULL, NULL, NULL, '2026-07-03 14:17:03.929099+00'),
	('9a4cdbc9-792a-48bc-9878-0a0894cc06db', 'classique_visite', NULL, NULL, '8c5e6c99-f1e6-4622-ac65-f0789461c4c5', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-03 15:29:48.727492+00'),
	('5bce2a09-ad9b-4a11-b424-1127e32ff775', 'vip', '+243975465330', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-03 15:37:02.221077+00'),
	('33d8e853-9014-42a6-9bce-ad3c63d98739', 'classique_visite', NULL, NULL, 'e2cacb95-4073-4a1d-b8c2-2638f9ba6dee', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-03 15:40:26.12839+00'),
	('dd7702e1-b5cb-4e36-9beb-a82b8ec5ecc9', 'classique_visite', NULL, NULL, '582f05be-e134-4f7f-ae48-165b257a9bf7', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-03 21:32:57.15869+00'),
	('5ce99751-ad06-4a7f-967b-a45c4972dece', 'classique_visite', NULL, NULL, 'edbfd6b8-9c01-4c36-8948-11a33796286e', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-04 08:46:44.034251+00'),
	('c1383223-8816-48bd-92e5-99946ec3fbdf', 'vip', '+243810979710', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-04 08:46:50.208406+00'),
	('e8f09bf7-a855-436d-bc9b-6c93367f0296', 'classique_commande', '+243810979710', NULL, NULL, NULL, '2026-07-04 08:47:17.853092+00'),
	('534606a3-51df-4fbd-a369-7bd2299cca7d', 'classique_visite', NULL, NULL, '9720220a-44c4-4c36-9dcd-0885bb315776', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-04 12:44:43.837167+00'),
	('43459203-0775-4534-a683-ab7e39015c30', 'classique_visite', NULL, NULL, 'd5a70917-8927-4e7f-8be3-965989733c36', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1', '2026-07-04 21:35:16.670924+00'),
	('999f1ca6-096a-4d18-9fc4-2809687c4633', 'classique_visite', NULL, NULL, 'e8d55b8b-a6aa-424c-9de8-f9826e4f1360', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1', '2026-07-04 21:35:44.895661+00'),
	('812a4efc-c44c-4410-b3ff-db4149d32597', 'vip', '+243975302311', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1', '2026-07-04 21:36:39.906353+00'),
	('501ec6a1-e563-40cf-893a-84d9409630f7', 'classique_visite', NULL, NULL, 'ffdfd409-b5cb-4615-ab51-bcf863909242', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-04 22:29:51.727904+00'),
	('e6c3f218-3867-43a1-b95f-c232c1277d1c', 'vip', '+243975465330', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-04 22:30:27.36065+00'),
	('52903d89-4075-44f2-9e52-04301fa35fd6', 'classique_visite', NULL, NULL, 'dd58f1cb-dbd1-4fb0-b710-68d8c64da2ad', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-05 12:58:07.239701+00'),
	('d56a0edb-e2a6-4cc0-9975-de8dec00e680', 'classique_visite', NULL, NULL, 'ea50997d-0026-4d5f-a2e7-7c4eb4abe0c6', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1', '2026-07-05 13:01:00.257609+00'),
	('6b18ed57-8257-44ba-8a6c-eaadcadf7071', 'classique_visite', NULL, NULL, 'a0179cd5-00a1-4a53-b82d-6f2b8d5f9fa4', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1', '2026-07-05 13:11:03.035573+00'),
	('da315793-90ef-40e6-9d1b-18968fb32c76', 'classique_visite', NULL, NULL, '626f484b-4f54-4674-9686-38740c1b1db4', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-05 16:40:51.841701+00'),
	('a4d1e19d-9099-4a33-9310-b9e41152460b', 'classique_visite', NULL, NULL, '671b0f36-41fa-4079-85b2-3b0eff2aedc6', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-05 16:40:52.272843+00'),
	('7dd1ddd5-82c1-425e-984f-92c87991fb9d', 'classique_visite', NULL, NULL, '93899ebe-10f0-4e50-b2ff-7bd1b546b71b', 'Mozilla/5.0 (Linux; Android 11; TECNO KG5j) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 Mobile Safari/537.36', '2026-07-05 16:47:45.862056+00'),
	('6b543fc3-d915-4598-8092-457afbe44554', 'classique_visite', NULL, NULL, '9ec53b7b-b821-4e26-ba1e-444679eb912d', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-05 21:41:19.659494+00'),
	('78b716b8-3119-45a3-80ce-0f1473f28ab6', 'vip', '+352691434011', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-05 21:42:02.152525+00'),
	('4a2658fc-0492-4c04-83cc-b0d5ac30eb0e', 'classique_visite', NULL, NULL, '81c086db-c6ed-45d4-a952-4d7270c65536', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-05 21:59:41.397082+00'),
	('a78add03-836b-43e0-b317-c49f2e5ee295', 'classique_visite', NULL, NULL, '24b070a0-ed68-418a-944f-e734af24fda2', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-06 17:30:10.922324+00'),
	('67d90b38-533c-485c-8863-0dff3beaeaba', 'classique_visite', NULL, NULL, '41f67e44-fb08-4051-8f48-c14de28106f6', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-06 18:36:54.952122+00'),
	('a3b24188-4717-4401-ae89-72786356c5d6', 'classique_visite', NULL, NULL, '33de50eb-a959-4b64-bebf-ec8d3a405cc3', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-06 19:32:46.275647+00'),
	('8f63cca0-5a59-481e-a5ed-dec6ffbebf0d', 'vip', '+243811281663', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-06 19:37:38.707811+00'),
	('849c1fe0-9685-4c9b-b72b-14350664eaaa', 'classique_visite', NULL, NULL, 'e5eb6405-d652-4fce-b247-81ca916d84d6', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-06 19:41:47.231205+00'),
	('2ce44ebb-f444-4c8d-a3d2-f64be2c1cbfc', 'vip', '+243811281663', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-06 19:42:04.77859+00'),
	('f434ee84-cc81-46e7-a3fd-627e4e961f06', 'classique_visite', NULL, NULL, '007f3e59-06a3-4a33-a95f-b590d29296b0', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-06 19:45:55.491121+00'),
	('0f678d46-258c-4a8d-a3ef-6976ef417ee9', 'classique_visite', NULL, NULL, 'e2d6a3e0-92f9-4960-a297-aad8a44df21c', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-06 19:46:36.941876+00'),
	('00962e5a-da5f-4f16-b5ad-d8debc93d3e3', 'vip', '+243811281663', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-06 19:46:59.271436+00'),
	('289719e4-7b21-4ecb-87fe-92c09df66c85', 'classique_visite', NULL, NULL, '77f7f23a-377d-4f42-88c7-b95574fb743a', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-06 19:53:56.815159+00'),
	('7bdf0723-b9ef-4465-ab86-78b08543aca8', 'classique_visite', NULL, NULL, '6d58ec64-ca75-4961-b4b1-96c70d564431', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-07 13:32:47.26939+00'),
	('e930b30d-d570-4db3-a12f-53ee593d7b6a', 'vip', '+243811281663', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-07 13:32:59.05467+00'),
	('45ac7b17-001c-4bbf-81e3-b0d6424b1383', 'classique_commande', '+243811281663', NULL, NULL, NULL, '2026-07-07 13:34:04.476401+00'),
	('fb68798d-a2c8-4f50-b3e8-dc36f0e24858', 'classique_visite', NULL, NULL, '061dbde1-7d49-4a5f-896f-4905cc373e87', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-07 14:29:22.239371+00'),
	('6a929554-31d8-45c5-a4cd-8340f4616bdd', 'classique_visite', NULL, NULL, 'fb4d4020-002d-4c4a-a58a-37df76372ec7', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-08 21:34:11.555148+00'),
	('ee8f48dd-dc2a-4d94-ac02-dfa8688b0176', 'classique_visite', NULL, NULL, '363df3a4-dc39-4ab6-a406-c334a31c3a7e', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-09 18:24:42.613205+00'),
	('2cee8bf5-2f92-4eec-ba9d-40a8929b7ba1', 'vip', '+243810979710', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-09 18:24:48.332301+00'),
	('e1f20794-01b9-4948-b4b4-d5bff06281fc', 'classique_commande', '+243810979710', NULL, NULL, NULL, '2026-07-09 18:25:09.176076+00'),
	('9421b367-af48-41aa-ab90-5829a582b913', 'classique_visite', NULL, NULL, 'c3de7a1d-bffd-4e81-bb89-8e3e4f2b1f5c', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-07-11 11:49:12.930379+00'),
	('9a55ae81-f711-4fa8-a800-32775c416d22', 'vip', '+243904557411', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-07-11 11:49:18.591805+00'),
	('2797c3b9-60b3-416c-9b39-092b2678fea5', 'classique_commande', '+243904557411', NULL, NULL, NULL, '2026-07-11 11:50:01.435099+00'),
	('0d46f499-8e06-46e3-b056-e1cd3dd06111', 'classique_commande', '+243810979710', NULL, NULL, NULL, '2026-08-11 11:59:48.123096+00'),
	('3ef6fd17-48ca-48f0-aa2b-74a91f6516aa', 'classique_visite', NULL, NULL, '2e0af5b6-f318-4a90-8a07-be55df4fb29a', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-07-11 15:39:05.511874+00'),
	('594e43c7-b580-4b93-9572-ac390dd56311', 'vip', '+243904557411', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-07-11 15:39:11.769225+00'),
	('15e901a7-8f2c-451e-90f0-b78eb5fcbc5b', 'classique_commande', '+243904557411', NULL, NULL, NULL, '2026-07-11 15:39:35.10349+00'),
	('8c9611f9-32ad-4a1a-8f21-bade7d7e344a', 'classique_visite', NULL, NULL, 'd510f6f0-0f8b-4d05-8003-962478a417cf', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-11 18:30:28.117215+00'),
	('23aceb24-1e90-4adc-a304-8381d5958f38', 'classique_visite', NULL, NULL, 'bbf6cca8-ac13-493a-aea0-a1d0e23a7287', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-11 21:34:03.87259+00'),
	('301df96c-a7f1-4458-86e0-32f77d752326', 'classique_visite', NULL, NULL, 'dd3394c8-e5cb-4277-bc9d-c92590b2883a', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-11 21:58:42.278693+00'),
	('e8a435fd-d774-46a9-8ed9-843a60ed8b05', 'classique_visite', NULL, NULL, '84b74634-ff70-43f1-971b-1001a26d2ff9', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-11 21:58:54.381386+00'),
	('5e8f1ebb-b024-4829-b971-bee2c5d4367f', 'vip', '+352691434011', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-11 21:59:23.364467+00'),
	('bc844d4f-1541-47d9-abf4-897a08e01551', 'classique_visite', NULL, NULL, '723fa6d2-77eb-4264-90f2-f046fb768704', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-12 10:32:27.212608+00'),
	('2a145470-4fd2-4be1-838d-17a4da2e804b', 'classique_visite', NULL, NULL, '222d87b1-97e5-418f-8185-dd8d2727edec', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-12 11:32:02.868302+00'),
	('325f9925-aec5-48fe-aaee-c4646842c7ce', 'vip', '+243810979710', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-12 11:32:09.047232+00'),
	('609333a2-b1bf-490d-8817-ad55054f5835', 'classique_commande', '+243810979710', NULL, NULL, NULL, '2026-07-12 11:32:38.260675+00'),
	('1945f24a-2e1d-406f-935f-8ba0d97c781c', 'classique_visite', NULL, NULL, '2ace5f89-fea9-423e-9d12-8009d3d09cb4', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-12 15:14:59.484073+00'),
	('d2ca3653-e8a2-4bcf-8875-b5114be014bc', 'classique_visite', NULL, NULL, 'dd0b5e1f-bb0a-4ac3-83ac-bbd027fc38af', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-13 11:40:38.026658+00'),
	('56dd3d63-96be-44b2-93e6-3a31a86ffa5b', 'vip', '+243811281663', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-13 11:40:51.14804+00'),
	('2e042fcc-8de7-4c24-937e-ae8417c6dca2', 'classique_commande', '+243811281663', NULL, NULL, NULL, '2026-07-13 11:41:33.218109+00'),
	('a5c492d0-3834-4a8d-bab4-2ae2ed7d35a3', 'classique_visite', NULL, NULL, '4a2d3604-8de4-4d72-bf37-64de1f02232e', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1', '2026-07-13 13:06:02.15207+00'),
	('f7700ddd-77b4-48ff-89ca-c30c6bd32475', 'classique_visite', NULL, NULL, '91eb7766-a8a7-4fe2-aeea-e73adb85e56a', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-13 13:07:19.719419+00'),
	('393f31cd-4d1c-4def-82ab-ba1e4ce5a23e', 'classique_visite', NULL, NULL, 'c9d5a5b5-3a1f-4b09-a4f8-d9313d240361', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-13 14:58:19.845798+00'),
	('e612d060-b547-4b7d-8ae4-fab6a79e3268', 'classique_visite', NULL, NULL, 'b1dc00b1-8406-42e4-bc19-6f4e3ebf0509', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-13 14:59:29.648758+00'),
	('067fc3e8-6be6-4a04-ae0f-2f84a42b3ddd', 'classique_visite', NULL, NULL, '567e894e-3a67-4947-8a3b-830878fbdc54', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-13 14:59:40.97501+00'),
	('5d3c62ac-fd4e-4a9e-bd8d-caa14612da71', 'classique_visite', NULL, NULL, '6ea1d69c-f4a4-4784-82ac-fe52d506c400', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1', '2026-07-13 15:07:54.039293+00'),
	('39073dd0-29a9-4cc0-b973-1a5ce1507ed7', 'vip', '+243851547328', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1', '2026-07-13 15:08:18.597755+00'),
	('791bb10f-5bbb-4656-88ad-91f1bd2727b3', 'classique_commande', '+243851547328', NULL, NULL, NULL, '2026-07-13 15:09:13.102544+00'),
	('9e7c8750-fdac-4d63-8cf4-d3ce84791fce', 'classique_visite', NULL, NULL, '71a5cae0-f1f3-4905-863b-7222825241ff', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-13 20:25:43.660376+00'),
	('b0b650f2-7255-473a-9f93-cf53da84cf43', 'classique_visite', NULL, NULL, '675369ec-79dd-4aab-8907-778bd0ab3930', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-14 01:00:53.403286+00'),
	('3a40d229-5b47-437b-b590-ebfa74661565', 'classique_visite', NULL, NULL, 'bd9d484b-2d43-4929-b826-06f66c2ead7e', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-07-14 10:25:55.057703+00'),
	('bd07842a-cf12-482b-9690-4b4cb769642a', 'classique_visite', NULL, NULL, '6fc7eb87-53d5-46b0-8a32-1fe190d77c84', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-15 11:16:26.739383+00'),
	('d265c117-edc6-45f8-8594-b1334ead4c09', 'vip', '+243811281663', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-15 11:16:42.448897+00'),
	('7cc5a022-c9dd-4c12-bbb6-d5c99e33e25e', 'classique_commande', '+243811281663', NULL, NULL, NULL, '2026-07-15 11:17:08.025901+00'),
	('a11cf5ef-f6ba-42f4-b9ad-e51ff73b780a', 'classique_visite', NULL, NULL, 'a9ba0fb6-e235-42d2-b9d7-7682967a7434', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-15 11:49:34.122407+00'),
	('e3a380d1-4253-42c8-aa26-7646760c6aeb', 'classique_visite', NULL, NULL, 'e566b1c9-d0dd-4391-ab38-75b8a40fb1f3', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-15 11:57:16.067845+00'),
	('620183c2-f25f-4e90-8279-537d8b363d7a', 'classique_visite', NULL, NULL, 'afe3e3dd-c350-4619-b3e0-5a260eb51d24', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-15 12:01:08.094048+00'),
	('547630f2-0f64-47d8-9b91-2adc64a7f111', 'vip', '+243906295503', NULL, NULL, 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-15 12:03:14.619983+00'),
	('469eebe4-24ce-4dfa-ab59-935f8db87bad', 'vip', '+243906295503', NULL, NULL, 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-15 12:06:58.217773+00'),
	('68ee188c-9bdb-45c2-ab4b-4b8001b29ef2', 'classique_commande', '+243906295503', NULL, NULL, NULL, '2026-07-15 12:08:32.417002+00'),
	('b543fbe9-c532-4ef4-bde1-519a2efc1c72', 'classique_visite', NULL, NULL, 'a64bf3c3-34f4-46f8-a0d5-876e0381b1fb', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-15 18:19:18.989148+00'),
	('f0f22282-ef2b-4429-afb1-cbcf525f22a5', 'classique_visite', NULL, NULL, 'b9830610-7ed0-4044-8a00-9a558d09e4ac', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-15 20:23:24.246034+00'),
	('6f8c6ebf-17ac-4d7b-86cb-7b3259e67ea4', 'classique_visite', NULL, NULL, '6b62bb3d-647b-4160-9f95-a6254266292e', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-15 20:24:13.995589+00'),
	('9603e797-e656-4117-9694-e7cdc5c2448c', 'vip', '+243980954541', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-15 20:24:35.767651+00'),
	('97ef98a8-ec5d-4bb0-ae74-b8284a9a2178', 'classique_visite', NULL, NULL, 'e8a0f00f-631a-4a00-8933-a47d6fcf6321', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1', '2026-07-15 21:22:19.923908+00'),
	('3c9ca685-d2b6-46dc-af06-1627ea89fc37', 'classique_visite', NULL, NULL, '4068d436-758f-4065-93c3-2cbdd4271df9', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-15 23:11:34.880212+00'),
	('b28cfd8b-a9c4-4615-be21-49d349dd0a47', 'vip', '+243980954541', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-15 23:11:42.97654+00'),
	('e8ebeac4-24bb-4dd2-9e1e-4381e4027d71', 'classique_commande', '+243980954541', NULL, NULL, NULL, '2026-07-15 23:13:43.777841+00'),
	('3913d7bc-7520-4dc2-956d-70e2c469eebd', 'classique_visite', NULL, NULL, '4d901fcd-142a-4032-90f7-d3b610ee9110', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1', '2026-07-16 09:33:25.645943+00'),
	('2ec9d616-1d95-4702-b8ff-972c4f615ec7', 'classique_visite', NULL, NULL, '6d8bb83b-3fd1-4799-b369-cb4386d09352', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-16 13:00:27.065394+00'),
	('6e10a827-3720-45ca-b630-0c2ac51b3035', 'vip', '+352691434011', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-16 13:00:54.530303+00'),
	('7ab458b5-26c6-49f2-bcb8-5f2ba12c220c', 'classique_visite', NULL, NULL, '420bd353-c5c1-48f4-847c-9351ae461e0e', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-16 21:44:58.123604+00'),
	('8c0402c4-027b-47eb-b611-e47813ebcc74', 'classique_visite', NULL, NULL, '0f924a9c-e11f-4994-b289-96ab42a3d1a5', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-16 21:45:07.330031+00'),
	('18cb5e6f-9fb0-4a9d-a663-70b4b8827aad', 'classique_visite', NULL, NULL, 'a4b701fb-482e-4009-8869-737af0430242', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1', '2026-07-16 23:21:39.666469+00'),
	('fcea59a1-c733-4835-bc58-6f512795e4b4', 'classique_visite', NULL, NULL, '96cd3ee3-7d11-4298-ab9a-1fc0be4c87f7', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1', '2026-07-17 08:08:51.601927+00'),
	('55f7a740-95a4-4d03-99aa-d687127238eb', 'classique_visite', NULL, NULL, '8541dd89-177b-464a-860e-75e01204bc7f', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1', '2026-07-17 08:11:40.131769+00'),
	('2cfd1132-b957-4ab0-9371-dc4a0600d5fa', 'vip', '+243975302311', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1', '2026-07-17 08:12:24.946167+00'),
	('cd9d97fa-ab60-41fb-90c3-ded91fe2a923', 'classique_commande', '+243975302311', NULL, NULL, NULL, '2026-07-17 08:13:24.220541+00'),
	('46a487e9-991a-4a42-8f0d-65cfa1c224ae', 'classique_visite', NULL, NULL, 'a049b0cb-a2db-4915-a221-4068a44f0790', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-17 10:46:15.180679+00'),
	('0285ccde-01bd-4a69-a2d4-c74c85c541ff', 'vip', '+243811281663', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-17 10:46:26.98511+00'),
	('eb1b4abf-437c-4a90-8fb4-5e4d0bd4407e', 'classique_visite', NULL, NULL, '6cda95a6-7161-4643-94cf-cba196648d80', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-17 11:22:30.797644+00'),
	('2e21f93a-4bdf-4211-986f-2cc701731100', 'classique_visite', NULL, NULL, '85136406-1551-4e6a-acd8-db3c050c68d4', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-17 12:55:38.475141+00'),
	('9eeb6336-2070-48c6-8747-e5534bd7d2fe', 'classique_visite', NULL, NULL, 'a11edffd-b5c8-469e-b544-3736942bb00f', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-17 13:03:19.819664+00'),
	('70f37388-8c89-43ef-acf9-3f4a2d728434', 'classique_visite', NULL, NULL, '9e1ee71d-1720-45a6-8547-8f4f0385555e', 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/17.1', '2026-07-17 16:55:57.378449+00'),
	('46092ded-eb9f-45cb-8015-0e99e2cc2237', 'classique_visite', NULL, NULL, '323328f2-4857-4206-b59c-042cee56489c', 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/17.1', '2026-07-17 16:57:54.063699+00'),
	('215a092f-1e6a-43e8-86c1-7ecaac589fb1', 'classique_visite', NULL, NULL, '7f5e2adf-09e3-42a1-91dc-989325392d9f', 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/17.1', '2026-07-17 17:02:55.671987+00'),
	('0d57022e-3575-43fc-b64b-05142d5934cf', 'vip', '+243997866570', NULL, NULL, 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/17.1', '2026-07-17 17:03:22.598795+00'),
	('841ef840-fe69-479f-bb70-99e982c4ffcf', 'classique_visite', NULL, NULL, '14ae9ff4-7e42-4a99-aa03-ec7dbab59cb3', 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/17.1', '2026-07-17 17:04:13.120853+00'),
	('28c5cf35-8026-4d04-9906-ad53db2b4e53', 'vip', '+243997866570', NULL, NULL, 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/17.1', '2026-07-17 17:05:09.795504+00'),
	('41788bac-344f-4444-a1ab-93078597bccd', 'classique_visite', NULL, NULL, 'f5cba6fe-157a-4ea9-b578-baf2beffe389', 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/17.1', '2026-07-17 17:05:36.630655+00'),
	('7cb7f05d-4c41-4a30-9052-df3bd313e221', 'classique_visite', NULL, NULL, '2fb7932f-9da8-4512-b66e-a04e90f054fc', 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/17.1', '2026-07-17 18:14:00.431561+00'),
	('cfc59c7f-d35d-4f39-bdaf-43451844709a', 'vip', '+243997866570', NULL, NULL, 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/17.1', '2026-07-17 18:14:40.179794+00'),
	('c02ecc3b-0729-4d9a-bc16-518ff714fe2f', 'classique_commande', '+243997866570', NULL, NULL, NULL, '2026-07-17 18:16:54.719803+00'),
	('f07a4d1d-4700-4879-a306-9ec479e19b81', 'classique_visite', NULL, NULL, 'e6d26633-0699-45ab-afd1-fb76650fb9c1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-17 22:02:12.708022+00'),
	('3d58e649-d0fb-4f4b-9c19-3ab7dffb6307', 'classique_visite', NULL, NULL, 'ac374445-e5c6-46b8-aa53-b1ecaf384e7a', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-17 22:02:34.641327+00'),
	('5e78904e-8ed1-40bd-a68e-5ee3172f24d9', 'classique_visite', NULL, NULL, '7218064a-5b36-4d84-acc1-14081516456a', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-07-17 22:04:22.713164+00'),
	('8fd7700a-99f0-4f1d-a88d-b319fae0ef7e', 'vip', '+243851547328', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-07-17 22:04:38.34401+00'),
	('1fa8cdd7-16d1-445d-bedd-062397319d9d', 'classique_commande', '+243851547328', NULL, NULL, NULL, '2026-07-17 22:05:33.358057+00'),
	('53af020f-09af-4da7-bfc2-e3b1b54152ee', 'classique_visite', NULL, NULL, 'de1c5955-4ffe-497c-9ca6-123df34368db', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-17 22:05:50.869543+00'),
	('1de549a2-940e-48be-a513-b15ad100c462', 'classique_visite', NULL, NULL, 'ff18c251-5901-490d-81aa-8b970e0996b1', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-17 22:08:57.707519+00'),
	('9a0332ae-48fc-43b3-9023-0cabab420301', 'classique_visite', NULL, NULL, '22c0ae8b-ad38-49cc-b0a2-3d39ef36536f', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-17 22:10:05.763655+00'),
	('8aaf6ee3-21e9-467a-9983-17b312145566', 'classique_visite', NULL, NULL, '6872e285-6753-42ac-990b-8e20301e40a4', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-17 22:18:08.494674+00'),
	('ed143023-149c-483e-bb7c-fb132422e24c', 'classique_visite', NULL, NULL, '337a1935-09ad-4255-995c-56dc07c3fca5', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-17 22:20:19.360574+00'),
	('88a9d31a-6ac2-40ee-95aa-212793e4e03c', 'classique_visite', NULL, NULL, '2dcc856b-7e2d-4b6e-b7d0-b64c20816418', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-17 22:20:20.797309+00'),
	('5fe6a63f-fe60-44b9-b11c-270b89e97070', 'classique_visite', NULL, NULL, '2cfeea5b-7125-4de7-8448-e020cbdb4e14', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-17 22:26:52.71148+00'),
	('b18b802d-642b-487c-be43-41cdbed83cc1', 'classique_visite', NULL, NULL, '65102d54-876d-4734-9c52-fd83615426c5', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-17 22:41:53.232215+00'),
	('bf105d04-38dc-471c-8e08-1263aca7e8eb', 'classique_visite', NULL, NULL, '11a9778f-8df0-43b4-ab14-5a078e0399c4', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-17 22:47:50.438512+00'),
	('93feca44-89ed-40ef-be53-7cfdf76ccddb', 'classique_visite', NULL, NULL, '6094039a-978d-4532-b998-6d364159cf20', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-17 22:50:21.187308+00'),
	('ddc1ef40-393c-478c-b560-c7e835cab264', 'vip', '+243828686120', NULL, NULL, 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-17 22:50:52.804903+00'),
	('7c60a525-8ab3-43af-96a4-8bb3e8a628eb', 'classique_commande', '+243828686120', NULL, NULL, NULL, '2026-07-17 22:56:05.692684+00'),
	('720fbf05-4513-4504-bb1a-68a907155c85', 'classique_visite', NULL, NULL, 'e9d9be1b-e5a3-419a-8093-717c505df357', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-07-18 06:16:34.957905+00'),
	('dd68a401-9aa2-46cb-9045-f6538673bce4', 'classique_visite', NULL, NULL, 'c6440813-b93d-459c-9888-41d9f04da55f', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-18 09:24:30.806954+00'),
	('f46e613e-9df1-4fb1-9d0b-30a28b2b30c6', 'classique_visite', NULL, NULL, 'c9355b11-3d49-428c-8898-0cbbb6302ec6', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-18 10:32:17.942624+00'),
	('f95645ef-40ae-404c-899f-97efd31efac4', 'vip', '+243828686120', NULL, NULL, 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-18 10:32:40.165604+00'),
	('677e91fe-fb0d-4da7-8232-7094769fd59a', 'vip', '+243828686120', NULL, NULL, 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-18 10:33:33.392453+00'),
	('a0d12715-8bf1-4c3b-83b8-89528cb14b56', 'classique_visite', NULL, NULL, '7a37a2f3-27ea-4385-97ab-c1c57aae9f2f', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.4 Mobile/15E148 Safari/604.1', '2026-07-18 14:12:22.065669+00'),
	('9550c4bc-5d0c-461c-92b4-4511ffd380e3', 'classique_visite', NULL, NULL, '122bdb17-7e1c-4268-94bb-705921d77968', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-18 14:41:49.417434+00'),
	('a9b7e195-c448-4040-8dd0-256dc774fbc0', 'classique_visite', NULL, NULL, '32973f53-9c23-4682-b760-2ae59b88ea16', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-18 14:54:05.66061+00'),
	('eedd2557-4266-4744-be6d-f89a537207a1', 'classique_visite', NULL, NULL, '724626d6-76c5-4b7f-8bc5-3d4b8763e210', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-18 14:54:05.856108+00'),
	('9fdf9157-5f90-413b-8e88-31d8671d934b', 'classique_visite', NULL, NULL, '6f924df6-5d5c-4967-a2a8-182b6b263d3b', 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/17.1', '2026-07-18 15:04:44.513712+00'),
	('6f627e0c-b0d8-49c7-9948-73fdc753f52c', 'classique_visite', NULL, NULL, 'd65d6b18-527d-4494-b204-708e2b91ff2c', 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/17.1', '2026-07-18 15:05:23.754528+00'),
	('e5ff1459-62f2-41f4-8962-536dcdaf8aef', 'vip', '+243997866570', NULL, NULL, 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/17.1', '2026-07-18 15:05:48.194209+00'),
	('c1256a40-f865-460a-b682-a4d8c603c6e2', 'classique_commande', '+243997866570', NULL, NULL, NULL, '2026-07-18 15:06:10.66743+00'),
	('1a2cb9b7-59a2-413c-abb3-dee46f43001f', 'classique_visite', NULL, NULL, '6df93a92-a8c2-44e6-a142-10c1765361d1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-07-18 17:51:59.075759+00'),
	('5231893a-fd3f-4235-bcb6-5425b96fc1b9', 'classique_visite', NULL, NULL, 'c68a30e5-ea2b-462c-9a34-f6e99f786fe5', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-07-18 18:32:53.09737+00'),
	('3fe8e7fd-0d7f-4c89-922a-225d02540916', 'vip', '+243904557411', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-07-18 18:33:01.775369+00'),
	('36426b03-8314-4940-97e4-42fc753ee543', 'classique_commande', '+243904557411', NULL, NULL, NULL, '2026-07-18 18:33:27.717932+00'),
	('d22a95b1-b20e-4baf-ab81-3f2614fd2f20', 'classique_visite', NULL, NULL, '64ea34f0-7ea9-459e-9544-6a328a6c7fe0', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-18 18:39:31.077289+00'),
	('c9eb5670-37c0-4a6c-9d9a-fcaba4adcf1f', 'classique_visite', NULL, NULL, '8a1c25eb-0714-42a7-9f42-9fa098918fc7', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.4 Mobile/15E148 Safari/604.1', '2026-07-18 21:25:29.847341+00'),
	('0de92509-1258-4989-bbb8-5264df0710cc', 'classique_visite', NULL, NULL, 'cf7fda12-76a0-4bef-b2e6-33e93cd81f00', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.4 Mobile/15E148 Safari/604.1', '2026-07-19 04:09:43.130891+00'),
	('73752967-a3bb-4b33-9b99-dfdb9f699010', 'classique_visite', NULL, NULL, '5ea1f969-67b8-460e-a8b0-8f2a466b71a9', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-19 11:48:48.050626+00'),
	('e358f468-e048-43dc-bdef-e873b20b6635', 'classique_visite', NULL, NULL, '12e3f8ca-52f3-4d20-befd-57e7433af762', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-19 11:48:48.11228+00'),
	('6cf82f82-7f6f-4aa1-bd47-60e70ff0f930', 'classique_visite', NULL, NULL, '45404b19-912d-4e11-bd0b-68cbd3791f81', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-19 11:49:33.600039+00'),
	('f76e6b0b-944f-44bf-8e58-0113f96274af', 'vip', '+243828686120', NULL, NULL, 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-19 11:49:55.673696+00'),
	('04e6ec13-e69e-48e8-92d6-0793b40410b9', 'vip', '+243828686120', NULL, NULL, 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-19 11:51:10.405468+00'),
	('9aebca37-1587-4f2a-b7bf-9e64a12dbb5d', 'classique_visite', NULL, NULL, '10871500-c06c-4e89-b1eb-f6af0e0f8343', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-19 12:21:00.280765+00'),
	('0d9d07b5-c7d9-471e-bb6c-7036adc6239f', 'classique_visite', NULL, NULL, 'cd247e8a-1584-4dc0-8e62-659b59c463c3', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-19 12:23:12.034816+00'),
	('ebc38507-b404-4302-9517-40f2033f5e59', 'classique_visite', NULL, NULL, 'c4c8e75c-f327-4fb0-8a11-0c1af23c331b', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-19 12:23:12.032899+00'),
	('e6c94dd8-1aec-4f1b-bfad-4990c1b9a6bc', 'vip', '+243828686120', NULL, NULL, 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-19 12:23:38.429912+00'),
	('ad9a6f60-673b-493f-8bda-0362dd263cd0', 'classique_commande', '+243828686120', NULL, NULL, NULL, '2026-07-19 12:24:29.566816+00'),
	('14f6be9d-be7e-46f8-b03f-b107cae7ae80', 'classique_visite', NULL, NULL, '48b14b39-0c7a-42a7-a270-09a76b041396', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-19 12:34:27.428986+00'),
	('a25df812-c786-4726-a08b-e1a2cdda2d56', 'classique_visite', NULL, NULL, '9c70fdb1-73c4-4005-991b-cc8ab4cbe26a', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.46 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-19 12:34:27.642806+00'),
	('6a1836f9-0c48-4550-b0c2-016db1f203c0', 'classique_visite', NULL, NULL, '4036e63b-1cfd-42fe-9f36-723be7161c2a', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-20 18:13:45.411983+00'),
	('5294828d-0331-4fc6-9b98-f5fa0056e10f', 'classique_visite', NULL, NULL, 'c2dcf591-b1d2-48a2-8336-f307083775f7', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-20 20:20:01.336489+00'),
	('883b3899-1ba3-44bb-bcac-031b5c61491c', 'classique_visite', NULL, NULL, '8943fd0e-9ee1-4d7c-921f-76c228067a3a', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-20 20:47:25.768776+00'),
	('3507e8a8-66e7-47e3-bb57-9cbcb4548a4f', 'classique_visite', NULL, NULL, 'e8377cbd-500f-4edf-a111-587542441b26', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-20 21:26:01.16583+00'),
	('1f73625c-f03b-47d0-9e41-e080a2ccbe3e', 'classique_visite', NULL, NULL, '34ce24a6-638e-47fb-98b7-ede6199b66cc', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-20 21:27:53.744728+00'),
	('e8be4604-631c-458e-859b-ec3f52a36482', 'vip', '+243818655008', NULL, NULL, 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-20 21:29:11.387991+00'),
	('cc4f8674-1b5c-4d74-a138-94dd78e550ff', 'classique_commande', '+243818655008', NULL, NULL, NULL, '2026-07-20 21:31:02.297827+00'),
	('2f1bf0e0-0f69-48a4-95ea-fe464a7cb8e6', 'classique_visite', NULL, NULL, '1a4b3424-7ab0-4ec3-9431-afa8d94e81a8', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-20 21:34:44.214977+00'),
	('b43c822d-decf-413d-a244-c3b475184961', 'classique_visite', NULL, NULL, '34347765-ca40-428c-9ee6-a35591b102b3', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-07-21 00:00:46.587913+00'),
	('8454e8f8-bb17-4c82-9748-a29a06b6fa42', 'classique_visite', NULL, NULL, '9d4db335-5c92-427c-87cd-72675dc0a3ed', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-21 12:15:30.130153+00'),
	('88609e11-6479-4732-9f44-2ce9ff6139de', 'classique_visite', NULL, NULL, '8faf2bae-ba35-4153-82ac-e6dd9c8e66e5', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-22 12:56:54.191257+00'),
	('14e855ec-bed5-4334-8cea-36708056b13f', 'vip', '+243811281663', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-22 13:11:27.942069+00'),
	('5c2b3d3c-909f-49d4-8fcb-50a4b37ade9d', 'classique_commande', '+243811281663', NULL, NULL, NULL, '2026-07-22 13:12:27.58548+00'),
	('364cf288-0244-48d4-9858-1c4f2d81a2c8', 'classique_visite', NULL, NULL, '83a1dec9-c274-44ac-8e41-edf9654acb85', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-22 17:29:10.737765+00'),
	('c5bf4ba0-048e-4cb2-bd24-fea1968b6c82', 'classique_visite', NULL, NULL, '326d6771-75e9-4a2a-92bd-350f254b2369', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-22 17:29:14.763539+00'),
	('bd23dcf7-382c-49e1-80b3-f640bde1de5f', 'classique_visite', NULL, NULL, 'fd72a79a-76f4-4b55-b175-affe2c083d2d', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-22 18:48:32.9745+00'),
	('d08d91a6-44d1-47eb-a3cb-3903a25507cb', 'classique_visite', NULL, NULL, '94209a43-9c53-46f6-b61b-98f4fe436e01', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-07-22 19:12:11.118202+00'),
	('07d45ad1-18cd-42ef-8d90-6af905216b02', 'vip', '+243851547328', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-07-22 19:12:29.303972+00'),
	('cde91de8-114a-495c-aece-784ecf693e35', 'classique_commande', '+243851547328', NULL, NULL, NULL, '2026-07-22 19:14:49.22701+00'),
	('d53f3d0a-91b4-4f4f-b919-ab06e3d1d88a', 'classique_visite', NULL, NULL, '01ccebae-2c77-41b1-b04c-c45b62dfefae', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-22 22:24:44.083778+00'),
	('58c09743-02ca-4f59-ab5e-002d3ece53fd', 'classique_visite', NULL, NULL, '9300db62-bdf6-4be9-9424-baa72ea6dd9e', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-22 22:26:35.817304+00'),
	('97c6bd50-5c22-4a2f-a8b8-3b2f14595a2d', 'classique_visite', NULL, NULL, '57e6d4e5-5b26-450a-b40e-acf337d86f80', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-22 22:27:06.287216+00'),
	('d8432e55-1443-46ea-8f87-fd1ba1937685', 'classique_visite', NULL, NULL, '8f6f312b-fc80-46dd-8400-7d6e0cc07afa', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-23 03:13:46.180683+00'),
	('4b0a96ef-d980-44a1-9bde-301839434559', 'classique_visite', NULL, NULL, '4981d05e-8c23-480a-ab66-a40789cd1f12', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-23 14:29:52.470037+00'),
	('186fb438-8cb2-4377-b9ae-d6f60eef4b89', 'classique_visite', NULL, NULL, '0ea0d2c9-df25-40d3-bc7e-730ef50c50b2', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-23 14:31:18.399875+00'),
	('29c90e85-7783-4f59-9bfd-dceb95df9db6', 'classique_visite', NULL, NULL, '6c9bd4b7-52be-4188-85d1-ace72a007eb4', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-23 14:34:59.213475+00'),
	('1271b050-962d-4cec-9ff8-fec6b831dfa7', 'classique_visite', NULL, NULL, '2f9347e6-a8f8-43af-ad28-d233bc4ec57e', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-24 09:38:37.476073+00'),
	('a7722442-b022-4a2f-aeb4-69059b909ff3', 'classique_visite', NULL, NULL, '282a456f-f9cc-4fa8-bc1d-e1b1a0b6ba13', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-24 09:40:08.918145+00'),
	('ffe56233-4b50-401d-9211-a0e217b0b222', 'classique_visite', NULL, NULL, '805d8f17-9bc3-47c2-b9e5-2118c6c2e156', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-24 16:29:46.420837+00'),
	('2a1d4ded-4db7-4b5e-b33c-7588072a34d8', 'vip', '+243811281663', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-24 16:30:02.478423+00'),
	('968bf590-d4a4-4f90-b6e1-8d107b691cbc', 'classique_commande', '+243811281663', NULL, NULL, NULL, '2026-07-24 16:30:45.226405+00'),
	('310234be-2a88-48c4-a407-304765e16e68', 'classique_visite', NULL, NULL, 'e49f985f-120b-4fc1-8a1d-a43c696dfe53', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-07-24 20:57:24.745837+00'),
	('f8e37a3c-ce41-4f5f-a3a0-c68415fc4beb', 'classique_visite', NULL, NULL, '4f63769e-fa7f-4415-b2fb-3228cc09c215', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.124 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-07-24 21:59:25.000153+00'),
	('14f9080b-92d5-4947-95d9-9c3c0186a7f5', 'classique_visite', NULL, NULL, 'b667d151-fc66-44ff-be57-299895145da4', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-25 01:08:37.550809+00'),
	('bd7c7bbd-4a88-4a0b-a362-94f9dd632718', 'classique_visite', NULL, NULL, '7f114a72-cc58-4160-914e-f6cfcde07cde', 'Mozilla/5.0 (Linux; Android 13; SM-A145P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Mobile Safari/537.36', '2026-07-25 01:14:07.415846+00'),
	('3a5eddb8-6928-4772-b07f-f80dcd5ddb1d', 'classique_visite', NULL, NULL, '2e8a8c17-fd4e-434b-a236-2132e87284cb', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-25 01:14:24.923616+00'),
	('2ef7d653-af14-44c9-919b-0437b011d414', 'classique_visite', NULL, NULL, 'ed7db44b-9b64-466f-800b-7ebcacdf3167', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-25 18:30:51.283243+00'),
	('6604c1af-9f9b-46d5-bfc7-5242d12c5bd3', 'vip', '+243811281663', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-25 18:31:04.710289+00'),
	('1b976419-8309-4539-bd08-be90fe02581f', 'classique_visite', NULL, NULL, '688f5219-59f2-4465-98e6-ad58df935007', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-26 01:19:39.058137+00'),
	('552bc848-89bf-4483-9265-fa955c426a42', 'classique_visite', NULL, NULL, '06a76e6e-700b-4ba7-a307-705a86e24a57', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-26 02:35:54.320401+00'),
	('1c435a80-ed5d-4860-809b-76d1dcfae075', 'classique_visite', NULL, NULL, '60cc3e30-823e-4aac-8476-6ab29b4df8bd', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-26 11:32:45.065353+00'),
	('5dcaba99-b414-4a70-9f87-b98349cf2191', 'classique_visite', NULL, NULL, 'fc2c7a15-e7af-49ab-b8d6-c38b43c53a6d', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-26 11:32:45.679167+00'),
	('d61987c1-aba6-487b-b131-a245694e4b3b', 'classique_visite', NULL, NULL, '8d338be3-8dc6-4748-9845-30c9742f8199', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-26 13:06:03.100875+00'),
	('36ad6932-8caa-4412-9f1f-89e42a75f595', 'classique_visite', NULL, NULL, '2786a37e-5a03-4fb9-9cc3-18167ad8a16f', 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/21.9', '2026-07-27 10:07:31.754348+00'),
	('d277a8a0-22ff-4b64-a472-9e0bb0617ab0', 'classique_visite', NULL, NULL, '360641ae-94cf-4c23-9ce0-ab84dc0dada2', 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/21.9', '2026-07-27 10:58:47.859507+00'),
	('1ca3e933-4df7-44a9-a876-b94ca8872249', 'vip', '+243997866570', NULL, NULL, 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/21.9', '2026-07-27 10:59:41.641447+00'),
	('7dc1ec7e-26ab-4aad-85ff-a3eb5a0d0ec6', 'classique_commande', '+243997866570', NULL, NULL, NULL, '2026-07-27 11:00:26.737895+00'),
	('d64b98a9-ee3f-4b77-a331-40eadba189df', 'classique_visite', NULL, NULL, '07ebb017-8266-4e3e-b582-8ac4f4ca81ed', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-27 16:20:17.56447+00'),
	('44887c34-7df5-4a57-8113-176e2132ff53', 'classique_visite', NULL, NULL, 'c845f25b-3cde-4112-8fe8-3646d175ae6a', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-27 16:20:18.577362+00'),
	('8f35241d-ae02-462f-a432-2ed7773e4397', 'classique_visite', NULL, NULL, '31f1b2a3-5e95-47a0-a3de-4c3c4e26ad4b', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-28 02:31:21.026314+00'),
	('e26a2aab-70f2-49ec-9328-5a4424579d4d', 'classique_visite', NULL, NULL, '1fd914c1-cc5f-4439-81e9-265c57f64925', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-07-28 07:49:39.643528+00'),
	('d20a7ee2-0c91-4ec5-9a76-846e05fb077e', 'classique_visite', NULL, NULL, '7af45c10-cb93-4d67-b2ba-3f4785998119', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-07-28 07:50:02.458102+00'),
	('38344b1e-c41e-4543-b4e3-ecaa95004083', 'classique_visite', NULL, NULL, '828897b6-2c59-4530-97ad-a92e2041b01c', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-07-28 08:02:38.965877+00'),
	('55061192-7d26-41d6-8fdf-9c6a51984639', 'vip', '+243977252929', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-07-28 08:08:41.071926+00'),
	('2b75c695-b0f9-4284-9e1f-a26d6e88341c', 'vip', '+243977252929', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-07-28 08:11:40.77328+00'),
	('e5a8d9a8-6a7e-4928-a4ee-69cf505a43ef', 'classique_visite', NULL, NULL, '5fbd406d-6767-436f-9ad0-d6203734a4df', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-07-28 08:43:21.34516+00'),
	('74535033-7448-4937-9552-4b914c735e29', 'classique_visite', NULL, NULL, '99da93c3-3ad8-4d35-8222-39de7292af5d', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-07-28 09:54:45.834906+00'),
	('8ddee200-37c5-4468-8483-491cdc84c4ab', 'classique_visite', NULL, NULL, '74ac7445-cbd5-47df-84e8-97b5c335cd3f', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/143.0.0.0 Mobile Safari/537.36', '2026-07-28 11:30:33.384412+00'),
	('064fa1f7-ff77-4180-9f2f-029f4ceff8a1', 'classique_visite', NULL, NULL, '2256907c-e5bd-4f2f-bf74-7bbc1bc7099a', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-28 12:37:39.260583+00'),
	('4c6dc6a3-1c3a-4de4-9a08-f24c37db8f26', 'classique_commande', '+243820730633', NULL, NULL, NULL, '2026-07-28 15:04:46.784638+00'),
	('3c242dd4-7f45-4270-a835-1d652dd235bd', 'classique_visite', NULL, NULL, '2a19ca1f-4066-41dd-a44d-17f1f925453c', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-29 09:29:37.782697+00'),
	('bc6ad82e-629c-4771-a1ad-ef84978043c9', 'classique_visite', NULL, NULL, '809453f5-6c24-4dcd-a4ac-a85aeda3c60e', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-29 09:34:43.684515+00'),
	('2c640eec-5d23-4d1e-a579-9b2dace7a2f8', 'classique_visite', NULL, NULL, 'd56a694f-284f-4881-ad4a-ca167e5db24f', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-29 12:31:35.029329+00'),
	('e74ad1b8-edcb-422d-9a43-9bdd64939c5b', 'vip', '+243810979710', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-29 12:31:42.186872+00'),
	('1acd75b2-9007-4310-9273-f7278ae42e83', 'classique_commande', '+243810979710', NULL, NULL, NULL, '2026-07-29 12:32:20.354782+00'),
	('3e1962ea-4301-4432-9400-80cba6861e8d', 'classique_commande', '+243810979710', NULL, NULL, NULL, '2026-07-29 12:34:01.795416+00'),
	('8d8f69e5-f9e8-4c81-b20a-828d40b0cf81', 'classique_visite', NULL, NULL, '3a31c9e5-a48d-4154-82d2-1e56dc3fd7a8', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-07-29 18:06:58.345261+00'),
	('f017022c-c48b-4b4b-b324-c3d42a73bc9f', 'vip', '+243977252929', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-07-29 18:07:15.051792+00'),
	('5b1f6050-4a1d-492f-89e7-8592a8101fb6', 'classique_commande', '+243977252929', NULL, NULL, NULL, '2026-07-29 18:08:35.741851+00'),
	('1212fa33-1ec3-4dc6-83fa-62d8dc69e22e', 'classique_visite', NULL, NULL, '48f7cf28-354b-4335-ac27-b54a21cd4a3b', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Mobile/15E148 Safari/604.1', '2026-07-29 20:36:53.481823+00'),
	('94f9e2dc-37b0-4b43-aa99-95ac14258bee', 'classique_visite', NULL, NULL, '742f81c7-8d56-4ae3-8c92-2f1805706413', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Mobile/15E148 Safari/604.1', '2026-07-29 20:56:03.860233+00'),
	('73c7ca35-0c6f-4811-a4ce-54b7474d3e8f', 'vip', '+243822165117', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Mobile/15E148 Safari/604.1', '2026-07-29 20:57:55.881601+00'),
	('13c00960-fb6e-4247-9c65-7de10c434d5f', 'classique_visite', NULL, NULL, '804c547e-e586-455f-9f64-f052a19da7dc', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-29 21:43:49.865605+00'),
	('a1d17614-8cc6-4e4b-9e7a-31237d50fea1', 'classique_visite', NULL, NULL, 'a2b1eceb-b5c3-438d-9a44-08cc1cf34e50', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-29 21:44:06.341211+00'),
	('cd5844d9-2f86-4c50-b686-59e173078fb5', 'vip', '+243822165117', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-29 21:45:04.10423+00'),
	('03d92080-b5ce-4509-bbed-409e1bbaa51c', 'classique_commande', '+243822165117', NULL, NULL, NULL, '2026-07-29 21:46:08.87391+00'),
	('0ce38b4e-1f74-4d9a-b572-3b883b835caf', 'classique_visite', NULL, NULL, '9a73b4f5-3c84-4552-8e74-467e0217ad69', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-29 21:47:25.231578+00'),
	('ef64af47-c0a5-410c-a740-f80b3a1e3640', 'classique_visite', NULL, NULL, '6433ac9a-d0ea-4e30-920a-a96b18974db7', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-29 21:47:42.886166+00'),
	('449d6d75-0a9f-42e3-a398-2c18b9e69090', 'classique_visite', NULL, NULL, '68203828-c654-4c81-ba9a-837717f942c6', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Mobile/15E148 Safari/604.1', '2026-07-29 22:18:44.11278+00'),
	('a47935a7-5baf-434f-bfe7-6c6fd3ab2d86', 'classique_visite', NULL, NULL, 'e6faa628-6409-47ae-9fe7-95c2563ae41a', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-29 22:29:38.448953+00'),
	('66215dfc-76ac-4c89-9dcd-df68eea8004b', 'classique_visite', NULL, NULL, 'a3bdccee-3ca0-4364-9ec3-df5a32051cd6', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-30 06:57:37.201944+00'),
	('9aef4843-4a75-4edb-a2c6-26047eb0b386', 'classique_visite', NULL, NULL, 'e9683779-060e-42ed-871f-b8d19c451df0', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-30 08:23:15.984889+00'),
	('72e23442-b0ef-42ef-8e8c-afed7a93869d', 'classique_visite', NULL, NULL, '9a57308f-82dd-4c4d-8ea0-c0a334ab557a', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-30 08:25:36.789564+00'),
	('00d0ff58-423f-4ba6-ac1f-61b730acfbb0', 'classique_visite', NULL, NULL, '770c4b80-cb3b-4e0c-8a6c-c333a27eeb80', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-30 08:42:36.024754+00'),
	('bd4dd555-b919-4763-b949-3c894c3a76d5', 'vip', '+243810979710', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-07-30 08:42:56.302307+00'),
	('48ec5cb4-133f-47cd-b0ee-93274fdaa533', 'classique_visite', NULL, NULL, 'c8804a8c-4ba9-4528-b880-1169b68104b1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-30 10:35:05.613195+00'),
	('b0cabadf-4a66-460d-84d7-e4bf61a20b5a', 'classique_visite', NULL, NULL, '8b695217-df7e-41d7-a58e-856a011fc8b8', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Mobile/15E148 Safari/604.1', '2026-07-30 10:35:15.980246+00'),
	('916f1805-1793-45de-87b6-04e2f79167f0', 'classique_visite', NULL, NULL, 'a0768cdf-0fe8-4a31-96be-e1e99a568bdb', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-30 10:35:30.545343+00'),
	('0eed4f23-56a4-4e82-98b8-43c8e8e3a933', 'vip', '+243822165117', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Mobile/15E148 Safari/604.1', '2026-07-30 10:35:34.98227+00'),
	('43a02a8f-c014-44dc-a727-7b994f95f4cd', 'classique_visite', NULL, NULL, 'ef07f1d0-0374-4d26-89f1-d78f61b89237', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-30 10:35:57.86971+00'),
	('d87bcfa9-6fe4-4a62-a2df-62fa7e877eaf', 'classique_visite', NULL, NULL, '1c832554-aa8d-4f29-926f-a2d4a2cc28db', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-30 10:40:18.717341+00'),
	('b4fc374d-d4b6-47f7-8995-05fbe868cfaa', 'classique_visite', NULL, NULL, '61baa632-dc92-4583-b2a9-715406e51689', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-30 10:41:38.970644+00'),
	('21855908-2e03-49c9-909a-2a67b6b3c319', 'classique_visite', NULL, NULL, 'e4f5cc80-0c74-4558-a7ad-4ca39ad654af', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.6 Mobile/15E148 Safari/604.1', '2026-07-30 10:41:57.356649+00'),
	('c7ed7e0f-ac7b-4eb7-97db-57f9e6067a40', 'classique_visite', NULL, NULL, '152c77a0-68ed-4d58-811f-69884ddd0760', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-30 10:44:55.454689+00'),
	('1ea4958f-69d5-4c2f-853f-28f9a4299c08', 'classique_visite', NULL, NULL, 'f50397f5-fcd2-4319-b90b-04d063c40e7c', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-07-30 15:25:10.477186+00'),
	('d95cd3ed-c35a-49e0-b6a1-9dbc5da94d61', 'classique_visite', NULL, NULL, '09977f1d-92f7-48de-ad73-e398373b23d4', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-07-31 18:06:03.080768+00'),
	('fcb291fa-a3e7-4656-9636-7cb66ea7da3a', 'classique_visite', NULL, NULL, '2295f40e-632c-45c2-8455-3bdfe5d36301', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-01 07:57:30.069238+00'),
	('ac1ab4df-30b8-427e-b8fb-53cfe9db64a2', 'classique_visite', NULL, NULL, '40819089-2af3-4645-8d18-ed57331b0fff', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-01 07:59:25.443907+00'),
	('4ecf2e6c-8e50-4785-b524-8790c4132e19', 'classique_visite', NULL, NULL, '609bd722-48c9-4f06-a2c2-851e73cfd8d5', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-01 08:09:35.042602+00'),
	('ad638bac-874c-4509-ae6c-30d500a06d19', 'vip', '+243985998472', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-01 08:09:55.361459+00'),
	('668f0c27-887e-4064-b8ce-85f5b681caca', 'vip', '+243985998472', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-01 08:11:36.180372+00'),
	('2f731423-e36b-4d25-b574-de2a31597379', 'classique_visite', NULL, NULL, '18a45e2b-a9c9-4642-8e69-d11402d88ff4', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-01 08:19:24.852263+00'),
	('c9dfb258-357e-4731-874d-41fc5b89da3d', 'classique_visite', NULL, NULL, '0e91791f-fffd-4a9c-8a7a-449a6cb93cc5', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-01 08:26:09.879956+00'),
	('ea2734c5-6c95-4519-a1a0-2688bdc157c0', 'classique_visite', NULL, NULL, 'f12339af-bfb6-404f-be8b-2d0287146cbc', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-01 08:28:07.079729+00'),
	('8edf4a7d-e989-4376-bed4-6ce4522927c7', 'classique_visite', NULL, NULL, 'ebddc8a8-3a6e-4a86-833e-e233cbd739a2', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-01 08:37:54.503732+00'),
	('d896e648-7850-4f31-ac6a-72c99ab37f22', 'vip', '+243977252929', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-01 08:38:30.491066+00'),
	('230c4bea-0d11-4eb7-af25-f7754b9b1b57', 'classique_commande', '+243977252929', NULL, NULL, NULL, '2026-08-01 08:39:02.4198+00'),
	('afd5b94b-772c-4b0c-a6a1-63f5ddacb894', 'classique_visite', NULL, NULL, 'ba2c82f3-d17a-4bf9-b8dc-e6deec69f0ef', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-01 11:52:57.011981+00'),
	('6de66a53-371b-4da9-b739-f3b99905f775', 'classique_visite', NULL, NULL, 'b652b280-2cc6-43ca-8eed-388125c4087a', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', '2026-08-01 12:47:50.780678+00'),
	('bbdc1a67-aebf-4ec1-a145-8f9028751faf', 'classique_visite', NULL, NULL, '999dce11-8454-4ece-b480-912fffa42edd', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', '2026-08-01 12:49:07.161247+00'),
	('f895854f-59d9-444e-8eaf-4ae8769219d0', 'classique_visite', NULL, NULL, '364b341c-2a93-40bd-942f-9f6808b6c7a4', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-01 12:52:19.668748+00'),
	('3d69669f-8344-43a4-b165-544bb49b1982', 'classique_visite', NULL, NULL, '786d0438-f63d-47f9-81d6-d5af2e7b7b53', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-01 13:14:25.303451+00'),
	('bd84f474-8600-429b-a130-d6f89794bfdf', 'classique_visite', NULL, NULL, 'af3f301c-d7f1-4811-a1d1-1ad94231b40c', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-01 13:28:44.707521+00'),
	('299e0430-8d01-4b93-a57b-51c16d66f1cf', 'vip', '+243985998472', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-01 13:29:02.062779+00'),
	('1ad3adf2-42be-4dbc-b000-99d35323ef82', 'classique_visite', NULL, NULL, '5e5763d5-9adc-408d-bd02-1f5338a53792', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-01 14:14:37.160975+00'),
	('9de57564-0b75-4440-9e25-a048b95849be', 'classique_visite', NULL, NULL, 'a82163c1-35a8-4f89-a37e-c385ed80e79f', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-01 15:36:25.014408+00'),
	('807c55b4-6fe1-4721-9020-5fa4ea3cd9f2', 'vip', '+243985998472', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-01 15:36:33.059638+00'),
	('858d16ea-e064-4186-b760-ef1ce7a02f84', 'classique_visite', NULL, NULL, '7490fc62-4118-4aa7-b782-1a19d196ecf9', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-01 16:49:30.560824+00'),
	('da6169bd-5846-4b5a-abda-37a37cde6704', 'classique_visite', NULL, NULL, '6ba3c366-123b-47c5-8e9d-deb850a6fa3c', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-01 18:39:50.174377+00'),
	('120558cb-cd1a-4c2e-b527-aa890ce821fb', 'classique_visite', NULL, NULL, 'e2d74dcd-d4f1-48cf-bfa3-c07d8bffaa20', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-01 21:51:26.450689+00'),
	('51fc47af-4e54-43c3-a225-d944cea698fd', 'vip', '+243985998472', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-01 21:51:36.813994+00'),
	('e298eef4-701d-485b-81ac-8ff93ed2973d', 'classique_visite', NULL, NULL, 'df00cad0-9285-41f1-9f7c-11602955d52d', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-02 00:15:59.061883+00'),
	('e90cb5ef-84d3-4bfc-83ec-128624424010', 'classique_visite', NULL, NULL, 'ba3c6fce-fd87-4b8f-a369-d85dfb5e1594', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-02 08:55:12.50661+00'),
	('791d3522-366d-4a8a-bf93-6d9b026b48da', 'vip', '+243985998472', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-02 08:55:18.157354+00'),
	('d62d8d56-9da5-4381-8ca6-ede55630abf0', 'classique_visite', NULL, NULL, '222e9e5a-eb11-4440-8e47-f0d1ee2f64b6', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-02 09:38:20.844139+00'),
	('1d72af3e-2590-41ed-ae4d-7172fbda62c8', 'vip', '+243985998472', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-02 09:38:31.79267+00'),
	('5757958f-78f6-4610-a9ae-d02b10eeb607', 'classique_visite', NULL, NULL, '2c97d373-5c89-4607-969d-58c20e9c243d', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-02 11:51:24.086731+00'),
	('a1a3a96c-c0e4-4d7f-bcb2-d4bd558badc1', 'classique_visite', NULL, NULL, '59e3c9d2-a0c1-4305-84f4-2d4ae680f8e8', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-02 11:52:47.274325+00'),
	('769db168-c6ae-404c-8e99-7820c9b5c933', 'vip', '+243985998472', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-02 11:54:33.898166+00'),
	('fbff1ab8-d2c0-4a36-9c75-4da12595fb13', 'classique_commande', '+243985998472', NULL, NULL, NULL, '2026-08-02 11:55:32.812367+00'),
	('10d62e06-669a-46da-9121-4d58324c8560', 'classique_visite', NULL, NULL, '27a36672-de68-47df-87cf-66069f992e29', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-02 12:23:40.170799+00'),
	('7648d961-b526-4110-a457-eb45f9ad163e', 'classique_visite', NULL, NULL, 'be8e9e1f-7db4-4e87-9959-5571a36ea36f', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-02 12:29:01.337943+00'),
	('7c146b05-2288-49b0-8933-a297afc926a0', 'classique_visite', NULL, NULL, 'b8b58af8-505e-4007-ba35-eb311a40f035', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-02 12:30:27.11365+00'),
	('89aa7b98-8200-4092-9831-0fcefc5ce5fb', 'classique_visite', NULL, NULL, 'f9f9ad10-910e-40a4-ad6a-a6fd09132af2', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-02 12:31:06.942355+00'),
	('591fa23a-5801-4ab4-9072-930250216615', 'vip', '+243997688362', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-02 12:31:41.580228+00'),
	('98a67fbd-7794-4015-a14b-0958975d751f', 'classique_commande', '+243997688362', NULL, NULL, NULL, '2026-08-02 12:32:12.201921+00'),
	('a18d8ee9-f9ab-402e-930e-a0d5e635a856', 'classique_visite', NULL, NULL, 'd7dd0d50-115a-4bca-8a69-a4468b47ec83', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-02 12:35:13.589762+00'),
	('3de5657f-d2a3-4c1d-b51f-47eff73f9765', 'classique_visite', NULL, NULL, '41087c49-1080-450d-95f5-911f64180713', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-02 20:56:56.941469+00'),
	('777f67ec-7063-4a4d-af78-2c2a228e6fb8', 'classique_visite', NULL, NULL, 'e8e39d8c-d2da-4ffe-865f-1be8a682c17e', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-02 20:57:45.32466+00'),
	('e26a85ae-842e-402f-90f4-447bd65fb644', 'vip', '+243848957350', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-02 20:58:52.99297+00'),
	('74804de6-5d24-4d5f-92b0-0248a51322de', 'classique_commande', '+243848957350', NULL, NULL, NULL, '2026-08-02 20:59:25.125547+00'),
	('fcd59341-d9a1-4e8d-8343-0a7fff893953', 'classique_commande', '+243848957350', NULL, NULL, NULL, '2026-08-02 20:59:30.485898+00'),
	('c32186a9-388d-4557-adb3-b2313e46095d', 'classique_visite', NULL, NULL, 'c4560ed9-000a-40ec-a5b3-26580d0cd30b', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-02 21:01:16.747685+00'),
	('5506be38-8995-455c-9d0c-b7172ed99d35', 'vip', '+243848957350', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-02 21:01:27.085552+00'),
	('6ca29455-5a90-4574-8752-285f94c88e39', 'classique_visite', NULL, NULL, '7ea2f4ad-e4d8-4323-a34b-80ab444ad283', 'Mozilla/5.0 (Linux; U; Android 16; SM-A065F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.181 Mobile Safari/537.36 OPR/99.4.2254.1608', '2026-08-03 08:32:16.144484+00'),
	('45d963ee-db66-42ab-bc67-a131419e4aa9', 'classique_visite', NULL, NULL, '31973bd6-1876-411f-9e98-41843bdbde96', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-03 10:05:27.177462+00'),
	('2d46ca71-81e3-47bc-a92a-2dd5c125014b', 'classique_visite', NULL, NULL, '794451fc-dc4f-4d29-87eb-d95c05ca005d', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-08-03 11:34:19.757152+00'),
	('78586e8b-54ae-413f-bc85-220951044568', 'classique_visite', NULL, NULL, 'e2afa93e-667b-4f20-bf8c-c0a8b6408165', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 (compatible; Google-Read-Aloud; +https://support.google.com/webmasters/answer/1061943)', '2026-08-03 11:34:23.332141+00'),
	('60698cc7-a7ca-4978-b31c-8864d7096449', 'classique_visite', NULL, NULL, '37424ac3-dfae-4808-ae10-dfd182db192a', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36', '2026-08-03 11:34:23.356595+00'),
	('8e6266b4-655a-4371-8cf0-ba77b0ce34e5', 'classique_visite', NULL, NULL, '6018783f-0f83-4b2d-9ded-b806d22bb70d', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-03 11:34:33.609043+00'),
	('66905895-2c52-4a29-9fd8-a4165f0ad46c', 'classique_visite', NULL, NULL, '892cf95b-442c-456f-8618-dc07e1336abd', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-08-03 11:35:13.395006+00'),
	('d1d7c0e9-2c99-4e82-8e63-bbd3c327f10e', 'classique_visite', NULL, NULL, 'f910106d-8260-4adf-88c3-5d12b3f28bb5', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-03 11:36:10.068144+00'),
	('7f760d1b-19e1-4b6b-a55d-1c2d0a688021', 'classique_visite', NULL, NULL, '81ed281a-eb24-40a2-939d-dba9853c0b02', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-08-03 11:38:23.216592+00'),
	('8bfdbc86-2797-4fb4-84ce-b2419021517c', 'vip', '+243852028702', NULL, NULL, 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-08-03 11:38:36.52988+00'),
	('bef424a4-5921-4165-acc2-7e10bf5b252a', 'classique_visite', NULL, NULL, '610d88a1-79c3-479d-b504-a3b7f5734ed6', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-08-03 11:43:24.452767+00'),
	('dd49d7be-2d3c-4f0c-aa94-09179a5ffd6e', 'classique_visite', NULL, NULL, '451f863a-b00c-4eef-8973-deedb8709af4', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '2026-08-03 11:44:20.535388+00'),
	('b9043d35-3112-42b7-af40-e326727b6a33', 'classique_commande', '+243852028702', NULL, NULL, NULL, '2026-08-03 11:45:24.574482+00'),
	('bde4bdcd-9fd8-4e42-8830-3016961e8104', 'classique_visite', NULL, NULL, '7621c055-0c15-44a5-bb39-56de8996ff1f', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', '2026-08-03 12:09:40.344124+00'),
	('fb05435a-6ed8-4127-8413-72944a218425', 'classique_visite', NULL, NULL, '7b3f99b1-49a5-432b-bd64-b670182d7b1b', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', '2026-08-03 12:10:01.341604+00'),
	('6ab3f9da-2492-4b14-80ba-a12a765e414a', 'classique_visite', NULL, NULL, '7095b1e2-773c-4c87-b36a-ec3bce6d7342', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2026-08-03 12:10:05.230682+00'),
	('5268956b-c5ff-4264-aadd-c7e3a1a17d2d', 'classique_visite', NULL, NULL, 'f923a182-fb01-459d-89f9-66f07479231d', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-08-03 15:23:35.934028+00'),
	('165731ea-27de-42b5-ace3-bbac6817299d', 'classique_visite', NULL, NULL, '1f6ee610-1fec-491b-b27b-f2e78a5fa7e3', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-03 15:30:28.600784+00'),
	('604da4e6-b572-4459-8877-1890153c2f6c', 'classique_visite', NULL, NULL, 'fda615de-5753-4407-bc8e-87707aef8025', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-08-03 15:46:29.114117+00'),
	('d42c959d-90ac-466f-9496-0869eeb890af', 'vip', '+243904557411', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-08-03 15:46:51.481194+00'),
	('8b1c8500-1f9a-4956-ada1-cffa003e8263', 'classique_commande', '+243904557411', NULL, NULL, NULL, '2026-08-03 15:47:37.542137+00'),
	('a041c4fe-e719-4c0c-b8a7-dd6c92c6d598', 'classique_visite', NULL, NULL, '03572242-3be8-4802-b5a6-39a8be74e056', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-03 16:20:21.386107+00'),
	('cef4828f-ce7f-4e19-b39f-141e6fedf8e6', 'classique_visite', NULL, NULL, 'cdd96310-48cd-4629-9241-786de4fe6cf8', 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/150.0.7871.113 Mobile/15E148 Safari/604.1', '2026-08-03 21:22:28.262193+00'),
	('57fe5961-6756-4b04-b75f-9a4a582993aa', 'classique_visite', NULL, NULL, 'f0353ecb-b092-4bae-a960-0ca71730ef90', 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/150.0.7871.113 Mobile/15E148 Safari/604.1', '2026-08-03 21:24:46.089885+00'),
	('fffbecfc-fa21-429d-94ad-1a16cf5d6433', 'classique_visite', NULL, NULL, '1c11e106-8543-471f-a25d-942da5087503', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-03 23:34:19.699387+00'),
	('591d82b1-80ed-43d2-8abd-6e1c897202d6', 'classique_visite', NULL, NULL, '3727f220-ffa5-4f46-ba0f-17cde48f7966', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-08-03 23:46:53.137358+00'),
	('7f389cd1-deff-4254-a4f9-3c5ab26feb73', 'classique_visite', NULL, NULL, '3b6b03b5-59c4-4a1c-9c34-2fb8f53fd8f8', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-08-03 23:47:17.737225+00'),
	('47f0fd63-bb79-4a6d-9b84-34328c9eb27a', 'vip', '+243852028702', NULL, NULL, 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-08-03 23:47:33.708603+00'),
	('9eeb6c1b-a64f-4953-ad1d-a124465d1021', 'classique_visite', NULL, NULL, 'fe8461ea-7019-41fa-b458-1d04bafe934a', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-04 08:19:34.425251+00'),
	('1022d493-a1b3-47b5-9f6b-b4cd84309dc4', 'classique_visite', NULL, NULL, '8fc9948b-d3dd-423c-a265-d6683eca19ab', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-04 08:21:11.939761+00'),
	('1f02a3ef-4114-4a45-82e3-e4a04c63559c', 'classique_visite', NULL, NULL, '7a387e6c-8051-4cd3-8378-f7dd1e04a6a3', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-04 08:22:00.854073+00'),
	('70ae8b89-0b44-4821-81cb-03fb3209515c', 'classique_visite', NULL, NULL, 'cccdefcb-09ed-44cd-b340-11c328e162ad', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-04 08:24:10.955889+00'),
	('ddf2fd24-d1ad-4dc6-b13b-42c1c64e970f', 'vip', '+243985998472', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-04 08:24:34.830291+00'),
	('4149280d-6a64-40b3-8352-b721ceb6170c', 'vip', '+243985998472', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-04 08:30:25.01084+00'),
	('2e983fd0-e3f3-468d-b350-15bece5a7ede', 'classique_commande', '+243985998472', NULL, NULL, NULL, '2026-08-04 08:33:10.117696+00'),
	('66d4fa4e-2741-4286-952e-1d329e0f12eb', 'classique_visite', NULL, NULL, 'd8fa57d3-05b5-44c5-a9ee-09b1d25e84e5', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-04 11:10:18.576276+00'),
	('e49e8ded-ce9e-4ca0-b7a8-f722975336ef', 'vip', '+243985998472', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-04 11:10:46.532247+00'),
	('a0682c8e-9181-4b80-bc81-61bd5fd3af9a', 'classique_commande', '+243985998472', NULL, NULL, NULL, '2026-08-04 11:11:10.49414+00'),
	('5147744a-fa58-4f8c-bc94-6c79c6d1aeb2', 'classique_visite', NULL, NULL, '76fb060f-e207-4a7c-9bdb-823a95e85bd2', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-04 12:55:11.24819+00'),
	('d69d22bb-36a8-4b3a-a28c-8a8c86f11093', 'classique_visite', NULL, NULL, 'cb583bd9-f1a2-477b-85e6-1659d257d5e1', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-08-04 19:43:37.681583+00'),
	('0c7441e2-78b8-49a3-82ef-14368d546030', 'classique_visite', NULL, NULL, 'e8143de6-f116-4707-92e1-ce839c7fc063', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-04 22:51:09.73088+00'),
	('06899a4e-4612-402e-b3ac-4ef5e4e0a718', 'classique_visite', NULL, NULL, '15159ba7-bf1a-406e-a493-a11f74846549', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-04 23:07:14.445921+00'),
	('9ea6c465-e691-49aa-890b-14e23fbd6bb6', 'classique_visite', NULL, NULL, '6d236bd8-d6a9-4716-bd0c-269e3028bfa9', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-05 09:01:07.990679+00'),
	('c35975e4-f81c-4b17-b9e0-92a189a18d51', 'vip', '+243977252929', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-05 09:01:59.95597+00'),
	('9ac37c6f-19ec-45a9-8409-b02d3a05a70f', 'classique_visite', NULL, NULL, 'cdda85f9-f322-4172-87b9-a3a1084e3b1d', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-05 09:05:44.486468+00'),
	('0666e656-c526-47d2-ad03-7db65bb00713', 'vip', '+243977252929', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-05 09:06:20.93537+00'),
	('98b94dcd-19f6-4136-9ce1-a9a26b36f0f6', 'classique_visite', NULL, NULL, 'f4e05217-1b06-4d80-944c-e803e9669e4b', 'Mozilla/5.0 (Linux; U; Android 14; fr-fr; TECNO KL4 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.179 Mobile Safari/537.36 PHX/21.9', '2026-08-05 14:08:56.316534+00'),
	('cf539be3-24d9-4307-9478-e29e30addbfb', 'classique_visite', NULL, NULL, 'd8c71595-8f01-4624-a11b-bec4c8cf0a6d', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-05 14:11:26.464073+00'),
	('e6f1a34f-b014-4c0c-8528-810b42860925', 'classique_visite', NULL, NULL, '97b5fda7-1a24-4c4b-afa0-5ff470fd4afb', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 (compatible; Google-Read-Aloud; +https://support.google.com/webmasters/answer/1061943)', '2026-08-05 14:50:19.317843+00'),
	('87e1e426-e9a4-43b9-9b45-af7413651f3a', 'classique_visite', NULL, NULL, '623e1369-0a46-464b-81af-bc78c270be6b', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-05 17:44:10.326727+00'),
	('b589e04a-9f04-4d3b-9ec1-2ad390e2b5d6', 'classique_visite', NULL, NULL, 'a75fe4be-ec12-41c7-9443-ad4fc80d6a89', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1', '2026-08-06 09:05:16.753879+00'),
	('698b92b5-387d-4fa8-88e2-3b3aee477c40', 'classique_visite', NULL, NULL, '00449dcc-e52a-442b-8d68-45d455868ab4', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1', '2026-08-06 11:00:22.270428+00'),
	('97823509-db6b-4828-b365-071668eed170', 'classique_visite', NULL, NULL, '79119a39-9490-4507-9767-7a6595dcba90', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-06 12:08:59.336745+00'),
	('f3d6ad86-b254-4eb8-b4bd-c466e0b7193d', 'classique_visite', NULL, NULL, 'd5a14728-6d3c-49c1-848f-8528a09a65da', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-06 12:09:21.77277+00'),
	('cef12f55-4f0c-497c-9ef2-546f5b010735', 'vip', '+243977252929', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-06 12:09:37.344853+00'),
	('018f8a90-5725-4b7b-b81d-2b92ea9fbc23', 'classique_commande', '+243977252929', NULL, NULL, NULL, '2026-08-06 12:14:06.319865+00'),
	('48d7a543-c5bd-4553-8444-774bcf7c5177', 'classique_visite', NULL, NULL, 'e54b46cc-320b-45e1-8d7e-f3fc7d2ab5ef', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-08-06 14:54:37.02641+00'),
	('c6a35585-7ecd-4d50-b22a-4aaf3d4503eb', 'classique_visite', NULL, NULL, '6c8eb90e-56d2-4c76-8ea1-745c8af4e6c9', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/143.0.0.0 Mobile Safari/537.36', '2026-08-06 14:54:58.76454+00'),
	('db9fa5c7-e237-43cb-9a6e-4d2a86b259a2', 'classique_visite', NULL, NULL, '4cfaa069-66f9-40a1-8638-9e7d7dc82a0a', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-08-07 14:32:32.271725+00'),
	('23761c46-b8af-4176-8aab-a8d079b14b88', 'vip', '+243832448175', NULL, NULL, 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-08-07 14:33:17.750616+00'),
	('7281d36f-d276-4835-ba62-36f15daef820', 'classique_visite', NULL, NULL, 'c87d8468-c32b-4a34-99ea-08170bcbf858', 'Mozilla/5.0 (Linux; Android 16; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-08-07 14:41:58.818189+00'),
	('042a80a2-91dc-4ce9-a06f-4ed0742eb302', 'classique_visite', NULL, NULL, '28a6c43a-142a-4f6c-b30b-0c3e98cc8bd9', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-08 13:00:17.917918+00'),
	('92e62678-c48d-4126-a575-8d78f8ee3149', 'classique_visite', NULL, NULL, '31eb1d12-3a56-4868-b476-d4b3e5c44d4d', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-08 19:58:05.321194+00'),
	('d5ec721d-2d55-4377-924b-99746e9b115b', 'vip', '+243852959228', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-08 19:58:58.774773+00'),
	('4b5fc2e5-7b68-4bc0-847f-c60dd8862d54', 'vip', '+243852959228', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-08 20:00:10.821988+00'),
	('6e766244-7d71-4fea-94e1-b0e8130bd325', 'classique_commande', '+243852959228', NULL, NULL, NULL, '2026-08-08 20:05:03.814639+00'),
	('fa9581ff-fe33-49e1-894c-8a4b446cc602', 'classique_visite', NULL, NULL, '51fc6c4a-fa48-4d95-8c1a-02d5aadea58b', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-09 11:02:12.83787+00'),
	('f90d65d8-bd6f-498c-971b-43674004d1e8', 'vip', '+243977252929', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-09 11:02:32.243261+00'),
	('1caa87b0-7d80-4dc7-8964-3f0f27d80521', 'classique_commande', '+243977252929', NULL, NULL, NULL, '2026-08-09 11:03:02.313582+00'),
	('fa03dedb-a4d6-487a-baa2-f3439331a39d', 'classique_visite', NULL, NULL, '6ec0a2a2-3caa-4bae-9fc9-1a038ba4fa2a', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-09 13:51:33.908581+00'),
	('140f2fbd-d3b7-406a-92d0-35310997fe4e', 'classique_visite', NULL, NULL, '2e3c126f-a729-44f3-9823-446b82bad168', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-09 15:25:01.814504+00'),
	('91bf8a4e-54ea-4825-8f89-cce9da58a631', 'classique_visite', NULL, NULL, 'a320461b-e9a6-4070-a59e-81274ab67263', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-09 15:36:05.613814+00'),
	('c2b6a367-16a0-49f1-89b6-61ce5b753eaa', 'classique_visite', NULL, NULL, '330f817e-87fd-40d3-a966-8dc9dc96ee78', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1', '2026-08-09 22:12:01.234821+00'),
	('9a631722-e62e-4d5b-9c65-457169e180ab', 'classique_visite', NULL, NULL, '5bd9c7d4-c944-42ff-9da9-03d952d75c76', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-08-10 13:46:51.047223+00'),
	('8709cf6a-969f-4fd6-8dcf-921c01d18f77', 'vip', '+243810979710', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-08-10 13:47:26.361624+00'),
	('048d298f-70f5-45d3-b722-01492bd18965', 'classique_visite', NULL, NULL, 'c19b860e-6846-4365-b0a3-386110848d77', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-08-10 14:07:04.890906+00'),
	('aabe9e73-da58-4bd9-8b57-9a3c6f72993b', 'classique_visite', NULL, NULL, '245020fb-5783-4071-bb9c-1a69831ec191', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-08-10 14:09:05.756429+00'),
	('07ee6803-574f-4c43-835b-68d5ff7d1d58', 'classique_visite', NULL, NULL, 'edd0717a-33c3-4838-a997-adee580c5fad', 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/151.0.7922.57 Mobile/15E148 Safari/604.1', '2026-08-10 18:08:32.171636+00'),
	('b2486824-0d2f-4294-a9b2-ba3ae34a3ffb', 'classique_visite', NULL, NULL, '972e6686-45a3-496c-af73-7b24e523aabf', 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/151.0.7922.57 Mobile/15E148 Safari/604.1', '2026-08-10 18:28:50.227714+00'),
	('8d666acf-19f8-4044-b0ba-860ffac889a3', 'classique_visite', NULL, NULL, '5039adbc-b716-442d-881c-f7f8cc0bee6b', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-10 21:14:14.489229+00'),
	('cd2738e0-353f-48a0-90ce-a3608263086b', 'classique_visite', NULL, NULL, 'bb7fca8e-6fbd-41b8-b291-8c4d97d15cf8', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-10 21:21:06.824315+00'),
	('a13d45d8-f2c3-4128-a2e0-5e2f34bf713f', 'classique_visite', NULL, NULL, 'b7389309-9ca0-4e03-98c6-fc1021c1ebc8', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '2026-08-10 21:23:33.044594+00'),
	('d03701ab-c74e-47a2-a0fc-7a1970415676', 'classique_visite', NULL, NULL, '0854a843-18c2-4d67-9077-1fa9f2e76ad3', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', '2026-08-11 03:56:33.518424+00'),
	('a4015f4f-747e-4e37-8548-87ef5db72296', 'classique_visite', NULL, NULL, '8272262f-7de3-4386-8fe8-8bb2d0354971', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5.1 Mobile/15E148 Safari/604.1', '2026-08-11 06:15:10.651232+00'),
	('01e56aa5-14a9-4a78-881c-13237f559893', 'classique_visite', NULL, NULL, 'c4cc04d1-7351-47a4-8ae2-df5f6459d7a9', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-11 10:25:50.37105+00'),
	('3099473d-72cb-406c-80f8-b5d35ac1b9eb', 'classique_visite', NULL, NULL, '545028eb-f2f7-45fe-91f2-ee000b907f00', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-08-11 11:59:19.301252+00'),
	('4daa8923-4fa6-44bb-a67a-3c9668cb6f98', 'vip', '+243810979710', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1', '2026-08-11 11:59:24.833032+00'),
	('3ce5921f-2d09-4687-89b1-07555913d69a', 'classique_visite', NULL, NULL, '43037117-7461-4af7-841a-c7b8b9d5c985', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-11 16:33:17.168627+00'),
	('3aecda5a-f40f-481b-a61d-f0278f6011d7', 'vip', '+243977252929', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '2026-08-11 16:34:11.347554+00'),
	('da4c456e-d92a-430f-89cd-fd6606f1d9f7', 'classique_commande', '+243977252929', NULL, NULL, NULL, '2026-08-11 16:34:38.686643+00');


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."products" ("id", "name", "description", "ingredients", "price", "subcategory", "image_url", "stock", "active", "featured", "popular", "discount", "created_at", "is_vip", "variants", "is_coup_de_coeur") VALUES
	('3d48ef96-d74f-4797-89b6-221c03cce773', 'Black BOX 10', 'Pour un monment entre amis ', 'Saveur intense', 40, 'sandwichs_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778452090657.jpg', 7, true, false, true, NULL, '2026-05-07 22:10:42.706391+00', true, NULL, false),
	('04b30644-dc0c-436f-bfea-6b6eb169f713', 'Banana Fiz', '', '', 4, 'smothie', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778527159347.jpg', 0, true, false, false, 0, '2026-05-11 19:19:22.54408+00', false, NULL, false),
	('f897e680-02e1-4728-b4b7-1b61f4b6b985', 'Coca-Cola', 'Le classique incontournable, frais et efficace à toute heure.', 'Coca-Cola 25 cl', 2, 'boissons_sans_alcool', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1776522335855.png', 0, true, false, false, NULL, '2026-04-26 17:26:20.205508+00', false, NULL, false),
	('cf2e139b-9fc1-46d7-87aa-3373a6377992', 'Milkshake Vanille & Oreo', '', '', 10, 'milshakes', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778688009764.jpg', 0, true, false, false, 0, '2026-05-13 15:36:40.479387+00', false, NULL, false),
	('03db1474-85c0-4125-8aa6-d70de93c6ded', 'Poulet Chrispy', '', 'Tenders, wings', 12, 'plats_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778532312037.jpg', 0, false, false, false, 0, '2026-05-11 20:29:31.786635+00', false, NULL, false),
	('49852f30-7632-44e6-881e-6b2ac0241137', 'Savana', 'Savanna Dry, la fraîcheur dorée qui réveille l’instant.', 'Cidre de pomme fermenté, eau gazéifiée, sucre, arômes naturels et conservateurs.', 3, 'bieres', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1779293380019.jpg', 0, true, false, false, NULL, '2026-05-20 16:10:55.189905+00', false, NULL, false),
	('b5859f59-5aa5-45af-8e1c-13903b3b6ec8', 'Likofi', 'La bière au goût franc qui célèbre la fierté du Congo.', 'Eau, malt d’orge, maïs, houblon et levure.', 3, 'bieres', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1779295873334.jpg', 0, true, false, false, NULL, '2026-05-20 16:51:50.343535+00', false, NULL, false),
	('60f7096a-328d-40fb-b070-ee7b13bb2c21', 'Burger Signature / Black Boss', '', 'Pain noir, Bacon, Cheddar fumé', 15, 'plats_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778534853567.jpg', 0, false, false, false, 0, '2026-05-11 21:05:11.898949+00', false, NULL, false),
	('9db7a5ca-91cb-4a1b-b7a0-2b9c09f8f2f9', 'Tacos', '', '', 6, 'plats_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778526140584.jpg', 0, false, false, false, 0, '2026-05-11 18:35:01.95244+00', false, NULL, false),
	('5c266a2c-15bc-41e1-8bc1-0b2aee7d1a1d', 'BLACK BOX 50', 'Pour les gourmands.', '', 150, 'sandwichs_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778454030669.jpg', 10, true, false, false, 0, '2026-05-10 23:00:39.985139+00', true, NULL, true),
	('ea506910-4fb3-4155-b1df-2fb10d887b48', 'Kebab', '', '', 4.5, 'plats_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778525611954.jpg', 0, false, false, true, 0, '2026-05-11 18:33:21.795292+00', false, NULL, false),
	('48863674-ec5f-4369-80a8-2194ae3e4b9e', 'Grinder premium', 'Moudre proprement, rapidement, sans effort', '', 10, 'espace_fumeur', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778686935127.jpg', 0, true, false, false, 0, '2026-05-13 15:26:17.733249+00', false, '[{"type": "Type", "options": ["Aluminium noir", "Transparent", "Electrique mini"]}]', false),
	('5ae9c7d4-718d-481d-ba0d-65952615d824', 'Tequila Camino', 'La tequila fraîche et solaire qui met le Mexique dans le verre.', 'Agave bleu, eau et levure.', 35, 'spiritueux', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1779298830234.jpg', 0, true, false, false, NULL, '2026-05-20 17:42:14.171385+00', false, NULL, false),
	('d79ac543-c0bb-48ea-b480-168b81b5d62f', 'Tropical Gold', 'Smoothie ultra frais à la banane et papaye, mixé pour une texture douce, fruitée et tropicale à chaque gorgée. 🤤', 'Banane,lait,papaye ', 5, 'smothie', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778875679113.jpg', 0, true, false, true, NULL, '2026-05-15 20:08:28.586434+00', false, NULL, false),
	('b58557cc-4ea7-4511-ba74-4982c7dc7359', 'BLACK BOX SOLO ', 'Pour un moment solo', 'Exquis ', 5, 'sandwichs_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778452210697.jpg', 1, true, false, false, 0, '2026-05-10 22:30:32.772805+00', true, NULL, false),
	('c9a2c0a1-df77-4564-91a4-23f95859b373', 'Burgers signature / Volcana', '', '2 steacks, Fromage fondant, Sauce piquante', 15, 'plats_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778534872061.jpg', 0, true, false, false, 0, '2026-05-11 20:48:18.350107+00', false, NULL, false),
	('715d22c6-8531-4adf-a07e-6fa98527c7a8', 'Castel', 'La bière blonde qui allie fraîcheur, élégance et caractère.', 'Eau, malt d’orge, maïs, houblon et levure.', 3, 'bieres', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1779295415557.jpg', 0, true, false, false, NULL, '2026-05-20 16:44:27.719127+00', false, NULL, false),
	('36362ca1-77f6-404e-8b79-f87e3a0c98e1', ' Service de préparation produit', 'Facturation pour 2 pièces (ex: BLACK BOX 5 = 10 pièces)', 'Mes petites mains', 1, 'sandwichs_chauds', '', 1000, true, false, false, NULL, '2026-06-12 12:33:20.82495+00', true, NULL, false),
	('a23d4cc9-4e73-4139-9a42-01e8abcc0afc', 'Cornets de frites pemium', '', '', 5, 'plats_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778532843821.jpg', 0, false, false, false, 0, '2026-05-11 20:31:03.23099+00', false, NULL, false),
	('a6352f65-a7f2-43e1-9a98-0ec8f49b4ee4', 'Hot Gog', '', '', 4.5, 'plats_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778525628006.jpg', 0, false, false, false, 0, '2026-05-11 18:33:56.507308+00', false, NULL, false),
	('58bb1fa3-27a5-422a-8eb9-4bde04e2adb1', 'Samousa', 'Samoussas croustillants à la pâte dorée, garnis d’une farce savoureuse et légèrement épicée. Une bouchée généreuse, parfumée et gourmande.', '', 2.5, 'plats_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778523804988.jpg', 0, false, false, false, 0, '2026-05-11 18:25:24.33248+00', false, NULL, false),
	('4731f4ff-7a6b-4485-b47e-f34940df1f88', 'Milkshake fruits rouges ', 'Onctueux, frais et plein de saveurs. Un mélange intense de fruits rouges à chaque gorgée', 'Fruits rouges ', 10, 'milshakes', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778688745634.jpg', 0, true, false, false, 0, '2026-05-12 16:44:05.608653+00', false, NULL, false),
	('4fabef7b-5012-4b4d-be99-8b703c64554d', 'Thé marocain à la menthe', 'L''incontournable local, chaleureux et toujours demandé.', 'Thé vert, menthe, sucre', 16.00, 'chaudes', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1776521454920.png', 100, true, false, false, 0, '2026-04-26 17:26:20.205508+00', false, NULL, false),
	('c197ba68-381e-4025-ac17-6e071ebd04d6', 'Thé noir', 'Sobre, classique et apprécié par les amateurs de thé simple.', 'Thé noir infusé', 15.00, 'chaudes', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1776521536568.png', 100, true, false, false, 0, '2026-04-26 17:26:20.205508+00', false, NULL, false),
	('757d9cdc-5f74-4a7f-a8bb-f36d61a7102d', 'Speed Energy', '', '', 2.5, 'boissons_sans_alcool', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778526819045.jpg', 0, true, false, true, 0, '2026-05-11 19:13:43.432113+00', false, NULL, false),
	('5486b326-0611-458d-8585-6295c6291e67', 'Citronnade maison', 'La boisson fraîcheur par excellence, simple et très efficace.', 'Citron, eau, sucre, glace', 20, 'boissons_sans_alcool', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1776523358061.png', 98, false, false, false, 10, '2026-04-26 17:26:20.205508+00', false, NULL, false),
	('135d3f04-c14f-4b46-9056-d1528b1d7961', 'Burger signature / Copacabanna Classic', '', 'Steack, Cheddar, crudités, sauce maison', 9, 'plats_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778533527812.jpg', 0, true, false, false, 0, '2026-05-11 20:44:37.991712+00', false, NULL, false),
	('a41283f0-7c78-4043-aacc-e9bdc02a56af', 'Bacardi Carta blanca', 'La fraîcheur cubaine qui réveille l’esprit cocktail.', 'Eau purifiée, mélasse de canne à sucre, levure.', 40, 'spiritueux', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1779298392995.jpg', 0, true, false, false, NULL, '2026-05-20 17:36:25.729746+00', false, NULL, false),
	('72325ae0-e7d9-4149-b054-cb6f93214423', 'Hennesy', 'L’élégance ambrée qui transforme chaque instant en moment d’exception.', 'Eaux-de-vie de vin issues de raisins, vieillies en fûts de chêne.', 150, 'spiritueux', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1779297355655.jpg', 0, true, true, true, NULL, '2026-05-20 17:17:32.153069+00', false, NULL, false),
	('2857b3de-185a-4347-affd-8f2b395c2219', 'Feuilles à Rouler Premium', '', '', 1, 'espace_fumeur', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778772089693.jpg', 0, true, false, false, 0, '2026-05-13 15:27:30.022188+00', false, NULL, false),
	('c8f19454-4337-459c-b425-df79988d1f21', 'Hunters', 'Hunter’s Dry, glacée comme il faut, sèche comme on aime.', 'Eau, alcool de fermentation, sucre, jus de pomme ou concentré de pomme, arômes, acidifiants et conservateurs.', 3, 'bieres', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1779293925135.jpg', 0, true, false, false, NULL, '2026-05-20 16:19:20.13346+00', false, NULL, false),
	('120d9970-a11e-484a-8b00-42a87c434f77', 'Tembo', 'LA fraîcheur congolaise au caractère bien trempé.', 'Eau, malt d’orge, maïs, houblon, levure.', 4, 'bieres', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1779294415704.jpg', 0, true, false, true, NULL, '2026-05-20 16:28:42.972293+00', false, NULL, false),
	('46a25bb7-6111-4d59-b476-f4540fd471b9', 'Fresh mango', 'Une explosion tropicale glacée et rafraîchissante', 'Mangue,menthe,citron ', 4, 'smothie', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778603219545.jpg', 0, true, false, false, 0, '2026-05-12 16:19:13.986659+00', false, NULL, false),
	('0a3e57d7-8dae-4806-8979-b060495fd68d', 'BLACK BOX 20', '', '', 80, 'sandwichs_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778452020812.jpg', 9, true, false, false, 0, '2026-05-07 22:11:18.588263+00', true, NULL, false),
	('6c013011-1911-479a-ac91-551dbb24f7a0', 'Filtres à charbon', '', '', 5, 'espace_fumeur', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778687293870.jpg', 0, true, false, false, 0, '2026-05-13 15:29:05.472497+00', false, NULL, false),
	('21c28139-5a26-46ef-a496-ec24ae804179', 'Turbo King', 'La bière brune qui impose son caractère royal.', 'Eau, malt d’orge, sucre, houblon, caramel, levure.', 3, 'bieres', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1779294764497.jpg', 0, true, false, false, NULL, '2026-05-20 16:35:01.610888+00', false, NULL, false),
	('87bd42a4-b484-4ef5-952e-90d80191afa2', 'Expresso', 'Petit, rapide et efficace, le café des clients pressés.', 'Café espresso serré', 16.00, 'chaudes', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1776520759938.png', 100, true, false, false, 0, '2026-04-26 17:26:20.205508+00', false, NULL, false),
	('b1d47bad-bb35-444b-b14c-229d8d17756f', 'Briquets premium rechargeables', 'Electrique USB, tempête, luxe métal.', '', 5, 'espace_fumeur', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778687427111.jpg', 0, false, false, false, 0, '2026-05-13 15:29:30.756089+00', false, NULL, false),
	('abb10ce2-a8b7-45da-b166-553b9f454bc1', 'Diffuseurs d’odeur / Encens relax', '', '', 10, 'espace_fumeur', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778687554098.jpg', 0, false, false, false, 0, '2026-05-13 15:33:01.329089+00', false, '[{"type": "Type", "options": ["Méditation", "Détente", "Chill room"]}]', false),
	('9e65f0a4-7b06-44eb-b868-5de1f619ea2b', 'Jus d''orange', 'Le grand classique frais, naturel et toujours demandé.', 'Jus d''orange frais', 20, 'boissons_sans_alcool', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1776522677133.png', 100, false, false, false, 0, '2026-04-26 17:26:20.205508+00', false, NULL, false),
	('32287411-144a-4051-bc68-bf34e8ae2d3f', 'Chawarma', '', '', 5, 'plats_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778526049994.jpg', 0, false, false, false, 0, '2026-05-11 18:34:27.819699+00', false, NULL, false),
	('3f994354-4e5e-4c23-a58d-96079e3465df', 'Fanta', 'Une boisson fruitée et pétillante qui plaît très facilement.', 'Fanta Orange 25 cl', 2.5, 'boissons_sans_alcool', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1776522605229.png', 99, true, false, false, 0, '2026-04-26 17:26:20.205508+00', false, NULL, false),
	('f9ef4edb-a4d3-4217-ac7e-052224952808', 'Plateaux roulage design', '', '', 10, 'espace_fumeur', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778687101787.jpg', 0, true, false, false, 0, '2026-05-13 15:28:29.551725+00', false, NULL, false),
	('fa154062-795a-4ee5-9b7a-54512993ef65', 'Milkshake à la fraise ', 'Un milkshake fraise frais, gourmand et généreux, avec une douceur fruitée qui réveille les papilles dès la première gorgée.', 'Crème fouettée, coulis de fraise, morceaux de fraises fraîches et glace pilée.', 10, 'milshakes', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778688554303.jpg', 0, true, false, false, 0, '2026-05-12 16:46:11.978457+00', false, NULL, false),
	('b6b8135b-7994-40cd-89d7-c463a652a748', 'Milkshake Chocolat', '', '', 10, 'milshakes', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778688252344.jpg', 0, true, false, true, 0, '2026-05-13 15:37:11.629547+00', false, NULL, false),
	('66392f60-4f7a-4d39-ba1b-c032f69b03fb', 'BLACK BOX 5', 'Weekend actif ', '', 20, 'sandwichs_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778451835817.jpg', 9, true, false, false, NULL, '2026-05-07 22:08:46.718958+00', true, NULL, false),
	('02efa72a-d835-4905-9663-5991aca62579', 'Sprite', 'Léger, citronné et ultra frais, très bon en accompagnement.', 'Sprite 25 cl', 2.5, 'boissons_sans_alcool', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1776522435848.png', 100, true, false, false, 0, '2026-04-26 17:26:20.205508+00', false, NULL, false),
	('1e7ff1cd-936b-4081-b554-a66af181a440', 'Café crème', 'Doux, rond et réconfortant, parfait à tout moment de la journée.', 'Café avec crème ou lait chaud', 18.00, 'chaudes', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1776520908776.png', 2, true, false, false, 0, '2026-04-26 17:26:20.205508+00', false, NULL, false),
	('570cfd7f-2c78-47b9-9e94-0f29ab965463', 'Milkshake Caramel', '', '', 10, 'milshakes', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778688139863.jpg', 0, false, false, false, 0, '2026-05-13 15:37:46.194479+00', false, NULL, false),
	('bd5665d7-d79b-4db5-bbb8-b3c5813a13b1', 'Milshake mango', 'Un milkshake mangue ultra frais, onctueux et solaire, qui envoie une vraie vague tropicale dès la première gorgée.', 'Crème fouettée, coulis de mangue, morceaux de mangue fraîche et glace pilée', 10, 'milshakes', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778688971414.jpg', 0, true, false, false, 0, '2026-05-12 16:35:20.740715+00', false, NULL, false),
	('0a94f0b2-2726-434d-877e-8386e691ad97', 'Sprite', '', '', 2.5, 'sandwichs_chauds', '', 0, true, false, false, 0, '2026-05-11 18:48:52.14611+00', false, NULL, false),
	('d4df5fe6-da22-4bd9-9bb7-e5072527b5f6', 'Strawberry FIZ', '', '', 5, 'smothie', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778527203343.jpg', 0, true, false, false, 0, '2026-05-11 19:20:05.906091+00', false, NULL, false),
	('a29bd03f-b859-4cd4-b274-f6dfb048826d', 'Xxl energy ', '', '', 0, 'sandwichs_chauds', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1778576580819.jpg', 0, true, false, false, 0, '2026-05-12 09:03:10.163007+00', false, NULL, false),
	('da0ff951-075b-4ba3-ad34-cb847721f37f', 'Jack Daniel', 'Le whiskey mythique au caractère fumé qui impose son style.', 'Eau, maïs, seigle, orge maltée et levure, vieillis en fûts de chêne.', 100, 'spiritueux', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1779297705121.jpg', 0, true, false, false, NULL, '2026-05-20 17:23:09.074081+00', false, NULL, false),
	('aa986eed-87ba-4aeb-954e-680dd4120761', 'Ambassade ', 'L’allure classique d’un goût légendaire.', 'Rien de bon pour nous', 2, 'espace_fumeur', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/1781264245878.jpg', 0, true, false, true, NULL, '2026-06-12 11:37:47.813048+00', false, NULL, false);


--
-- Data for Name: push_subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."push_subscriptions" ("id", "endpoint", "p256dh", "auth", "created_at") VALUES
	('7fadf655-fc04-4f14-adc1-6300f59c35d0', 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABqPxsVSg90bPe3PgmcFsFgw5Vzvk8jfV57OJ04MzVywS9f5xj9UpSebEhatwyZiTIixL9qM-ZVvifSFE6K_1k8K0YFLCd2ienpkKJxNmwq1-8ZSm2cmQSfrk8N7EKc3QVI4R0h-wxglAaf9a4dto0LidV5Fpgg4jDPmivq2mG3Ieo7pEQ', 'BFYGPidtNUIB8EGa-ijkSz8e5OExlFfwse7zsWWUpPAznTxtFE_RR7YODV-tMFPoGiA1kI91STlnLMxcQRlQhRY', 'hNHLe4db2s7TP_JAvSPBiQ', '2026-06-27 00:36:38.608+00'),
	('d3d21a1a-49d0-4aff-9223-68c3a7354737', 'https://web.push.apple.com/QMvy7jtLIGwyfuJyiQvbhJkBadkMgqqoQ9uiNuKzI9I_gHllumL6kmg7Ndk8yTB-KZTU7YXDa7IPzn_jLL6iIQNeXcO92TW_gw4TH9xxKnF0JA9-cCt-TNvcgLyusPoxYBBPOL6XjjL853i50X1wT2xKBIm-1EkVVX2lXpAn_j8', 'BLKXLNUGiAFzv_ttyDpSY21kok2UMhnn7RM1pO-Lo5Wl2PWHRDznrNHDG6AYcNlIdFFgH6jdbLV9Of95gE-7Tok', '7KBgrorkLA_dJCIIMpDfeg', '2026-06-27 09:12:18.774+00'),
	('da91a09f-e6bb-40c1-beb5-2d8a9f5976de', 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABqRquCmYO5mm0SxcqpKr3FpQjRrbW1KfOnPWBfrMahDKPCPP14C4jgRlgYzbvTX1UoVEruQYyvvzeFzfYW4y5yBMTDvbVC0WnP5BTYx6OvDDFO7L53gnv9c8TuqL3CBdFBRBUZU9OY6NtRyY1jG9vH-6MLZWz_On_v-tWUNKfAXM9e9y4', 'BKb95yx-GW1KMCV2Dv4vPZ0Qx1stzQOSl8WO-O8lxAQoVoQAJTWIQlZP6glOygVoOfNWxZD0YJeWKVSJjzMfbBQ', 'ZP1iwdQPaFtYo-EoGGnonA', '2026-07-02 18:18:43.633+00');


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."settings" ("key", "value") VALUES
	('background_gradient_from', '#080603'),
	('background_gradient_to', '#1a1008'),
	('delivery_enabled', 'true'),
	('feature_1', '{"icon":"clock","title":"Heure d''ouverture","desc":"De 8:00 du matin à 04:00 du matin."}'),
	('site_logo_admin', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/logo-admin-1782521198893.png'),
	('site_logo_vip', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/logo-vip-1782521381451.png'),
	('background_image_active', 'true'),
	('vip_access_enabled', 'true'),
	('site_name', 'Black Deew'),
	('tax_enabled', 'true'),
	('feature_1_active', 'true'),
	('vip_access_password', 'Sun64'),
	('stock_enabled', 'false'),
	('background_gradient_end', '#1a0a02'),
	('feature_2', '{"icon":"chef","title":"Produits frais","desc":"Préparés à la commande"}'),
	('status', 'open'),
	('footer_description', 'Plats chauds, boissons fraîches et snacks livrés rapidement.'),
	('footer_subtitle', 'Directement chez toi.'),
	('background_color', '#080603'),
	('feature_3_active', 'true'),
	('footer_line1', 'Livraison à'),
	('notification_email', 'manualongaboni@gmail.com'),
	('site_logo', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/logo-black-deew-1779043185849.png'),
	('footer_line2', 'Kinshasa.'),
	('background_type', 'color'),
	('status_message', ''),
	('background_image', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/background-1779057235851.jpg'),
	('feature_2_active', 'true'),
	('feature_3', '{"icon":"shield","title":"Paiement à la livraison","desc":"Cash uniquement"}'),
	('background_gradient_dir', 'to bottom'),
	('hero_image', 'https://ecljtkcoublqlgenpjlo.supabase.co/storage/v1/object/public/products/hero.png'),
	('site_description', 'Le seul à livrer à KINSHASA quand les autres dorment.'),
	('currency', 'USD'),
	('background_gradient_start', '#0A0804'),
	('slots_closed_days', '[]'),
	('tax_rate', '16'),
	('menu_placeholder', 'Qu''est-ce qui te fait envie ?'),
	('menu_placeholder_builtin_icon', 'UtensilsCrossed'),
	('menu_placeholder_icon', ''),
	('menu_placeholder_icon_type', 'builtin'),
	('slots_pause_end', '07:59'),
	('site_baseline', 'L''âme du Goût à KINSHASA'),
	('slots_start', '06:00'),
	('slots_days_ahead', '0'),
	('admin_email', 'heupel.martial@gmail.com'),
	('slots_capacity', '2'),
	('vip_allowed_phones', '["+243822165117","+243810979710","+243979478418","+243985998472","+243977252929","+243997688362","+243852028702","+243820730633","+243904557411","+243852959228","+243832448175"]'),
	('slots_pause_start', '05:00'),
	('slots_duration', '30'),
	('delivery_shop_lat', '-4.342220'),
	('slots_end', '23:00'),
	('delivery_min_order', '10'),
	('delivery_mode', 'all'),
	('delivery_out_of_zone_message', 'Désolé, vous êtes hors zone de livraison.'),
	('delivery_max_radius', '10'),
	('delivery_free_above', '100'),
	('delivery_min_order_strategy', 'per_zone'),
	('module_livreurs', 'false'),
	('module_drivers_app', 'false'),
	('delivery_shop_lng', '15.283165'),
	('delivery_tolerance', '0.5'),
	('delivery_shop_address', 'Bandalungwa, Kinshasa, République démocratique du Congo'),
	('delivery_pickup_message', 'Retrait sur place disponible.');


--
-- Data for Name: vip_access_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."vip_access_requests" ("id", "phone", "pseudo", "status", "created_at", "reviewed_at", "reviewed_by", "requested_password") VALUES
	('e87bd888-7a94-4a5a-938d-7b21aa77d694', '+243822809942', 'T.i king', 'approved', '2026-07-02 11:24:47.920666+00', '2026-07-02 11:27:09.549+00', NULL, '2493'),
	('467f497a-d143-477b-87e8-c5adbe43ff6c', '+243975465330', 'Alvin', 'approved', '2026-07-02 15:21:17.494246+00', '2026-07-02 15:23:16.429+00', NULL, 'precie60'),
	('5b60d2ed-955b-4f56-9ae7-46c7cce3dd8e', '+243992976329', '19', 'approved', '2026-07-03 10:35:37.006955+00', '2026-07-03 10:36:05.273+00', NULL, 'lecap1928'),
	('91909efc-c3fe-41f6-aca5-82d2a94c72e1', '+243980954541', 'Alz Alz', 'approved', '2026-07-15 18:21:45.574069+00', '2026-07-15 20:19:45.712+00', NULL, 'Mbapper07'),
	('46a8672f-9e3e-4728-8c64-d336c0f6b2f8', '+243818655008', 'Christo', 'approved', '2026-07-15 21:24:36.679824+00', '2026-07-15 21:47:58.127+00', NULL, 'Christiano13#'),
	('e307fb98-6438-4358-a1ff-82c91856dd70', '+352691434011', 'MARTCH', 'approved', '2026-06-21 10:35:35.261229+00', '2026-06-21 10:35:42.451+00', NULL, NULL),
	('6dcc08de-6a1e-4710-b598-7b317ff3ed40', '+243828686120', 'Bigiz', 'approved', '2026-07-17 22:43:56.628992+00', '2026-07-17 22:44:03.381+00', NULL, 'bigiz2288'),
	('cbbfb403-c6a0-4905-9bf0-25b17093c13e', '+352691434011', 'MARTC', 'approved', '2026-06-21 10:41:35.270865+00', '2026-06-21 10:41:48.535+00', NULL, NULL),
	('c12bd6e7-e5ca-4a70-968c-1c99eec208dc', '+352691434011', 'MARTCH', 'approved', '2026-06-21 10:45:08.034742+00', '2026-06-21 10:45:53.332+00', NULL, NULL),
	('afe276b1-186c-40c5-99dd-9c749fa0fcdb', '+243861722831', 'Bitch', 'approved', '2026-07-27 10:11:05.093871+00', '2026-07-27 10:56:23.109+00', NULL, 'Henrielle012'),
	('994b9cc5-d4fc-4416-8698-3ce18c982948', '+352691434011', 'MARTCH', 'approved', '2026-06-21 10:49:50.379602+00', '2026-06-21 10:52:40.492+00', NULL, NULL),
	('76cd777d-f69c-4fd2-9f20-e2c614d6ca07', '+352691434011', 'MARTCH', 'approved', '2026-06-21 11:12:53.286671+00', '2026-06-21 11:13:05.164+00', NULL, NULL),
	('1e03ce49-ed4e-4129-8ac5-1be0ce152fa3', '+243822165117', 'Zeph', 'approved', '2026-07-29 20:38:25.953379+00', '2026-07-29 20:39:49.373+00', NULL, '251120'),
	('95489cfc-bbcb-4e65-97e7-f6036333fc6f', '+243810979710', 'Kaz2', 'approved', '2026-07-30 06:58:51.233216+00', '2026-07-30 08:34:24.209+00', NULL, 'Alg64'),
	('e6f80311-45ca-4444-ba93-3d0690da7c0c', '+352691434011', 'MARTCH TEST ACCES 3', 'rejected', '2026-06-21 11:47:14.26653+00', '2026-06-21 12:04:27.062+00', NULL, NULL),
	('b15d0e56-9a98-4b74-af67-a966ce001f70', '+352691434011', 'MARTCH ACCES TEST 2', 'rejected', '2026-06-21 11:33:28.007013+00', '2026-06-21 12:04:29.637+00', NULL, NULL),
	('a96803c2-6bbf-4245-8de1-fd4243d20f2b', '+352691434011', 'MARTCH', 'rejected', '2026-06-21 11:26:26.172546+00', '2026-06-21 12:04:35.502+00', NULL, NULL),
	('e7c6c355-8b75-41d7-ae21-fdc5bbe7d9bd', '+352691434011', 'MARTCH TEST 1', 'approved', '2026-06-21 12:12:53.720752+00', '2026-06-21 12:43:11.862+00', NULL, NULL),
	('74b25f34-b9fa-4b59-8d00-02c3846b4ac5', '+243985998472', 'Hatim baby', 'approved', '2026-08-01 08:03:32.385896+00', '2026-08-01 08:04:50.994+00', NULL, 'Liverpool243'),
	('afb4acb7-1437-4816-8368-d76dc1a6967a', '+352691434011', 'Martch', 'approved', '2026-06-21 12:44:00.358616+00', '2026-06-21 12:44:10.55+00', NULL, NULL),
	('4d12e6d9-0f04-41a6-8630-4f3e092e2ca3', '+352691434011', 'Martch', 'approved', '2026-06-21 12:44:36.304129+00', '2026-06-21 12:45:03.641+00', NULL, NULL),
	('004edd92-a89a-4319-871c-fdf92124d901', '+243977252929', 'Le baron', 'approved', '2026-08-01 08:31:32.712815+00', '2026-08-01 08:32:45.988+00', NULL, 'Kinshasa243'),
	('75c0e636-71b3-4fc6-bb1b-91e61f8864a4', '+352691434011', 'Martch', 'approved', '2026-06-21 12:48:26.940808+00', '2026-06-21 12:48:37.001+00', NULL, NULL),
	('743eb5de-6797-4783-95a3-7b14a1c28870', '+352691434011', 'MARTCH', 'approved', '2026-06-21 13:00:29.388843+00', '2026-06-21 13:00:37.439+00', NULL, NULL),
	('a1575ca8-8b76-43e7-9b78-83a54dd13d89', '+243992641162', 'Young 2crime', 'approved', '2026-08-01 13:13:19.628531+00', '2026-08-01 13:13:27.814+00', NULL, 'kin243'),
	('4f82a6bc-0bc4-43e0-b54d-4fe11a27df5e', '+352691434011', 'Martch', 'approved', '2026-06-21 13:14:42.873856+00', '2026-06-21 13:16:46.056+00', NULL, NULL),
	('978143ce-7315-4cae-8008-d2065469407c', '+352691434011', 'Martch', 'approved', '2026-06-21 13:43:52.234745+00', '2026-06-21 13:44:02.625+00', NULL, NULL),
	('870f9bb2-567a-431a-bf4b-6ac3199449f3', '+243997688362', 'Mula', 'approved', '2026-08-02 12:25:17.945441+00', '2026-08-02 12:25:47.398+00', NULL, 'Bakwafika26'),
	('b6b84601-1289-4c71-919f-2f98379e4bb7', '+243848957350', 'Snoob', 'approved', '2026-08-02 20:57:31.712892+00', '2026-08-02 20:58:11.064+00', NULL, 'alg64'),
	('7bae46fc-9903-40ff-b3dc-f0efaef52b13', '+243852028702', 'SÉQUOIA', 'approved', '2026-08-03 11:36:14.346319+00', '2026-08-03 11:37:07.006+00', NULL, 'kin2026@'),
	('e996de9a-a81b-4548-8b13-28cd10ea3017', '+243811521126', 'Young', 'rejected', '2026-08-03 11:35:15.120347+00', '2026-08-03 11:37:14.981+00', NULL, 'kin243'),
	('f91fd29e-5849-4154-b1be-96f518e0bac2', '+243852959228', 'MD10', 'approved', '2026-08-05 14:13:14.685768+00', '2026-08-05 18:29:39.35+00', NULL, '1205djo'),
	('520c2d05-3fca-4c17-a4a3-e1c92b25b532', '+243832448175', 'Biggi', 'approved', '2026-08-06 14:55:38.992324+00', '2026-08-07 05:13:54.364+00', NULL, 'jemima'),
	('e353f068-f3d4-4914-82d2-04b75ea2238d', '+243818655008', 'Christo', 'pending', '2026-08-10 14:08:48.449781+00', NULL, NULL, 'Christiano13#'),
	('f7aafc7e-5481-4fbe-8c01-e41d41b4dbd7', '+212454545', 'test pass', 'approved', '2026-06-21 15:20:04.726311+00', '2026-06-21 15:20:16.899+00', NULL, 'test1234'),
	('0445aa9c-9c8c-479a-8a1d-24abb7afb18e', '+21245454545', 'test pass', 'approved', '2026-06-21 15:25:18.247666+00', '2026-06-21 15:25:30.36+00', NULL, 'test1234'),
	('36895508-cf35-47bc-82be-c46036292d49', '+21245454545', 'test pass', 'approved', '2026-06-21 15:44:49.491346+00', '2026-06-21 15:44:57.662+00', NULL, 'test1234'),
	('675d3b46-a78f-448f-8002-5e7fb67fccf6', '+21246464646', 'test access', 'approved', '2026-06-21 15:56:39.414339+00', '2026-06-21 15:57:18.179+00', NULL, 'test1234'),
	('ff9198da-3c64-4f00-8cbd-46680f19a014', '+21247474747', 'TEST ACCESS', 'approved', '2026-06-21 16:23:35.498095+00', '2026-06-21 16:23:48.951+00', NULL, 'test12345'),
	('e083dd5f-4c1b-4165-b816-cd86bcd08310', '+21240404040', 'test access', 'approved', '2026-06-21 16:43:06.915284+00', '2026-06-21 16:43:22.653+00', NULL, 'test1234'),
	('3ab294b4-c03a-4940-a007-41b4c8975514', '+21270707070', 'test acces', 'approved', '2026-06-21 17:17:31.22224+00', '2026-06-21 17:17:45.565+00', NULL, 'testtest'),
	('65036a69-76b1-4ba3-9332-c17133ef2a37', '+21220202020', 'Test prod demande acces', 'approved', '2026-06-21 19:10:32.495432+00', '2026-06-21 19:11:34.949+00', NULL, 'Test'),
	('814b7bdd-c8a6-41c5-aa94-145f1792230c', '+243997866570', 'Alg64', 'approved', '2026-06-25 12:30:25.292783+00', '2026-06-25 12:32:41.147+00', NULL, 'Alg64'),
	('872827ec-0fb5-42fc-9d5d-f42445915100', '+243850283437', 'Danshow', 'approved', '2026-06-26 10:34:41.119872+00', '2026-06-26 10:35:40.2+00', NULL, 'Kinshasa243'),
	('72e7a5ea-4004-49f2-8a60-ad59dd268435', '+243977252929', 'Le baron', 'approved', '2026-06-26 10:39:22.628717+00', '2026-06-26 10:55:10+00', NULL, 'Kinshasa243'),
	('8fc41dc3-5785-4240-acb5-007f0c5ef9ce', '+243829208567', 'Matcho', 'approved', '2026-06-26 12:15:01.023247+00', '2026-06-26 12:15:40.705+00', NULL, 'Nathan@$$'),
	('1d2e9527-cf5f-40b1-bed9-96779223b7f8', '+243811281663', 'Mc tkz', 'approved', '2026-06-26 14:48:55.04028+00', '2026-06-26 14:56:14.118+00', NULL, '12345678Kal'),
	('d9155bc5-d814-4050-823c-22fef8ae0b61', '+35269111111', 'test martch', 'rejected', '2026-06-27 00:20:08.272415+00', '2026-06-27 00:56:47.512+00', NULL, 'AAAA'),
	('f0ca7677-e3ad-463f-b190-bd9364de1b66', '+3522222', 'Test vip', 'approved', '2026-06-27 09:14:10.719207+00', '2026-06-27 09:14:21.918+00', NULL, 'aaaaa');


--
-- Data for Name: vip_individual_passwords; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."vip_individual_passwords" ("id", "phone", "password", "created_at", "updated_at") VALUES
	('c3c71c37-9f4c-4761-9e7c-751ee76dba28', '+212454545', 'test1234', '2026-06-21 15:20:17.37141+00', '2026-06-21 15:20:17.122+00'),
	('41221138-5b7b-4281-93d3-471b8fe2bf79', '+21245454545', 'test1234', '2026-06-21 15:25:30.845066+00', '2026-06-21 15:44:58.111+00'),
	('16c23c86-14cd-4504-8ef7-991e23b7318b', '+21246464646', 'test1234', '2026-06-21 15:57:18.856891+00', '2026-06-21 15:57:18.566+00'),
	('0ffd79f8-4f14-4d6b-9ed3-30c7cd348bcb', '+21247474747', 'test12345', '2026-06-21 16:23:49.38931+00', '2026-06-21 16:23:49.284+00'),
	('6b54ccc1-263c-42de-b52e-b3b58f8813f9', '+21240404040', 'test1234', '2026-06-21 16:43:23.571766+00', '2026-06-21 16:43:23.372+00'),
	('cb272a6e-dd3a-43a9-a28a-dfa63b2cd7b2', '+21270707070', 'testtest', '2026-06-21 17:17:46.444609+00', '2026-06-21 17:17:45.758+00'),
	('1b3a6ef6-5d9d-43d1-89b1-31ce0904f87e', '+21220202020', 'Test', '2026-06-21 19:11:35.27878+00', '2026-06-21 19:11:35.102+00'),
	('b4087b51-30f5-444b-bb0b-a237ee427e42', '+352691434011', 'Fort*f55', '2026-06-21 18:32:42.077007+00', '2026-06-21 23:04:18.978+00'),
	('2b5bb387-449e-48ab-82a6-da20c9d89ec6', '+243975302311', 'Fuckboy06', '2026-06-22 07:40:31.556002+00', '2026-06-22 07:40:29.271+00'),
	('7e108568-a2a9-4d1a-8e21-5fe08311a5c9', '+243825158026', 'Alg64', '2026-06-22 11:15:07.846166+00', '2026-06-22 11:15:07.551+00'),
	('25a53d36-e95c-4935-a332-9ade31b471f6', '+243850283437', 'Kinshasa243', '2026-06-26 10:35:41.110141+00', '2026-06-26 10:35:40.689+00'),
	('2589f5ed-2b72-413f-b8ec-a12aa20e8695', '+243829208567', 'Nathan@$$', '2026-06-26 12:15:41.493752+00', '2026-06-26 12:15:41.202+00'),
	('b85aaa13-34cb-4748-8639-66663f709e58', '+243811281663', '12345678Kal', '2026-06-26 14:56:15.126713+00', '2026-06-26 14:56:14.785+00'),
	('509eaf81-1197-4065-a37f-f720f782da2f', '+3522222', 'aaaaa', '2026-06-27 09:14:22.716367+00', '2026-06-27 09:14:22.353+00'),
	('af47ab52-b596-454d-8e6a-ff961353d52d', '+243820730633', 'Trismegiste', '2026-06-26 16:50:07.504807+00', '2026-06-27 18:03:07.181+00'),
	('301cff65-88ef-4b7b-850b-ecd435fbd846', '+243822809942', '2493', '2026-07-02 11:27:10.351533+00', '2026-07-02 11:27:09.984+00'),
	('23f83c3c-e27b-4046-9b89-c568303c121b', '+243855764821', 'Sun64', '2026-07-02 13:40:38.02982+00', '2026-07-02 13:40:37.507+00'),
	('d5b9c78b-8075-4480-ab68-7fa5ce214810', '+243975465330', 'precie60', '2026-07-02 15:23:17.123112+00', '2026-07-02 15:23:16.853+00'),
	('cf4d6c37-4687-47e8-b104-8006edd6109a', '+243992976329', 'lecap1928', '2026-07-03 10:36:06.152312+00', '2026-07-03 10:36:05.815+00'),
	('30878f84-f95b-4b57-8939-9d5af1fd948a', '+243851547328', '1234567', '2026-06-22 16:34:21.835671+00', '2026-07-13 15:08:15.849+00'),
	('6315bc2c-b22a-4264-b36c-514d1d5af6e9', '+243906295503', 'junior**02', '2026-07-15 12:03:11.230366+00', '2026-07-15 12:03:09.189+00'),
	('bfbadafc-c63b-4d9f-8ac8-1e8a7157a0b1', '+243980954541', 'Mbapper07', '2026-07-15 20:19:46.560972+00', '2026-07-15 20:19:46.226+00'),
	('9d6cc48e-0a25-4f9b-b794-bc6ffed794a2', '+243828686120', 'sun64', '2026-07-17 22:44:04.048287+00', '2026-07-17 22:50:49.018+00'),
	('43e2cc0d-da52-488d-b0ad-24dd89be3ad4', '+243818655008', 'Christiano13#', '2026-07-15 21:47:58.823443+00', '2026-07-20 21:29:08.203+00'),
	('67447be9-7dd6-4728-b484-74a52b36559a', '+243861722831', 'Henrielle012', '2026-07-27 10:56:24.335135+00', '2026-07-27 10:56:23.613+00'),
	('ff422c67-e5cf-4a24-aab8-95e10eba67b3', '+243997866570', 'Henrielle012', '2026-06-25 12:32:42.060968+00', '2026-07-27 10:59:37.13+00'),
	('73437bb7-5d2f-4edd-93ce-f77a1d2b9b7c', '+243822165117', '251120', '2026-07-29 20:39:50.72642+00', '2026-07-29 20:39:49.809+00'),
	('15e84f58-6704-49bf-b795-61bf03d5fbd2', '+243810979710', 'Alg64', '2026-06-26 10:26:01.350089+00', '2026-07-30 08:34:25.387+00'),
	('60a0152c-ac89-44b7-ac12-d0490e498e6d', '+243979478418', 'Amira', '2026-07-30 10:40:40.325706+00', '2026-07-30 10:40:39.805+00'),
	('b23dc0e9-c3d7-408b-81c2-500c7cd12c24', '+243977252929', 'Kamarashavu243', '2026-06-26 10:55:10.928107+00', '2026-08-01 08:38:18.407+00'),
	('2c700a2b-076a-4101-ad6a-cd6c6aa2f0dc', '+243992641162', 'kin243', '2026-08-01 13:13:28.518701+00', '2026-08-01 13:13:28.196+00'),
	('9b73cdfd-289b-412f-b09a-497e39d0bcd6', '+243997688362', 'alg64', '2026-08-02 12:25:48.181223+00', '2026-08-02 12:31:38.179+00'),
	('1d581515-1b1d-4416-87f5-01e5d95f49ff', '+243848957350', 'alg64', '2026-08-02 20:58:11.805457+00', '2026-08-02 20:58:11.507+00'),
	('3ad184d5-1347-4e8f-86d4-b15021146fee', '+243852028702', 'kin2026@', '2026-08-03 11:37:07.720396+00', '2026-08-03 11:37:07.446+00'),
	('359a9638-1386-490c-a6ea-f5f4216c4787', '+243904557411', 'sun64', '2026-06-25 20:37:15.948988+00', '2026-08-03 15:46:48.01+00'),
	('9aff9d46-666b-4eef-8851-e2cfa4039c43', '+243985998472', 'alg64', '2026-08-01 08:04:51.590987+00', '2026-08-04 08:24:31.305+00'),
	('ad7f6ca3-aafe-4d26-b000-ff265195545d', '+243852959228', '1205djo', '2026-08-05 18:29:40.102996+00', '2026-08-05 18:29:39.804+00'),
	('cfbea23e-d7e7-4cae-8cae-ba4429800315', '+243832448175', 'jemima', '2026-08-07 05:13:54.821064+00', '2026-08-07 05:13:54.744+00');


--
-- Data for Name: vip_password_reset_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."vip_password_reset_requests" ("id", "phone", "status", "created_at", "sent_at") VALUES
	('bad73260-7a6e-42ce-8b7b-657f68da2f71', '+352691434011', 'sent', '2026-06-21 21:37:50.024082+00', '2026-06-21 22:30:11.308+00'),
	('d6fb118f-edbe-4c6f-b0c3-439c9f25c852', '+3526919434011', 'pending', '2026-06-21 22:33:38.528735+00', NULL),
	('6d649abd-4fe1-40a9-9c5b-726e30f6c49a', '+352691434011', 'sent', '2026-06-21 22:35:31.983054+00', '2026-06-21 22:35:46.626+00'),
	('b900680f-07ab-4bd8-abe5-2278c94d10c1', '+352691434011', 'sent', '2026-06-21 23:03:11.003514+00', '2026-06-21 23:03:31.874+00'),
	('e28e2553-faba-43d0-a96f-a429f3763de9', '+243997866570', 'sent', '2026-06-25 12:36:28.016637+00', '2026-06-26 11:12:41.475+00'),
	('e83fc0d6-96bf-4fe2-9a93-c358dc80c6df', '+243820730633', 'sent', '2026-06-27 18:01:42.761034+00', '2026-06-27 18:02:08.022+00'),
	('39791693-eaf9-4256-8338-1d9190869a73', '+243820730633', 'sent', '2026-07-03 10:33:00.624674+00', '2026-07-03 10:38:34.237+00'),
	('5cf254fe-c8c4-4fac-9e34-b3bd26aefd64', '+243851547328', 'sent', '2026-07-13 13:06:26.869049+00', '2026-07-13 14:59:16.239+00'),
	('43b61eb6-8945-49d0-acf8-25eb4badf5c0', '+243906295503', 'sent', '2026-07-15 11:57:56.907531+00', '2026-07-15 11:58:53.859+00'),
	('a158c155-d8e2-49d2-b127-73e398874a41', '+243997866570', 'sent', '2026-07-17 16:58:03.576251+00', '2026-07-17 16:59:27.473+00'),
	('c35a5524-8b02-4cac-a935-de7e9926a670', '+243828686120', 'sent', '2026-07-17 22:49:12.883396+00', '2026-07-17 22:49:40.565+00'),
	('8f8bfacf-6c02-4903-8267-44bb01e1889e', '+243818655008', 'sent', '2026-07-18 15:12:31.634592+00', '2026-07-18 15:12:55.437+00'),
	('538d176f-1f69-4295-8dd6-7811f52ee60a', '+243818655008', 'sent', '2026-07-20 21:26:57.595203+00', '2026-07-20 21:27:21.281+00'),
	('91f78895-1dc7-4e8c-833c-15518db619d9', '+243997866570', 'sent', '2026-07-27 10:08:02.743987+00', '2026-07-27 10:56:40.507+00'),
	('b5251e25-db73-42a9-b810-033bdd483e49', '+243979478418', 'sent', '2026-07-30 08:25:53.971074+00', '2026-07-30 10:39:46.341+00'),
	('bdbf5661-161b-47bd-9875-442c1994928f', '+243985998472', 'sent', '2026-08-01 08:12:16.470209+00', '2026-08-01 08:13:12.803+00'),
	('cf3a24e0-8f63-4cc1-95f2-3263f138aee2', '+243977252929', 'sent', '2026-07-28 08:07:59.239923+00', '2026-08-01 08:32:58.153+00'),
	('f673d8a3-f5f6-4462-9993-0a0cb1d3f937', '+243985998472', 'sent', '2026-08-02 11:52:19.08655+00', '2026-08-02 11:52:36.29+00'),
	('572d5a38-6232-4df9-bad6-8ba4760a6df7', '+243997688362', 'sent', '2026-08-02 12:28:36.551229+00', '2026-08-02 12:28:47.055+00'),
	('b715d0e2-d7cd-4732-8272-a9cd469301f5', '+243904557411', 'sent', '2026-08-03 15:31:20.690605+00', '2026-08-03 15:31:32.158+00'),
	('378190db-4ba2-47ab-9f93-06b25a3693fd', '+243985998472', 'sent', '2026-08-04 08:20:05.573909+00', '2026-08-04 08:20:16.065+00');


--
-- Data for Name: vip_password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "style"."vip_password_reset_tokens" ("id", "phone", "token", "created_at", "expires_at", "used_at") VALUES
	('b66da964-6969-4981-9c65-f0115abdf94c', '+352691434011', '38c9f83a-02b9-426e-a67d-f4b9fb32d5aa', '2026-06-21 22:30:12.055297+00', '2026-06-21 23:30:12.055297+00', '2026-06-21 22:31:25.668+00'),
	('af2fbdf5-b9fe-46c8-8761-bd50cbeed7dc', '+352691434011', '7a9628d6-4d50-4a75-a034-fc18affbfcde', '2026-06-21 22:35:47.434295+00', '2026-06-21 23:35:47.434295+00', NULL),
	('b8d9b96c-27b4-4c40-b710-67c324c1f65e', '+352691434011', 'e7debf4d-e6a6-47a5-9758-772d71c95458', '2026-06-21 23:03:31.871267+00', '2026-06-22 00:03:31.871267+00', '2026-06-21 23:04:19.62+00'),
	('8214ec4f-8230-4da7-8336-9a16809fde1e', '+243997866570', 'eb8699a2-f2ca-4621-83d3-832b368cda83', '2026-06-26 11:12:41.521857+00', '2026-06-26 12:12:41.521857+00', NULL),
	('5f3c9f3b-cdbc-479d-9c2a-2987414b076e', '+243820730633', 'dd58ab7b-47e8-4bd8-8f3e-18a9c473e693', '2026-06-27 18:02:07.897619+00', '2026-06-27 19:02:07.897619+00', '2026-06-27 18:03:08.301+00'),
	('24c51e3d-3122-4936-bf3b-0fe7f986accc', '+243820730633', '5d7b4427-9049-4f4f-acea-ec3bbb928dc4', '2026-07-03 10:38:34.202207+00', '2026-07-03 11:38:34.202207+00', NULL),
	('fef8a2c0-3600-4696-9415-27a389f2432e', '+243851547328', '7cd94cfb-65f9-4e87-9dc6-41d64938b716', '2026-07-13 14:59:15.778988+00', '2026-07-13 15:59:15.778988+00', NULL),
	('a91802e2-c657-4ce8-9313-73dd0eadc367', '+243851547328', '44fbdb21-b79f-4de8-bc2b-d419d6cb379c', '2026-07-13 14:59:16.103594+00', '2026-07-13 15:59:16.103594+00', '2026-07-13 15:08:16.317+00'),
	('0b54c2be-5d2d-40e4-ac36-8507d869d413', '+243906295503', 'e9cd5436-2403-45ea-8c58-c0f127db12ae', '2026-07-15 11:58:53.718552+00', '2026-07-15 12:58:53.718552+00', '2026-07-15 12:03:10.807+00'),
	('a90511aa-81a7-4659-9fe7-3277d0c8fe7c', '+243997866570', '1489e5bb-d3e8-48f2-b968-5e1867c33aad', '2026-07-17 16:59:27.30255+00', '2026-07-17 17:59:27.30255+00', '2026-07-17 17:03:20.487+00'),
	('d62d6a4e-e633-4cf4-8032-4d95b311546e', '+243828686120', '885a6b04-c1e7-4f86-8b95-4d471cd47ff2', '2026-07-17 22:49:40.412847+00', '2026-07-17 23:49:40.412847+00', '2026-07-17 22:50:49.781+00'),
	('b1865421-0067-4267-b46c-4b9f5aac353d', '+243818655008', '5a4ee589-7a17-4b1f-8323-df9a88a9efd8', '2026-07-18 15:12:55.263191+00', '2026-07-18 16:12:55.263191+00', NULL),
	('176dfb80-8c04-4c41-9e22-f72fb7363a8d', '+243818655008', '28b99637-6a71-4aa9-aac4-42196d55151a', '2026-07-20 21:27:21.132971+00', '2026-07-20 22:27:21.132971+00', '2026-07-20 21:29:09.039+00'),
	('33746350-b3fa-4919-8219-b8297556c508', '+243997866570', '6dc5c2d6-4ca1-4657-9e97-090b8085cd51', '2026-07-27 10:56:40.734563+00', '2026-07-27 11:56:40.734563+00', '2026-07-27 10:59:38.054+00'),
	('3853e784-716f-4253-915f-215c091e370b', '+243979478418', '9dab63b3-f83c-477c-8303-ee33ebf05a26', '2026-07-30 10:39:46.202578+00', '2026-07-30 11:39:46.202578+00', NULL),
	('6eb6010c-7a8d-46eb-b933-2cec593b0128', '+243979478418', '1404220a-9b6c-40f7-88e6-1af63886f70a', '2026-07-30 10:39:45.904711+00', '2026-07-30 11:39:45.904711+00', '2026-07-30 10:40:40.292+00'),
	('88ae0a36-4442-4ee7-8563-b7e96d7e29e1', '+243985998472', 'acf7eca3-7c91-40ea-8001-c47966acd7f3', '2026-08-01 08:13:12.648319+00', '2026-08-01 09:13:12.648319+00', NULL),
	('ea66b710-94da-491f-b99d-d11c8af6d20a', '+243977252929', 'bb975fb8-eb9c-4990-8aac-6a4fe9f1fd89', '2026-08-01 08:32:58.019044+00', '2026-08-01 09:32:58.019044+00', '2026-08-01 08:38:26.786+00'),
	('00a1e958-4b9f-4970-a466-55d19972ca74', '+243985998472', '7b50e904-8187-4957-a78f-a79e8929178e', '2026-08-02 11:52:36.151405+00', '2026-08-02 12:52:36.151405+00', '2026-08-02 11:54:31.879+00'),
	('a0a626ce-2c64-4766-9f7d-7dd9bf659618', '+243997688362', '0664c484-fe86-491b-8658-e779a29286fd', '2026-08-02 12:28:46.925411+00', '2026-08-02 13:28:46.925411+00', '2026-08-02 12:31:39.3+00'),
	('08ebf8a1-7162-4ee5-a450-049c73c8ac12', '+243904557411', '90f08a8a-d3a5-49ea-b6fd-d55ad334908e', '2026-08-03 15:31:31.979619+00', '2026-08-03 16:31:31.979619+00', NULL),
	('67d56cb1-2e70-495b-bc88-474a2d4fbc78', '+243904557411', '6cc4cf0f-70c9-4eb2-9fb5-6a2097af823a', '2026-08-03 15:31:31.98905+00', '2026-08-03 16:31:31.98905+00', '2026-08-03 15:46:48.507+00'),
	('0710cddc-0419-4b10-b15c-7f2c592d92a9', '+243985998472', '3fe80237-142a-4982-8688-1f53918a23a5', '2026-08-04 08:20:16.13501+00', '2026-08-04 09:20:16.13501+00', '2026-08-04 08:24:32.554+00');


--
-- PostgreSQL database dump complete
--

-- \unrestrict GVjEbLtigGAPJt6Yzmsa3aUcwm16M9Km331qFdMb0rjgY5wKc3cZ1IVlIpuccOk

RESET ALL;


GRANT USAGE ON SCHEMA "style"
TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA "style"
TO anon, authenticated, service_role;

GRANT ALL ON ALL ROUTINES IN SCHEMA "style"
TO anon, authenticated, service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA "style"
TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA "style"
GRANT ALL ON TABLES
TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA "style"
GRANT ALL ON ROUTINES
TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA "style"
GRANT ALL ON SEQUENCES
TO anon, authenticated, service_role;

