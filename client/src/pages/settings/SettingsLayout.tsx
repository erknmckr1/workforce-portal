import { Outlet, NavLink } from "react-router-dom";
import { Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const settingsLinks = [
  { path: "/settings", label: "Genel Ayarlar", icon: Settings, end: true },
  { path: "/settings/approvals", label: "Onay Hiyerarşisi", icon: ShieldCheck, end: false },
];

export default function SettingsLayout() {
  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
      {/* Sol Menü - Settings Sidebar */}
      <aside className="w-full lg:w-72 shrink-0">
        <div className="bg-card border border-border rounded-[2rem] p-4 shadow-sm">
          <h2 className="text-xl font-black px-4 mb-4 text-foreground">Sistem Ayarları</h2>
          <nav className="flex flex-col gap-2">
            {settingsLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  end={link.end}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-4 h-12 rounded-2xl font-bold transition-all text-sm",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon size={18} />
                  {link.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Sağ İçerik - Nested Route */}
      <main className="flex-1 bg-card border border-border rounded-[2.5rem] p-8 shadow-sm overflow-hidden min-h-[500px]">
        <Outlet />
      </main>
    </div>
  );
}
