import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../lib/api";
import TerminalLeftSide from "../components/terminal/TerminalLeftSide";
import TerminalRightSide from "../components/terminal/TerminalRightSide";
import TerminalJobTable from "../components/terminal/TerminalJobTable";
import type { Job } from "../components/terminal/TerminalJobTable";
import TerminalHeader from "../components/terminal/TerminalHeader";
import TerminalLoginModal from "../components/terminal/TerminalLoginModal";
import { useAuthStore } from "../store/authStore";

const UretimTerminal = () => {
  const { section, areaName } = useParams<{
    section: string;
    areaName: string;
  }>();

  const {
    user,
    isAuthenticated,
    login: globalLogin,
    logout: globalLogout,
  } = useAuthStore();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchOrderId, setSearchOrderId] = useState("");

  // Saat güncelleme
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // SAP Sipariş Sorgulama (TanStack Query)
  const { isFetching: isSearching, refetch: fetchOrder } = useQuery({
    queryKey: ["sap-order", searchOrderId],
    queryFn: async () => {
      if (!searchOrderId) return null;
      const res = await apiClient.get(`/mes/order/${searchOrderId}`);
      return res.data;
    },
    enabled: false, // fonksiyonu elle çağırmak için false yapıyoruz. searchOrderId değiştiğinde otomatik çalışmaz.
  });

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchOrderId) {
      fetchOrder();
    }
  };

  const handleLoginSuccess = (userData: any) => {
    // Burada any kullanmak zorundayız çünkü backend'den gelen veri store User tipiyle tam eşleşmeyebilir
    // Ancak login fonksiyonu User bekliyor.
    globalLogin(userData);
  };

  const handleLogout = () => {
    globalLogout();
  };

  // Mock Data
  const mockJobs: Job[] = [
    {
      id: "079103",
      operatorId: "1234567890",
      operatorName: "Ahmet Yılmaz",
      orderId: "3365214",
      oldCode: "K-201",
      processId: "000001",
      section: "montaj",
      process: "Kalite Kontrol",
      quantity: "150",
    },
    {
      id: "079104",
      operatorId: "9876543210",
      operatorName: "Mehmet Demir",
      orderId: "3365215",
      oldCode: "L-302",
      processId: "000002",
      section: "montaj",
      process: "Montaj",
      quantity: "200",
    },
  ];

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col overflow-hidden font-sans select-none">
      {/* Login Modal Overlay */}
      {!isAuthenticated && (
        <TerminalLoginModal onLoginSuccess={handleLoginSuccess} />
      )}

      <TerminalHeader
        areaName={areaName}
        section={section}
        searchOrderId={searchOrderId}
        setSearchOrderId={setSearchOrderId}
        handleSearch={handleSearch}
        isSearching={isSearching}
        currentTime={currentTime}
      />

      {/* MAIN LAYOUT */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />

        <TerminalLeftSide operator={user} onLogout={handleLogout} />

        <main className="flex-1 flex flex-col relative z-10">
          <div className="h-[65%] flex">
            <TerminalJobTable
              jobs={mockJobs}
              selectedJob={selectedJob}
              onSelectJob={setSelectedJob}
            />
            <TerminalRightSide />
          </div>

          {/* BOTTOM SECTION */}
          <div className="h-[35%] flex bg-card border-t border-border">
            <div className="w-[40%] p-4 border-r border-border">
              <div className="w-full h-full bg-secondary/20 border border-border rounded-xl overflow-hidden flex flex-col">
                <div className="bg-secondary/80 p-2 flex text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  <div className="flex-1 px-2">Operator</div>
                  <div className="w-24 text-center">Süre</div>
                  <div className="w-24 text-center">Durum</div>
                </div>
                <div className="flex-1 flex items-center justify-center text-muted-foreground/50 font-bold text-xs uppercase tracking-tighter">
                  Mola Verisi Yok
                </div>
              </div>
            </div>

            <div className="w-[60%] p-4">
              <div className="w-full h-full bg-secondary/20 border border-border rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.3em] mb-2">
                    Seçili İş Detayları
                  </p>
                  <p className="text-muted-foreground/40 font-bold text-sm italic">
                    Henüz bir iş seçilmedi.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default UretimTerminal;
