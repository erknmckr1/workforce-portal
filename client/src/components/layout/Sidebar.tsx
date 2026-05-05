import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Briefcase,
  FileText,
  ClipboardCheck,
  ShieldCheck,
  Stethoscope,
  MonitorSmartphone,
  Wrench,
  CalendarRange,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useModuleStore } from "@/store/moduleStore";
import apiClient from "@/lib/api";
import { toast } from "sonner";

const menuItems = [
  {
    title: "Panel",
    icon: LayoutDashboard,
    path: "/panel",
    roles: ["Admin", "Müdür", "Şef", "Personel", "İK", "Revir"],
  },
  {
    title: "İzinlerim",
    icon: CalendarDays,
    path: "/leaves",
    roles: ["Admin", "Müdür", "Şef", "Personel", "İK", "Revir", "Güvenlik"],
  },
  {
    title: "Onay Bekleyenler",
    icon: ClipboardCheck,
    path: "/leave-approvals",
    roles: ["Admin", "Müdür", "Şef", "İK"],
  },
  {
    title: "Personel Yönetimi",
    icon: Users,
    path: "/management",
    roles: ["Admin", "İK"],
  },
  {
    title: "Güvenlik Paneli",
    icon: ShieldCheck,
    path: "/security",
    roles: ["Admin", "Güvenlik"],
  },
  {
    title: "Raporlar",
    icon: FileText,
    path: "/reports",
    roles: ["Admin", "İK", "Müdür"],
  },
  {
    title: "Revir İşlemleri",
    icon: Stethoscope,
    path: "/infirmary",
    roles: ["Admin", "Revir"],
  },
  {
    title: "Üretim Ekranları",
    icon: MonitorSmartphone,
    path: "/mes-screens",
    roles: ["Admin"],
  },
  {
    title: "Araçlar",
    icon: Wrench,
    roles: ["Admin", "İK", "Müdür", "Şef", "Personel", "Revir", "Güvenlik"],
    children: [
      {
        title: "Senelik Plan",
        path: "/yearly-plan",
        icon: CalendarRange,
        roles: ["Admin", "İK", "Müdür", "Şef", "Personel", "Revir", "Güvenlik"],
      },
      {
        title: "Yemek Menüsü",
        path: "/food-menu",
        icon: FileText,
        roles: ["Admin", "İK", "Müdür", "Şef", "Personel", "Revir", "Güvenlik"],
      },
    ],
  },
  {
    title: "Ayarlar",
    icon: Settings,
    roles: ["Admin", "İK"],
    children: [
      { 
        title: "Genel Ayarlar", 
        path: "/settings/general",
        roles: ["Admin"]
      },
      { 
        title: "Onay Hiyerarşisi", 
        path: "/settings/approvals",
        roles: ["Admin"]
      },
      {
        title: "Takvim Yönetimi",
        path: "/calendar-manager",
        roles: ["Admin", "İK"],
      },
      {
        title: "Şifre Talepleri",
        path: "/password-resets",
        roles: ["Admin", "İK"],
      },
      {
        title: "Yemek Yönetimi",
        path: "/settings/food-menu",
        roles: ["Admin"],
      },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  collapsed: boolean;
  onCollapse: (val: boolean) => void;
}

export default function Sidebar({
  isOpen,
  onToggle,
  collapsed,
  onCollapse,
}: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(
    location.pathname.startsWith("/settings") ||
      location.pathname.startsWith("/calendar-manager")
      ? "Ayarlar"
      : location.pathname.startsWith("/yearly-plan")
        ? "Araçlar"
        : null,
  );

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
      logout();
      toast.success("Güvenli çıkış yapıldı.");
    } catch (error) {
      console.log(error);
      toast.error("Çıkış yapılırken bir hata oluştu.");
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onToggle}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col h-screen bg-card border-r border-border transition-all duration-300 ease-in-out lg:relative",
          collapsed ? "w-[80px]" : "w-[280px]",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo Alanı */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-border/50 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
              <Briefcase className="text-primary-foreground" size={20} />
            </div>
            <div
              className={cn(
                "flex flex-col transition-opacity duration-300",
                collapsed ? "lg:opacity-0" : "opacity-100",
              )}
            >
              <span className="font-black text-lg tracking-tighter text-foreground leading-none">
                Midas
              </span>
            </div>
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={onToggle}
            className="p-2 rounded-xl hover:bg-muted lg:hidden"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Menü Öğeleri */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 custom-scrollbar">
          {menuItems
            .filter((item) => item.roles.includes(user?.role || ""))
            .map((item) => {
              const hasChildren = !!item.children;
              const isActive = hasChildren
                ? item.children!.some(
                    (child) => location.pathname === child.path,
                  )
                : location.pathname === item.path;
              const isExpanded = expandedMenu === item.title;
              const Icon = item.icon;

              return (
                <div key={item.title} className="flex flex-col space-y-1">
                  {hasChildren ? (
                    <button
                      onClick={() => {
                        if (collapsed) onCollapse(false);
                        setExpandedMenu(isExpanded ? null : item.title);
                      }}
                      className={cn(
                        "flex items-center gap-4 px-4 h-12 w-full rounded-xl transition-all group relative overflow-hidden",
                        isActive && !isExpanded
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon
                        size={20}
                        className={cn(
                          "shrink-0 transition-transform",
                          isActive ? "text-primary" : "group-hover:scale-110",
                        )}
                      />
                      <span
                        className={cn(
                          "font-bold text-sm tracking-tight transition-all text-left flex-1",
                          collapsed
                            ? "lg:opacity-0 lg:w-0"
                            : "opacity-100 w-auto",
                        )}
                      >
                        {item.title}
                      </span>
                      {!collapsed && (
                        <ChevronDown
                          size={16}
                          className={cn(
                            "transition-transform text-muted-foreground group-hover:text-foreground",
                            isExpanded ? "rotate-180" : "rotate-0",
                          )}
                        />
                      )}
                    </button>
                  ) : (
                    <Link
                      to={item.path!}
                      onClick={() => {
                        if (window.innerWidth < 1024) onToggle();
                      }}
                      className={cn(
                        "flex items-center gap-4 px-4 h-12 rounded-xl transition-all group relative overflow-hidden",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon
                        size={20}
                        className={cn(
                          "shrink-0",
                          isActive
                            ? "scale-110"
                            : "group-hover:scale-110 transition-transform",
                        )}
                      />
                      <span
                        className={cn(
                          "font-bold text-sm tracking-tight transition-all",
                          collapsed
                            ? "lg:opacity-0 lg:w-0"
                            : "opacity-100 w-auto",
                        )}
                      >
                        {item.title}
                      </span>

                      {isActive && (
                        <div className="absolute left-0 w-1 h-6 bg-primary-foreground rounded-r-full" />
                      )}
                    </Link>
                  )}

                  {hasChildren && isExpanded && !collapsed && (
                    <div className="flex flex-col space-y-1 pl-12 pr-2 animate-in slide-in-from-top-2 duration-200">
                      {item
                        .children!.filter(
                          (child) =>
                            !("roles" in child) ||
                            (child as any).roles.includes(user?.role || ""),
                        )
                        .map((child) => {
                          const isChildActive =
                            location.pathname === child.path;
                          return (
                            <Link
                              key={child.path}
                              to={child.path}
                              onClick={() => {
                                if (window.innerWidth < 1024) onToggle();
                              }}
                              className={cn(
                                "flex items-center h-10 px-4 rounded-xl text-sm font-bold transition-all relative overflow-hidden",
                                isChildActive
                                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}
                            >
                              <span>{child.title}</span>
                              {isChildActive && (
                                <div className="absolute left-0 w-1 h-4 bg-primary-foreground rounded-r-full" />
                              )}
                            </Link>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
        </nav>

        {/* Alt Kısım: İşlemler & Çıkış */}
        <div className="p-4 border-t border-border/50 space-y-2">
          {/* Kiosk Açma Butonu */}
          <button
            onClick={() => useModuleStore.getState().openPopup()}
            className={cn(
              "flex items-center gap-4 px-4 h-12 w-full rounded-xl transition-all  bg-orange-500/10 hover:bg-orange-500 text-foreground hover:text-card group",
              collapsed ? "lg:justify-center" : "",
            )}
          >
            <MonitorSmartphone
              size={20}
              className="shrink-0 group-hover:scale-110 transition-transform"
            />
            <span
              className={cn(
                "font-bold text-sm tracking-tight",
                collapsed ? "lg:hidden" : "block",
              )}
            >
              Kiosk Ekranı
            </span>
          </button>

          {/* Oturumu Kapat */}
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-4 px-4 h-12 w-full rounded-xl transition-all text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-95",
              collapsed ? "lg:justify-center" : "",
            )}
          >
            <LogOut size={20} className="shrink-0" />
            <span
              className={cn(
                "font-bold text-sm tracking-tight",
                collapsed ? "lg:hidden" : "block",
              )}
            >
              Oturumu Kapat
            </span>
          </button>
        </div>

        {/* Daraltma Butonu (Desktop Only) */}
        <button
          onClick={() => onCollapse(!collapsed)}
          className="absolute -right-3 top-10 w-6 h-6 rounded-full bg-background border border-border hidden lg:flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors shadow-sm z-50"
        >
          <ChevronLeft
            size={14}
            className={cn(
              "transition-transform",
              collapsed ? "rotate-180" : "rotate-0",
            )}
          />
        </button>
      </aside>
    </>
  );
}
