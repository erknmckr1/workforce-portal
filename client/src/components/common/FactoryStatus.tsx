import React from "react";
import { Fingerprint, RefreshCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api";

interface FactoryStatusProps {
  externalId?: number;
}

const FactoryStatus: React.FC<FactoryStatusProps> = ({ externalId }) => {
  // Veriyi çekme mantığını buraya taşıyoruz
  const { data: factoryData } = useQuery({
    queryKey: ["factoryEntry", externalId],
    queryFn: async () => {
      if (!externalId) return null;
      const res = await apiClient.get(
        `/mes/get-factory-entry?externalId=${externalId}`
      );
      return res.data;
    },
    enabled: !!externalId,
    refetchInterval: 60000, // Dakikada bir yenile
  });

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "--:--";
    const date = new Date(dateStr);
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  if (!externalId) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-secondary/40 border border-border rounded-xl">
      {/* Previous Day Exit */}
      <div className="flex items-center gap-3 pr-4 border-r border-border/50">
        <div className="p-1.5 bg-rose-500/20 rounded-lg">
          <RefreshCcw size={16} className="text-rose-500" />
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] font-black text-rose-500/60 uppercase tracking-widest leading-none">
            Dün Çıkış
          </span>
          <span className="text-sm font-mono font-black text-rose-500 tabular-nums leading-none mt-1">
            {formatTime(factoryData?.exitTime)}
          </span>
        </div>
      </div>

      {/* Today Entry */}
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-emerald-500/20 rounded-lg">
          <Fingerprint size={16} className="text-emerald-500" />
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] font-black text-emerald-500/60 uppercase tracking-widest leading-none">
            Bugün Giriş
          </span>
          <span className="text-sm font-mono font-black text-emerald-500 tabular-nums leading-none mt-1">
            {formatTime(factoryData?.entryTime)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default FactoryStatus;
