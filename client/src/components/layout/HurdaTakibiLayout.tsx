import { Outlet } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import TerminalHeader from "./TerminalHeader";

export default function HurdaTakibiLayout() {
  return (
    <div className="flex flex-col h-screen w-screen min-w-full bg-background overflow-hidden relative">
      {/* REUSABLE TERMINAL HEADER */}
      <TerminalHeader
        title="Hurda Takibi"
        icon={<AlertTriangle size={16} />}
        accentColor="rose"
        backUrl="/mes-screens"
        backLabel="Üretim Ekranları"
      />

      {/* SAYFA İÇERİĞİ - FULL W-SCREEN */}
      <main className="flex-1 overflow-hidden bg-muted/20 custom-scrollbar p-2.5 sm:p-3 w-full">
        <div className="w-full min-w-full h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
