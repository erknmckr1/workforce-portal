import { useState } from "react";
import {
  ClipboardCheck,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  CalendarDays
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLeaves, type ILeave } from "@/hooks/useLeaves";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useAuthStore } from "@/store/authStore";

export default function LeaveApprovals() {
  const { user } = useAuthStore();
  const { leaves, isLoading, approveLeave, rejectLeave } = useLeaves({ approver_id: user?.id_dec });
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  const handleApprove = async (id: number) => {
    if (!user?.id_dec) return;
    setProcessingId(id);
    try {
      await approveLeave({ id, approver_id: user.id_dec });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: number) => {
    if (!user?.id_dec) return;
    setProcessingId(id);
    try {
      await rejectLeave({ id, approver_id: user.id_dec });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (statusId: number) => {
    switch (statusId) {
      case 1:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/10 text-warning border border-warning/20 font-bold text-[10px] uppercase tracking-widest">
            <Clock size={12} /> 1. Onay Bekliyor
          </div>
        );
      case 2:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-info/10 text-info border border-info/20 font-bold text-[10px] uppercase tracking-widest">
            <Clock size={12} /> 2. Onay Bekliyor
          </div>
        );
      case 3:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success border border-success/20 font-bold text-[10px] uppercase tracking-widest">
            <CheckCircle2 size={12} /> Onaylandı
          </div>
        );
      case 4:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border font-bold text-[10px] uppercase tracking-widest">
            <XCircle size={12} /> İptal Edildi
          </div>
        );
      case 5:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-bold text-[10px] uppercase tracking-widest">
            <XCircle size={12} /> Reddedildi
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
            <ClipboardCheck className="text-primary" size={40} />
            İzin Onayları
          </h1>
          <p className="text-muted-foreground font-bold mt-2 text-sm uppercase tracking-widest flex items-center gap-2">
            Onayınızı Bekleyen Personel Talepleri
          </p>
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
              <span className="font-bold text-foreground uppercase tracking-widest text-sm">Talepler Getiriliyor...</span>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-[3rem] border-2 border-dashed border-border/50">
              <CheckCircle2 className="text-success/50 mb-4" size={48} />
              <span className="font-bold text-muted-foreground uppercase tracking-widest text-sm">Süper! Onay bekleyen hiçbir talep yok.</span>
            </div>
          ) : (
            filteredLeaves.map((leave: ILeave) => (
              <div
                key={leave.id}
                className="group p-6 sm:p-8 rounded-[3rem] border border-border/50 bg-card hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/20 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                <div className="flex items-start sm:items-center gap-6">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-warning/10 flex items-center justify-center text-warning shrink-0">
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
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground font-medium">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground/70">Başlangıç:</span>
                        <span>{format(new Date(leave.start_date), "d MMM yyyy HH:mm", { locale: tr })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground/70">İşe Dönüş:</span>
                        <span>{format(new Date(leave.end_date), "d MMM yyyy HH:mm", { locale: tr })}</span>
                      </div>
                      {leave.description && (
                        <div className="mt-2 p-3 bg-muted/30 rounded-xl text-xs italic border border-border/50">
                          "{leave.description}"
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col lg:items-end gap-6 mt-4 lg:mt-0 pt-6 lg:pt-0 border-t border-border/50 lg:border-none">
                  <div className="flex flex-col lg:text-right">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Mevcut Durum</span>
                    <div className="flex items-center gap-1">
                        {/* 1. Onay Noktası */}
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full transition-colors",
                          // DURUM 5 (RED) iken: Eğer auth1 tarihi varsa ve auth2 tarihi yoksa, auth1 reddetmiştir.
                          (leave.leave_status_id === 5 && leave.auth1_responded_at && !leave.auth2_responded_at) ? "bg-destructive shadow-[0_0_8px_rgba(var(--destructive),0.5)]" :
                          // Eğer auth1 onaylamışsa (bu duruma sadece auth1 onay verip 2. aşamaya geçtiyse veya onaylandıysa gelinir)
                          (leave.auth1_responded_at || leave.leave_status_id === 3 || leave.leave_status_id === 2) ? "bg-success" : 
                          // Süreç iptal edildiyse
                          (leave.leave_status_id === 4) ? "bg-destructive" : "bg-muted"
                        )} />
                        
                        <div className="w-4 h-[2px] bg-muted/50" />
                        
                        {/* 2. Onay Noktası */}
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full transition-colors",
                          // DURUM 5 (RED) iken: Eğer hem auth1 hem auth2 tarihi varsa, 2. kişi reddetmiştir.
                          (leave.leave_status_id === 5 && leave.auth1_responded_at && leave.auth2_responded_at) ? "bg-destructive shadow-[0_0_8px_rgba(var(--destructive),0.5)]" :
                          // Sadece tam onaylandı durumunda yeşil.
                          (leave.leave_status_id === 3) ? "bg-success shadow-[0_0_8px_rgba(var(--success),0.5)]" : 
                          "bg-muted"
                        )} />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => handleReject(leave.id!)}
                      disabled={processingId === leave.id}
                      className="h-12 px-6 rounded-xl font-bold border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all disabled:opacity-50"
                    >
                      {processingId === leave.id ? <Loader2 className="animate-spin mr-2" size={18} /> : <XCircle size={18} className="mr-2" />} 
                      Reddet
                    </Button>
                    <Button 
                      onClick={() => handleApprove(leave.id!)}
                      disabled={processingId === leave.id}
                      className="h-12 px-8 rounded-xl bg-success hover:bg-success/90 text-success-foreground font-black shadow-lg shadow-success/20 transition-all disabled:opacity-50"
                    >
                      {processingId === leave.id ? <Loader2 className="animate-spin mr-2" size={18} /> : <CheckCircle2 size={18} className="mr-2" />} 
                      Onayla
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
