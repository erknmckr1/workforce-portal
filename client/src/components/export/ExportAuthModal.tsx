import React, { useState, useRef, useEffect } from "react";
import { ShieldCheck, UserCheck, X, Loader2, Download, AlertCircle } from "lucide-react";
import apiClient from "@/lib/api";

interface ExportAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetTitle: string;
  recordCount: number;
  areaLabel?: string;
  onSuccess: (operatorName: string, operatorId: string) => void;
  getExportMetadata: () => {
    dataset: string;
    datasetTitle: string;
    areaName: string;
    startDate: string;
    endDate: string;
    recordCount: number;
    columns: string[];
  };
}

export const ExportAuthModal: React.FC<ExportAuthModalProps> = ({
  isOpen,
  onClose,
  datasetTitle,
  recordCount,
  areaLabel,
  onSuccess,
  getExportMetadata,
}) => {
  const [operatorId, setOperatorId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setOperatorId("");
      setErrorMessage(null);
      setIsLoading(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = operatorId.trim();

    if (!cleanId) {
      setErrorMessage("Lütfen kartınızı okutun veya Sicil / Kullanıcı ID girin.");
      inputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const metadata = getExportMetadata();
      const response = await apiClient.post("/export/log-download", {
        operatorId: cleanId,
        ...metadata,
      });

      if (response.data?.success) {
        onSuccess(response.data.operatorName || cleanId, response.data.operatorId || cleanId);
        onClose();
      } else {
        setErrorMessage(response.data?.message || "Doğrulama yapılamadı.");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Sunucu ile iletişim kurulurken bir hata oluştu.";
      setErrorMessage(msg);
      inputRef.current?.focus();
      inputRef.current?.select();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-6 pb-4 border-b border-border bg-secondary/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground tracking-tight">
                İndirme Güvenlik Doğrulaması
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Denetim kaydı için kimliğinizi doğrulayın
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* RAPOR ÖZETİ BİLGİ KARTI */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-secondary/40 border border-border rounded-xl space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Veri Seti:</span>
              <span className="font-bold text-foreground">{datasetTitle}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Satır Sayısı:</span>
              <span className="font-mono font-bold text-primary">{recordCount} Kayıt</span>
            </div>
            {areaLabel && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Bölüm Filtresi:</span>
                <span className="font-bold text-foreground">{areaLabel}</span>
              </div>
            )}
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <UserCheck size={14} className="text-primary" />
                Sicil No / Personel Kartı (NFC)
              </label>
              <input
                ref={inputRef}
                type="text"
                autoComplete="off"
                disabled={isLoading}
                value={operatorId}
                onChange={(e) => {
                  setOperatorId(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Kart okutun veya ID girin..."
                className="w-full h-12 px-4 bg-background border border-border rounded-xl text-base font-mono font-bold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-center tracking-wider"
              />
              <p className="text-[11px] text-muted-foreground text-center">
                NFC kartınızı okutabilir veya klavyeden ID yazıp Enter'a basabilirsiniz.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2 text-destructive text-xs animate-in fade-in duration-150">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
            )}

            {/* BUTONLAR */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 h-11 px-4 bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-xl text-xs transition-all disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={isLoading || !operatorId.trim()}
                className="flex-1 h-11 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Doğrulanıyor...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Onayla ve İndir</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ExportAuthModal;
