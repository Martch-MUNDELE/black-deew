import { createClient } from "@/lib/supabase/server";
import AdminNavClient from "@/components/admin/AdminNavClient";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";

const NAV_GROUPS = [
  {
    label: "BOUTIQUE",
    links: [
      { href: "/admin", label: "Dashboard", icon: "home" },
      {
        href: "/admin/commandes", label: "Commandes", icon: "shopping-bag",
        sub: [
          { label: "Nouvelles",   url: "/admin/commandes?tab=nouvelle" },
          { label: "Confirmées",  url: "/admin/commandes?tab=confirmée" },
          { label: "Préparation", url: "/admin/commandes?tab=en_preparation" },
          { label: "Livraison",   url: "/admin/commandes?tab=en_livraison" },
          { label: "Livrées",     url: "/admin/commandes?tab=livrée" },
          { label: "Annulées",    url: "/admin/commandes?tab=annulée" },
          { label: "Retrait",     url: "/admin/commandes?tab=retrait" },
        ],
      },
      {
        href: "/admin/produits", label: "Produits", icon: "package",
        sub: [
          { label: "+ Ajouter", url: "/admin/produits/nouveau" },
          { label: "Actifs",    url: "/admin/produits?tab=actifs" },
          { label: "Inactifs",  url: "/admin/produits?tab=inactifs" },
          { label: "VIP",       url: "/admin/produits?tab=vip" },
        ],
      },
    ],
  },
  {
    label: "CONFIGURATION",
    links: [
      { href: "/admin/menu",     label: "Menu",     icon: "utensils" },
      { href: "/admin/livreurs", label: "Livreurs", icon: "users" },
      {
        href: "/admin/livraison", label: "Livraison", icon: "truck",
        sub: [
          { label: "Mode",             url: "/admin/livraison?tab=mode" },
          { label: "Position boutique", url: "/admin/livraison?tab=position" },
          { label: "Zone & tarifs",    url: "/admin/livraison?tab=zone" },
          { label: "Simulateur",       url: "/admin/livraison?tab=simulateur" },
        ],
      },
      {
        href: "/admin/creneaux", label: "Créneaux", icon: "clock",
        sub: [
          { label: "Horaires",       url: "/admin/creneaux?tab=horaires" },
          { label: "Pause déjeuner", url: "/admin/creneaux?tab=pause" },
          { label: "Jours fermés",   url: "/admin/creneaux?tab=fermeture" },
          { label: "Génération",     url: "/admin/creneaux?tab=generation" },
        ],
      },
      {
        href: "/admin/settings", label: "Paramètres", icon: "settings",
        sub: [
          { label: "Statut service",    url: "/admin/settings?tab=statut" },
          { label: "Identité du site",  url: "/admin/settings?tab=identite" },
          { label: "Fond de page",      url: "/admin/settings?tab=fond" },
          { label: "Image hero",        url: "/admin/settings?tab=hero" },
          { label: "Arguments produit", url: "/admin/settings?tab=arguments" },
          { label: "Devise",            url: "/admin/settings?tab=devise" },
          { label: "Notifications",     url: "/admin/settings?tab=notifications" },
          { label: "Footer",            url: "/admin/settings?tab=footer" },
          { label: "Accès VIP",         url: "/admin/settings?tab=vip" },
        ],
      },
    ],
  },
  {
    label: "FACTURATION",
    links: [
      { href: "/admin/abonnement", label: "Mon abonnement", icon: "clock" },
    ],
  },
  {
    label: "SUPER ADMIN",
    links: [
      { href: "/admin/superadmin", label: "Super Admin", icon: "star", sub: [
        { label: "Administrateurs", url: "/admin/superadmin" },
        { label: "Journal", url: "/admin/superadmin" },
      ]},
      { href: "/admin/superadmin/facturation/contrats", label: "Facturation", icon: "clock", sub: [
        { label: "Clients & Contrats", url: "/admin/superadmin/facturation/contrats" },
        { label: "Périodes", url: "/admin/superadmin/facturation/periodes" },
        { label: "Ajustements", url: "/admin/superadmin/facturation/ajustements" },
      ]},
    ],
  },
];

export default async function AdminNav() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let siteName = "Black Deew";
  let siteLogo = "";

  if (user?.email) {
    const [, settingsData] = await Promise.all([
      supabase.from("admins").select("role, status").eq("email", user.email).maybeSingle(),
      supabase.from("settings").select("key, value").in("key", ["site_name", "site_logo"]),
    ]);
    const nameRow = (settingsData.data || []).find(s => s.key === "site_name");
    if (nameRow?.value) siteName = nameRow.value;
    const logoRow = (settingsData.data || []).find(s => s.key === "site_logo");
    if (logoRow?.value) siteLogo = logoRow.value;
  }

  return (
    <AdminNavClient groups={NAV_GROUPS} siteName={siteName} siteLogo={siteLogo}>
      <AdminLogoutButton />
    </AdminNavClient>
  );
}
