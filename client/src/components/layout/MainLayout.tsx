import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { ModuleWrapperPopup } from "@/components/kiosk/ModuleWrapperPopup";

export default function MainLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      {/* Sol Menü: Sidebar */}
      <Sidebar
        isOpen={isMobileOpen}
        onToggle={() => setIsMobileOpen(!isMobileOpen)}
        collapsed={isCollapsed}
        onCollapse={setIsCollapsed}
      />

      {/* Sağ İçerik Alanı */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Üst Bilgi Barı: Header */}
        <Header onMenuClick={() => setIsMobileOpen(true)} />

        {/* Dinamik Sayfa İçeriği */}
        <main className="flex-1 overflow-y-auto bg-muted/20 custom-scrollbar">
          <div className="p-4 md:p-8  w-full mx-auto ">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Kiosk Modülü (Tüm ekranın üstüne binen global Modal) */}
      <ModuleWrapperPopup />
    </div>
  );
}

