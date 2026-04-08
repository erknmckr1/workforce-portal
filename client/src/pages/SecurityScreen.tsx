import { useState, useMemo } from "react";
import { 
  ShieldCheck, 
  Search, 
  LogOut, 
  Building2,
  CalendarDays,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { useLeaves, type ILeave } from "@/hooks/useLeaves";
import { useAuthStore } from "@/store/authStore";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";

export default function SecurityScreen() {
  const { user } = useAuthStore();
  const { leaves, isLoading, confirmExit, isConfirmingExit } = useLeaves({ is_security: true });
  const [searchTerm, setSearchTerm] = useState("");

  const approvedLeaves = useMemo(() => {
    return (leaves as ILeave[]).filter(l => 
      l.leave_status_id === 3 && 
      format(new Date(l.start_date), "HH:mm") !== "07:30"
    );
  }, [leaves]);

  const filteredLeaves = useMemo(() => {
    return approvedLeaves.filter(p => 
      `${p.User?.name} ${p.User?.surname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.User?.id_dec.includes(searchTerm)
    );
  }, [approvedLeaves, searchTerm]);

  const pendingLeaves = useMemo(() => {
    return filteredLeaves.filter(l => !l.exit_confirmed_at);
  }, [filteredLeaves]);

  const handleConfirmExit = async (id: number) => {
    if (!user?.id_dec) return;
    await confirmExit({ id, confirmed_by: user.id_dec });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] lg:h-[calc(100vh-160px)] gap-6 animate-in fade-in duration-500 overflow-hidden">
      
      {/* ÜST BÖLÜM: Sabit Kalacak Kısım (Başlık ve İstatistikler) */}
      <div className="flex flex-col gap-6 shrink-0 pb-4 border-b border-border/50">
        <PageHeader 
          title="Güvenlik Paneli"
          description={format(new Date(), "d MMMM yyyy, EEEE", { locale: tr })}
          icon={ShieldCheck}
          action={
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Personel adı veya ID..."
                className="h-11 pl-11 rounded-xl bg-muted/40 border-none font-bold text-sm placeholder:text-muted-foreground/60 outline-none focus-visible:ring-primary/20 transition-all text-foreground"
              />
            </div>
          }
        />

      {/* QUICK STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-4">
             <div className="w-10 h-10 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center font-black text-lg">
                {pendingLeaves.length}
             </div>
             <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Bekleyen Çıkışlar</span>
          </div>
          <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-4">
             <div className="w-10 h-10 rounded-lg bg-success/10 text-success flex items-center justify-center font-black text-lg">
                {approvedLeaves.filter(l => l.exit_confirmed_at).length}
             </div>
             <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Çıkış Yapanlar (İzinde)</span>
          </div>
      </div>
      </div>

      {/* ALT BÖLÜM: Sadece Bu Alan Kaydırılabilir (Liste) */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar space-y-4 pb-10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-primary mb-2" size={32} />
            <span className="font-bold text-xs text-muted-foreground uppercase tracking-widest">Yükleniyor...</span>
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-3xl border-2 border-dashed">
             <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Kayıt Bulunamadı</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredLeaves.map((leave) => (
              <div 
                key={leave.id} 
                className={cn(
                  "p-5 bg-card rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4",
                  leave.exit_confirmed_at ? "border-success/40 bg-success/5" : "border-border shadow-sm"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center font-bold uppercase shrink-0 transition-colors",
                    leave.exit_confirmed_at ? "bg-info/10 text-info" : "bg-primary/10 text-primary"
                  )}>
                    {leave.User?.name[0]}{leave.User?.surname[0]}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-foreground">
                        {leave.User?.name} {leave.User?.surname}
                      </h3>
                      <span className="text-[9px] font-bold text-muted-foreground/60 border px-1.5 rounded uppercase">
                        {leave.User?.id_dec}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                       <span className="flex items-center gap-1"><Building2 size={12} /> {leave.User?.Section?.name}</span>
                       <span className="flex items-center gap-1"><CalendarDays size={12} /> {leave.LeaveReason?.label}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 justify-end">
                   <div className="flex flex-col text-center sm:text-right">
                      <span className="text-[10px] font-black text-foreground uppercase tracking-tight">
                         {format(new Date(leave.start_date), "HH:mm")} - {format(new Date(leave.end_date), "HH:mm")}
                      </span>
                      <span className="text-[9px] font-bold text-muted-foreground italic">{format(new Date(leave.start_date), "d MMM yyyy", { locale: tr })}</span>
                   </div>

                   {!leave.exit_confirmed_at ? (
                      <Button 
                        onClick={() => handleConfirmExit(leave.id!)}
                        disabled={isConfirmingExit}
                        className="h-10 px-6 rounded-xl bg-destructive hover:bg-destructive/90 text-[11px] font-black uppercase tracking-widest transition-active active:scale-95 min-w-[140px]"
                      >
                         {isConfirmingExit ? <Loader2 className="animate-spin" /> : <LogOut size={16} className="mr-2" />}
                         Çıkış Onayla
                      </Button>
                   ) : (
                      <div className="h-10 px-6 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center gap-2 text-success font-black text-[11px] min-w-[140px] uppercase">
                         <CheckCircle2 size={16} />
                         Çıkış Yapıldı
                      </div>
                   )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
