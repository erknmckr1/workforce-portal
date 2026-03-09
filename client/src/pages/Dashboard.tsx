import { useAuthStore } from "../store/authStore";
import { LayoutDashboard, Calendar, Clock, UserCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Hoş Geldin Başlığı */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-foreground">
          Portal Özeti
        </h1>
        <p className="text-muted-foreground font-medium">
          Merhaba <span className="text-primary font-bold">{user?.name}</span>, bugün her şey yolunda görünüyor.
        </p>
      </div>

      {/* Hızlı İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* İçerik Hazırlığı (Placeholder) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[400px] rounded-3xl bg-card border border-border flex items-center justify-center border-dashed">
          <span className="text-muted-foreground font-bold italic opacity-30">Aktivite Akışı Grafigi Yakında...</span>
        </div>
        <div className="h-[400px] rounded-3xl bg-card border border-border flex items-center justify-center border-dashed">
          <span className="text-muted-foreground font-bold italic opacity-30">Yaklaşan Tatiller Listesi...</span>
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
    <div className="bg-card p-6 rounded-[2rem] border border-border shadow-sm hover:shadow-md transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-3 rounded-2xl text-card shadow-lg", color)}>
          <Icon size={24} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-1 px-2 bg-muted rounded-full">
          Giriş Yapıldı
        </span>
      </div>
      <div>
        <h3 className="text-muted-foreground text-xs font-black uppercase tracking-[0.15em] mb-1">{title}</h3>
        <p className="text-3xl font-black text-foreground tracking-tighter">{value}</p>
        <p className="text-xs font-bold text-muted-foreground/60 mt-2 italic">{trend}</p>
      </div>
    </div>
  );
}

// cn helper can be imported from @/lib/utils if not available globally in the file
import { cn } from "@/lib/utils";
