"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Home, Package, ShoppingBag, Truck, Clock, Settings,
  Users, Star, UtensilsCrossed, ChevronDown, X, Menu, Lock,
  type LucideProps,
} from "lucide-react";

type NavSubLink = {
  label: string;
  url: string;
};

type NavLink = {
  href: string;
  label: string;
  icon: string;
  sub?: NavSubLink[];
  badge?: boolean;
  badgeCount?: number;
};

type NavGroup = {
  label: string;
  links: NavLink[];
};

type IconComponent = React.ComponentType<LucideProps>;

const ICON_MAP: Record<string, IconComponent> = {
  "home": Home,
  "package": Package,
  "shopping-bag": ShoppingBag,
  "truck": Truck,
  "clock": Clock,
  "settings": Settings,
  "users": Users,
  "star": Star,
  "utensils": UtensilsCrossed,
  "lock": Lock,
};

function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={18} className={className} aria-hidden="true" />;
}


export default function AdminNavClient({
  groups,
  siteName,
  siteLogo,
  children,
}: {
  groups: NavGroup[];
  siteName: string;
  siteLogo?: string;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [superAdmin, setSuperAdmin] = useState(false);

  useEffect(() => {
    const sb = createClient();
    let active = true;
    let handled = false;

    const checkRole = async (email: string) => {
      try {
        const { data: admin } = await sb.from("admins").select("role,status").eq("email", email).single();
        if (active) setSuperAdmin(admin?.role === "superadmin" && admin?.status === "active");
      } catch {
        if (active) setSuperAdmin(false);
      }
    };

    sb.auth.getSession().then(({ data: { session } }) => {
      if (!active || handled) return;
      const email = session?.user?.email;
      if (!email) return;
      handled = true;
      checkRole(email);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (!active || handled) return;
      const email = session?.user?.email;
      if (!email) return;
      handled = true;
      checkRole(email);
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  const [expandedHref, setExpandedHref] = useState<string | null>(null);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [logoUrl, setLogoUrl] = useState(siteLogo || "");

  useEffect(() => {
    if (logoUrl) return;
    const sb = createClient();
    sb.from("settings").select("value").eq("key", "site_logo").maybeSingle().then(({ data }) => {
      if (data?.value) setLogoUrl(data.value);
    });
  }, [logoUrl]);
  const [pendingVipCount, setPendingVipCount] = useState(0);
  const prevOrderIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const sb = createClient();
    sb.from("orders").select("id").eq("status", "nouvelle").then(({ data }) => {
      const rows = (data || []) as { id: string }[];
      prevOrderIds.current = new Set(rows.map(o => o.id));
      setNewOrderCount(rows.length);
      isFirstLoad.current = false;
    });
    const channel = sb.channel("adminnav-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const o = payload.new as { id: string };
        if (!prevOrderIds.current.has(o.id)) {
          prevOrderIds.current.add(o.id);
          setNewOrderCount(c => c + 1);
        }
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const sb = createClient();
    sb.from("vip_access_requests").select("id").eq("status", "pending").then(({ data }) => {
      setPendingVipCount((data || []).length);
    });
    const ch = sb.channel("adminnav-vip")
      .on("postgres_changes", { event: "*", schema: "public", table: "vip_access_requests" }, () => {
        sb.from("vip_access_requests").select("id").eq("status", "pending").then(({ data }) => {
          setPendingVipCount((data || []).length);
        });
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, []);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href + "?");
  }

  function toggleExpand(href: string) {
    setExpandedHref(prev => prev === href ? null : href);
  }

  const close = () => setMenuOpen(false);

  // Groupes visibles (superadmin conditionnel)
  const visibleGroups = groups.filter(g => {
    if (g.label === "SUPER ADMIN") return superAdmin;
    return true;
  });

  // Bottom bar fixe : Dashboard, Commandes, Accès VIP
  const BOTTOM_HREFS = ["/admin", "/admin/commandes", "/admin/settings"];
  const allLinks = visibleGroups.flatMap(g => g.links);
  const bottomLinks = BOTTOM_HREFS.map(h => allLinks.find(l => l.href === h)).filter(Boolean) as typeof allLinks;

  const logoMark = siteName.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();

  return (
    <>
      {/* ── SIDEBAR DESKTOP ── */}
      <aside className="bd-sidebar" aria-label="Navigation administration">
        <div className="bd-sidebar-logo">
          <Link href="/admin" className="bd-sidebar-logo-link">
            <span className="bd-sidebar-logo-mark">{logoMark}</span>
            <div>
              <span className="bd-sidebar-logo-name">{siteName}</span>
              <span className="bd-sidebar-logo-sub">Administration</span>
            </div>
          </Link>
        </div>

        <nav className="bd-sidebar-nav">
          {visibleGroups.map(group => (
            <div key={group.label} className="bd-sidebar-group">
              <span className="bd-sidebar-group-label">{group.label}</span>
              {group.links.map(link => {
                const active = isActive(link.href, link.href === "/admin");
                const expanded = expandedHref === link.href;
                return (
                  <div key={link.href}>
                    {link.sub ? (
                      <button
                        onClick={() => toggleExpand(link.href)}
                        className={`bd-sidebar-link bd-sidebar-link-btn${active ? " is-active" : ""}`}
                        aria-expanded={expanded}
                      >
                        <NavIcon name={link.icon} className="bd-sidebar-link-icon" />
                        <span className="bd-sidebar-link-label">{link.label}</span>
                        <ChevronDown size={14} className={`bd-sidebar-chevron${expanded ? " is-open" : ""}`} />
                      </button>
                    ) : (
                      <Link
                        href={link.href}
                        className={`bd-sidebar-link${active ? " is-active" : ""}`}
                        aria-current={active ? "page" : undefined}
                      >
                        <NavIcon name={link.icon} className="bd-sidebar-link-icon" />
                        <span className="bd-sidebar-link-label">{link.label}</span>
                        {(link.badgeCount ?? 0) > 0 && (
                          <span className="bd-sidebar-badge">{link.badgeCount}</span>
                        )}
                      </Link>
                    )}
                    {link.sub && expanded && (
                      <div className="bd-sidebar-sub">
                        {link.sub.map(sub => (
                          <Link
                            key={sub.label}
                            href={sub.url}
                            className={`bd-sidebar-sub-link${pathname + (typeof window !== "undefined" ? window.location.search : "") === sub.url ? " is-active" : ""}`}
                          >
                            {sub.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="bd-sidebar-footer">{children}</div>
      </aside>

      {/* ── HEADER MOBILE ── */}
      <header className="bd-mobile-header" aria-label="En-tête administration">
        <Link href="/admin" className="bd-mobile-logo-link">
          {logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logoUrl} alt={siteName} width={32} height={32} style={{ objectFit: "contain", borderRadius: 8, flexShrink: 0 }} />
            : <span className="bd-mobile-logo-mark">{logoMark}</span>
          }
          <span className="bd-mobile-logo-name">{siteName} Admin</span>
        </Link>
      </header>

      {/* Overlay */}
      {menuOpen && (
        <div className="bd-mobile-overlay" onClick={close} aria-hidden="true" />
      )}

      {/* Dropdown mobile */}
      {menuOpen && (
        <div className="bd-mobile-drawer" role="navigation" aria-label="Menu administration">
          {visibleGroups.map(group => (
            <div key={group.label}>
              <div className="bd-drawer-group-label">{group.label}</div>
              {group.links.map(link => {
                const active = isActive(link.href, link.href === "/admin");
                const expanded = expandedHref === link.href;
                return (
                  <div key={link.href}>
                    {link.sub ? (
                      <button
                        onClick={() => toggleExpand(link.href)}
                        className={`bd-drawer-link bd-drawer-link-btn${active ? " is-active" : ""}`}
                      >
                        <NavIcon name={link.icon} />
                        <span>{link.label}</span>
                        <ChevronDown size={13} className={`bd-sidebar-chevron${expanded ? " is-open" : ""}`} />
                      </button>
                    ) : (
                      <Link
                        href={link.href}
                        className={`bd-drawer-link${active ? " is-active" : ""}`}
                        onClick={close}
                        aria-current={active ? "page" : undefined}
                      >
                        <NavIcon name={link.icon} />
                        <span>{link.label}</span>
                      </Link>
                    )}
                    {link.sub && expanded && (
                      <div className="bd-drawer-sub">
                        {link.sub.map(sub => (
                          <Link
                            key={sub.label}
                            href={sub.url}
                            className="bd-drawer-sub-link"
                            onClick={close}
                          >
                            {sub.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="bd-drawer-footer">{children}</div>
        </div>
      )}

      {/* ── BOTTOM BAR MOBILE ── */}
      <nav className="bd-bottom-bar" aria-label="Navigation principale">
        {bottomLinks.map(link => {
          const isVip = link.href === "/admin/settings";
          const href = isVip ? "/admin/settings?tab=vip" : link.href;
          const label = isVip ? "Accès VIP" : link.label;
          const icon = isVip ? "lock" : link.icon;
          const active = isVip ? pathname.startsWith("/admin/settings") : isActive(link.href, link.href === "/admin");
          return (
            <Link
              key={link.href}
              href={href}
              className={`bd-bottom-tab${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="bd-bottom-tab-icon" style={{ position: "relative" }}>
                <NavIcon name={icon} />
                {link.href === "/admin/commandes" && newOrderCount > 0 && (
                  <span style={{ position: "absolute", top: -6, right: -8, background: "#F5C842", color: "#000", borderRadius: 9, minWidth: 16, height: 16, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{newOrderCount}</span>
                )}
                {isVip && pendingVipCount > 0 && (
                  <span style={{ position: "absolute", top: -6, right: -8, background: "#F5C842", color: "#000", borderRadius: 9, minWidth: 16, height: 16, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{pendingVipCount}</span>
                )}
              </span>
              <span className="bd-bottom-tab-label">{label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className={`bd-bottom-tab${menuOpen ? " is-active" : ""}`}
          aria-label="Menu"
        >
          <span className="bd-bottom-tab-icon">
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </span>
          <span className="bd-bottom-tab-label">Menu</span>
        </button>
      </nav>
    </>
  );
}
