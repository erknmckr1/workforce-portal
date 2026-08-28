import React, { useState, useEffect } from "react";
import { X, Maximize2, Minimize2, Clock } from "lucide-react";

interface GiantClockModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ColorTheme = "amber" | "emerald" | "cyan" | "rose" | "white";

const THEME_STYLES: Record<
  ColorTheme,
  {
    name: string;
    text: string;
    glow: string;
    border: string;
    bg: string;
    accentBg: string;
    indicator: string;
  }
> = {
  amber: {
    name: "Kehribar",
    text: "text-amber-500",
    glow: "drop-shadow-[0_0_35px_rgba(245,158,11,0.45)]",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    accentBg: "bg-amber-500",
    indicator: "bg-amber-500",
  },
  emerald: {
    name: "Zümrüt",
    text: "text-emerald-400",
    glow: "drop-shadow-[0_0_35px_rgba(52,211,153,0.45)]",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    accentBg: "bg-emerald-500",
    indicator: "bg-emerald-400",
  },
  cyan: {
    name: "Siber Mavi",
    text: "text-cyan-400",
    glow: "drop-shadow-[0_0_35px_rgba(34,211,238,0.45)]",
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/10",
    accentBg: "bg-cyan-500",
    indicator: "bg-cyan-400",
  },
  rose: {
    name: "Neon Kırmızı",
    text: "text-rose-500",
    glow: "drop-shadow-[0_0_35px_rgba(244,63,94,0.45)]",
    border: "border-rose-500/30",
    bg: "bg-rose-500/10",
    accentBg: "bg-rose-500",
    indicator: "bg-rose-500",
  },
  white: {
    name: "Saf Beyaz",
    text: "text-white",
    glow: "drop-shadow-[0_0_35px_rgba(255,255,255,0.45)]",
    border: "border-white/30",
    bg: "bg-white/10",
    accentBg: "bg-white",
    indicator: "bg-white",
  },
};

