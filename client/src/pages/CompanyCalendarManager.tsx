import React, { useState, useEffect } from "react";
import apiClient from "@/lib/api";
import { format } from "date-fns";
import { toast } from "sonner";
import { useConfirm } from "@/providers/ConfirmProvider";

interface CalendarEvent {
  id: number;
  event_date: string;
  event_type: string;
  title: string;
  description: string;
  is_half_day: boolean;
  color_code: string;
}

const EVENT_TYPES = [
  { value: "SALARY", label: "Maaş Ödemesi", defaultColor: "#10b981" },
  { value: "HOLIDAY", label: "Resmi / Dini Bayram", defaultColor: "#f59e0b" },
  { value: "CLOSURE", label: "Tam Kapama (Yıllık İzinden)", defaultColor: "#ef4444" },
  { value: "CLOSURE_HALF", label: "Yarım Gün Kapama", defaultColor: "#ef4444" },
];

export default function CompanyCalendarManager() {
  const { confirm } = useConfirm();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState("HOLIDAY");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/calendar");
      // Eğer sunucudan data gelmezse veya undefined dönerse [] array i kullan ki sayfa .map atarken çökmesin!
      setEvents(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Takvim verileri çekilemedi:", err);
      setEvents([]); // Hata anında da boş dizi ver.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !title) {
      toast.error("Tarihler ve başlık zorunludur!");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Başlangıç tarihi bitişten sonra olamaz!");
      return;
    }

    const selectedType = EVENT_TYPES.find((t) => t.value === type);

    try {
      const res = await apiClient.post("/calendar", {
        start_date: startDate,
        end_date: endDate,
        event_type: type,
        title: title,
        description: desc,
        color_code: selectedType?.defaultColor,
        is_half_day: type === "CLOSURE_HALF",
      });
      toast.success(res.data.message || "Etkinlik başarıyla eklendi.");

      // Formu temizle ve listeyi yenile
      setStartDate("");
      setEndDate("");
      setTitle("");
      setDesc("");
      fetchEvents();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Bir hata oluştu.");
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: "Takvim Etkinliğini Sil",
      description: "Bu takvim etkinliğini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
    });
    if (!confirmed) return;
    try {
      await apiClient.delete(`/calendar/${id}`);
      toast.success("Etkinlik başarıyla silindi.");
      fetchEvents();
    } catch (err) {
      toast.error("Silinirken bir hata oluştu.");
    }
  };

  return (
    <div className="p-8 w-full mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-foreground">Kurumsal Takvim Yönetimi</h1>
        <p className="text-muted-foreground">Şirketin maaş günlerini, resmî tatillerini ve kapalı olduğu günleri buradan belirleyin.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Form Alanı - Sticky */}
        <div className="col-span-1 bg-card border rounded-2xl p-6 shadow-sm h-fit sticky top-6">
          <h2 className="text-lg font-bold mb-4">Yeni Gün Ekle</h2>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Başlangıç</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2 border rounded-xl bg-background text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Bitiş</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="w-full p-2 border rounded-xl bg-background text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Etkinlik Türü</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-2 border rounded-xl bg-background"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Başlık (Takvimde Görünecek)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: 23 Nisan Çocuk Bayramı"
                className="w-full p-2 border rounded-xl bg-background"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Açıklama (Opsiyonel)</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Ek detaylar..."
                className="w-full p-2 border rounded-xl bg-background resize-none"
                rows={2}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:bg-primary/90 transition-all shadow-md"
            >
              Takvime Ekle
            </button>
          </form>
        </div>

        {/* Liste Alanı */}
        <div className="col-span-2 bg-card border rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Mevcut Tanımlamalar</h2>

          {loading ? (
            <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
          ) : events.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground bg-muted/30 rounded-xl">Henüz takvime bir gün eklenmemiş.</div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-primary-foreground shadow-sm flex-shrink-0"
                      style={{ backgroundColor: event.color_code || "#ccc" }}
                    >
                      {format(new Date(event.event_date), "dd")}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                        {event.title}
                        {event.is_half_day && <span className="text-[10px] bg-warning/20 text-warning px-2 py-0.5 rounded-full uppercase font-bold">Yarım Gün</span>}
                      </h3>
                      <p className="text-xs text-muted-foreground">{format(new Date(event.event_date), "MMMM yyyy, EEEE")}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(event.id)}
                    className="text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-colors text-sm font-medium"
                  >
                    Sil
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
