import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, CalendarDays, X, ArrowLeft } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useModuleStore } from "@/store/moduleStore";
import KioskPage from "@/pages/KioskPage";

export type TerminalAccentColor = "rose" | "indigo" | "emerald" | "amber" | "blue";

interface TerminalHeaderProps {
  title: string;
  badgeText?: string;
  icon?: React.ReactNode;
  accentColor?: TerminalAccentColor;
  backUrl?: string;
  backLabel?: string;
  showKioskButton?: boolean;
  kioskButtonText?: string;
  rightContent?: React.ReactNode;
}

const ACCENT_STYLES: Record<
  TerminalAccentColor,
  {
    iconBg: string;
    iconBorder: string;
    iconText: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    buttonBg: string;
    buttonHover: string;
  }
> = {
  rose: {
    iconBg: "bg-rose-500/10",
    iconBorder: "border-rose-500/20",
    iconText: "text-rose-500",
    badgeBg: "bg-rose-500/10",
    badgeBorder: "border-rose-500/20",
    badgeText: "text-rose-500",
    buttonBg: "bg-rose-600",
    buttonHover: "hover:bg-rose-700",
  },
  indigo: {
    iconBg: "bg-indigo-500/10",
    iconBorder: "border-indigo-500/20",
    iconText: "text-indigo-500",
    badgeBg: "bg-indigo-500/10",
    badgeBorder: "border-indigo-500/20",
    badgeText: "text-indigo-500",
    buttonBg: "bg-indigo-600",
    buttonHover: "hover:bg-indigo-700",
  },
  emerald: {
    iconBg: "bg-emerald-500/10",
    iconBorder: "border-emerald-500/20",
    iconText: "text-emerald-500",
    badgeBg: "bg-emerald-500/10",
    badgeBorder: "border-emerald-500/20",
    badgeText: "text-emerald-500",
    buttonBg: "bg-emerald-600",
    buttonHover: "hover:bg-emerald-700",
  },
  amber: {
    iconBg: "bg-amber-500/10",
    iconBorder: "border-amber-500/20",
    iconText: "text-amber-500",
    badgeBg: "bg-amber-500/10",
    badgeBorder: "border-amber-500/20",
    badgeText: "text-amber-500",
    buttonBg: "bg-amber-600",
    buttonHover: "hover:bg-amber-700",
  },
  blue: {
    iconBg: "bg-blue-500/10",
    iconBorder: "border-blue-500/20",
    iconText: "text-blue-500",
    badgeBg: "bg-blue-500/10",
    badgeBorder: "border-blue-500/20",
    badgeText: "text-blue-500",
    buttonBg: "bg-blue-600",
    buttonHover: "hover:bg-blue-700",
  },
};

export default function TerminalHeader({
  title,
  badgeText,
  icon,
  accentColor = "indigo",
  backUrl,
  backLabel = "Geri Dön",
  showKioskButton = true,
  kioskButtonText = "İzin Girişi",
  rightContent,
}: TerminalHeaderProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { closePopup } = useModuleStore();
  const [isKioskOpen, setIsKioskOpen] = useState(false);

  const styles = ACCENT_STYLES[accentColor] || ACCENT_STYLES.indigo;

  return (
    <>
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

      {/* HEADER BAR */}
      <header className="h-12 sm:h-14 border-b border-border bg-card/70 backdrop-blur-xl px-3 sm:px-6 flex items-center justify-between shrink-0 z-30 w-full">
        {/* Sol Taraf: Geri Butonu + Logo & Başlık */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {backUrl && (
            <>
              <button
                onClick={() => navigate(backUrl)}
                className="p-1.5 sm:p-2 bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl border border-border transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 text-xs font-bold"
                title={backLabel}
              >
                <ArrowLeft size={16} />
                <span className="hidden md:inline">{backLabel}</span>
              </button>
              <div className="h-5 w-px bg-border/60" />
            </>
          )}

          {icon && (
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${styles.iconBg} border ${styles.iconBorder} ${styles.iconText} flex items-center justify-center shadow-xs`}
            >
              {icon}
            </div>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-black text-xs sm:text-sm tracking-tight text-foreground uppercase">
              Midas
            </span>
            <span
              className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md ${styles.badgeBg} ${styles.badgeText} border ${styles.badgeBorder}`}
            >
              {badgeText || title}
            </span>
          </div>
        </div>

        {/* Sağ Taraf: Ek Bileşenler, İzin Girişi & Tema Değiştirici */}
        <div className="flex items-center gap-2">
          {rightContent}

          {showKioskButton && (
            <button
              onClick={() => setIsKioskOpen(true)}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 ${styles.buttonBg} ${styles.buttonHover} text-white font-bold text-[10px] sm:text-xs rounded-lg shadow-xs transition-all cursor-pointer active:scale-95 uppercase tracking-wider`}
              title="İzin Talebi / Kiosk Ekranı"
            >
              <CalendarDays size={13} />
              <span>{kioskButtonText}</span>
            </button>
          )}

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1.5 sm:p-2 bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl border border-border transition-all cursor-pointer active:scale-95"
            title="Temayı Değiştir"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>
    </>
  );
}
