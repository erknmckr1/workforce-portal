import React, { useState, useRef, useEffect } from "react";
import { useFoodMenu } from "@/hooks/useFoodMenu";
import {
  X,
  UtensilsCrossed,
  ArrowLeft,
  ArrowRight,
  Loader2,
  ChevronRight,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isToday,
} from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface FoodMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FoodMenuModal: React.FC<FoodMenuModalProps> = ({ isOpen, onClose }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const todayRef = useRef<HTMLDivElement>(null);
  const year = format(currentDate, "yyyy");
  const month = format(currentDate, "MM");

  const { monthlyQuery } = useFoodMenu(year, month);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  }).filter((day) => day.getDay() !== 0 && day.getDay() !== 6);

  // Modal açıldığında veya veri yüklendiğinde "Bugün"e kaydır
  useEffect(() => {
    if (isOpen && !monthlyQuery.isLoading) {
      setTimeout(() => {
        todayRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 300); // Modal animasyonunun bitmesini bekleyelim
    }
  }, [isOpen, monthlyQuery.isLoading, currentDate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-hidden">
      <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-[95%] h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header - Midas Theme */}
        <div className="bg-mds p-8 flex items-center justify-between border-b border-foreground/10 shrink-0">
          <div className="flex items-center gap-6">
            <div className="bg-foreground/10 p-4 rounded-2xl">
              <UtensilsCrossed size={32} className="text-black" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-black uppercase tracking-tight">
                Yemek Menüsü
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Month Navigation */}
            <div className="flex items-center gap-2 bg-foreground/5 p-2 rounded-[1.25rem] border border-foreground/5">
              <button
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="p-3 hover:bg-foreground/10 rounded-xl transition-all text-black"
              >
                <ArrowLeft size={24} />
              </button>
              <div className="px-6 font-black text-sm uppercase tracking-[0.2em] min-w-[200px] text-center text-black">
                {format(currentDate, "MMMM yyyy", { locale: tr })}
              </div>
              <button
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="p-3 hover:bg-foreground/10 rounded-xl transition-all text-black"
              >
                <ArrowRight size={24} />
              </button>
            </div>

            <button
              onClick={onClose}
              className="bg-foreground/10 hover:bg-foreground/20 text-black p-4 rounded-[1.25rem] transition-all active:scale-95"
            >
              <X size={32} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {monthlyQuery.isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-mds" size={64} />
              <span className="font-black text-muted-foreground uppercase tracking-widest animate-pulse">
                Menü Yükleniyor...
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-8">
              {daysInMonth.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const menuData = monthlyQuery.data?.find(
                  (m) => m.menu_date === dateKey,
                );
                const isActive = isToday(day);

                return (
                  <div
                    key={dateKey}
                    ref={isActive ? todayRef : null}
                    className={cn(
                      "group relative bg-secondary/20 border-2 rounded-[2rem] p-6 flex flex-col h-full transition-all duration-500",
                      isActive
                        ? "border-mds bg-mds/5 ring-4 ring-mds/10 shadow-xl"
                        : "border-border/40 hover:border-mds/30 hover:bg-secondary/40",
                    )}
                  >
                    {/* Date Badge */}
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-col">
                        <span
                          className={cn(
                            "text-3xl font-black tracking-tighter leading-none",
                            isActive ? "text-mds" : "text-foreground",
                          )}
                        >
                          {format(day, "d", { locale: tr })}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">
                          {format(day, "MMMM", { locale: tr })}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          isActive
                            ? "bg-mds text-black"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {format(day, "EEEE", { locale: tr })}
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="flex-1 space-y-3">
                      {menuData &&
                      menuData.parsedItems.some((i) => i.trim() !== "") ? (
                        menuData.parsedItems.map(
                          (item, idx) =>
                            item.trim() !== "" && (
                              <div
                                key={idx}
                                className="flex items-start gap-2 group/item"
                              >
                                <ChevronRight
                                  size={14}
                                  className="mt-0.5 text-mds/50 group-hover/item:text-mds transition-colors shrink-0"
                                />
                                <span className="text-xs font-bold text-foreground/80 leading-snug">
                                  {item}
                                </span>
                              </div>
                            ),
                        )
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 py-8">
                          <span className="text-4xl mb-2">🍽️</span>
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            Menü Bulunamadı
                          </span>
                        </div>
                      )}
                    </div>

                    {isActive && (
                      <div className="absolute -top-3 -right-3 bg-mds text-black w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-4 border-card animate-bounce">
                        <UtensilsCrossed size={16} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-6 bg-muted/30 border-t border-border/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="text-3xl">🥗</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-mds animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Midas MES Terminal
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodMenuModal;
