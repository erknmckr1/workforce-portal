import { useState } from "react";
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  Info,
  Loader2,
  Users,
  HardDriveDownload,
  FolderOpen
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import apiClient from "@/lib/api";

interface SyncSummary {
  totalRows: number;
  updated: number;
  notFound: number;
  unchanged: number;
  path?: string;
}

export default function SettingsIndex() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [summary, setSummary] = useState<SyncSummary | null>(null);

  // Sunucudaki sabit dosyadan senkronize et
  const handleLocalSync = async () => {
    setIsSyncing(true);
    setSummary(null);
    try {
      const response = await apiClient.post("/personnel/sync-leaves-local");
      setSummary(response.data.summary);
      toast.success("Sunucudaki dosyadan izinler güncellendi!");
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Sunucu dosyası okunurken bir hata oluştu.";
      toast.error(errorMessage);
    } finally {
      setIsSyncing(false);
    }
  };

  // Manuel dosya yükleme (Dosya seçildiği an yükler)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploading(true);
      setSummary(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await apiClient.post("/personnel/sync-leaves", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        setSummary(response.data.summary);
        toast.success("Yüklenen dosyadan izinler güncellendi!");
      } catch (error: unknown) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "Excel yüklenirken hata oluştu.";
        toast.error(errorMessage);
      } finally {
        setIsUploading(false);
        e.target.value = ''; // Reset input
      }
    }
  };

  return (
    <div className="space-y-8 p-1">
      <div>
        <h3 className="text-3xl font-black text-foreground tracking-tight">Genel Ayarlar</h3>
        <p className="text-muted-foreground font-medium mt-1">
          Sistem parametrelerini ve veri senkronizasyonlarını buradan yönetin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 leading-tight">
        {/* İzin Senkronizasyon Ana Kartı */}
        <Card className="border-border/50 shadow-xl shadow-border/5 overflow-hidden flex flex-col">
          <div className="h-2 w-full bg-primary" />
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">İzin Bakiyesi Senkronizasyonu</CardTitle>
                <CardDescription>Excel verileri ile sistemi güncel tutun</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 flex-1">
            {/* Sunucu Dosyası Seçeneği (Önerilen) */}
            <div className="p-6 rounded-2xl bg-primary/3 border border-primary/10 flex flex-col gap-4">
               <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-primary/10 text-primary shrink-0">
                    <HardDriveDownload size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-base text-foreground">Sunucudaki Dosyayı Kullan</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                       Sistemde tanımlı olan <span className="font-bold text-primary italic">YILLIK İZİN TAKİP 2026.xlsx</span> dosyasını okur. En hızlı ve güvenli yöntemdir.
                    </p>
                  </div>
               </div>
               <Button 
                onClick={handleLocalSync} 
                disabled={isSyncing || isUploading}
                className="w-full h-12 rounded-xl font-black text-base shadow-lg shadow-primary/20 gap-2"
               >
                {isSyncing ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                {isSyncing ? "Dosya Okunuyor..." : "Şimdi Senkronize Et"}
               </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground font-black tracking-widest leading-none py-1">veya</span></div>
            </div>

            {/* Manuel Yükleme Seçeneği */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20">
               <div className="flex items-center gap-3">
                  <FolderOpen className="text-muted-foreground" size={20} />
                  <span className="text-sm font-bold">Farklı bir dosya yükle</span>
               </div>
               <div className="relative">
                 <input
                  type="file"
                  id="manual-upload"
                  className="hidden"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                 />
                 <Button 
                  variant="ghost" 
                  size="sm"
                  disabled={isSyncing || isUploading}
                  onClick={() => document.getElementById('manual-upload')?.click()}
                  className="font-bold text-primary hover:bg-primary/5"
                 >
                   {isUploading ? <Loader2 className="animate-spin" /> : "Dosya Seç"}
                 </Button>
               </div>
            </div>

            {summary && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl space-y-2 animate-in fade-in zoom-in duration-300">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={18} />
                  <span className="font-bold text-sm">İşlem Tamamlandı</span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="flex flex-col p-2 rounded-xl bg-background/50 border border-border/50">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Toplam Satır</span>
                    <span className="text-xs font-black">{summary.totalRows}</span>
                  </div>
                  <div className="flex flex-col p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-600/70 font-bold">Güncellenen</span>
                    <span className="text-xs font-black text-emerald-600">{summary.updated}</span>
                  </div>
                  <div className="flex flex-col p-2 rounded-xl bg-orange-500/5 border border-orange-500/20">
                    <span className="text-[10px] uppercase tracking-wider text-orange-600/70 font-bold">Bulunamayan</span>
                    <span className="text-xs font-black text-orange-600">{summary.notFound}</span>
                  </div>
                  <div className="flex flex-col p-2 rounded-xl bg-slate-500/5 border border-slate-500/20">
                    <span className="text-[10px] uppercase tracking-wider text-slate-600/70 font-bold">Aynı Kalan</span>
                    <span className="text-xs font-black text-slate-600">{summary.unchanged}</span>
                  </div>
                </div>
                {summary.path && (
                  <p className="text-[10px] text-muted-foreground truncate italic pt-1">
                    Dosya: {summary.path}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bilgilendirme Kartı */}
        <div className="space-y-6">
          <Card className="border-border/50 shadow-xl shadow-border/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-black flex items-center gap-2 text-blue-500">
                <Info size={22} />
                Senkronizasyon Rehberi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                    <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                      Excel dosyasında <span className="font-bold text-foreground underline decoration-blue-500/50 underline-offset-4">"TC NO"</span> ve <span className="font-bold text-foreground underline decoration-blue-500/50 underline-offset-4">"KALAN İZİN"</span> kolon başlıkları bulunmalıdır.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                    <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                      Sistem personelleri TC numaralarına göre eşleştirir. Eğer personelin TC'si kayıtlı değilse izinleri güncellenmez.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0">3</div>
                    <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                      Dosya adının <span className="italic font-bold text-foreground">YILLIK İZİN TAKİP 2026.xlsx</span> olduğundan ve sistemde tanımlı yolda bulunduğundan emin olun.
                    </p>
                  </div>
               </div>
               
               <div className="pt-4 mt-4 border-t border-border/50">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-xs font-black h-12 px-4 rounded-xl group hover:border-primary/50" 
                    onClick={() => window.open("/management", "_blank")}
                  >
                    <Users className="mr-3 text-muted-foreground group-hover:text-primary" size={20} />
                    Personel TC Kayıtlarını Kontrol Et
                  </Button>
               </div>
            </CardContent>
          </Card>
          
          <Alert className="bg-orange-500/5 border-orange-500/20 rounded-2xl">
            <div className="flex gap-3">
               <XCircle className="text-orange-500 shrink-0" size={18} />
               <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400 leading-relaxed uppercase tracking-tight">
                  TİP: Excel dosyasını her güncellediğinizde butona basarak verilerin sisteme yansımasını sağlayabilirsiniz.
               </p>
            </div>
          </Alert>
        </div>
      </div>
    </div>
  );
}

// Minimal Alert Replacement to avoid missing dependency
function Alert({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`p-4 rounded-xl border ${className}`}>
      {children}
    </div>
  );
}
