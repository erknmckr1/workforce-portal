import { useState, useMemo } from "react";
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Search,
  CheckCircle2,
  Clock,
  Monitor,
  Smartphone,
  Globe,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useSurveys } from "@/hooks/useSurveys";
import { useConfirm } from "@/providers/ConfirmProvider";
import type { CompanySurvey, SurveyFormData } from "@/types/survey";
import { cn } from "@/lib/utils";

const PLATFORM_OPTIONS = [
  { id: "MES", label: "MES Terminalleri (Üretim Ekranları)", icon: Monitor },
  { id: "KIOSK", label: "İzin Kiosku (Saha Kiosklar)", icon: Smartphone },
  { id: "PORTAL", label: "İntranet / Personel Portali", icon: Globe },
];

export default function SurveyManager() {
  const { surveys, isLoading, createSurvey, updateSurvey, toggleSurvey, deleteSurvey, isSubmitting } =
    useSurveys();
  const { confirm } = useConfirm();

  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<CompanySurvey | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["MES", "KIOSK", "PORTAL"]);
  const [isActive, setIsActive] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [orderIndex, setOrderIndex] = useState(0);

  // Preview Modal State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setFormUrl("");
    setSelectedPlatforms(["MES", "KIOSK", "PORTAL"]);
    setIsActive(true);
    setStartDate("");
    setEndDate("");
    setOrderIndex(0);
    setEditingSurvey(null);
  };

  const handleOpenAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (survey: CompanySurvey) => {
    setEditingSurvey(survey);
    setTitle(survey.title);
    setDescription(survey.description || "");
    setFormUrl(survey.form_url);
    setSelectedPlatforms(survey.target_platforms.split(",").map((s) => s.trim()));
    setIsActive(survey.is_active);
    setStartDate(survey.start_date ? survey.start_date.slice(0, 10) : "");
    setEndDate(survey.end_date ? survey.end_date.slice(0, 10) : "");
    setOrderIndex(survey.order_index || 0);
    setIsDialogOpen(true);
  };

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !formUrl.trim()) return;

    const payload: SurveyFormData = {
      title: title.trim(),
      description: description.trim() || undefined,
      form_url: formUrl.trim(),
      target_platforms: selectedPlatforms.length > 0 ? selectedPlatforms.join(",") : "MES",
      is_active: isActive,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      order_index: Number(orderIndex) || 0,
    };

    if (editingSurvey) {
      await updateSurvey({ id: editingSurvey.id, data: payload });
    } else {
      await createSurvey(payload);
    }
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (survey: CompanySurvey) => {
    const isConfirmed = await confirm({
      title: "Anketi Sil",
      description: `"${survey.title}" anketini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      confirmText: "Evet, Sil",
      cancelText: "İptal",
      variant: "destructive",
    });

    if (isConfirmed) {
      await deleteSurvey(survey.id);
    }
  };

  // Filtreleme
  const filteredSurveys = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return surveys;
    return surveys.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        s.target_platforms.toLowerCase().includes(q)
    );
  }, [surveys, searchTerm]);

  // Durum hesaplama
  const getSurveyStatus = (survey: CompanySurvey) => {
    if (!survey.is_active) {
      return { label: "Pasif", color: "bg-muted text-muted-foreground border-border" };
    }
    const now = new Date();
    if (survey.end_date && new Date(survey.end_date) < now) {
      return { label: "Süresi Doldu", color: "bg-destructive/10 text-destructive border-destructive/20" };
    }
    if (survey.start_date && new Date(survey.start_date) > now) {
      return { label: "Planlandı", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
    }
    return { label: "Yayında", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" };
  };

  return (
    <div className="space-y-6">
      {/* Üst Başlık & Ekle Butonu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <ClipboardList className="text-primary" size={24} />
            Şirket Anketleri Yönetimi
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            MES terminalleri, İzin Kiosku ve Personel Portali ekranlarında yayınlanacak form ve anketleri yönetin.
          </p>
        </div>

        <Button
          onClick={handleOpenAddDialog}
          className="rounded-xl font-bold gap-2 shadow-lg shadow-primary/20 shrink-0"
        >
          <Plus size={16} />
          Yeni Anket Ekle
        </Button>
      </div>

      {/* Arama Barı */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          placeholder="Anket adı veya açıklamasında ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-10 rounded-xl bg-muted/30 border-border/60"
        />
      </div>

      {/* Anket Kartları / Listesi */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="animate-spin mb-2" size={28} />
          <span className="text-sm">Anketler yükleniyor...</span>
        </div>
      ) : filteredSurveys.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-muted/10">
          <ClipboardList className="mx-auto text-muted-foreground opacity-30 mb-3" size={48} />
          <h3 className="font-bold text-sm text-foreground">Henüz kayıtlı anket bulunmuyor</h3>
          <p className="text-xs text-muted-foreground mt-1">
            "Yeni Anket Ekle" butonuna basarak ilk anket bağlantısını sisteme ekleyebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredSurveys.map((survey) => {
            const status = getSurveyStatus(survey);
            const platforms = survey.target_platforms.split(",").map((p) => p.trim());

            return (
              <div
                key={survey.id}
                className={cn(
                  "p-5 rounded-2xl border bg-card/50 hover:bg-card hover:border-primary/30 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4",
                  !survey.is_active && "opacity-75 bg-muted/10"
                )}
              >
                {/* Sol: Bilgi & Link */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-extrabold text-base text-foreground tracking-tight">
                      {survey.title}
                    </span>
                    <Badge variant="outline" className={cn("text-[10px] font-bold py-0.5", status.color)}>
                      {status.label}
                    </Badge>
                    <span className="text-[11px] font-mono text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-md">
                      Sıra: #{survey.order_index}
                    </span>
                  </div>

                  {survey.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{survey.description}</p>
                  )}

                  {/* Platformlar & Tarihler */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                    {/* Platform Rozetleri */}
                    <div className="flex items-center gap-1.5">
                      {platforms.map((p) => (
                        <span
                          key={p}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20"
                        >
                          {p === "MES" ? "Üretim MES" : p === "KIOSK" ? "Saha Kiosk" : "Portal"}
                        </span>
                      ))}
                    </div>

                    <div className="h-3 w-px bg-border/60 hidden sm:block" />

                    {/* Tarih Aralığı */}
                    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                      <Clock size={13} />
                      <span>
                        {survey.start_date || survey.end_date
                          ? `${survey.start_date ? new Date(survey.start_date).toLocaleDateString("tr-TR") : "Başlangıç Yok"} ➔ ${
                              survey.end_date ? new Date(survey.end_date).toLocaleDateString("tr-TR") : "Süresiz"
                            }`
                          : "Süresiz Yayın"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sağ: Aksiyon Butonları & Switch */}
                <div className="flex items-center gap-3 shrink-0 self-end md:self-center border-t md:border-t-0 pt-3 md:pt-0 w-full md:w-auto justify-between md:justify-end">
                  {/* Aktif / Pasif Toggle */}
                  <div className="flex items-center gap-2 pr-2 border-r border-border/60">
                    <Switch
                      checked={survey.is_active}
                      onCheckedChange={() => toggleSurvey(survey.id)}
                      disabled={isSubmitting}
                      title={survey.is_active ? "Pasife Al" : "Yayına Al"}
                    />
                    <span className="text-xs font-bold text-muted-foreground select-none">
                      {survey.is_active ? "Yayında" : "Pasif"}
                    </span>
                  </div>

                  {/* Önizle Butonu */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewUrl(survey.form_url)}
                    className="h-9 px-3 rounded-xl gap-1.5 text-xs font-bold"
                    title="Anketi Önizle"
                  >
                    <ExternalLink size={13} />
                    <span className="hidden sm:inline">Önizle</span>
                  </Button>

                  {/* Düzenle Butonu */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenEditDialog(survey)}
                    className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-foreground"
                    title="Düzenle"
                  >
                    <Pencil size={15} />
                  </Button>

                  {/* Sil Butonu */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(survey)}
                    className="h-9 w-9 p-0 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                    title="Sil"
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ekleme / Düzenleme Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl sm:max-w-3xl rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <ClipboardList className="text-primary" size={22} />
              {editingSurvey ? "Anketi Düzenle" : "Yeni Anket Ekle"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Anket başlığı, Microsoft Forms linki, hedef ekranlar ve yayınlanma tarihlerini yapılandırın.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div>
              <Label className="text-xs font-bold">Anket Başlığı *</Label>
              <Input
                placeholder="Örn: 2026 Yılı Çalışan Memnuniyeti Anketi"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="mt-1.5 rounded-xl h-11 text-sm font-medium"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Form Bağlantısı (URL) *</Label>
              <Input
                placeholder="https://forms.cloud.microsoft/r/..."
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                required
                className="mt-1.5 rounded-xl h-11 font-mono text-xs"
              />
              <span className="text-[11px] text-muted-foreground mt-1.5 block">
                Microsoft Forms, Google Forms vb. herkese açık anket linkini yapıştırın.
              </span>
            </div>

            <div>
              <Label className="text-xs font-bold">Açıklama (Opsiyonel)</Label>
              <Input
                placeholder="Örn: Fabrika geneli yıllık değerlendirme anketi."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5 rounded-xl h-10 text-xs"
              />
            </div>

            {/* Hedef Ekranlar */}
            <div>
              <Label className="text-xs font-bold block mb-2">Hangi Ekranlarda Yayınlansın?</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PLATFORM_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isChecked = selectedPlatforms.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => togglePlatform(opt.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer select-none transition-all",
                        isChecked
                          ? "bg-primary/10 border-primary/40 text-foreground ring-1 ring-primary/20 shadow-xs"
                          : "bg-muted/20 border-border/60 text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                          isChecked ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon size={16} />
                      </div>
                      <span className="text-xs font-bold flex-1">{opt.label}</span>
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all",
                          isChecked ? "bg-primary border-primary text-white" : "border-muted-foreground/40"
                        )}
                      >
                        {isChecked && <CheckCircle2 size={12} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tarih Aralığı */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <Label className="text-xs font-bold">Başlangıç Tarihi</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1.5 rounded-xl h-10 text-xs"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Boş bırakılırsa hemen yayına girer.
                </span>
              </div>
              <div>
                <Label className="text-xs font-bold">Bitiş Tarihi (Otomatik Kapanış)</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1.5 rounded-xl h-10 text-xs"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Boş bırakılırsa süresiz yayında kalır.
                </span>
              </div>
            </div>

            {/* Sıralama ve Aktiflik */}
            <div className="flex items-center justify-between pt-3 border-t border-border/60">
              <div className="flex items-center gap-3">
                <Switch checked={isActive} onCheckedChange={setIsActive} id="form-active" />
                <Label htmlFor="form-active" className="text-xs font-bold cursor-pointer">
                  Hemen Yayına Al
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs font-bold">Sıra:</Label>
                <Input
                  type="number"
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(Number(e.target.value))}
                  className="w-20 h-9 text-center rounded-xl text-xs font-bold"
                  min={0}
                />
              </div>
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="rounded-xl font-bold"
              >
                İptal
              </Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl font-bold shadow-md px-6">
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={14} />
                    Kaydediliyor...
                  </>
                ) : editingSurvey ? (
                  "Değişiklikleri Kaydet"
                ) : (
                  "Anketi Oluştur"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Canlı Form Önizleme Modalı */}
      {previewUrl && (
        <div className="fixed inset-0 z-150 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl w-full max-w-[1440px] h-[94vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-3.5 px-6 border-b border-border bg-muted/40 flex items-center justify-between shrink-0 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <ClipboardList size={20} />
                </div>
                <div className="min-w-0">
                  <span className="font-extrabold text-sm text-foreground block">Anket Canlı Önizleme (iFrame)</span>
                  <span className="text-[11px] font-mono text-muted-foreground truncate block max-w-sm sm:max-w-md md:max-w-xl">
                    {previewUrl}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(previewUrl, "_blank")}
                  className="rounded-xl font-bold text-xs h-9 gap-1.5"
                  title="Yeni Sekmede Aç"
                >
                  <ExternalLink size={13} />
                  <span className="hidden sm:inline">Yeni Sekmede Aç</span>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setPreviewUrl(null)}
                  className="rounded-xl font-bold text-xs h-9 px-4"
                >
                  Önizlemeyi Kapat
                </Button>
              </div>
            </div>
            <div className="flex-1 w-full h-full bg-white relative">
              <iframe
                src={previewUrl}
                title="Survey Preview"
                className="w-full h-full border-none"
                allow="geolocation; microphone; camera"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
