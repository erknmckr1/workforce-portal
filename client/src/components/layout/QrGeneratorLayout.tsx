import { Outlet } from "react-router-dom";
import { QrCode } from "lucide-react";
import TerminalHeader from "./TerminalHeader";

export default function QrGeneratorLayout() {
  return (
    <div className="flex flex-col h-screen w-screen min-w-full bg-background overflow-hidden relative">
      {/* REUSABLE TERMINAL HEADER */}
      <TerminalHeader
        title="Ücretsiz QR Oluşturucu"
        badgeText="Termal Etiket"
        icon={<QrCode size={16} />}
        accentColor="emerald"
        backUrl="/mes-screens"
        backLabel="Üretim Ekranları"
        showKioskButton={false}
      />

      {/* SAYFA İÇERİĞİ */}
      <main className="flex-1 overflow-y-auto bg-muted/20 custom-scrollbar p-3 sm:p-6 w-full">
        <div className="w-full min-w-full h-full max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
