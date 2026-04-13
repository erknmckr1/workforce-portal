import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/api";
import { AxiosError } from "axios";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  KeyRound,
  Search,
  Loader2,
  Clock,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface ResetRequest {
  id: number;
  user_id: string;
  status: "PENDING" | "COMPLETED" | "REJECTED";
  created_at: string;
  User: {
    name: string;
    surname: string;
    id_dec: string;
  };
}

export default function PasswordResetManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<ResetRequest | null>(null);
  const [tempPassword, setTempPassword] = useState("Midas123!");
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Talepleri getir
  const { data: requests, isLoading } = useQuery<ResetRequest[]>({
    queryKey: ["password-reset-requests"],
    queryFn: async () => {
      const response = await apiClient.get("/auth/reset-requests");
      return response.data;
    }
  });

  // Talebi yönetme mutasyonu
  const handleMutation = useMutation({
    mutationFn: async ({ id, action, password }: { id: number, action: "APPROVE" | "REJECT", password?: string }) => {
      await apiClient.post(`/auth/handle-reset/${id}`, { action, temporary_password: password });
    },
    onSuccess: (_, variables) => {
      toast.success(variables.action === "APPROVE" ? "Şifre başarıyla sıfırlandı." : "Talep reddedildi.");
      queryClient.invalidateQueries({ queryKey: ["password-reset-requests"] });
      setIsResetModalOpen(false);
      setSelectedRequest(null);
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "İşlem sırasında bir hata oluştu.");
    }
  });

  const filteredRequests = requests?.filter(req =>
    `${req.User.name} ${req.User.surname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.User.id_dec.includes(searchTerm)
  );

  const openResetModal = (request: ResetRequest) => {
    setSelectedRequest(request);
    // Varsayılan geçici şifre: Midas + TC son 4 hane (eğer varsa)
    const suffix = request.user_id.slice(-4);
    setTempPassword(`Midas${suffix}!`);
    setIsResetModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Üst Bilgi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card p-6 rounded-[2rem] border border-border/50 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <ShieldAlert size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Bekleyen Talepler</p>
            <p className="text-2xl font-black">{requests?.filter(r => r.status === "PENDING").length || 0}</p>
          </div>
        </div>
        <div className="bg-card p-6 rounded-[2rem] border border-border/50 shadow-sm md:col-span-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <KeyRound size={80} />
          </div>
          <h2 className="text-xl font-black tracking-tight">Şifre Sıfırlama Yönetimi</h2>
          <p className="text-muted-foreground font-medium text-sm">
            Personelin gönderdiği şifre sıfırlama taleplerini buradan onaylayabilir ve geçici şifre atayabilirsiniz.
          </p>
        </div>
      </div>

      {/* Liste Kartı */}
      <div className="bg-card rounded-[2.5rem] border border-border/50 shadow-xl overflow-hidden min-h-[500px] flex flex-col">
        {/* Arama Barı */}
        <div className="p-6 border-b border-border/50 bg-muted/20 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors" size={18} />
            <Input
              placeholder="Personel adı veya ID ile ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 rounded-2xl border-none bg-background shadow-inner focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Badge variant="outline" className="px-4 py-1.5 rounded-full border-primary/20 text-primary font-bold">
            {filteredRequests?.length || 0} Talep Bulundu
          </Badge>
        </div>

        {/* Tablo */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <Table>
            <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-md">
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="font-bold py-5 pl-8 uppercase text-[10px] tracking-widest">Kayıtlı Personel</TableHead>
                <TableHead className="font-bold py-5 uppercase text-[10px] tracking-widest">ID / Sicil No</TableHead>
                <TableHead className="font-bold py-5 uppercase text-[10px] tracking-widest text-center">Talep Tarihi</TableHead>
                <TableHead className="font-bold py-5 uppercase text-[10px] tracking-widest text-right pr-8">Aksiyonlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests && filteredRequests.length > 0 ? (
                filteredRequests.map((req) => (
                  <TableRow key={req.id} className="group hover:bg-muted/20 transition-colors border-border/30">
                    <TableCell className="pl-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black">
                          {req.User.name[0]}{req.User.surname[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                            {req.User.name} {req.User.surname}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-bold">MİDAS PERSONEL</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-muted hover:bg-muted text-foreground/70 font-mono tracking-tighter">
                        {req.user_id}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium text-muted-foreground text-sm">
                      <div className="flex flex-col items-center">
                        <span className="flex items-center gap-1.5"><Clock size={12} /> {format(new Date(req.created_at), "d MMMM yyyy", { locale: tr })}</span>
                        <span className="text-[10px] opacity-60 font-bold">{format(new Date(req.created_at), "HH:mm")}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive font-bold h-10 w-10 p-0"
                          onClick={() => handleMutation.mutate({ id: req.id, action: "REJECT" })}
                          disabled={handleMutation.isPending}
                        >
                          <XCircle size={18} />
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold h-10 px-4 gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                          onClick={() => openResetModal(req)}
                          disabled={handleMutation.isPending}
                        >
                          <CheckCircle2 size={16} /> Şifreyi Sıfırla
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-4 grayscale opacity-20">
                      <ShieldAlert size={60} />
                      <p className="text-xl font-black">Bekleyen talep bulunmuyor</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Şifre Sıfırlama Modalı */}
      <Dialog open={isResetModalOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-8 border-none shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-500/10 flex items-center justify-center text-emerald-600 mx-auto mb-2">
              <KeyRound size={32} />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight text-center">
              Şifreyi Sıfırla
            </DialogTitle>
            <DialogDescription className="text-center font-medium">
              <span className="text-primary font-bold">{selectedRequest?.User.name} {selectedRequest?.User.surname}</span> için yeni bir geçici şifre belirleyin.
            </DialogDescription>
          </DialogHeader>

          <div className="py-8 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Geçici Şifre</label>
              <Input
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                className="h-14 rounded-2xl bg-muted/30 border-none text-lg font-bold tracking-widest text-center focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
              <p className="text-[11px] font-bold text-amber-600 flex items-start gap-2">
                <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                Girdiğiniz şifre personelin eski şifresini geçersiz kılacaktır. Lütfen bu şifreyi personele bildirin.
              </p>
            </div>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-base font-black shadow-xl shadow-emerald-500/20 gap-2 border-none"
              onClick={() => handleMutation.mutate({
                id: selectedRequest!.id,
                action: "APPROVE",
                password: tempPassword
              })}
              disabled={handleMutation.isPending}
            >
              {handleMutation.isPending ? "İşleniyor..." : (
                <>
                  Onayla ve Şifreyi Güncelle <ArrowRight size={20} />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // setIsResetDialogOpen yardımcısı (Dialog içindeki onOpenChange için)
  function setIsResetDialogOpen(open: boolean) {
    if (!open) {
      setIsResetModalOpen(false);
      setSelectedRequest(null);
    }
  }
}
