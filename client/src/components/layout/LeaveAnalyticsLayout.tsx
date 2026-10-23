import { Outlet } from "react-router-dom";
import { FileBarChart2 } from "lucide-react";
import TerminalHeader from "./TerminalHeader";

export default function LeaveAnalyticsLayout() {
  return (
    <div className="flex flex-col h-screen w-screen min-w-full bg-background overflow-hidden relative">
      {/* REUSABLE TERMINAL HEADER (No sidebar, full-screen width) */}
      <TerminalHeader
        title="İzin & Devamsızlık Süreç Analitiği"
        badgeText="SÜREÇ & KPI RAPORU"
        icon={<FileBarChart2 size={16} />}
        accentColor="indigo"
        backUrl="/reports"
        backLabel="Raporlar Merkezi"
        showKioskButton={true}
      />

      {/* SAYFA İÇERİĞİ - TAM EKRAN (W-SCREEN) */}
      <main className="flex-1 overflow-y-auto bg-muted/20 custom-scrollbar p-3 sm:p-5 lg:p-6 w-full min-w-full">
        <div className="w-full min-w-full pb-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
