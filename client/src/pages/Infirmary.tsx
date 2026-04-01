import { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Stethoscope,
  Calendar,
  Phone,
  MapPin,
  FileText,
  User,
  Building2,
  CheckCircle2,
  Loader2,
  ClipboardList
} from "lucide-react";
import { usePersonnel } from "@/hooks/usePersonnel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import axios from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export default function Infirmary() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    leave_type: "",
    start_date: "",
    start_time: "07:30",
    end_date: "",
    end_time: "17:15",
    address: "",
    phone: "",
    description: ""
  });

  // Tüm personelleri hızlıca çekelim (Arama için)
  const { data: personnelResponse, isLoading: isLoadingPersonnel } = usePersonnel(1, 1000, searchTerm);
  const personnelList = useMemo(() => personnelResponse?.data || [], [personnelResponse]);

  // Seçilen Personel Bilgisi
  const selectedPersonnel = useMemo(() =>
    personnelList.find(p => p.id_dec === selectedPersonnelId),
    [selectedPersonnelId, personnelList]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonnel) return toast.error("Lütfen bir personel seçin.");
    if (!formData.leave_type) return toast.error("Lütfen izin nedenini seçin.");
    if (!formData.start_date || !formData.end_date) return toast.error("Lütfen tarihleri doldurun.");

    try {
      setIsSubmitting(true);

      // Revir kayıtları için AMİR ONAYI GEREKMEDEN (Auto-Approved) statüsü ile gönderiyoruz
      // Status 2 kabaca "Approved" anlamına gelsin (Senin sistemdeki karşılığına göre backend'de ayarlarız)
      const payload = {
        user_id: selectedPersonnel.id_dec,
        leave_reason_id: formData.leave_type === "Doktor Sevk" ? 8 : 9,
        leave_duration_type_id: 4, // Revir genelde saatlik kabul edilir
        start_date: `${formData.start_date} ${formData.start_time}`,
        end_date: `${formData.end_date} ${formData.end_time}`,
        address: formData.address,
        phone: formData.phone,
        description: `[REVİR KAYDI - ${user?.name}] ${formData.description}`,
        status: "Approved", 
        is_revir: true
      };

      await axios.post("/leave", payload);

      toast.success("Revir kaydı başarıyla oluşturuldu.");

      // Temizlik
      setSelectedPersonnelId(null);
      setSearchTerm("");
      setFormData({
        leave_type: "",
        start_date: "",
        start_time: "08:00",
        end_date: "",
        end_time: "17:30",
        address: "",
        phone: "",
        description: ""
      });

      queryClient.invalidateQueries({ queryKey: ["leaves"] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Kayıt sırasında bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-500 max-h-[calc(100vh-100px)] overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-0">
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Stethoscope className="text-primary h-6 w-6" />
          Revir İşlemleri
        </h1>
        <p className="text-muted-foreground text-xs font-bold">
          Hastaneye sevk ve istirahat raporu girişlerini buradan yapabilirsiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
        {/* SOL PANEL: PERSONEL SEÇİMİ */}
        <div className="lg:col-span-4 space-y-3 flex flex-col h-full">
          <div className="bg-card border border-border/50 rounded-[1.5rem] p-4 shadow-sm overflow-hidden relative group">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
              <Search size={16} className="text-primary" />
              Personel Bul
            </h2>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input
                placeholder="İsim veya Sicil No ile Ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-11 rounded-xl bg-muted/40 border-none text-sm font-bold"
              />
              {isLoadingPersonnel && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" size={14} />}
            </div>

            {/* Arama Sonuçları Listesi - Yükseklik Optimize Edildi */}
            <div className="space-y-1.5 max-h-[200px] overflow-y-hidden pr-1.5 custom-scrollbar">
              {searchTerm && personnelList.length > 0 ? (
                personnelList.map((p) => (
                  <button
                    key={p.id_dec}
                    onClick={() => {
                      setSelectedPersonnelId(p.id_dec);
                      setFormData(prev => ({ ...prev, phone: p.phone || "", address: p.address || "" }));
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl transition-all border border-transparent",
                      selectedPersonnelId === p.id_dec
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                        : "bg-muted/30 hover:bg-muted/50 text-foreground"
                    )}
                  >
                    <div className="flex flex-col items-start px-1 ">
                      <span className="font-bold text-sm truncate max-w-[180px]">{p.name} {p.surname}</span>
                      <span className={cn(
                        "text-[10px] uppercase font-bold tracking-widest",
                        selectedPersonnelId === p.id_dec ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {p.id_dec} • {p.Department?.name}
                      </span>
                    </div>
                    {selectedPersonnelId === p.id_dec && <CheckCircle2 size={16} />}
                  </button>
                ))
              ) : searchTerm ? (
                <div className="text-center py-6 opacity-50 text-sm italic">Personel bulunamadı...</div>
              ) : (
                <div className="text-center py-10 opacity-30">
                  <User size={32} className="mx-auto mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">Arama yaparak başlayın</p>
                </div>
              )}
            </div>
          </div>

          {/* Seçili Personel Detay Kartı */}
          {selectedPersonnel && (
            <div className="bg-primary/5 border border-primary/10 rounded-[1.5rem] p-4 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <User size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground leading-tight">{selectedPersonnel.name} {selectedPersonnel.surname}</h3>
                  <p className="text-[11px] font-bold text-primary uppercase tracking-wider">{selectedPersonnel.Role?.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground bg-background/50 p-2 rounded-lg">
                  <Building2 size={14} className="text-primary/60" />
                  <span className="text-[11px] text-foreground truncate">{selectedPersonnel.Department?.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground bg-background/50 p-2 rounded-lg">
                  <Calendar size={14} className="text-primary/60" />
                  <span className="text-[11px] text-foreground">{selectedPersonnel.id_dec}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SAĞ PANEL: FORM */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSubmit} className="bg-card border border-border/50 rounded-[1.5rem] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-1">
              <h2 className="text-base font-black text-foreground flex items-center gap-2">
                <Plus className="bg-primary text-primary-foreground p-0.5 rounded-md" size={18} />
                Yeni Kayıt Oluştur
              </h2>
              <div className="flex items-center gap-2 bg-green-500/10 text-green-600 px-3 py-1 rounded-full border border-green-500/20">
                <CheckCircle2 size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">Auto Approved</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              {/* İzin Nedeni */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">İzin Nedeni</label>
                <Select
                  value={formData.leave_type}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, leave_type: val }))}
                >
                  <SelectTrigger className="h-12 rounded-xl bg-muted/40 border-none font-bold text-base focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Seçiniz..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl">
                    <SelectItem value="Doktor Sevk" className="py-2.5 font-bold rounded-lg m-1 text-sm italic">🩺 Doktor Sevk</SelectItem>
                    <SelectItem value="Doktor İstirahat" className="py-2.5 font-bold rounded-lg m-1 text-sm italic">🛌 Doktor İstirahat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Ulaşılacak Tel */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Ulaşılacak Tel</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30" size={16} />
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="h-12 pl-10 rounded-xl bg-muted/40 border-none font-bold text-base focus-visible:ring-2 focus-visible:ring-primary/20"
                    placeholder="05xx..."
                  />
                </div>
              </div>

              {/* Başlangıç Tarih/Saat */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">İzin Başlangıç</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30" size={16} />
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      className="h-12 pl-10 rounded-xl bg-muted/40 border-none font-bold text-base"
                    />
                  </div>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                    className="h-12 w-28 rounded-xl bg-muted/40 border-none font-bold text-base"
                  />
                </div>
              </div>

              {/* Dönüş Tarih/Saat */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">İşe Dönüş Tarihi</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30" size={16} />
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      className="h-12 pl-10 rounded-xl bg-muted/40 border-none font-bold text-base"
                    />
                  </div>
                  <Input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                    className="h-12 w-28 rounded-xl bg-muted/40 border-none font-bold text-base"
                  />
                </div>
              </div>
            </div>

            {/* Ulaşılacak Adres */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Ulaşılacak Adres</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3.5 text-muted-foreground/30" size={16} />
                <Textarea
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="min-h-[50px] pl-10 rounded-xl bg-muted/40 border-none font-bold text-base pt-3"
                  placeholder="Hizmet alacağı hastane veya adres..."
                />
              </div>
            </div>

            {/* Açıklama */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tanı / Açıklama</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3.5 text-muted-foreground/30" size={16} />
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="min-h-[60px] pl-10 rounded-xl bg-muted/40 border-none font-bold text-base pt-3"
                  placeholder="Kısa tıbbi notlar..."
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex items-center gap-3">
              <Button
                type="submit"
                disabled={isSubmitting || !selectedPersonnel}
                className="flex-1 h-14 rounded-xl text-lg font-black uppercase tracking-widest shadow-lg shadow-primary/20"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin mr-2" size={20} />
                ) : (
                  <CheckCircle2 className="mr-2" size={20} />
                )}
                Revir Kaydını Onayla
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-14 w-14 rounded-xl border-2 border-primary/10 text-primary hover:bg-primary/5"
                onClick={() => toast.info("Revir izinleri geçmişi yakında eklenecek.")}
              >
                <ClipboardList size={26} />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
