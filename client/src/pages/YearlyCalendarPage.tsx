import React, { useState, useEffect } from "react";
import apiClient from "@/lib/api";
import { format, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarEvent {
  id: number;
  event_date: string;
  event_type: string;
  title: string;
  description: string;
  is_half_day: boolean;
  color_code: string;
}

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

// Pazartesi -> Pazar sıralı başlık
const WEEK_DAYS = ["Pa", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

export default function YearlyCalendarPage() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/calendar");
      setEvents(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Takvim verileri çekilemedi:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const getEventForDate = (dateString: string) => {
    return events.find((e) => e.event_date === dateString);
  };

  // Hafta sonunu otomatik tespit et (Cumartesi=6, Pazar=0)
  const isWeekend = (year: number, month: number, day: number) => {
    const d = new Date(year, month, day).getDay();
    return d === 0 || d === 6;
  };

  const renderMonth = (monthIndex: number) => {
    const daysInMonth = getDaysInMonth(new Date(currentYear, monthIndex, 1));

    // Ay 1'inin hangi gün olduğu (Pzt=0 bazlı indekse çeviriyoruz)
    let startDayIndex = getDay(startOfMonth(new Date(currentYear, monthIndex, 1))) - 1;
    if (startDayIndex === -1) startDayIndex = 6; // Pazar ise 6'ya al

    const cells = [];

    // Boş başlangıç hücreleri
    for (let i = 0; i < startDayIndex; i++) {
      cells.push(<div key={`empty-${i}`} className="h-8 border border-transparent" />);
    }

    // Gün hücreleri
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = format(new Date(currentYear, monthIndex, day), "yyyy-MM-dd");
      const event = getEventForDate(dateStr);
      const weekend = !event && isWeekend(currentYear, monthIndex, day);

      let bgColor = 'transparent';
      let textColor = 'inherit';

      if (event) {
        bgColor = event.color_code || '#888';
        textColor = '#ffffff';
      } else if (weekend) {
        bgColor = '#3b82f6'; // Hafta sonu → Mavi
        textColor = '#ffffff';
      }

      cells.push(
        <div
          key={day}
          className="h-8 border border-border flex items-center justify-center text-[11px] font-bold cursor-default relative group transition-all"
          style={{ backgroundColor: bgColor, color: textColor }}
        >
          {day}
          {event?.is_half_day && (
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-warning border border-border" />
          )}
          {event && (
            <div className="absolute opacity-0 group-hover:opacity-100 pointer-events-none z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 bg-popover text-popover-foreground text-[10px] w-max max-w-[180px] px-2 py-1 rounded shadow-xl transition-opacity border border-border">
              <p className="font-bold leading-tight">{event.title}</p>
              {event.description && <p className="text-muted-foreground text-[9px] mt-0.5">{event.description}</p>}
              {event.is_half_day && <p className="text-warning font-bold">⚡ Yarım Gün</p>}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={monthIndex} className="bg-card border shadow-sm rounded-xl overflow-hidden">
        {/* Ay Başlığı */}
        <div className="bg-primary py-2 px-3 text-center font-black text-primary-foreground text-sm border-b">
          {MONTHS[monthIndex]} {currentYear}
        </div>
        {/* Hafta Günleri */}
        <div className="grid grid-cols-7 bg-muted/40 border-b">
          {WEEK_DAYS.map((d, i) => (
            <div key={i} className="text-center text-[9px] font-black py-1 text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        {/* Gün Hücreleri */}
        <div className="grid grid-cols-7 bg-background">
          {cells}
        </div>
      </div>
    );
  };

  return (
    <div className=" w-full mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">

      {/* Üst Başlık & Yıl Seçici */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-primary text-primary-foreground p-2 px-6 rounded-2xl shadow-lg">
        <div>
          <h1 className="text-3xl font-black">Senelik Plan</h1>
          <p className="text-primary-foreground/70 text-sm mt-1">Tatiller, maaş günleri ve fabrika kapama planı.</p>
        </div>
        <div className="flex items-center gap-4 bg-primary-foreground/10 rounded-xl border border-primary-foreground/20 p-2">
          <button onClick={() => setCurrentYear(p => p - 1)} className="p-2 hover:bg-primary-foreground/20 rounded-lg transition-colors">
            <ChevronLeft size={22} />
          </button>
          <span className="text-4xl font-black min-w-[80px] text-center">{currentYear}</span>
          <button onClick={() => setCurrentYear(p => p + 1)} className="p-2 hover:bg-primary-foreground/20 rounded-lg transition-colors">
            <ChevronRight size={22} />
          </button>
        </div>
      </div>

      {/* Lejant */}
      <div className="bg-card border p-4 rounded-xl flex flex-wrap items-center gap-6 text-sm font-semibold">
        <span className="text-muted-foreground font-black text-xs uppercase tracking-wider">Açıklama:</span>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-info" />Hafta Sonu</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-warning" />Resmi / Dini Bayram</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-success" />Maaş Ödeme Günü</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-destructive" />Zorunlu Fabrika Kapaması</div>
        <div className="flex items-center gap-2">
          <div className="relative w-4 h-4 rounded bg-destructive">
            <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-warning border border-border" />
          </div>
          Yarım Gün
        </div>
      </div>

      {/* 12 Aylık Grid */}
      {loading ? (
        <div className="flex justify-center p-20">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(12)].map((_, i) => renderMonth(i))}
        </div>
      )}

    </div>
  );
}
