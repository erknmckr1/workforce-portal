import { useAuthStore } from "../store/authStore";
import { LayoutDashboard, Calendar, Clock, UserCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export default function Dashboard() {
  const { user } = useAuthStore();

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] lg:h-[calc(100vh-160px)] gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden">
      
      {/* ÜST BÖLÜM: Sabit Kalacak Kısım */}
      <div className="flex flex-col gap-6 shrink-0">
        <PageHeader 
          title="Portal Özeti"
          description={<>Merhaba <span className="text-primary font-bold mx-1">{user?.name}</span>, bugün her şey yolunda görünüyor.</>}
        />

        {/* Hızlı İstatistik Kartları */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Kalan İzin" 
          value="14 Gün" 
          icon={Calendar} 
          trend="+2 Gün (Yıllık)"
          color="bg-blue-500"
        />
        <StatCard 
          title="Mesai Süresi" 
          value="168s" 
          icon={Clock} 
          trend="Bu Ay Toplam"
          color="bg-orange-500"
        />
        <StatCard 
          title="Durum" 
          value="Aktif Çalışıyor" 
          icon={UserCheck} 
          trend="08:30 Giriş"
          color="bg-green-500"
        />
        <StatCard 
          title="Modüller" 
          value="4 Aktif" 
          icon={LayoutDashboard} 
          trend="Erişim Yetkisi"
          color="bg-purple-500"
        />
        </div>
      </div>

      {/* ALT BÖLÜM: İçerik / Grafikler (KAYDIRILABİLİR) */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-[400px] rounded-2xl bg-card border border-border flex items-center justify-center border-dashed">
            <span className="text-muted-foreground font-bold italic opacity-30 text-sm">Aktivite Akışı Grafigi Yakında...</span>
          </div>
          <div className="h-[400px] rounded-2xl bg-card border border-border flex items-center justify-center border-dashed">
            <span className="text-muted-foreground font-bold italic opacity-30 text-sm">Yaklaşan Tatiller Listesi...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend: string;
  color: string;
}

function StatCard({ title, value, icon: Icon, trend, color }: StatCardProps) {
  return (
    <div className="bg-card p-4 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all group">
      <div className="flex justify-between items-start mb-3">
        <div className={cn("p-2.5 rounded-xl text-card shadow-lg", color)}>
          <Icon size={20} />
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground py-1 px-2 bg-muted rounded-md hidden lg:inline-block">
          Giriş Yapıldı
        </span>
      </div>
      <div>
        <h3 className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.15em] mb-1">{title}</h3>
        <p className="text-2xl font-black text-foreground tracking-tighter">{value}</p>
        <p className="text-[10px] font-bold text-muted-foreground/60 mt-1 italic">{trend}</p>
      </div>
    </div>
  );
}

// cn helper can be imported from @/lib/utils if not available globally in the file
import { cn } from "@/lib/utils";
