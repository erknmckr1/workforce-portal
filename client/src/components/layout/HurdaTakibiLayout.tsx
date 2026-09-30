import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, BarChart3, ListFilter } from "lucide-react";
import TerminalHeader from "./TerminalHeader";

export default function HurdaTakibiLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isReportPage = location.pathname.includes("/hurda-raporu");

  return (
    <div className="flex flex-col h-screen w-screen min-w-full bg-background overflow-hidden relative">
      {/* REUSABLE TERMINAL HEADER: DİNAMİK BAŞLIK VE GEÇİŞ BUTONU */}
      <TerminalHeader
        title={isReportPage ? "Hurda & Kalite Raporu" : "Hurda Takibi"}
        badgeText={isReportPage ? "Analitik Rapor" : "Kayıt Terminali"}
        icon={isReportPage ? <BarChart3 size={16} /> : <AlertTriangle size={16} />}
        accentColor="rose"
        backUrl={isReportPage ? undefined : "/mes-screens"}
        backLabel={isReportPage ? undefined : "Üretim Ekranları"}
        showKioskButton={false}
        customAction={
          isReportPage
            ? {
                label: "Hurda Listesi",
                icon: <ListFilter size={14} />,
                onClick: () => navigate("/hurda-takibi"),
              }
            : {
                label: "Hurda Raporu",
                icon: <BarChart3 size={14} />,
                onClick: () => navigate("/hurda-raporu"),
              }
        }
      />

      {/* SAYFA İÇERİĞİ - FULL W-SCREEN */}
      <main
        className={`flex-1 ${
          isReportPage ? "overflow-y-auto" : "overflow-hidden"
        } bg-muted/20 custom-scrollbar p-2.5 sm:p-4 w-full`}
      >
        <div className="w-full min-w-full h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
