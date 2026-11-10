import React, { useState, useEffect } from "react";
import { X, ClipboardList, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { useActiveSurveys } from "@/hooks/useSurveys";
import { cn } from "@/lib/utils";

interface SurveysModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform?: "MES" | "KIOSK" | "PORTAL";
}

const SurveysModal: React.FC<SurveysModalProps> = ({ isOpen, onClose, platform = "MES" }) => {
  const { data: surveys = [], isLoading, refetch } = useActiveSurveys(platform);
  const [selectedSurveyIndex, setSelectedSurveyIndex] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);

  // Modal açıldığında güncel anketleri hemen doğrula ve ilk anketi seç
  useEffect(() => {
    if (isOpen) {
      refetch();
      setSelectedSurveyIndex(0);
      setIframeKey((prev) => prev + 1);
    }
  }, [isOpen, refetch]);

  if (!isOpen) return null;

  const currentSurvey = surveys[selectedSurveyIndex] || surveys[0];

  const handleRefreshIframe = () => {
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-[2rem] sm:rounded-[2.5rem] w-full max-w-[98%] sm:max-w-[95%] h-[92vh] sm:h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER - Dokunmatik ve Büyük Butonlu */}
        <div className="bg-secondary/60 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between border-b border-border gap-3 shrink-0">
          
          {/* Sol: Başlık ve Anket Sayısı */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <ClipboardList size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight flex items-center gap-2">
                Şirket Anketleri
                {surveys.length > 0 && (
                  <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                    {surveys.length} Aktif Anket
                  </span>
                )}
              </h2>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Lütfen anket sorularını eksiksiz doldurarak en alttaki "Gönder" butonuna basınız.
              </p>
            </div>
          </div>

          {/* Orta / Sekmeler: Birden Fazla Anket Varsa */}
          {surveys.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar max-w-full sm:max-w-xl py-1 px-1 bg-muted/40 p-1.5 rounded-2xl border border-border/60">
              {surveys.map((survey, index) => {
                const isSelected = selectedSurveyIndex === index;
                return (
                  <button
                    key={survey.id}
                    onClick={() => {
                      setSelectedSurveyIndex(index);
                      setIframeKey((prev) => prev + 1);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap cursor-pointer active:scale-95",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    {isSelected && <CheckCircle2 size={14} className="shrink-0" />}
                    <span>{survey.title}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Sağ: Yenile ve Büyük Kapat Butonu */}
          <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto shrink-0">
            <button
              onClick={handleRefreshIframe}
              className="p-2.5 sm:p-3 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Formu Yenile"
            >
              <RefreshCw size={16} />
              <span className="hidden md:inline">Yenile</span>
            </button>

            <button
              onClick={onClose}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-black uppercase text-xs sm:text-sm tracking-wider shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <X size={18} />
              <span>Kapat / Ekrana Dön</span>
            </button>
          </div>
        </div>

        {/* MODAL BODY (iFrame Container) */}
        <div className="flex-1 w-full h-full bg-white relative overflow-hidden">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-card text-muted-foreground gap-3">
              <Loader2 className="animate-spin text-primary" size={36} />
              <span className="text-sm font-bold">Anket yükleniyor...</span>
            </div>
          ) : !currentSurvey ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-card text-muted-foreground p-6 text-center">
              <ClipboardList size={48} className="opacity-30 mb-3 text-muted-foreground" />
              <h3 className="font-bold text-base text-foreground">Şu Anda Yayında Olan Bir Anket Bulunmuyor</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Bu anket yayından kaldırılmış veya yayın süresi sona ermiş olabilir.
              </p>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
              >
                Ekrana Dön
              </button>
            </div>
          ) : (
            <iframe
              key={`${currentSurvey.id}-${iframeKey}`}
              src={currentSurvey.form_url}
              title={currentSurvey.title}
              className="w-full h-full border-none"
              allow="geolocation; microphone; camera"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SurveysModal;
