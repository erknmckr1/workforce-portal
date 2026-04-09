import { useState } from "react";
import { X, UserCircle, Briefcase, Loader2, KeyRound, MonitorSmartphone, Clock, CheckCircle2, ThumbsDown } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useConfirm } from "@/providers/ConfirmProvider";
import { useModuleStore } from "@/store/moduleStore";
import { cn } from "@/lib/utils";
import apiClient from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { type Personnel } from "@/hooks/usePersonnel";
import { useLeaves } from "@/hooks/useLeaves";
import { SharedLeaveForm } from "@/components/leaves/SharedLeaveForm";

// Kiosk ID Giriş Ekranı
function KioskLogin() {
  const [userid, setUserid] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser } = useModuleStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userid.trim()) return;
    
    setLoading(true);
    try {
      const resp = await apiClient.get(`/personnel?search=${userid}`);
      const foundUser = resp.data.data.find((p: Personnel) => p.id_dec === userid);
      
      if (foundUser) {
        setUser(foundUser);
        toast.success(`Hoş geldiniz, ${foundUser.name}`);
      } else {
        toast.error("Bu ID'ye ait personel bulunamadı.");
      }
    } catch {
      toast.error("Sistemsel bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto">
      <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary mb-8 shadow-md">
        <MonitorSmartphone size={48} />
      </div>
      <h2 className="text-3xl font-black text-foreground mb-2 tracking-tight text-center">Kiosk Girişi</h2>
      <p className="text-muted-foreground font-bold text-sm mb-10 uppercase tracking-widest text-center">
        İşlem yapmak için ID Kartınızı okutun veya numaranızı girin.
      </p>

      <form onSubmit={handleLogin} className="w-full space-y-4">
        <div className="relative">
          <KeyRound className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={24} />
          <Input 
            autoFocus
            type="number"
            placeholder="Personel ID..."
            className="w-full h-20 pl-16 rounded-[1.5rem] bg-muted/30 border-2 border-border/50 font-black text-2xl text-center focus-visible:ring-primary/20"
            value={userid}
            onChange={(e) => setUserid(e.target.value)}
          />
        </div>
        <Button 
          disabled={loading || !userid}
          type="submit" 
          className="w-full h-16 rounded-[1.5rem] bg-primary text-primary-foreground font-black text-lg uppercase tracking-widest shadow-md"
        >
          {loading ? <Loader2 className="animate-spin" /> : "Sisteme Gir"}
        </Button>
      </form>
    </div>
  );
}

// Sol Kişisel Profil Kartı
function KioskUserProfile() {
  const { user, setUser } = useModuleStore();

  if (!user) return null;

  return (
    <div className="w-full md:w-80 bg-card border-r border-border/50 flex flex-col items-center py-10 px-6 shrink-0 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-32 bg-primary/5 z-0" />
      
      <div className="w-32 h-32 rounded-full bg-muted border-4 border-background shadow-md flex items-center justify-center text-muted-foreground mb-6 overflow-hidden z-10">
        <UserCircle size={80} strokeWidth={1} />
      </div>

      <h3 className="font-black text-2xl text-center text-foreground leading-tight z-10">
        {user.name} <br/> {user.surname}
      </h3>
      
      <div className="mt-6 w-full space-y-4 z-10">
        <div className="flex flex-col items-center p-3 rounded-2xl bg-muted/30 border border-border/50">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">ID Numarası</span>
          <span className="font-black text-lg text-foreground">{user.id_dec}</span>
        </div>
        
        <div className="flex flex-col items-center p-3 rounded-2xl bg-muted/30 border border-border/50">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Departman</span>
          <span className="font-bold text-sm text-foreground flex items-center gap-2">
            <Briefcase size={14} className="text-primary"/> 
            {user.Section?.name || "Belirtilmedi"}
          </span>
        </div>
        
        <div className="flex flex-col items-center p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-600">
          <span className="text-[10px] font-black uppercase tracking-widest mb-1">Yıllık İzin Bakiyesi</span>
          <span className="font-black text-3xl">{user.leave_balance || 0} <span className="text-sm">Gün</span></span>
        </div>
      </div>

      <div className="flex-1" />

      <Button 
        onClick={() => setUser(null)}
        variant="ghost" 
        className="w-full h-14 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive font-bold uppercase tracking-widest text-sm"
      >
        <X size={18} className="mr-2"/> Çıkış Yap
      </Button>
    </div>
  );
}

