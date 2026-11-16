import { Outlet } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import TerminalHeader from "./TerminalHeader";

export default function KaliteRaporuLayout() {
  return (
    <div className="flex flex-col h-screen w-screen min-w-full bg-background overflow-hidden relative">
      {/* REUSABLE TERMINAL HEADER (Tam ekran, sidebar yok) */}
      <TerminalHeader
        title="Kalite Kontrol & Tamir Analizi"
        badgeText="MES CANLI RAPOR"
        icon={<ShieldCheck size={16} />}
        accentColor="amber"
        backUrl="/reports"
        backLabel="Raporlar Merkezi"
        showKioskButton={false}
      />

      {/* SAYFA İÇERİĞİ - TAM EKRAN (W-SCREEN) */}
      <main className="flex-1 overflow-y-auto bg-muted/20 custom-scrollbar p-3 sm:p-5 lg:p-6 w-full min-w-full">
        <div className="w-full min-w-full max-w-480 mx-auto pb-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
