import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Loader2
} from "lucide-react";
import { useLeaves, type ILeave } from "@/hooks/useLeaves";
import { type Personnel } from "@/hooks/usePersonnel";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Button } from "@/components/ui/button";

interface PersonnelDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnel: Personnel | null;
}

export function PersonnelDetailModal({
  open,
  onOpenChange,
  personnel
}: PersonnelDetailModalProps) {
  const { leaves, isLoading } = useLeaves({ user_id: personnel?.id_dec });

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:min-w-5xl min-w-full p-0 overflow-hidden border border-border bg-card shadow-none">
        <div className="bg-primary/5 p-8 border-b border-primary/10">
          <DialogHeader className="flex flex-row items-center gap-6 space-y-0 text-left">
            <div className="w-20 h-20 rounded-[2rem] bg-primary text-primary-foreground flex items-center justify-center text-3xl font-black shadow-lg shadow-primary/20 uppercase">
              {personnel?.name?.[0]}{personnel?.surname?.[0]}
            </div>
            <div>
              <DialogTitle className="text-3xl font-black tracking-tight">
                {personnel?.name} {personnel?.surname}
              </DialogTitle>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-black bg-primary/20 text-primary px-3 py-1 rounded-full uppercase tracking-tighter">
                  {personnel?.Role?.name}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  ID: {personnel?.id_dec}
                </span>
              </div>
            </div>
          </DialogHeader>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <div className="px-8 bg-muted/20 border-b border-border/50">
            <TabsList className="bg-transparent h-14 gap-8 p-0">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-full font-black uppercase tracking-tighter text-xs"
              >
                <User size={16} className="mr-2" /> Genel Bakış
              </TabsTrigger>
              <TabsTrigger
                value="leaves"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-full font-black uppercase tracking-tighter text-xs"
              >
                <CalendarDays size={16} className="mr-2" /> İzin Geçmişi
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <TabsContent value="overview" className="mt-0 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                      <FileText size={14} /> Organizasyon
                    </h4>
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-muted/40 border border-border/50">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1 tracking-widest">Birim & Departman</span>
                        <p className="font-bold text-foreground">{personnel?.Section?.name} / {personnel?.Department?.name}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-muted/40 border border-border/50">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1 tracking-widest">Görev Unvanı</span>
                        <p className="font-bold text-foreground">{personnel?.JobTitle?.name || "Belirtilmemiş"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                      <Clock size={14} /> Onay Hiyerarşisi
                    </h4>
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-warning/5 border border-warning/10">
                        <span className="text-[10px] font-bold text-warning uppercase block mb-1 tracking-widest">1. Onaycı (Şef)</span>
                        <p className="font-bold text-foreground">
                          {personnel?.Auth1 ? `${personnel.Auth1.name} ${personnel.Auth1.surname}` : "Atanmamış"}
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-info/5 border border-info/10">
                        <span className="text-[10px] font-bold text-info uppercase block mb-1 tracking-widest">2. Onaycı (Müdür)</span>
                        <p className="font-bold text-foreground">
                          {personnel?.Auth2 ? `${personnel.Auth2.name} ${personnel.Auth2.surname}` : "Atanmamış"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="leaves" className="mt-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="animate-spin text-primary mb-4" size={32} />
                  <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Veriler Hazırlanıyor...</span>
                </div>
              ) : leaves.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 p-8 border border-dashed border-border/50 rounded-[2rem] bg-muted/10">
                  <AlertCircle className="text-muted-foreground/30 mb-4" size={48} />
                  <span className="font-bold text-muted-foreground italic text-sm tracking-tight text-center">Bu personele ait henüz bir izin kaydı bulunmamaktadır.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {(leaves as ILeave[]).map((leave) => (
                    <div key={leave.id} className="p-5 rounded-3xl bg-card border border-border/50 hover:bg-muted/30 hover:border-primary/20 transition-all flex items-center justify-between gap-4 group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <CalendarDays size={20} />
                        </div>
                        <div>
                          <p className="font-black text-foreground tracking-tight flex items-center gap-2">
                            {leave.LeaveReason?.label}
                            <span className="text-[10px] font-bold text-muted-foreground/50 border border-border px-1.5 rounded uppercase">
                              {leave.LeaveDurationType?.label}
                            </span>
                          </p>
                          <p className="text-xs font-bold text-muted-foreground mt-0.5 whitespace-nowrap">
                            {format(new Date(leave.start_date), "d MMM yyyy", { locale: tr })} - {format(new Date(leave.end_date), "d MMM yyyy", { locale: tr })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        {getStatusBadge(leave.leave_status_id)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <div className="p-8 bg-muted/10 border-t border-border/50 flex justify-end">
          <Button
            onClick={() => onOpenChange(false)}
            className="h-12 px-10 rounded-xl font-bold bg-foreground text-background hover:opacity-90"
          >
            Tamam
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
