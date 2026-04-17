import { useState } from "react";
import { useFoodMenu } from "@/hooks/useFoodMenu";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  UtensilsCrossed,
  ArrowLeft,
  ArrowRight,
  Loader2,
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

export default function FoodMenuPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = format(currentDate, "yyyy");
  const month = format(currentDate, "MM");

  const { monthlyQuery } = useFoodMenu(year, month);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  }).filter((day) => day.getDay() !== 0 && day.getDay() !== 6);

  return (
    <div className="p-4 space-y-4 w-full mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <UtensilsCrossed size={24} />
            </div>
            Yemek Menüsü
          </h1>
        </div>

        <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-2xl shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl w-10 h-10"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ArrowLeft size={18} />
          </Button>
          <div className="px-4 font-black text-xs uppercase tracking-[0.2em] min-w-[150px] text-center">
            {format(currentDate, "MMMM yyyy", { locale: tr })}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl w-10 h-10"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ArrowRight size={18} />
          </Button>
        </div>
      </div>

      {monthlyQuery.isLoading ? (
        <div className="h-[400px] flex items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {daysInMonth.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const menuData = monthlyQuery.data?.find(
              (m) => m.menu_date === dateKey,
            );
            const isActive = isToday(day);

            return (
              <Card
                key={dateKey}
                className={cn(
                  "border-border/60 shadow-none transition-all duration-300 rounded-xl flex flex-col h-full",
                  isActive &&
                    "border-primary bg-primary-4 ring-2 ring-primary/30 shadow-lg shadow-primary/20 scale-[1.02] z-10",
                )}
              >
                <div
                  className={cn(
                    "px-3 py-1.5 flex items-center justify-between border-b border-border/50",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/30",
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black tracking-tight leading-tight">
                      {format(day, "d MMMM", { locale: tr })}
                    </span>
                    <span
                      className={cn(
                        "text-[8px] font-bold uppercase leading-none",
                        isActive ? "text-primary-foreground/80" : "text-muted-foreground opacity-60",
                      )}
                    >
                      {format(day, "EEEE", { locale: tr })}
                    </span>
                  </div>
                  {isActive && (
                    <div className="bg-primary-foreground/20 p-1 rounded-md animate-bounce">
                      <UtensilsCrossed size={12} />
                    </div>
                  )}
                </div>

                <CardContent className="p-2 flex-1 space-y-0.5">
                  {menuData &&
                  menuData.parsedItems.some((i) => i.trim() !== "") ? (
                    menuData.parsedItems.map(
                      (item, idx) =>
                        item.trim() !== "" && (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 py-0.5 border-b border-border/30 last:border-0"
                          >
                            <span className="text-[10px] font-bold text-foreground/80 leading-none truncate">
                              {item}
                            </span>
                          </div>
                        ),
                    )
                  ) : (
                    <div className="py-4 text-center opacity-20">
                      <p className="text-[8px] font-black uppercase">Boş</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="bg-card rounded-2xl p-4 flex items-center gap-4 border border-border/50 shadow-sm">
        <div className="text-xl opacity-30">🍱</div>
        <p className="text-[10px] text-muted-foreground font-medium flex-1">
          Sağlıklı beslenme verimliliği artırır. Önerileriniz için iletişime
          geçebilirsiniz.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl h-8 px-4 text-[10px] font-black uppercase tracking-widest border-primary/20 text-primary hover:bg-primary/5"
        >
          Öneri
        </Button>
      </div>
    </div>
  );
}
