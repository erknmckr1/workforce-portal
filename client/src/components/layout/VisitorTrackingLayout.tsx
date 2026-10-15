import { Outlet } from "react-router-dom";
import { UserCheck } from "lucide-react";
import TerminalHeader from "./TerminalHeader";

export default function VisitorTrackingLayout() {
  return (
    <div className="flex flex-col h-screen w-screen min-w-full bg-background overflow-hidden relative">
      {/* REUSABLE TERMINAL HEADER */}
      <TerminalHeader
        title="Ziyaretçi Takip Sistemi"
        icon={<UserCheck size={16} />}
        accentColor="indigo"
        backUrl="/security"
        backLabel="Güvenlik Paneli"
        showKioskButton={true}
      />

      {/* SAYFA İÇERİĞİ - TAM EKRAN (W-SCREEN) */}
      <main className="flex-1 overflow-hidden bg-muted/20 custom-scrollbar p-2.5 sm:p-4 w-full min-w-full">
        <div className="w-full min-w-full h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
