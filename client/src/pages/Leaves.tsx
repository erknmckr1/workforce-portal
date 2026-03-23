import { useState } from "react";
import { 
  CalendarDays, 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  MoreVertical,
  ChevronRight,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLeaves, type ILeave } from "@/hooks/useLeaves";
import { CreateLeaveModal } from "@/components/leaves/CreateLeaveModal";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useAuthStore } from "@/store/authStore";

export default function Leaves() {
  const { user } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { leaves, isLoading } = useLeaves({ user_id: user?.id_dec });
  const [searchTerm, setSearchTerm] = useState("");

  const getStatusBadge = (statusId: number) => {
    switch (statusId) {
      case 1:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20 font-bold text-[10px] uppercase tracking-widest">
            <Clock size={12} /> 1. Onay Bekliyor
          </div>
        );
      case 2:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold text-[10px] uppercase tracking-widest">
            <Clock size={12} /> 2. Onay Bekliyor
          </div>
        );
      case 3:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 font-bold text-[10px] uppercase tracking-widest">
            <CheckCircle2 size={12} /> Onaylandı
          </div>
        );
      case 4:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-bold text-[10px] uppercase tracking-widest">
            <XCircle size={12} /> İptal Edildi
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
            <AlertCircle size={12} /> Belirsiz
          </div>
        );
    }
  };

  const filteredLeaves = (leaves as ILeave[]).filter((leave) => 
    leave.User?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    leave.User?.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    leave.id?.toString().includes(searchTerm)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-foreground flex items-center gap-4 tracking-tighter">
            <CalendarDays className="text-primary" size={40} />
            İzin Yönetimi
          </h1>
          <p className="text-muted-foreground font-bold mt-2 text-sm uppercase tracking-widest flex items-center gap-2">
            Personel İzin Talepleri ve Geçmişi
          </p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          className="h-16 px-10 rounded-2xl bg-primary text-primary-foreground font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3"
        >
          <Plus size={24} /> Yeni İzin Talebi
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Stats Cards */}
        <div className="bg-card border border-border/50 p-6 rounded-[2.5rem] flex flex-col items-center justify-center gap-2 text-center">
            <span className="text-4xl font-black text-foreground">{leaves.length}</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Toplam Talep</span>
        </div>
        <div className="bg-orange-500/5 border border-orange-500/10 p-6 rounded-[2.5rem] flex flex-col items-center justify-center gap-2 text-center">
            <span className="text-4xl font-black text-orange-500">{leaves.filter((l: ILeave) => l.leave_status_id < 3).length}</span>
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.2em]">Bekleyenler</span>
        </div>
         <div className="bg-green-500/5 border border-green-500/10 p-6 rounded-[2.5rem] flex flex-col items-center justify-center gap-2 text-center">
            <span className="text-4xl font-black text-green-500">{leaves.filter((l: ILeave) => l.leave_status_id === 3).length}</span>
            <span className="text-[10px] font-bold text-green-500 uppercase tracking-[0.2em]">Onaylananlar</span>
        </div>
        <div className="bg-primary/5 border border-primary/10 p-6 rounded-[2.5rem] flex flex-col items-center justify-center gap-2 text-center">
            <span className="text-4xl font-black text-primary">14.5</span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Kalan Bakiyem</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/20 p-4 rounded-3xl border border-border/50">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Personel adı veya ID ile ara..." 
              className="pl-12 h-14 rounded-2xl bg-card border-none font-bold text-foreground focus-visible:ring-primary/40 transition-all"
            />
          </div>
          <Button variant="outline" className="h-14 px-8 rounded-2xl font-bold border-border/50 bg-card hover:bg-muted flex items-center gap-2">
            <Filter size={18} /> Filtrele
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <Loader2 className="animate-spin text-primary mb-4" size={40} />
              <span className="font-bold text-foreground uppercase tracking-widest text-sm">Veriler Getiriliyor...</span>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-[3rem] border-2 border-dashed border-border/50">
                <AlertCircle className="text-muted-foreground mb-4" size={48} />
                <span className="font-bold text-muted-foreground uppercase tracking-widest text-sm">Gösterilecek kayıt bulunamadı.</span>
            </div>
          ) : (
            filteredLeaves.map((leave: ILeave) => (
              <div 
                key={leave.id} 
                className="group p-6 sm:p-8 rounded-[3rem] border border-border/50 bg-card hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/20 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                <div className="flex items-start sm:items-center gap-6">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-muted/40 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                    <CalendarDays size={28} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h3 className="text-xl font-black text-foreground tracking-tight">
                        {leave.User?.name} {leave.User?.surname}
                      </h3>
                      {getStatusBadge(leave.leave_status_id)}
                      <span className="px-3 py-1 rounded-full bg-primary/5 text-primary border border-primary/10 font-bold text-[10px] uppercase tracking-widest">
                        {leave.LeaveReason?.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground font-bold italic">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-primary/60" />
                        <span>{format(new Date(leave.start_date), "d MMM yyyy HH:mm", { locale: tr })}</span>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground/30 hidden sm:block" />
                      <div className="flex items-center gap-2">
                         <span className="text-muted-foreground/50">İşe Dönüş:</span>
                        <span>{format(new Date(leave.end_date), "d MMM yyyy HH:mm", { locale: tr })}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-6 border-t border-border/50 lg:border-none pt-6 lg:pt-0">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">Onay Akışı</span>
                    <div className="flex items-center gap-1 mt-1">
                        <div className={cn("w-2 h-2 rounded-full", leave.leave_status_id >= 2 || leave.leave_status_id === 3 ? "bg-green-500" : "bg-muted")} />
                        <div className="w-4 h-[2px] bg-muted" />
                        <div className={cn("w-2 h-2 rounded-full", leave.leave_status_id === 3 ? "bg-green-500" : "bg-muted")} />
                    </div>
                  </div>
                  <Button variant="ghost" className="w-12 h-12 rounded-xl border border-border/50 hover:bg-muted p-0">
                    <MoreVertical size={20} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <CreateLeaveModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
      />
    </div>
  );
}
