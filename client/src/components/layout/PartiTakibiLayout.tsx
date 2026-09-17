import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Layers, Sun, Moon, CalendarDays, X } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useModuleStore } from "@/store/moduleStore";
import KioskPage from "@/pages/KioskPage";

export default function PartiTakibiLayout() {
  const { theme, setTheme } = useTheme();
  const { closePopup } = useModuleStore();
  const [isKioskOpen, setIsKioskOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden relative">
      {/* Kiosk (İzin Alma) Modal Overlay */}
      {isKioskOpen && (
        <div className="fixed inset-0 z-50 animate-in fade-in duration-200">
          <KioskPage />
          <button
            onClick={() => {
              setIsKioskOpen(false);
              closePopup();
            }}
            className="fixed top-3.5 right-6 z-60 bg-destructive hover:bg-destructive/90 text-destructive-foreground px-5 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <X size={16} />
            <span>Kapat / Ekrana Dön</span>
          </button>
        </div>
      )}

      {/* ÜST HEADER (Kiosk Modu - Şifresiz / Bağımsız Terminal) */}
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
                Parti Takibi Kiosk
              </span>
            </div>
          </div>
        </div>

        {/* Sağ Taraf: İzin Girişi & Tema Değiştir */}
        <div className="flex items-center gap-3">
          {/* İzin Talebi / Kiosk Butonu */}
          <button
            onClick={() => setIsKioskOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 uppercase tracking-wider"
            title="İzin Talebi / Kiosk Ekranı"
          >
            <CalendarDays size={16} />
            <span>İzin Girişi</span>
          </button>

          {/* Tema Değiştir */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl border border-border transition-all cursor-pointer active:scale-95"
            title="Temayı Değiştir"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
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
