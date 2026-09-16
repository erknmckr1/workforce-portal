import { Outlet, useLocation } from "react-router-dom";
import { Layers, Sun, Moon, LogOut } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useTheme } from "@/components/theme-provider";
import apiClient from "@/lib/api";
import { toast } from "sonner";

export default function PartiTakibiLayout() {
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      sessionStorage.setItem("redirect_after_login", location.pathname + location.search);
      await apiClient.post("/auth/logout");
      logout();
      toast.success("Güvenli çıkış yapıldı.");
    } catch {
      toast.error("Çıkış yapılırken bir hata oluştu.");
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      {/* ÜST HEADER (Sidebar Yok, İzolasyonlu Bağımsız Navbar) */}
      <header className="h-16 border-b border-border bg-card/60 backdrop-blur-xl px-6 flex items-center justify-between shrink-0 z-30">
        {/* Sol Taraf: Logo & Başlık */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shadow-xs">
            <Layers size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-tight text-foreground uppercase">
                Midas
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                Parti Takibi
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground hidden md:block">
              Parti ve Lot Süreç Yönetim Paneli
            </p>
          </div>
        </div>

        {/* Sağ Taraf: Tema, Kullanıcı Bilgisi & Çıkış */}
        <div className="flex items-center gap-3">
          {/* Tema Değiştir */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl border border-border transition-all cursor-pointer active:scale-95"
            title="Temayı Değiştir"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Kullanıcı Rozeti */}
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border text-xs">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
              {user?.name?.[0] || "U"}
            </div>
            <div className="text-left">
              <div className="font-bold text-foreground text-xs leading-none">
                {user?.name || "Kullanıcı"}
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                {user?.role || "Operatör"}
              </div>
            </div>
          </div>

          {/* Çıkış */}
          <button
            onClick={handleLogout}
            className="p-2.5 bg-secondary hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-xl border border-border transition-all cursor-pointer active:scale-95"
            title="Güvenli Çıkış"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* SAYFA İÇERİĞİ (Full Width / Split View Ready) */}
      <main className="flex-1 overflow-y-auto bg-muted/20 custom-scrollbar p-4 lg:p-6">
        <div className="w-full h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