const GiantClockModal: React.FC<GiantClockModalProps> = ({ isOpen, onClose }) => {
  const [time, setTime] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ColorTheme>("amber");

  // Canlı saat güncellemesi
  useEffect(() => {
    if (!isOpen) return;

    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // ESC ile kapatma ve klavye kısayolları
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Tam ekran kontrolü
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  if (!isOpen) return null;

  const hours = time.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    hour12: false,
  });
  const minutes = time.toLocaleTimeString("tr-TR", {
    minute: "2-digit",
  });
  const seconds = time.toLocaleTimeString("tr-TR", {
    second: "2-digit",
  });

  const dayName = time.toLocaleDateString("tr-TR", { weekday: "long" });
  const fullDate = time.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Yılın kaçıncı haftası
  const getWeekNumber = (d: Date) => {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  };

  const currentSeconds = time.getSeconds();
  const currentProgress = (currentSeconds / 60) * 100;
  const currentTheme = THEME_STYLES[selectedTheme];

  return (
    <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-6 sm:p-10 select-none animate-in fade-in zoom-in-95 duration-200">
      {/* ÜST BAR (Başlık, Kontroller, Kapat Butonu) */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl backdrop-blur-md">
          <Clock className={`w-5 h-5 ${currentTheme.text}`} />
          <span className="text-sm font-semibold tracking-wider uppercase text-white/80">
            Fabrika Dijital Saat Paneli
          </span>
        </div>

        {/* Aksiyon butonları */}
        <div className="flex items-center gap-3">
          {/* Renk Değiştirici */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 p-1.5 rounded-2xl backdrop-blur-md">
            {(Object.keys(THEME_STYLES) as ColorTheme[]).map((themeKey) => (
              <button
                key={themeKey}
                onClick={() => setSelectedTheme(themeKey)}
                className={`w-7 h-7 rounded-xl transition-all duration-200 flex items-center justify-center ${
                  selectedTheme === themeKey
                    ? "ring-2 ring-white scale-110 shadow-lg"
                    : "opacity-60 hover:opacity-100 hover:scale-105"
                }`}
                style={{
                  backgroundColor:
                    themeKey === "amber"
                      ? "#f59e0b"
                      : themeKey === "emerald"
                      ? "#10b981"
                      : themeKey === "cyan"
                      ? "#06b6d4"
                      : themeKey === "rose"
                      ? "#f43f5e"
                      : "#ffffff",
                }}
                title={THEME_STYLES[themeKey].name}
              />
            ))}
          </div>

          {/* Tam Ekran Butonu */}
          <button
            onClick={toggleFullscreen}
            className="p-3 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            title={isFullscreen ? "Tam Ekrandan Çık (F)" : "Tam Ekran Yap (F)"}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>

          {/* Kapat Butonu */}
          <button
            onClick={onClose}
            className="p-3 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-2xl border border-rose-500/30 transition-all active:scale-95 cursor-pointer"
            title="Kapat (ESC)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* ORTA DEV SAAT ALANI */}
      <div className="flex-1 flex flex-col items-center justify-center my-auto">
        {/* DEV DİJİTAL SAAT */}
        <div className="flex items-center justify-center font-mono font-black tracking-tight tabular-nums select-none leading-none">
          {/* SAAT */}
          <span
            className={`text-[17vw] sm:text-[18vw] md:text-[20vw] lg:text-[22vw] ${currentTheme.text} ${currentTheme.glow} transition-colors duration-300`}
          >
            {hours}
          </span>

          {/* İKİ NOKTA - YANIP SÖNEN ANİMASYON */}
          <span
            className={`text-[15vw] sm:text-[16vw] md:text-[18vw] lg:text-[20vw] mx-1 md:mx-3 ${currentTheme.text} ${currentTheme.glow} animate-pulse`}
          >
            :
          </span>

          {/* DAKİKA */}
          <span
            className={`text-[17vw] sm:text-[18vw] md:text-[20vw] lg:text-[22vw] ${currentTheme.text} ${currentTheme.glow} transition-colors duration-300`}
          >
            {minutes}
          </span>

          {/* SANİYE - BİRAZ DAHA KÜÇÜK VE AYRI VURGULU */}
          <div className="flex flex-col ml-3 sm:ml-6 md:ml-8 self-center">
            <span
              className={`text-[7vw] sm:text-[8vw] md:text-[9vw] lg:text-[10vw] leading-none ${currentTheme.text} ${currentTheme.glow} opacity-90 transition-colors duration-300`}
            >
              {seconds}
            </span>
            <span className="text-[1.2vw] tracking-widest uppercase font-sans font-bold text-white/40 mt-1">
              SANİYE
            </span>
          </div>
        </div>

        {/* 60 SANİYE İLERLEME ÇUBUĞU */}
        <div className="w-full max-w-4xl mt-6 px-4">
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div
              className={`h-full ${currentTheme.accentBg} rounded-full transition-all duration-1000 ease-linear shadow-[0_0_12px_rgba(255,255,255,0.5)]`}
              style={{ width: `${currentProgress}%` }}
            />
          </div>
        </div>

        {/* BÜYÜK TARİH VE GÜN BİLGİSİ */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 mt-8 text-center">
          <div className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-wider text-white">
            {dayName}
          </div>
          <div className="h-6 w-[2px] bg-white/20 hidden sm:block" />
          <div className="text-xl sm:text-3xl md:text-4xl font-light tracking-wide text-white/80">
            {fullDate}
          </div>
          <div className="h-6 w-[2px] bg-white/20 hidden sm:block" />
          <div className="bg-white/10 text-white/90 border border-white/15 px-4 py-1.5 rounded-xl text-sm sm:text-base md:text-lg font-mono font-semibold">
            {getWeekNumber(time)}. Hafta
          </div>
        </div>
      </div>

      {/* ALT BİLGİ VE İPUCU ALANI */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-white/40 border-t border-white/10 pt-4">
        <div className="flex items-center gap-4">
          <span>Kapatmak için <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">ESC</kbd> tuşuna basın</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Tam ekran için <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">F</kbd> tuşuna basın</span>
        </div>
        <div className="font-mono text-white/30">
          MIDAS MES TERMINAL SYSTEM
        </div>
      </div>
    </div>
  );
};

export default GiantClockModal;