// Kiosk Geniş İzin Formu (Performans Optimize)
function KioskLeaveForm() {
  const { user } = useModuleStore();

  if (!user) return null;

  return (
    <SharedLeaveForm
      userId={user.id_dec}
      defaultPhone={user.phone}
      defaultAddress={user.address}
      isKioskMode={true}
    />
  );
}

// "Taleplerim" Ekranı - Kullanıcının Kendi İzinlerini Listelediği Grid
function KioskMyRequests() {
  const { user } = useModuleStore();
  const { leaves, isLoading, cancelLeave } = useLeaves({ user_id: user?.id_dec });
  const { confirm } = useConfirm();

  if (isLoading) {
    return <div className="w-full h-full flex flex-col items-center justify-center p-10"><Loader2 className="animate-spin text-primary" size={48} /></div>;
  }

  if (!leaves || leaves.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-10 border-2 border-dashed border-border/50 rounded-[2rem] bg-muted/10">
        <h2 className="text-2xl font-black text-muted-foreground uppercase tracking-widest mt-4">Kayıtlı Talebiniz Bulunmuyor</h2>
      </div>
    );
  }

  const handleCancel = async (id: number) => {
    if (await confirm({
      title: "Talebi İptal Et",
      description: "Bu izin talebinizi iptal etmek istediğinize emin misiniz?",
      confirmText: "Evet, İptal Et",
      cancelText: "Vazgeç",
      variant: "destructive"
    })) {
      try {
        await cancelLeave({ id, user_id: user!.id_dec });
      } catch {
         // handled in hook
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-10">
      {leaves.map((leave) => {
        const isPending = leave.leave_status_id === 1; // 1: Bekliyor
        let statusColor = "bg-muted text-muted-foreground border-border/50";
        if (leave.leave_status_id === 1) statusColor = "bg-orange-500/10 text-orange-600 border-orange-500/20";
        else if (leave.leave_status_id === 3) statusColor = "bg-green-500/10 text-green-600 border-green-500/20";
        else if (leave.leave_status_id === 4 || leave.leave_status_id === 5) statusColor = "bg-destructive/10 text-destructive border-destructive/20";

        return (
          <div key={leave.id} className="flex flex-col xl:flex-row items-center bg-card border-[1.5px] border-border/50 rounded-[2rem] p-4 lg:pr-6 shadow-sm overflow-hidden gap-6">
            
            {/* Left Box: ID, Type and Reason */}
            <div className="flex flex-col items-start xl:min-w-[280px] w-full xl:w-auto">
               <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted py-1  px-3 rounded-md">#{leave.id}</span>
                  <span className={cn("text-[10px] font-black uppercase tracking-widest py-1 px-3 rounded-md border-[1.5px]", statusColor)}>
                     {leave.LeaveStatus?.label || "Bilinmiyor"}
                  </span>
               </div>
               <h3 className="font-black text-xl text-foreground leading-tight!">
                  {leave.LeaveReason?.label}
               </h3>
               <span className="text-xs text-primary font-black uppercase tracking-widest mt-1">{leave.LeaveDurationType?.label}</span>
            </div>
            
            {/* Middle: Start/End Dates */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 bg-muted/20 px-6 py-4 rounded-[1.5rem] flex-1 w-full xl:w-auto md:justify-around">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center border border-border/50 text-muted-foreground shrink-0"><Clock size={18}/></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Başlangıç</p>
                    <p className="font-bold text-[13px] text-foreground">{format(new Date(leave.start_date), "dd MMM yyyy HH:mm", { locale: tr })}</p>
                  </div>
               </div>
               <div className="hidden md:block w-[2px] h-10 bg-border/50 rounded-full"></div>
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center border border-border/50 text-muted-foreground shrink-0"><Clock size={18}/></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bitiş (Dönüş)</p>
                    <p className="font-bold text-[13px] text-foreground">{format(new Date(leave.end_date), "dd MMM yyyy HH:mm", { locale: tr })}</p>
                  </div>
               </div>
            </div>

            {/* Right: Actions */}
            <div className="shrink-0 flex items-center w-full xl:w-[150px] justify-center xl:justify-end">
                {isPending ? (
                   <Button variant="ghost" onClick={() => handleCancel(leave.id)} className="w-full xl:w-auto text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl h-14 xl:h-12 px-6 font-black transition-all uppercase tracking-widest text-[11px] bg-destructive/5">
                      İptal Et
                   </Button>
                ) : (
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 text-center w-full py-2">İşlem Yapılamaz</span>
                )}
            </div>

          </div>
        );
      })}
    </div>
  );
}

// "Talepleri Onayla" Ekranı - Yetkilinin Onay Bekleyen İzinleri
function KioskApproveRequests() {
  const { user } = useModuleStore();
  const { leaves, isLoading, approveLeave, rejectLeave } = useLeaves({ 
    approver_id: user?.id_dec, 
    status_id: 1 // Sadece bekleyenler
  });
  const { confirm } = useConfirm();

  if (isLoading) {
    return <div className="w-full h-full flex flex-col items-center justify-center p-10"><Loader2 className="animate-spin text-orange-500" size={48} /></div>;
  }

  if (!leaves || leaves.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-10 border-2 border-dashed border-orange-500/20 rounded-[2rem] bg-orange-500/5">
        <h2 className="text-2xl font-black text-orange-600 uppercase tracking-widest mt-4 text-center">Onay Bekleyen <br/> Talep Bulunmuyor</h2>
      </div>
    );
  }

  const handleApprove = async (id: number) => {
    if (await confirm({
      title: "Talebi Onayla",
      description: "Bu izin talebini onaylamak üzeresiniz. Devam edilsin mi?",
      confirmText: "Evet, Onayla",
      variant: "default"
    })) {
      try {
        await approveLeave({ id, approver_id: user!.id_dec });
      } catch { /* handled */ }
    }
  };

  const handleReject = async (id: number) => {
    if (await confirm({
      title: "Talebi Reddet",
      description: "Bu izin talebini reddetmek istediğinize emin misiniz?",
      confirmText: "Evet, Reddet",
      variant: "destructive"
    })) {
      try {
        await rejectLeave({ id, approver_id: user!.id_dec });
      } catch { /* handled */ }
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-10">
      <div className="flex items-center gap-3 mb-2">
         <div className="h-8 w-1 bg-orange-500 rounded-full"></div>
         <h2 className="font-black text-xl uppercase tracking-tighter text-foreground">Sizin Onayınız Bekleniyor</h2>
      </div>

      {leaves.map((leave) => (
        <div key={leave.id} className="flex flex-col xl:flex-row items-center bg-card border-[1.5px] border-orange-500/20 rounded-[2rem] p-4 lg:pr-6 shadow-sm overflow-hidden gap-6 hover:border-orange-500/40 transition-colors">
          
          {/* Personnel Info */}
          <div className="flex flex-col items-start xl:min-w-[250px] w-full xl:w-auto">
             <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-600 font-black text-[10px]">
                   {leave.User?.name?.[0]}{leave.User?.surname?.[0]}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted py-0.5 px-2 rounded">#{leave.id}</span>
             </div>
             <h3 className="font-black text-lg text-foreground leading-tight! uppercase">
                {leave.User?.name} {leave.User?.surname}
             </h3>
             <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                {leave.User?.Section?.name || "Bölüm Belirtilmemiş"}
             </p>
          </div>
          
          {/* Leave Details */}
          <div className="flex flex-col md:flex-row items-center gap-6 bg-orange-500/5 px-6 py-4 rounded-[1.5rem] flex-1 w-full xl:w-auto border border-orange-500/10">
             <div className="flex flex-col items-start min-w-[120px]">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-600/70 mb-1">İzin Nedeni</span>
                <span className="font-bold text-sm text-foreground">{leave.LeaveReason?.label}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">{leave.LeaveDurationType?.label}</span>
             </div>
             
             <div className="hidden md:block w-px h-10 bg-orange-500/10"></div>

             <div className="flex items-center gap-4 flex-1 justify-around">
               <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center border border-orange-500/10 text-orange-500/60 shrink-0"><Clock size={16}/></div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-muted-foreground">Başlangıç</p>
                    <p className="font-bold text-xs text-foreground">{format(new Date(leave.start_date), "dd MMM yyyy HH:mm", { locale: tr })}</p>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center border border-orange-500/10 text-orange-500/60 shrink-0"><Clock size={16}/></div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-muted-foreground">Bitiş</p>
                    <p className="font-bold text-xs text-foreground">{format(new Date(leave.end_date), "dd MMM yyyy HH:mm", { locale: tr })}</p>
                  </div>
               </div>
             </div>
          </div>

          {/* Action Buttons */}
          <div className="shrink-0 flex items-center gap-3 w-full xl:w-auto">
              <Button onClick={() => handleApprove(leave.id)} className="flex-1 xl:w-32 bg-green-600 hover:bg-green-700 text-white rounded-xl h-14 xl:h-12 font-black transition-all uppercase tracking-widest text-[11px] shadow-lg shadow-green-600/20">
                 <CheckCircle2 size={16} className="mr-2"/> Onayla
              </Button>
              <Button onClick={() => handleReject(leave.id)} variant="ghost" className="flex-1 xl:w-32 text-destructive hover:bg-destructive/10 hover:text-destructive border border-destructive/20 rounded-xl h-14 xl:h-12 font-black transition-all uppercase tracking-widest text-[11px]">
                 <ThumbsDown size={16} className="mr-2"/> Reddet
              </Button>
          </div>

        </div>
      ))}
    </div>
  );
}

// Ana Form/İçerik Alanı
function KioskMainDashboard() {
  const { selectedFlow } = useModuleStore();

  return (
    <div className="flex flex-col flex-1 h-full relative bg-muted/10 overflow-hidden">
        <div className="absolute inset-0 p-8 overflow-y-auto custom-scrollbar">
           {selectedFlow === "Talep Oluştur" ? (
             <KioskLeaveForm />
           ) : selectedFlow === "Taleplerim" ? (
             <KioskMyRequests />
           ) : (
             <KioskApproveRequests />
           )}
        </div>
    </div>
  );
}

export function ModuleWrapperPopup() {
  const { isPopupOpen, closePopup, selectedFlow, setSelectedFlow, user } = useModuleStore();

  if (!isPopupOpen) return null;

  const rolesAllowedToApprove = [1, 2, 3,7];
  const canApprove = user?.role_id ? rolesAllowedToApprove.includes(user.role_id) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4 lg:p-8">
      <div className="relative w-[98%] max-w-none h-full max-h-[900px] bg-background rounded-[2rem] shadow-xl flex flex-col overflow-hidden border border-border/50">
        <div className="flex items-center justify-between p-4 px-6 border-b border-border/50 bg-card z-10 shrink-0">
          <div className="flex items-center gap-4">
            {user && (
              <>
                <button
                  onClick={() => setSelectedFlow("Talep Oluştur")}
                  className={cn(
                    "px-6 py-3.5 rounded-2xl font-black uppercase tracking-wider text-xs",
                    selectedFlow === "Talep Oluştur"
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  Talep Oluştur
                </button>
                <button
                  onClick={() => setSelectedFlow("Taleplerim")}
                  className={cn(
                    "px-6 py-3.5 rounded-2xl font-black uppercase tracking-wider text-xs",
                    selectedFlow === "Taleplerim"
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  Taleplerim
                </button>
                {canApprove && (
                  <button
                    onClick={() => setSelectedFlow("Talepleri Onayla")}
                    className={cn(
                      "px-6 py-3.5 rounded-2xl font-black uppercase tracking-wider text-xs",
                      selectedFlow === "Talepleri Onayla"
                        ? "bg-orange-500 text-primary-foreground shadow-md shadow-orange-500/30"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    Talepleri Onayla
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-6">
            {!user && <span className="font-black text-sm uppercase tracking-widest text-muted-foreground">KİOSK TERMİNALİ</span>}
            <button onClick={closePopup} className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive hover:text-primary-foreground border-2 border-destructive/20"><X size={24} /></button>
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
          {user ? (
            <>
              <KioskUserProfile />
              <KioskMainDashboard />
            </>
          ) : (
            <KioskLogin />
          )}
        </div>
      </div>
    </div>
  );
}
