import React from "react";
import { Search, RefreshCcw, Sun, Moon } from "lucide-react";
import { useTheme } from "../theme-provider";

interface TerminalHeaderProps {
  areaName?: string;
  section?: string;
  searchOrderId: string;
  setSearchOrderId: (val: string) => void;
  handleSearch: (e: React.KeyboardEvent) => void;
  isSearching: boolean;
  currentTime: Date;
}

const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  areaName,
  section,
  searchOrderId,
  setSearchOrderId,
  handleSearch,
  isSearching,
  currentTime,
}) => {
  const { theme, setTheme } = useTheme();

  return (
    <header className="h-[70px] bg-secondary/30 backdrop-blur-md border-b border-border flex items-center justify-between px-6 relative z-20">
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <h1 className="text-xl font-black tracking-tighter bg-linear-to-r from-foreground to-muted-foreground bg-clip-text text-transparent uppercase">
            {areaName} <span className="text-amber-500 font-light font-sans tracking-normal drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">Terminal</span>
          </h1>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Sistem Aktif • {section}
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="relative ml-10 group">
          <div className="absolute inset-0 bg-amber-500/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="relative flex items-center bg-secondary/50 border border-border rounded-xl px-4 py-2 w-[400px] focus-within:border-amber-500/50 transition-all focus-within:bg-secondary">
            <Search className="text-muted-foreground group-focus-within:text-amber-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="SİPARİŞ NO VEYA BARKOD OKUTUN..."
              value={searchOrderId}
              onChange={(e) => setSearchOrderId(e.target.value)}
              onKeyDown={handleSearch}
              className="bg-transparent border-none focus:ring-0 text-sm font-mono tracking-widest placeholder:text-muted-foreground/30 placeholder:font-sans placeholder:tracking-normal w-full ml-3 uppercase"
            />
            {isSearching && <RefreshCcw size={16} className="animate-spin text-amber-500" />}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <div className="text-3xl font-mono font-black tracking-tighter text-amber-500 tabular-nums drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {currentTime.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* THEME TOGGLE */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-3 bg-secondary hover:bg-accent rounded-xl border border-border transition-all duration-300 group active:scale-90"
          title="Temayı Değiştir"
        >
          {theme === "dark" ? (
            <Sun size={20} className="text-muted-foreground group-hover:text-amber-500 transition-colors" />
          ) : (
            <Moon size={20} className="text-muted-foreground group-hover:text-amber-500 transition-colors" />
          )}
        </button>
      </div>
    </header>
  );
};

export default TerminalHeader;
