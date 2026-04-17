import { useState } from "react";
import { useFoodMenu } from "@/hooks/useFoodMenu";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar,
  Save,
  ArrowLeft,
  ArrowRight,
  Table as TableIcon,
  FileSpreadsheet,
  Download,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
} from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

const ITEM_LABELS = [
  "Çorba",
  "Ana Yemek",
  "Pilav / Makarna",
  "Salata / Meze",
  "Tatlı / Meyve",
  "Yoğurt / İçecek",
  "Kahvaltı / Ara Öğün",
];

export default function FoodMenuManager() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = format(currentDate, "yyyy");
  const month = format(currentDate, "MM");

  const { monthlyQuery, bulkUpdateMutation } = useFoodMenu(year, month);
  const [localMenu, setLocalMenu] = useState<Record<string, string[]>>({});
  const [prevQueryData, setPrevQueryData] = useState<any>(null);

  // Sync internal state with query data during render to avoid cascading effects
  if (monthlyQuery.data && monthlyQuery.data !== prevQueryData) {
    const initialMap: Record<string, string[]> = {};
    monthlyQuery.data.forEach((entry) => {
      initialMap[entry.menu_date] = entry.parsedItems;
    });
    setLocalMenu(initialMap);
    setPrevQueryData(monthlyQuery.data);
  }

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const handleSave = async () => {
    try {
      const menuData = Object.entries(localMenu)
        .filter(([, items]) => items.some((i) => i.trim() !== "")) // Sadece en az 1 öğesi olanları gönder
        .map(([date, items]) => ({
          menu_date: date,
          items: items,
        }));

      if (menuData.length === 0) {
        toast.error("Kaydedilecek veri bulunamadı.");
        return;
      }

      await bulkUpdateMutation.mutateAsync(menuData);
      toast.success("Aylık menü başarıyla güncellendi.");
    } catch {
      toast.error("Hata oluştu.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        const newMenu: Record<string, string[]> = { ...localMenu };
        let importedCount = 0;
        const dateRegex = /(\d{2})\.(\d{2})\.(\d{4})/; // Format: 01.04.2026

        // Görseldeki karmaşık grid yapısını taramak için tüm hücreleri geziyoruz
        data.forEach((row, rowIndex) => {
          if (!row) return;
          row.forEach((cell, colIndex) => {
            const cellStr = String(cell || "");
            const match = cellStr.match(dateRegex);

            // Eğer hücrede "01.04.2026" gibi bir tarih formatı varsa o günün başlangıcıdır
            if (match) {
              const dateKey = `${match[3]}-${match[2]}-${match[1]}`; // YYYY-MM-DD
              
              const items: string[] = [];
              // Bu hücrenin altındaki 7 satırı (yemek kalemleri) oku
              for (let i = 1; i <= ITEM_LABELS.length; i++) {
                const foodRow = data[rowIndex + i];
                items.push(String(foodRow ? foodRow[colIndex] || "" : "").trim());
              }

              // Sadece en az 1 kalemi olan günleri ekle
              if (items.some((item) => item !== "")) {
                newMenu[dateKey] = items;
                importedCount++;
              }
            }
          });
        });

        if (importedCount === 0) {
          toast.error(
            "Dosyada uygun formatta tarih ve yemek bilgisi bulunamadı.",
          );
          return;
        }

        setLocalMenu(newMenu);
        toast.success(
          `${importedCount} günlük menü başarıyla aktarıldı. Kaydetmeyi unutmayın!`,
        );
      } catch (err) {
        console.error(err);
        toast.error(
          "Excel dosyası okunurken hata oluştu. Lütfen formatı kontrol edin.",
        );
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ""; // Girişi sıfırla
  };

  const downloadTemplate = () => {
    const monthName = format(currentDate, "MMMM yyyy", { locale: tr }).toUpperCase();
    const data: any[][] = [
      ["", "", "", "", `${monthName} MENÜ`], // Başlık
      [], // Boşluk
    ];

    const days = eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    });

    // Günleri haftalara (Pazartesi-Cuma) göre grupla
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];

    days.forEach((day) => {
      const dayIdx = day.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
      if (dayIdx === 0 || dayIdx === 6) return; // Hafta sonlarını atla

      // Eğer Pazartesi ise yeni hafta başlat
      if (dayIdx === 1 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    });
    if (currentWeek.length > 0) weeks.push(currentWeek);

    // Her haftayı 8 satır olarak ekle (1 Tarih + 7 Yemek satırı)
    weeks.forEach((week) => {
      // Sütun eşleştirme: Pazartesi -> Index 1, Salı -> Index 2 ... Cuma -> Index 5
      const dateRow = Array(6).fill("");
      week.forEach(d => {
        const idx = d.getDay();
        dateRow[idx] = format(d, "dd.MM.yyyy EEEE", { locale: tr }).toUpperCase();
      });
      data.push(dateRow);

      // 7 Boş yemek satırı ekle
      for (let i = 0; i < 7; i++) {
        data.push(Array(6).fill(""));
      }
      data.push([]); // Haftalar arası boşluk
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Sütun genişliklerini ayarla (Daha okunaklı olması için)
    ws["!cols"] = [
      { wch: 5 },  // A
      { wch: 30 }, // B
      { wch: 30 }, // C
      { wch: 30 }, // D
      { wch: 30 }, // E
      { wch: 30 }, // F
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Yemek Menusu");
    
    const fileName = `Yemek_Menusu_Sablonu_${format(currentDate, "MMMM_yyyy", { locale: tr })}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="p-6 space-y-6 w-full mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Calendar className="text-primary" size={32} />
            Yemek Menüsü Yönetimi
          </h1>
          <p className="text-muted-foreground font-medium">
            Aylık yemek listesini düzenleyin ve güncelleyin.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-2xl shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ArrowLeft size={18} />
          </Button>
          <div className="px-4 font-black text-sm uppercase tracking-widest min-w-[180px] text-center">
            {format(currentDate, "MMMM yyyy", { locale: tr })}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ArrowRight size={18} />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            id="excel-upload"
            className="hidden"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="h-12 px-4 rounded-2xl font-bold border-dashed border-primary/30 text-primary hover:bg-primary/5 hidden md:flex items-center gap-2"
          >
            <Download size={18} />
            Şablon İndir
          </Button>
          <Button
            variant="outline"
            onClick={() => document.getElementById("excel-upload")?.click()}
            className="h-12 px-4 rounded-2xl font-bold border-primary/30 text-primary hover:bg-primary/5 flex items-center gap-2"
          >
            <Upload size={18} />
            Excel'den Aktar
          </Button>
          <Button
            onClick={handleSave}
            disabled={bulkUpdateMutation.isPending}
            className="h-12 px-8 rounded-2xl font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Save size={18} />
            {bulkUpdateMutation.isPending ? "Kaydediliyor..." : "Tümünü Kaydet"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {daysInMonth.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayName = format(day, "EEEE", { locale: tr });
          const isToday = format(new Date(), "yyyy-MM-dd") === dateKey;
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <Card
              key={dateKey}
              className={cn(
                "border-border/50 shadow-none overflow-hidden transition-all duration-300 hover:border-primary/50 group",
                isToday &&
                  "border-primary bg-primary/5 shadow-md shadow-primary/5",
                isWeekend && "bg-muted/30",
              )}
            >
              <div
                className={cn(
                  "px-4 py-3 border-b border-border/50 flex items-center justify-between",
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50",
                )}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase tracking-widest opacity-70">
                    {dayName}
                  </span>
                  <span className="text-sm font-black">
                    {format(day, "d MMMM", { locale: tr })}
                  </span>
                </div>
                {isToday && (
                  <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded-full uppercase">
                    Bugün
                  </span>
                )}
              </div>
              <CardContent className="p-4 space-y-2">
                {ITEM_LABELS.map((label, idx) => {
                   const itemValue = localMenu[dateKey]?.[idx] || "";
                   return (
                    <div key={idx} className="flex items-center gap-2 group/item">
                      <span className="text-[10px] font-black text-muted-foreground w-4 shrink-0 opacity-40">
                         {idx + 1}
                      </span>
                      <span className={cn(
                        "text-[11px] font-bold truncate",
                        itemValue ? "text-foreground" : "text-muted-foreground/30 italic"
                      )}>
                        {itemValue || "---"}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="bg-muted/30 border border-border/50 rounded-3xl p-6 flex items-start gap-4">
        <div className="p-3 bg-card border border-border/50 rounded-2xl text-primary shadow-sm">
          <TableIcon size={24} />
        </div>
        <div>
          <h4 className="font-black text-primary uppercase tracking-widest text-sm">
            Excel İle Hızlı Aktarım
          </h4>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            "Şablon İndir" butonuna tıklayarak ilgili aya ait Excel dosyasını alabilir, 
            içeriği doldurduktan sonra "Excel'den Aktar" diyerek tüm ayı tek seferde yükleyebilirsiniz.
          </p>
        </div>
      </div>
    </div>
  );
}
