import React, { useState } from "react";
import { Search, RefreshCcw, Sun, Moon, Clock } from "lucide-react";
import { useTheme } from "../theme-provider";
import FactoryStatus from "../common/FactoryStatus";
import GiantClockModal from "./GiantClockModal";

interface TerminalHeaderProps {
  areaName?: string;
  section?: string;
  searchOrderId: string;
  setSearchOrderId: (val: string) => void;
  handleSearch: (e: React.KeyboardEvent) => void;
  isSearching: boolean;
  currentTime: Date;
  externalId?: number;
  isOnBreak: boolean;
  onLogoClick?: () => void;
}

const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  areaName,
  searchOrderId,
  setSearchOrderId,
  handleSearch,
  isSearching,
  currentTime,
  externalId,
  isOnBreak,
  onLogoClick,
}) => {
  const { theme, setTheme } = useTheme();
  const [clickCount, setClickCount] = useState(0);
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);

  const handleTitleClick = () => {
    const newCount = clickCount + 1;
    if (newCount >= 5) {
      onLogoClick?.();
      setClickCount(0);
    } else {
      setClickCount(newCount);
      // 2 saniye sonra sayacı sıfırla
      setTimeout(() => setClickCount(0), 2000);
    }
  };

  return (
    <>
      <header className="h-[70px] bg-secondary/30 backdrop-blur-md border-b border-border flex items-center justify-between px-6 relative z-20">
        <div className="flex items-center gap-6">
          <div
            className="flex flex-col cursor-pointer select-none active:scale-95 transition-transform"
            onClick={handleTitleClick}
          >
            <h1 className="text-xl font-black tracking-tighter bg-linear-to-r from-foreground to-muted-foreground bg-clip-text text-transparent uppercase">
              {areaName}{" "}
              <span className="text-amber-500 font-light font-sans tracking-normal drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                Terminal
              </span>
            </h1>
          </div>

          {/* SEARCH BAR */}
          <div className="relative ml-10 group">
            <div className="absolute inset-0 bg-amber-500/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <div
              className={`relative flex items-center bg-secondary/50 border border-border rounded-xl px-4 py-2 w-[400px] focus-within:border-amber-500/50 transition-all focus-within:bg-secondary ${isOnBreak ? "opacity-50 grayscale pointer-events-none" : ""}`}
            >
              <Search
                className="text-muted-foreground group-focus-within:text-amber-500 transition-colors"
                size={18}
              />
              <input
                type="text"
                placeholder={
                  isOnBreak
                    ? "MOLADAYKEN İŞ BAŞLATILAMAZ"
                    : "SİPARİŞ NO VEYA BARKOD OKUTUN..."
                }
                value={searchOrderId}
                disabled={isOnBreak}
                onChange={(e) => setSearchOrderId(e.target.value)}
                onKeyDown={handleSearch}
                className="bg-transparent border-none focus:ring-0 text-sm font-mono tracking-widest placeholder:text-muted-foreground/30 placeholder:font-sans placeholder:tracking-normal w-full ml-3 uppercase"
              />
              {isSearching && (
                <RefreshCcw size={16} className="animate-spin text-amber-500" />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* REUSABLE FACTORY TIMES */}
          <FactoryStatus externalId={externalId} />

          {areaName !== "kalite" && (
            <div
              onClick={() => setIsClockModalOpen(true)}
              className="flex items-center gap-3 shrink-0 cursor-pointer group hover:scale-105 transition-all p-1.5 rounded-xl hover:bg-secondary/40"
              title="Dev Dijital Saati Aç"
            >
              <div className="text-[50px] leading-none font-mono font-black tracking-tighter text-amber-500 tabular-nums drop-shadow-[0_0_15px_rgba(245,158,11,0.3)] group-hover:drop-shadow-[0_0_25px_rgba(245,158,11,0.6)] transition-all">
                {currentTime.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
              <div className="text-[10px] font-bold text-muted-foreground group-hover:text-amber-500/80 uppercase tracking-widest whitespace-nowrap transition-colors">
                {currentTime.toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
          )}

          {/* GIANT CLOCK MODAL BUTTON */}
          <button
            onClick={() => setIsClockModalOpen(true)}
            className="p-3 bg-secondary hover:bg-amber-500/20 text-muted-foreground hover:text-amber-500 rounded-xl border border-border hover:border-amber-500/40 transition-all duration-300 group active:scale-90 shadow-xs cursor-pointer"
            title="Dev Dijital Saat Paneli"
          >
            <Clock
              size={20}
              className="transition-transform group-hover:rotate-12 duration-300"
            />
          </button>

          {/* RELOAD BUTTON */}
          <button
            onClick={() => window.location.reload()}
            className="p-3 bg-secondary hover:bg-accent rounded-xl border border-border transition-all duration-300 group active:scale-90 cursor-pointer"
            title="Sayfayı Yenile"
          >
            <RefreshCcw
              size={20}
              className="text-muted-foreground group-hover:text-emerald-500 transition-colors"
            />
          </button>

          {/* THEME TOGGLE */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-3 bg-secondary hover:bg-accent rounded-xl border border-border transition-all duration-300 group active:scale-90 cursor-pointer"
            title="Temayı Değiştir"
          >
            {theme === "dark" ? (
              <Sun
                size={20}
                className="text-muted-foreground group-hover:text-amber-500 transition-colors"
              />
            ) : (
              <Moon
                size={20}
                className="text-muted-foreground group-hover:text-amber-500 transition-colors"
              />
            )}
          </button>
        </div>
      </header>

      {/* DEV SAAT MODALI */}
      <GiantClockModal
        isOpen={isClockModalOpen}
        onClose={() => setIsClockModalOpen(false)}
      />
    </>
  );
};

export default TerminalHeader;
