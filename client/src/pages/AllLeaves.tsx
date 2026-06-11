import { useState } from "react";
import {
  CalendarDays,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreVertical,
  ChevronRight,
  Loader2,
  Files,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLeaves, type ILeave } from "@/hooks/useLeaves";
import { CreateLeaveModal } from "@/components/leaves/CreateLeaveModal";
import { LeaveActivityDialog } from "@/components/leaves/LeaveActivityDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useAuthStore } from "@/store/authStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PencilLine, Trash2 } from "lucide-react";
import { useConfirm } from "@/providers/ConfirmProvider";

export default function AllLeaves() {
  const { user } = useAuthStore();
  const { confirm } = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<ILeave | null>(null);
  const [detailLeave, setDetailLeave] = useState<ILeave | null>(null);

  // Tüm izinleri çekmek için filtre göndermiyoruz (Admin/İK yetkisi backend'de tümünü döndürür)
  const { leaves, isLoading, cancelLeave, approveLeave, rejectLeave } =
    useLeaves({});
  const [searchTerm, setSearchTerm] = useState("");
  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const handleEdit = (leave: ILeave) => {
    setEditingLeave(leave);
    setIsModalOpen(true);
  };

  const handleCancel = async (id: number) => {
    if (!user?.id_dec) return;

    const isConfirmed = await confirm({
      title: "İzni İptal Et",
      description:
        "Bu izin talebini iptal etmek istediğinizden emin misiniz? Bu işlem geri alınamaz.",
      confirmText: "İptal Et",
      variant: "destructive",
    });

    if (!isConfirmed) return;

    setProcessingId(id);
    try {
      await cancelLeave({ id, user_id: user.id_dec });
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (id: number) => {
    if (!user?.id_dec) return;

    const isConfirmed = await confirm({
      title: "İzni Onayla",
      description: "Bu izin talebini onaylamak istediğinizden emin misiniz?",
      confirmText: "Onayla",
      variant: "success",
    });

    if (!isConfirmed) return;

    setProcessingId(id);
    try {
      await approveLeave({ id, approver_id: user.id_dec });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: number) => {
    if (!user?.id_dec) return;

    const isConfirmed = await confirm({
      title: "İzni Reddet",
      description: "Bu izin talebini reddetmek istediğinizden emin misiniz?",
      confirmText: "Reddet",
      variant: "destructive",
    });

    if (!isConfirmed) return;

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

  const filteredLeaves = (leaves as ILeave[]).filter((leave) => {
    const matchesSearch =
      leave.User?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leave.User?.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leave.id?.toString().includes(searchTerm);

    let matchesDate = true;
    if (startDate) {
      matchesDate =
        matchesDate && new Date(leave.start_date) >= new Date(startDate);
    }
    if (endDate) {
      const endD = new Date(endDate);
      endD.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(leave.start_date) <= endD;
    }

    return matchesSearch && matchesDate;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] lg:h-[calc(100vh-160px)] gap-6 animate-in fade-in duration-500 overflow-hidden">
      {/* SABİT ÜST BÖLÜM: Başlık, Butonlar, İstatistikler ve Filtre */}
      <div className="flex flex-col gap-6 shrink-0 pb-4 border-b border-border/50">
        <PageHeader
          title="Tüm İzinler"
          description="Şirket Geneli İzin Talepleri ve Kayıtları"
          icon={Files}
          action={
            <Button
              onClick={() => setIsModalOpen(true)}
              className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 text-sm"
            >
              <Plus size={20} /> Yeni İzin Talebi
            </Button>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border/50 p-4 rounded-2xl flex flex-col items-center justify-center gap-1 text-center">
            <span className="text-2xl font-black text-foreground">
              {leaves.length}
            </span>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
              Toplam Talep
            </span>
          </div>
          <div className="bg-orange-500/5 border border-orange-500/10 p-4 rounded-2xl flex flex-col items-center justify-center gap-1 text-center">
            <span className="text-2xl font-black text-orange-500">
              {leaves.filter((l: ILeave) => l.leave_status_id < 3).length}
            </span>
            <span className="text-[9px] font-bold text-orange-500 uppercase tracking-[0.2em]">
              Bekleyenler
            </span>
          </div>
          <div className="bg-green-500/5 border border-green-500/10 p-4 rounded-2xl flex flex-col items-center justify-center gap-1 text-center">
            <span className="text-2xl font-black text-success">
              {leaves.filter((l: ILeave) => l.leave_status_id === 3).length}
            </span>
            <span className="text-[9px] font-bold text-success uppercase tracking-[0.2em]">
              Onaylananlar
            </span>
          </div>
          <div className="bg-destructive/5 border border-destructive/10 p-4 rounded-2xl flex flex-col items-center justify-center gap-1 text-center">
            <span className="text-2xl font-black text-destructive">
              {
                leaves.filter(
                  (l: ILeave) =>
                    l.leave_status_id === 4 || l.leave_status_id === 5,
                ).length
              }
            </span>
            <span className="text-[9px] font-bold text-destructive uppercase tracking-[0.2em]">
              İptal / Red
            </span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-4 bg-muted/20 p-3 rounded-2xl border border-border/50">
          <div className="relative flex-1 w-full">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Personel adı veya Talep ID ile ara..."
              className="pl-11 h-11 rounded-xl bg-card border-none font-bold text-foreground focus-visible:ring-primary/40 transition-all text-sm"
            />
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-40">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11 pl-4 pr-3 rounded-xl bg-card border-none font-bold text-foreground text-sm cursor-pointer"
              />
            </div>
            <span className="text-muted-foreground font-bold">-</span>
            <div className="relative flex-1 lg:w-40">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11 pl-4 pr-3 rounded-xl bg-card border-none font-bold text-foreground text-sm cursor-pointer"
              />
            </div>
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="h-11 px-3 text-destructive hover:bg-destructive/10 rounded-xl"
                title="Tarih filtresini temizle"
              >
                <XCircle size={20} />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KAYDIRILABİLİR İÇERİK BÖLÜMÜ: Liste Alanı */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar space-y-4 pb-10">
        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <Loader2 className="animate-spin text-primary mb-4" size={32} />
              <span className="font-bold text-foreground uppercase tracking-widest text-xs">
                Veriler Getiriliyor...
              </span>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-3xl border-2 border-dashed border-border/50">
              <AlertCircle className="text-muted-foreground mb-4" size={40} />
              <span className="font-bold text-muted-foreground uppercase tracking-widest text-xs">
                Gösterilecek kayıt bulunamadı.
              </span>
            </div>
          ) : (
            filteredLeaves.map((leave: ILeave) => {
              const isPendingLeave =
                leave.leave_status_id === 1 || leave.leave_status_id === 2;
              const isAutoApprovedWithoutChain =
                leave.leave_status_id === 3 &&
                !leave.auth1_user_id &&
                !leave.auth2_user_id;
              const isAdminOrHr = user?.role === "Admin" || user?.role === "İK";
              const canCancelLeave =
                isPendingLeave || isAutoApprovedWithoutChain || isAdminOrHr;

              return (
                <div
                  key={leave.id}
                  className="group p-5 sm:p-6 rounded-2xl border border-border/50 bg-card hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                      <CalendarDays size={20} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-base font-black text-foreground tracking-tight">
                          {leave.User?.name} {leave.User?.surname}
                        </h3>
                        <span className="text-xs font-medium text-muted-foreground">
                          (#{leave.User?.id_dec})
                        </span>
                        {getStatusBadge(leave.leave_status_id)}
                        <span className="px-3 py-1 rounded-full bg-primary/5 text-primary border border-primary/10 font-bold text-[10px] uppercase tracking-widest">
                          {leave.LeaveReason?.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground font-bold italic">
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-primary/60" />
                          <span>
                            {format(
                              new Date(leave.start_date),
                              "d MMM yyyy HH:mm",
                              { locale: tr },
                            )}
                          </span>
                        </div>
                        <ChevronRight
                          size={14}
                          className="text-muted-foreground/30 hidden sm:block"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground/50">
                            İşe Dönüş:
                          </span>
                          <span>
                            {format(
                              new Date(leave.end_date),
                              "d MMM yyyy HH:mm",
                              { locale: tr },
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-6 border-t border-border/50 lg:border-none pt-6 lg:pt-0">
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest mb-2">
                        Onay Durumu
                      </span>
                      <div className="flex items-center justify-end gap-3">
                        <div className="flex flex-col items-center gap-1.5">
                          <div
                            className={cn(
                              "w-2.5 h-2.5 rounded-full transition-all duration-500",
                              leave.leave_status_id === 5 &&
                                leave.auth1_responded_at &&
                                !leave.auth2_responded_at
                                ? "bg-destructive shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                                : leave.auth1_responded_at ||
                                    leave.leave_status_id === 3 ||
                                    leave.leave_status_id === 2
                                  ? "bg-success shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                                  : leave.leave_status_id === 4
                                    ? "bg-muted-foreground/30"
                                    : "bg-muted animate-pulse",
                            )}
                            title="1. Onay Kademesi"
                          />
                          {leave.Approver1 && (
                            <span className="text-[9px] font-black text-muted-foreground/60 whitespace-nowrap tracking-tighter">
                              {leave.Approver1.name}{" "}
                              {leave.Approver1.surname[0]}.
                            </span>
                          )}
                        </div>

                        {leave.Approver2 &&
                          leave.Approver2.name !== leave.Approver1?.name && (
                            <>
                              <div className="w-4 h-px bg-border/50 mb-4" />
                              <div className="flex flex-col items-center gap-1.5">
                                <div
                                  className={cn(
                                    "w-2.5 h-2.5 rounded-full transition-all duration-500",
                                    leave.leave_status_id === 5 &&
                                      leave.auth2_responded_at
                                      ? "bg-destructive shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                                      : leave.leave_status_id === 3
                                        ? "bg-success shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                                        : "bg-muted",
                                  )}
                                  title="2. Onay Kademesi"
                                />
                                <span className="text-[9px] font-black text-muted-foreground/60 whitespace-nowrap tracking-tighter">
                                  {leave.Approver2.name}{" "}
                                  {leave.Approver2.surname[0]}.
                                </span>
                              </div>
                            </>
                          )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-12 h-12 rounded-xl border border-border/50 hover:bg-muted p-0"
                        >
                          {processingId === leave.id ? (
                            <Loader2 className="animate-spin" size={18} />
                          ) : (
                            <MoreVertical size={20} />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 rounded-2xl p-2 border-border/50 shadow-xl"
                      >
                        {isPendingLeave && isAdminOrHr && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleApprove(leave.id!)}
                              className="flex items-center gap-2 p-3 rounded-xl font-bold text-success cursor-pointer hover:bg-success/10"
                            >
                              <CheckCircle2 size={18} />
                              Hızlı Onayla
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleReject(leave.id!)}
                              className="flex items-center gap-2 p-3 rounded-xl font-bold text-destructive cursor-pointer hover:bg-destructive/10"
                            >
                              <XCircle size={18} />
                              Reddet
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEdit(leave)}
                              className="flex items-center gap-2 p-3 rounded-xl font-bold cursor-pointer"
                            >
                              <PencilLine size={18} className="text-primary" />
                              Düzenle
                            </DropdownMenuItem>
                          </>
                        )}
                        {!isPendingLeave && canCancelLeave && (
                          <DropdownMenuItem
                            onClick={() => handleCancel(leave.id!)}
                            className="flex items-center gap-2 p-3 rounded-xl font-bold text-destructive cursor-pointer hover:bg-destructive/10"
                          >
                            <Trash2 size={18} />
                            İptal Et
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setDetailLeave(leave)}
                          className="flex items-center gap-2 p-3 rounded-xl font-bold cursor-pointer"
                        >
                          <AlertCircle size={18} className="text-muted-foreground" />
                          Detaylar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <CreateLeaveModal
        open={isModalOpen}
        onOpenChange={(open: boolean) => {
          setIsModalOpen(open);
          if (!open) setEditingLeave(null);
        }}
        editingLeave={editingLeave}
      />
      <LeaveActivityDialog
        leave={detailLeave}
        open={Boolean(detailLeave)}
        onOpenChange={(open) => {
          if (!open) setDetailLeave(null);
        }}
      />
    </div>
  );
}
