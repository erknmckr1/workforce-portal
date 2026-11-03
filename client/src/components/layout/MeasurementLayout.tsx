import { Outlet } from "react-router-dom";
import { Scale } from "lucide-react";
import TerminalHeader from "./TerminalHeader";

export default function MeasurementLayout() {
  return (
    <div className="flex flex-col h-screen w-screen min-w-full bg-background overflow-hidden relative">
      {/* REUSABLE TERMINAL HEADER: Reusable başlık ve navigasyon */}
      <TerminalHeader
        title="Ölçüm Takip & Tolerans İzleme"
        badgeText="MES Ölçüm Terminali"
        icon={<Scale size={16} />}
        accentColor="indigo"
        backUrl="/mes-screens"
        backLabel="Üretim Ekranları"
        showKioskButton={true}
      />

      {/* SAYFA İÇERİĞİ - TAM EKRAN (W-SCREEN) */}
      <main className="flex-1 overflow-hidden bg-muted/20 p-2 sm:p-3 w-full min-w-full">
        <div className="w-full min-w-full h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
