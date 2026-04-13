import { useAuthStore } from "../store/authStore";
import { LayoutDashboard, Calendar, Clock, UserCheck, CalendarDays, Banknote, AlertTriangle, PartyPopper, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { format, isAfter, startOfDay, startOfMonth, endOfMonth } from "date-fns";

interface CalendarEvent {
  id: number;
  event_date: string;
  event_type: string;
  title: string;
  description: string;
  is_half_day: boolean;
  color_code: string;
}

// Bu Ayki Etkinlikler Widget
function UpcomingEventsWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await apiClient.get("/calendar");
        const all: CalendarEvent[] = Array.isArray(res.data?.data) ? res.data.data : [];

        const today = startOfDay(new Date());
        const monthStart = startOfMonth(today);
        const monthEnd = endOfMonth(today);

        // Bu ay içindeki ve henüz geçmemiş etkinlikleri filtrele
        const filtered = all
          .filter(e => {
            const d = new Date(e.event_date);
            return d >= monthStart && d <= monthEnd && !isAfter(today, d) === false
              ? false
              : d >= today && d <= monthEnd;
          })
          .sort((a, b) => a.event_date.localeCompare(b.event_date));

        setEvents(filtered);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // Etkinlik türüne göre ikon
  const getIcon = (type: string) => {
    switch (type) {
      case "SALARY": return <Banknote size={14} className="text-success" />;
      case "HOLIDAY": return <PartyPopper size={14} className="text-warning" />;
      case "CLOSURE":
      case "CLOSURE_HALF": return <AlertTriangle size={14} className="text-destructive" />;
      default: return <CalendarDays size={14} className="text-muted-foreground" />;
    }
  };

  const monthName = format(new Date(), "MMMM yyyy");

  return (
    <div className="h-full rounded-2xl bg-card border border-border flex flex-col overflow-hidden">
      {/* Başlık */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10">
            <CalendarDays size={16} className="text-primary" />
          </div>
          <div>
            <h3 className="font-black text-sm text-foreground">Bu Ay</h3>
            <p className="text-[10px] text-muted-foreground capitalize">{monthName}</p>
          </div>
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground py-1 px-2 bg-muted rounded-md">
          {events.length} Etkinlik
        </span>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <CalendarDays size={32} className="opacity-20" />
            <p className="text-xs font-bold">Bu ay için etkinlik yok</p>
          </div>
        ) : (
          events.map(event => {
            const date = new Date(event.event_date);
            const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
            return (
              <div
                key={event.id}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-xl transition-colors",
                  isToday ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                )}
              >
                {/* Tarih Kutusu */}
                <div
                  className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 shadow-sm"
                  style={{ backgroundColor: event.color_code || "#888" }}
                >
                  <span className="text-[9px] font-black text-primary-foreground opacity-80 uppercase leading-none">
                    {format(date, "MMM")}
                  </span>
                  <span className="text-base font-black text-primary-foreground leading-none">
                    {format(date, "dd")}
                  </span>
                </div>

                {/* Bilgi */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {getIcon(event.event_type)}
                    <p className="text-xs font-bold text-foreground truncate">{event.title}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(date, "EEEE")}
                    {event.is_half_day && <span className="ml-1 text-warning font-bold">· Yarım Gün</span>}
                    {isToday && <span className="ml-1 text-primary font-bold">· Bugün!</span>}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Döviz / Altın Widget (Kompakt Liste)
interface CurrencyRate {
  Alış: string;
  Satış: string;
  Değişim: string;
  Tür: string;
}

const TRACKED = [
  { key: "gram-altin", label: "Gram Altın", flag: "🪙" },
  { key: "USD", label: "ABD Doları", flag: "🇺🇸" },
  { key: "EUR", label: "Euro", flag: "🇪🇺" },
  { key: "GBP", label: "Sterlin", flag: "🇬🇧" },
  { key: "CHF", label: "İsviçre Frangı", flag: "🇨🇭" },
  { key: "gram-gumus", label: "Gümüş (Gram)", flag: "⚪" },
];

function CurrencyWidget() {
  const [rates, setRates] = useState<Record<string, CurrencyRate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchRates = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      // Backend proxy üzerinden çekiyoruz
      const res = await apiClient.get("/rates/rates");
      const payload = res.data?.data || {};
      setRates(payload);
      setLastUpdate(payload.update_date || "");
    } catch {
      setRates(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRates();
    const interval = setInterval(() => fetchRates(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full rounded-2xl bg-card border border-border flex flex-col overflow-hidden">
      {/* Başlık */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-success/10">
            <TrendingUp size={16} className="text-success" />
          </div>
          <div>
            <h3 className="font-black text-sm text-foreground">Döviz & Altın</h3>
            <p className="text-[10px] text-muted-foreground">Nadir Döviz / Kapalıçarşı</p>
          </div>
        </div>
        <button
          onClick={() => fetchRates(true)}
          className={cn(
            "text-[9px] font-black uppercase tracking-widest text-muted-foreground py-1 px-2 bg-muted rounded-md flex items-center gap-1 hover:text-foreground transition-colors",
            refreshing && "animate-spin opacity-50 pointer-events-none"
          )}
        >
          <RefreshCw size={10} />
          {lastUpdate ? lastUpdate.split(" ")[1] : "..."}
        </button>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
        {loading ? (
          <div className="space-y-2 pt-2">
            {TRACKED.map(c => (
              <div key={c.key} className="flex items-center gap-3 p-2.5 rounded-xl animate-pulse">
                <div className="w-8 h-8 bg-muted rounded-lg shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-muted rounded w-20" />
                  <div className="h-2.5 bg-muted rounded w-14" />
                </div>
                <div className="h-4 bg-muted rounded w-16" />
              </div>
            ))}
          </div>
        ) : !rates ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <TrendingDown size={32} className="opacity-20" />
            <p className="text-xs font-bold">Veri alınamadı</p>
          </div>
        ) : (
          TRACKED.map(currency => {
            const rate = rates[currency.key] as CurrencyRate | undefined;
            if (!rate) return null;

            const degisim = rate.Değişim || "";
            const isPositive = !degisim.startsWith("%-");
            const degisimText = degisim.replace("%-", "-").replace("%", "+");

            return (
              <div
                key={currency.key}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
              >
                {/* Bayrak / Sembol */}
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 text-xl shadow-inner">
                  {currency.flag}
                </div>

                {/* İsim */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-foreground truncate uppercase tracking-tight">{currency.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn(
                      "text-[9px] font-black px-1 rounded flex items-center gap-0.5",
                      isPositive ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
                    )}>
                      {isPositive ? "▲" : "▼"} {degisimText}
                    </span>
                  </div>
                </div>

                {/* Alış & Satış */}
                <div className="flex gap-4 shrink-0 pr-1 text-right">
                  <div>
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Alış</p>
                    <p className="text-xs font-black text-foreground tabular-nums">{rate.Alış}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Satış</p>
                    <p className="text-xs font-black text-foreground tabular-nums">{rate.Satış}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();

  return (
    <div className="flex flex-col h-full lg:h-[calc(100vh-160px)] gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500 lg:overflow-hidden">

      {/* ÜST BÖLÜM: Sabit Kalacak Kısım */}
      <div className="flex flex-col gap-6 shrink-0">
        <PageHeader
          title="Portal Özeti"
          description={<>Merhaba <span className="text-primary font-bold mx-1">{user?.name}</span>, bugün her şey yolunda görünüyor.</>}
        />

        {/* Hızlı İstatistik Kartları */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title=""
            value=""
            icon={Calendar}
            trend=""
            color="bg-blue-500"
          />
          <StatCard
            title=""
            value=""
            icon={Clock}
            trend="Bu Ay Toplam"
            color="bg-orange-500"
          />
          <StatCard
            title="Durum"
            value="Aktif Çalışıyor"
            icon={UserCheck}
            trend="08:30 Giriş"
            color="bg-green-500"
          />
          <StatCard
            title=""
            value=""
            icon={LayoutDashboard}
            trend=""
            color="bg-purple-500"
          />
        </div>
      </div>

      {/* ALT BÖLÜM: İçerik / Grafikler (MOBİLDE SCROLL, DESKTOPTA SABİT) */}
      <div className="flex-1 min-h-0 pb-6 overflow-y-auto lg:overflow-visible custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-4 h-auto lg:h-full">
          {/* Üst Satır: Aktivite (2) + Etkinlikler (1) */}
          <div className="lg:col-span-2 min-h-[300px] lg:h-full rounded-2xl bg-card border border-border flex items-center justify-center border-dashed">
            <span className="text-muted-foreground font-bold italic opacity-30 text-sm">Aktivite Akışı Grafiği Yakında...</span>
          </div>
          <div className="min-h-[400px] lg:h-full">
            <UpcomingEventsWidget />
          </div>

          {/* Alt Satır: Placeholder (2) + Döviz (1) */}
          <div className="lg:col-span-2 min-h-[300px] lg:h-full rounded-2xl bg-card border border-border flex items-center justify-center border-dashed">
            <span className="text-muted-foreground font-bold italic opacity-30 text-sm">Gelişmiş İstatistikler Yakında...</span>
          </div>
          <div className="min-h-[400px] lg:h-full">
            <CurrencyWidget />
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend: string;
  color: string;
}

function StatCard({ title, value, icon: Icon, trend, color }: StatCardProps) {
  return (
    <div className="bg-card p-4 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all group">
      <div className="flex justify-between items-start mb-3">
        <div className={cn("p-2.5 rounded-xl text-card shadow-lg", color)}>
          <Icon size={20} />
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground py-1 px-2 bg-muted rounded-md hidden lg:inline-block">
          Giriş Yapıldı
        </span>
      </div>
      <div>
        <h3 className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.15em] mb-1">{title}</h3>
        <p className="text-2xl font-black text-foreground tracking-tighter">{value}</p>
        <p className="text-[10px] font-bold text-muted-foreground/60 mt-1 italic">{trend}</p>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
