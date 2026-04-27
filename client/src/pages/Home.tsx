import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../lib/api";
import {
  Newspaper,
  Calendar,
  Utensils,
  CircleDollarSign,
  ChevronRight,
  ChevronLeft,
  Search,
  MoreHorizontal,
  User,
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Wind,
  Thermometer,
  Droplets,
  Video,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";

interface CalendarEvent {
  id?: number;
  title: string;
  event_date: string;
  description?: string;
}

interface CurrencyRate {
  Alış: string;
  Satış: string;
  Tür?: string;
  Değişim?: string;
}

interface RateData {
  update_date?: string;
  [key: string]: CurrencyRate | string | undefined;
}

interface FoodMenu {
  items: string; // JSON String
  note?: string;
}

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  thumbnail?: string;
  enclosure?: { link?: string; type?: string };
  category?: string;
}

const Home = () => {
  const { isAuthenticated } = useAuthStore();
  const [calendarDate, setCalendarDate] = useState(new Date());

  const { data: ratesResponse } = useQuery({
    queryKey: ["public-rates"],
    queryFn: async () => {
      const res = await apiClient.get("/rates/rates");
      return res.data;
    },
    refetchInterval: 1000 * 60 * 30,
  });

  const rates = ratesResponse?.data as RateData;

  const { data: todayMenu } = useQuery({
    queryKey: ["public-today-menu"],
    queryFn: async () => {
      const res = await apiClient.get("/food-menu/today");
      return res.data as FoodMenu;
    },
  });

  const parsedFood = todayMenu?.items ? JSON.parse(todayMenu.items) : null;

  const { data: eventsResponse } = useQuery({
    queryKey: ["public-events"],
    queryFn: async () => {
      const res = await apiClient.get("/calendar");
      return res.data;
    },
  });

  const rawEvents = (
    Array.isArray(eventsResponse) ? eventsResponse : eventsResponse?.data || []
  ) as CalendarEvent[];
  const upcomingEvents = rawEvents
    .filter(
      (e: CalendarEvent) =>
        new Date(e.event_date) >= new Date(new Date().setHours(0, 0, 0, 0)),
    )
    .slice(0, 5);
  // Hava Durumu Verisi (Open-Meteo - İstanbul)
  const { data: weatherData } = useQuery({
    queryKey: ["weather"],
    queryFn: async () => {
      const res = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=41.0082&longitude=28.9784&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto",
      );
      return res.json();
    },
    refetchInterval: 1000 * 60 * 30, // 30 dk
  });

  const getWeatherIcon = (code: number, size = 24) => {
    if (code === 0) return <Sun className="text-yellow-500" size={size} />;
    if (code <= 3) return <Cloud className="text-gray-400" size={size} />;
    if (code <= 67) return <CloudRain className="text-blue-400" size={size} />;
    return <CloudLightning className="text-purple-400" size={size} />;
  };

  // Haber Çekme (Bloomberg HT Ekonomi + DonanımHaber Teknoloji)
  const { data: newsItems } = useQuery({
    queryKey: ["news"],
    queryFn: async () => {
      // Ekonomi (Bloomberg HT)
      const resEko = await fetch(
        "https://api.rss2json.com/v1/api.json?rss_url=https://www.bloomberght.com/rss",
      );
      const dataEko = await resEko.json();

      // Teknoloji (DonanımHaber)
      const resTekno = await fetch(
        "https://api.rss2json.com/v1/api.json?rss_url=https://www.donanimhaber.com/rss/tum/",
      );
      const dataTekno = await resTekno.json();

      const ekoItems = (dataEko.items || [])
        .slice(0, 3)
        .map((i: NewsItem) => ({ ...i, category: "Ekonomi" }));
      const teknoItems = (dataTekno.items || [])
        .slice(0, 3)
        .map((i: NewsItem) => ({ ...i, category: "Teknoloji" }));

      return [...ekoItems, ...teknoItems];
    },
    refetchInterval: 1000 * 60 * 60, // 1 saat
  });

  const [activeNews, setActiveNews] = useState(0);
  // Takvim Hesaplamaları
  const daysInMonth = new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth() + 1,
    0,
  ).getDate();
  const firstDayOfMonth = new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth(),
    1,
  ).getDay();
  const startingDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const prevMonth = () =>
    setCalendarDate(
      new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1),
    );
  const nextMonth = () =>
    setCalendarDate(
      new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1),
    );

  const getEventsForDay = (day: number) => {
    return rawEvents.filter((ev: CalendarEvent) => {
      const evDate = new Date(ev.event_date);
      return (
        evDate.getDate() === day &&
        evDate.getMonth() === calendarDate.getMonth() &&
        evDate.getFullYear() === calendarDate.getFullYear()
      );
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Üst Header (Resimdeki Siyah Bar) */}
      <header className="bg-primary text-primary-foreground h-12 flex items-center px-4 justify-between sticky top-0 z-60 shadow-md">
        <div className="flex items-center gap-4">
          <div className="font-black text-xl tracking-tighter italic">
            MIDAS
          </div>
          <div className="h-4 w-px bg-primary-foreground/20 ml-2"></div>
          <div className="hidden md:flex gap-6 text-[11px] font-bold uppercase tracking-wider opacity-80">
            <span className="hover:opacity-100 cursor-pointer">Dokümanlar</span>
            <span className="hover:opacity-100 cursor-pointer">Belgeler</span>
            <span className="hover:opacity-100 cursor-pointer">Formlar</span>
            <span className="hover:opacity-100 cursor-pointer">Numaralar</span>
            <span className="hover:opacity-100 cursor-pointer">Anketler</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* <Search
            size={16}
            className="opacity-60 cursor-pointer hover:opacity-100"
          />
          <div className="relative">
            <Bell size={16} className="opacity-60" />
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-[8px] px-1 rounded-full">
              3
            </span>
          </div>
          <div className="relative">
            <Mail size={16} className="opacity-60" />
            <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-[8px] px-1 rounded-full">
              2
            </span>
          </div> */}
          <Link
            to={isAuthenticated ? "/panel" : "/login"}
            className="flex items-center gap-2 bg-primary-foreground/10 px-3 py-1 rounded-md text-xs font-bold cursor-pointer hover:bg-primary-foreground/20 transition-colors"
          >
            <User size={14} />
            {isAuthenticated ? "Personel Paneli" : "Giriş Yap"}
          </Link>
        </div>
      </header>

      {/* Ana Grid Yapısı (Full Width) */}
      <div className="w-full px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* SOL SIDEBAR (Takvim ve Yemek) */}
          <aside className="lg:col-span-3 space-y-6 order-2 lg:order-1">
            {/* TAKVİM WIDGET */}
            <section className="bg-card border border-border rounded-sm shadow-sm overflow-hidden">
              <div className="bg-info text-info-foreground p-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <Calendar size={16} /> TAKVİM
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-4 px-1">
                  <button
                    onClick={prevMonth}
                    className="p-1 hover:bg-muted rounded transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    {calendarDate.toLocaleDateString("tr-TR", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <button
                    onClick={nextMonth}
                    className="p-1 hover:bg-muted rounded transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
                {/* Dinamik Takvim Grid */}
                <div className="grid grid-cols-7 text-[10px] text-center font-bold text-muted-foreground mb-2">
                  {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map(
                    (d) => (
                      <div key={d}>{d}</div>
                    ),
                  )}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {/* Boş Günler (Ayın ilk gününe kadar) */}
                  {Array.from({ length: startingDayIndex }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-8"></div>
                  ))}

                  {/* Ayın Günleri */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isToday =
                      day === new Date().getDate() &&
                      calendarDate.getMonth() === new Date().getMonth() &&
                      calendarDate.getFullYear() === new Date().getFullYear();

                    const dayEvents = getEventsForDay(day);
                    const hasEvent = dayEvents.length > 0;

                    return (
                      <div
                        key={day}
                        title={
                          hasEvent
                            ? dayEvents
                                .map((e: CalendarEvent) => e.title)
                                .join(", ")
                            : ""
                        }
                        className={`h-8 flex flex-col items-center justify-center text-[11px] font-bold rounded-sm cursor-pointer transition-colors relative
                          ${isToday ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-foreground"}
                        `}
                      >
                        <span>{day}</span>
                        {hasEvent && !isToday && (
                          <div className="absolute bottom-1 w-1 h-1 rounded-full bg-info"></div>
                        )}
                        {hasEvent && isToday && (
                          <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary-foreground"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-border space-y-3">
                  {upcomingEvents.map((ev: CalendarEvent, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 group">
                      <div className="text-[10px] font-black text-info w-8 shrink-0">
                        {new Date(ev.event_date).toLocaleDateString("tr-TR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </div>
                      <div className="text-[11px] font-bold text-foreground truncate group-hover:text-info cursor-pointer">
                        {ev.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* YEMEK MENÜSÜ WIDGET */}
            <section className="bg-card border border-border rounded-sm shadow-sm overflow-hidden">
              <div className="bg-destructive text-destructive-foreground p-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <Utensils size={16} /> GÜNÜN YEMEĞİ
              </div>
              <div className="bg-destructive/90 p-4 text-destructive-foreground text-center">
                <Utensils size={32} className="mx-auto mb-2 opacity-30" />
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-2 border-b border-destructive-foreground/20 pb-1">
                  Menü Listesi
                </div>
                {Array.isArray(parsedFood) ? (
                  <div className="space-y-1.5">
                    {parsedFood.map((food: string, idx: number) => (
                      <div
                        key={idx}
                        className="text-xs font-bold tracking-tight"
                      >
                        {food}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs font-bold italic opacity-60">
                    Bugün için menü girilmedi.
                  </div>
                )}
              </div>
              <div className="p-3 bg-muted/30 text-[10px] font-bold text-center text-muted-foreground uppercase">
                Afiyet Olsun
              </div>
            </section>

            {/* VİDEOLAR WIDGET */}
            <section className="bg-card border border-border rounded-sm shadow-sm overflow-hidden">
              <div className="p-3 flex items-center gap-3 border-b border-border bg-muted/10">
                <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center text-success">
                  <Video size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-wider">
                  VİDEOLAR
                </span>
              </div>
              <div className="p-3">
                <div className="aspect-video bg-background rounded overflow-hidden shadow-sm border border-border">
                  <iframe
                    width="100%"
                    height="100%"
                    src="https://www.youtube.com/embed/ttDbSrXnCH4"
                    title="Midas  Tanıtım Filmi"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  ></iframe>
                </div>
              </div>
            </section>
          </aside>

          {/* ORTA KOLON (Duyurular ve Manşet) */}
          <main className="lg:col-span-6 space-y-6 order-1 lg:order-2">
            {/* Manşet Görsel Alanı (Dinamik Haberler) */}
            <section className="relative aspect-21/9 bg-muted rounded-sm border border-border overflow-hidden shadow-sm group">
              {newsItems && newsItems.length > 0 ? (
                <>
                  <a href={newsItems[activeNews].link} target="_blank" rel="noreferrer">
                    <img
                      src={
                        newsItems[activeNews].thumbnail ||
                        newsItems[activeNews].enclosure?.link ||
                        "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80"
                      }
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      alt={newsItems[activeNews].title}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-background/90 to-transparent"></div>
                    <div className="absolute bottom-6 left-6 text-foreground max-w-lg">
                      <div className="text-[10px] font-black uppercase tracking-widest bg-info text-info-foreground px-2 py-0.5 inline-block mb-2">
                        {newsItems[activeNews].category}
                      </div>
                      <h2 className="text-2xl font-black tracking-tighter leading-tight mb-2 uppercase italic line-clamp-2">
                        {newsItems[activeNews].title}
                      </h2>
                      <div className="text-xs font-medium opacity-80 line-clamp-1" 
                           dangerouslySetInnerHTML={{ __html: newsItems[activeNews].description }}>
                      </div>
                    </div>
                  </a>
                  <div className="absolute bottom-6 right-6 flex gap-2">
                    {newsItems.map((_: NewsItem, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setActiveNews(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === activeNews ? "bg-foreground w-4" : "bg-foreground/30"
                        }`}
                      ></button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold uppercase tracking-widest opacity-20">
                  Haberler Yükleniyor...
                </div>
              )}
            </section>

            {/* DUYURULAR LISTESİ */}
            <section className="bg-card border border-border rounded-sm shadow-sm overflow-hidden">
              <Tabs defaultValue="duyurular" className="w-full">
                <div className="border-b border-border px-3 pt-2.5 flex items-end justify-between bg-muted/20">
                  <TabsList className="bg-transparent h-auto p-0 flex gap-4 text-[11px] font-black uppercase tracking-wider justify-start rounded-none">
                    <TabsTrigger
                      value="duyurular"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-info data-[state=active]:text-info data-[state=active]:shadow-none data-[state=active]:bg-transparent px-0 py-1"
                    >
                      Duyurular
                    </TabsTrigger>
                    <TabsTrigger
                      value="teknoloji"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-info data-[state=active]:text-info data-[state=active]:shadow-none data-[state=active]:bg-transparent px-0 py-1"
                    >
                      Teknoloji
                    </TabsTrigger>
                    <TabsTrigger
                      value="haberler"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-info data-[state=active]:text-info data-[state=active]:shadow-none data-[state=active]:bg-transparent px-0 py-1"
                    >
                      Haberler
                    </TabsTrigger>
                  </TabsList>
                  <MoreHorizontal size={16} className="opacity-40 mb-1" />
                </div>

                <TabsContent
                  value="duyurular"
                  className="m-0 focus-visible:outline-none"
                >
                  <div className="divide-y divide-border">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="p-4 hover:bg-muted/30 transition-colors flex gap-4 cursor-pointer group"
                      >
                        <div className="w-12 h-12 bg-muted shrink-0 flex items-center justify-center rounded border border-border overflow-hidden">
                          <Newspaper size={20} className="opacity-20" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-[10px] font-black text-info uppercase tracking-widest">
                              Kurumsal
                            </span>
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">
                              {27 - i} Nisan 2026
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-foreground group-hover:text-info transition-colors tracking-tight">
                            2026 Yılı İzin Planlamaları ve Departman Bazlı
                            Çalışma Takvimleri Hakkında Bilgilendirme
                          </h4>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent
                  value="teknoloji"
                  className="m-0 focus-visible:outline-none"
                >
                  <div className="py-12 flex flex-col items-center justify-center text-center opacity-60">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Henüz bir teknoloji haberi bulunmuyor
                    </p>
                  </div>
                </TabsContent>

                <TabsContent
                  value="haberler"
                  className="m-0 focus-visible:outline-none"
                >
                  <div className="divide-y divide-border">
                    {newsItems?.map((news: NewsItem, idx: number) => (
                      <a
                        key={idx}
                        href={news.link}
                        target="_blank"
                        rel="noreferrer"
                        className="p-4 hover:bg-muted/30 transition-colors flex gap-4 cursor-pointer group"
                      >
                        <div className="w-12 h-12 bg-muted shrink-0 flex items-center justify-center rounded border border-border overflow-hidden">
                          {news.thumbnail || news.enclosure?.link ? (
                            <img 
                              src={news.thumbnail || news.enclosure?.link} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                              alt="news"
                            />
                          ) : (
                            <Newspaper size={20} className="opacity-20" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-[10px] font-black text-info uppercase tracking-widest">
                              {news.category}
                            </span>
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">
                              {new Date(news.pubDate).toLocaleDateString("tr-TR")}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-foreground group-hover:text-info transition-colors tracking-tight line-clamp-2">
                            {news.title}
                          </h4>
                        </div>
                      </a>
                    ))}
                  </div>
                </TabsContent>

                <div className="p-3 border-t border-border bg-muted/20 text-center">
                  <button className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                    Tüm Duyuruları Gör
                  </button>
                </div>
              </Tabs>
            </section>
          </main>

          {/* SAĞ SIDEBAR (Piyasa ve Diğer) */}
          <aside className="lg:col-span-3 space-y-6 order-3">
            {/* PİYASA REHBERİ */}
            <section className="bg-card border border-border rounded-sm shadow-sm overflow-hidden">
              <div className="bg-primary text-primary-foreground p-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <CircleDollarSign size={16} /> PİYASA REHBERİ
              </div>
              <div className="grid grid-cols-3 text-[9px] font-black uppercase text-muted-foreground bg-muted/20 px-3 py-1.5 border-b border-border">
                <span>Birim</span>
                <span className="text-right">Alış</span>
                <span className="text-right">Satış</span>
              </div>
              <div className="divide-y divide-border px-3">
                {Object.entries(rates || {})
                  .filter(([key]) => key !== "update_date")
                  .map(([key, value]) => {
                    const rate = value as CurrencyRate;
                    return (
                      <div
                        key={key}
                        className="grid grid-cols-3 py-2 text-[11px] font-bold items-center hover:bg-muted/30 transition-colors"
                      >
                        <span className="text-muted-foreground uppercase">
                          {key === "gram-altin"
                            ? "ALTIN"
                            : key === "gram-gumus"
                              ? "GÜMÜŞ"
                              : key}
                        </span>
                        <span className="text-right tracking-tighter text-info font-medium">
                          {rate.Alış || "---"}
                        </span>
                        <span className="text-right tracking-tighter text-destructive font-medium">
                          {rate.Satış || "---"}
                        </span>
                      </div>
                    );
                  })}
              </div>
              <div className="p-2 text-[9px] text-center bg-muted/40 text-muted-foreground uppercase font-medium border-t border-border">
                Son Güncelleme:{" "}
                {rates?.update_date ||
                  new Date().toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
              </div>
            </section>

            {/* PERSONEL ARAMA / KİM KİMDİR (Resimdeki gibi) */}
            <section className="bg-card border border-border rounded-sm shadow-sm p-4">
              <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Search size={16} className="text-info" /> PERSONEL ARAMA
              </div>
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="İsim veya Birim Ara..."
                  className="w-full bg-muted border border-border px-3 py-2 text-xs rounded focus:outline-none focus:border-info transition-colors"
                />
                <Search
                  size={14}
                  className="absolute right-3 top-2.5 opacity-20"
                />
              </div>
            </section>

            {/* HAVA DURUMU WIDGET */}
            <section className="bg-card border border-border rounded-sm shadow-sm overflow-hidden">
              <div className="bg-info text-info-foreground p-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                ☁️ HAVA DURUMU
              </div>
              <div className="p-4">
                {weatherData ? (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        {getWeatherIcon(weatherData.current.weather_code)}
                        <div>
                          <div className="text-3xl font-black tracking-tighter leading-none">
                            {Math.round(weatherData.current.temperature_2m)}°
                          </div>
                          <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1">
                            İstanbul
                          </div>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                          <Thermometer size={12} className="text-info" />
                          <span>
                            Hissedilen:{" "}
                            {Math.round(
                              weatherData.current.apparent_temperature,
                            )}
                            °
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                          <Wind size={12} className="text-info" />
                          <span>
                            Rüzgar: {weatherData.current.wind_speed_10m} km/s
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                          <Droplets size={12} className="text-info" />
                          <span>
                            Nem: %{weatherData.current.relative_humidity_2m}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* 3 Günlük Tahmin */}
                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border">
                      {weatherData.daily.time
                        .slice(1, 4)
                        .map((date: string, idx: number) => (
                          <div
                            key={date}
                            className="text-center p-2 rounded hover:bg-muted/50 transition-colors"
                          >
                            <div className="text-[9px] font-black uppercase text-muted-foreground mb-1">
                              {new Date(date).toLocaleDateString("tr-TR", {
                                weekday: "short",
                              })}
                            </div>
                            <div className="flex justify-center my-1">
                              {getWeatherIcon(
                                weatherData.daily.weather_code[idx + 1],
                                14,
                              )}
                            </div>
                            <div className="text-[10px] font-black">
                              {Math.round(
                                weatherData.daily.temperature_2m_max[idx + 1],
                              )}
                              °
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-xs font-bold text-muted-foreground animate-pulse uppercase tracking-widest">
                    Hava Durumu Yükleniyor...
                  </div>
                )}
              </div>
            </section>

            {/* BU HAFTA DOĞANLAR */}
            <section className="bg-card border border-border rounded-sm shadow-sm overflow-hidden">
              <div className="bg-warning text-warning-foreground p-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                🎂 DOĞUM GÜNLERİ
              </div>
              <div className="p-3 space-y-4"></div>
            </section>
          </aside>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground/50 py-6 border-t border-primary-foreground/10">
        <div className="px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em]">
          <span>© {new Date().getFullYear()} Midas</span>
        </div>
      </footer>
    </div>
  );
};

export default Home;
