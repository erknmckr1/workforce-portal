import { Outlet } from "react-router-dom";
import { Layers } from "lucide-react";
import TerminalHeader from "./TerminalHeader";

export default function PartiTakibiLayout() {
  return (
    <div className="flex flex-col h-screen w-screen min-w-full bg-background overflow-hidden relative">
      <TerminalHeader
        title="Parti Takibi Kiosk"
        icon={<Layers size={16} />}
        accentColor="indigo"
      />

      {/* SAYFA İÇERİĞİ (Full Width / Split View Ready) */}
      <main className="flex-1 overflow-y-auto bg-muted/20 custom-scrollbar p-2.5 sm:p-4 lg:p-6 w-full">
        <div className="w-full h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
