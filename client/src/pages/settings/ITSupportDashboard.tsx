import { useState, useEffect, useRef } from "react";
import { 
  LifeBuoy, 
  Search, 
  Loader2, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  X, 
  Calendar, 
  User, 
  Building2, 
  Activity,
  Paperclip
} from "lucide-react";
import apiClient from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RequestMessage {
  id: number;
  request_id: number;
  sender_id: string;
  message: string;
  attachment_url?: string | null;
  created_at: string;
  Sender?: {
    name: string;
    surname: string;
    role_id: number;
  };
}

interface ITRequest {
  id: number;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  Creator?: {
    name: string;
    surname: string;
    email?: string;
    Department?: {
      name: string;
    };
  };
  Assignee?: {
    name: string;
    surname: string;
  };
}

const STATUSES = ["Tümü", "Beklemede", "İşlemde", "Çözüldü", "İptal"];

const getDurationText = (createdStr: string, resolvedStr: string) => {
  const start = new Date(createdStr).getTime();
  const end = new Date(resolvedStr).getTime();
  const diffMs = end - start;
  
  if (diffMs <= 0) return "1 dakikadan az";
  
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 60) {
    return `${diffMins} dakika`;
  }
  
  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  
  if (diffHours < 24) {
    return `${diffHours} saat ${remainingMins} dakika`;
  }
  
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  return `${diffDays} gün ${remainingHours} saat`;
};

export default function ITSupportDashboard() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<ITRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tümü");

  // Drawer / Chat state
  const [selectedRequest, setSelectedRequest] = useState<ITRequest | null>(null);
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setSelectedFile(file);
          const reader = new FileReader();
          reader.onloadend = () => {
            setFilePreview(reader.result as string);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/it-requests");
      setRequests(res.data.requests || []);
    } catch {
      toast.error("Talepler yüklenirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (requestId: number) => {
    try {
      const res = await apiClient.get(`/it-requests/${requestId}/messages`);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error("Mesajlar çekilemedi:", err);
    }
  };

  const startPolling = (requestId: number) => {
    stopPolling();
    pollIntervalRef.current = setInterval(() => {
      fetchMessages(requestId);
    }, 4000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    loadRequests();
    return () => stopPolling();
  }, []);

  useEffect(() => {
    // Arka planda talep listesini her 10 saniyede bir güncelle
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get("/it-requests");
        const reqs = res.data.requests || [];
        setRequests(reqs);

        // Eğer aktif sohbet açıksa ve durumu/sorumlusu değiştiyse arayüzü güncelle
        if (selectedRequest) {
          const updated = reqs.find((r: ITRequest) => r.id === selectedRequest.id);
          if (updated) {
            if (
              updated.status !== selectedRequest.status ||
              updated.Assignee?.name !== selectedRequest.Assignee?.name ||
              updated.Assignee?.surname !== selectedRequest.Assignee?.surname
            ) {
              setSelectedRequest(updated);
            }
          }
        }
      } catch (err) {
        console.error("Arka plan güncelleme hatası:", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedRequest]);

  useEffect(() => {
    if (selectedRequest) {
      scrollToBottom();
    }
  }, [messages, selectedRequest]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSelectRequest = (req: ITRequest) => {
    setSelectedRequest(req);
    setMessages([]);
    setMessagesLoading(true);
    fetchMessages(req.id).finally(() => setMessagesLoading(false));
    startPolling(req.id);
  };

  const handleCloseChat = () => {
    setSelectedRequest(null);
    stopPolling();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !selectedRequest || isSending) return;

    const text = newMessage.trim();
    const fileToSend = selectedFile;
    setNewMessage("");
    clearFile();

    try {
      setIsSending(true);
      const formData = new FormData();
      formData.append("message", text);
      if (fileToSend) {
        formData.append("attachment", fileToSend);
      }

      const res = await apiClient.post(`/it-requests/${selectedRequest.id}/messages`, formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      setMessages(prev => [...prev, res.data.message]);
      
      // Update requests list silently to bubble this request to top
      const listRes = await apiClient.get("/it-requests");
      setRequests(listRes.data.requests || []);
    } catch {
      toast.error("Mesaj gönderilemedi.");
      setNewMessage(text);
      if (fileToSend) {
        setSelectedFile(fileToSend);
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(fileToSend);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedRequest || statusUpdating) return;

    try {
      setStatusUpdating(true);
      await apiClient.put(`/it-requests/${selectedRequest.id}/status`, {
        status: newStatus
      });
      
      toast.success(`Talep durumu '${newStatus}' olarak güncellendi.`);
      
      // Update selected request status locally
      setSelectedRequest(prev => prev ? { ...prev, status: newStatus } : null);
      
      // Refresh messages to show the system message
      await fetchMessages(selectedRequest.id);
      
      // Refresh list
      const listRes = await apiClient.get("/it-requests");
      setRequests(listRes.data.requests || []);
    } catch {
      toast.error("Durum güncellenirken hata oluştu.");
    } finally {
      setStatusUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Beklemede":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500">
            <Clock size={12} /> Beklemede
          </span>
        );
      case "İşlemde":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
            <Loader2 size={12} className="animate-spin" /> İşlemde
          </span>
        );
      case "Çözüldü":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 size={12} /> Çözüldü
          </span>
        );
      case "İptal":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
            <AlertCircle size={12} /> İptal
          </span>
        );
      default:
        return null;
    }
  };

  const filteredRequests = requests.filter(req => {
    const creatorName = `${req.Creator?.name || ""} ${req.Creator?.surname || ""}`.toLowerCase();
    const departmentName = req.Creator?.Department?.name?.toLowerCase() || "";
    const subject = req.subject.toLowerCase();
    const matchSearch = 
      creatorName.includes(searchTerm.toLowerCase()) || 
      departmentName.includes(searchTerm.toLowerCase()) || 
      subject.includes(searchTerm.toLowerCase());
      
    const matchStatus = statusFilter === "Tümü" || req.status === statusFilter;
    
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 relative overflow-hidden">
      {/* LEFT: REQUESTS CONTROL TABLE */}
      <div className="flex-1 flex flex-col bg-card border border-border/50 rounded-[2.5rem] p-6 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="border-b border-border/50 pb-5 mb-5 shrink-0">
          <h3 className="text-2xl font-black text-foreground flex items-center gap-2.5">
            <LifeBuoy className="text-primary animate-pulse" size={28} />
            IT Destek Yönetim Paneli
          </h3>
          <p className="text-muted-foreground font-medium text-xs mt-1">
            Kullanıcılardan gelen tüm bilgi işlem sorunlarını izleyin, cevaplayın ve durumlarını güncelleyin.
          </p>
        </div>

        {/* Filters Panel */}
        <div className="flex flex-col md:flex-row gap-3 mb-5 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Konu, personel veya departman ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-muted/30 border border-border/40 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground transition-all"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none shrink-0">
            {STATUSES.map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "h-10 px-4 rounded-xl text-xs font-bold border transition-all",
                  statusFilter === status
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-muted/10 border-border/50 text-muted-foreground hover:bg-muted/30"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Requests Table/List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-60">
              <Loader2 className="animate-spin text-primary mb-3" size={32} />
              <span className="text-sm font-bold">Talepler yükleniyor...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="font-bold text-sm">Filtrelere uygun IT talebi bulunamadı.</p>
            </div>
          ) : (
            filteredRequests.map(req => (
              <div
                key={req.id}
                onClick={() => handleSelectRequest(req)}
                className={cn(
                  "p-4 bg-muted/10 hover:bg-muted/30 border rounded-2xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer shadow-sm relative overflow-hidden group",
                  selectedRequest?.id === req.id ? "border-primary bg-primary/5" : "border-border/50"
                )}
              >
                {selectedRequest?.id === req.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                )}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      #{req.id}
                    </span>
                    <h4 className="font-black text-sm text-foreground leading-snug group-hover:text-primary transition-colors">
                      {req.subject.split(" ").slice(1).join(" ") || req.subject}
                    </h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-[11px] text-muted-foreground font-bold">
                    <span className="flex items-center gap-1">
                      <User size={12} /> {req.Creator?.name} {req.Creator?.surname}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 size={12} /> {req.Creator?.Department?.name || "Birim Belirtilmemiş"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> {new Date(req.created_at).toLocaleDateString("tr-TR")} {new Date(req.created_at).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {req.Assignee ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <User size={12} /> Sorumlu: {req.Assignee.name} {req.Assignee.surname}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-orange-500 font-black">
                        <User size={12} /> Üstlenilmedi
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {getStatusBadge(req.status)}
                  <button className="h-9 px-4 rounded-lg bg-card border border-border/60 text-[11px] font-black uppercase text-muted-foreground group-hover:text-primary group-hover:border-primary/30 transition-all">
                    Sohbete Bağlan
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: CHAT PANEL & MANAGEMENT */}
      {selectedRequest && (
        <div className="w-112.5bg-card border border-border/50 rounded-[2.5rem] p-6 shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-4 shrink-0">
            <div className="space-y-0.5">
              <h4 className="font-black text-sm text-foreground truncate max-w-70">
                {selectedRequest.subject.split(" ").slice(1).join(" ") || selectedRequest.subject}
              </h4>
              <span className="block text-[10px] text-muted-foreground font-bold">
                Talep Sahibi: {selectedRequest.Creator?.name} {selectedRequest.Creator?.surname}
                {selectedRequest.Assignee && ` | Sorumlu: ${selectedRequest.Assignee.name} ${selectedRequest.Assignee.surname}`}
              </span>
            </div>
            <button 
              onClick={handleCloseChat}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* IT Status Changer Actions */}
          {selectedRequest.status !== "Çözüldü" && selectedRequest.status !== "İptal" ? (
            <div className="bg-muted/30 p-3 rounded-2xl mb-4 shrink-0 space-y-2 border border-border/40">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                <Activity size={12} /> Durum Yönetimi
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleUpdateStatus("İşlemde")}
                  disabled={selectedRequest.status === "İşlemde" || statusUpdating}
                  className={cn(
                    "h-9 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                    selectedRequest.status === "İşlemde"
                      ? "bg-blue-500 text-card"
                      : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400"
                  )}
                >
                  İşlemde
                </button>
                <button
                  onClick={() => handleUpdateStatus("Çözüldü")}
                  disabled={selectedRequest.status === "Çözüldü" || statusUpdating}
                  className={cn(
                    "h-9 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                    selectedRequest.status === "Çözüldü"
                      ? "bg-emerald-500 text-card"
                      : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  Çözüldü
                </button>
                <button
                  onClick={() => handleUpdateStatus("İptal")}
                  disabled={selectedRequest.status === "İptal" || statusUpdating}
                  className={cn(
                    "h-9 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                    selectedRequest.status === "İptal"
                      ? "bg-red-500 text-card"
                      : "bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400"
                  )}
                >
                  İptal Et
                </button>
              </div>
            </div>
          ) : (
            <div className={cn(
              "p-3 rounded-2xl mb-4 shrink-0 border text-center text-xs font-black uppercase tracking-wider space-y-1",
              selectedRequest.status === "Çözüldü"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/15 border-red-500/30 text-red-600 dark:text-red-400"
            )}>
              <div>
                {selectedRequest.status === "Çözüldü"
                  ? "✓ Bu destek talebi çözüldü olarak kapatılmıştır."
                  : "✗ Bu destek talebi iptal edilmiştir."}
              </div>
              {selectedRequest.resolved_at && (
                <div className="text-[10px] opacity-80 normal-case font-semibold mt-1">
                  {selectedRequest.Assignee ? `${selectedRequest.Assignee.name} ${selectedRequest.Assignee.surname} tarafından ` : ""}
                  {getDurationText(selectedRequest.created_at, selectedRequest.resolved_at)} içinde tamamlandı.
                </div>
              )}
            </div>
          )}

          {/* Messages Log */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-2 flex flex-col custom-scrollbar">
            {messagesLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-60">
                <Loader2 className="animate-spin text-primary mb-2" size={24} />
                <span className="text-xs font-bold">Yazışmalar yükleniyor...</span>
              </div>
            ) : (
              messages.map(msg => {
                const isSystem = msg.sender_id === "system";
                const isMe = msg.sender_id === user?.id_dec;

                if (isSystem) {
                  return (
                    <div key={msg.id} className="w-full flex justify-center py-1">
                      <span className="text-[10px] font-bold px-3 py-1 bg-muted text-muted-foreground rounded-full border border-border/40 text-center max-w-[90%] leading-tight italic">
                        {msg.message}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-sm",
                      isMe 
                        ? "self-end bg-primary text-primary-foreground rounded-tr-none" 
                        : "self-start bg-muted/40 border border-border/50 text-foreground rounded-tl-none"
                    )}
                  >
                    {!isMe && msg.Sender && (
                      <span className="block text-[9px] font-black uppercase text-primary/80 mb-1 leading-none">
                        {msg.Sender.name} {msg.Sender.surname}
                      </span>
                    )}
                    <p className="font-semibold whitespace-pre-line leading-relaxed">{msg.message}</p>
                    {msg.attachment_url && (
                       <div className="mt-2 rounded-xl overflow-hidden max-w-50 border border-border/40 bg-black/5 cursor-pointer">
                         <img 
                           src={`${import.meta.env.VITE_API_BASE_URL.replace("/api", "")}/it-attachments/${msg.attachment_url}`}
                           alt="attachment"
                           onClick={() => setPreviewImage(`${import.meta.env.VITE_API_BASE_URL.replace("/api", "")}/it-attachments/${msg.attachment_url}`)}
                           className="w-full h-auto object-cover max-h-37.5 hover:opacity-90 transition-opacity"
                         />
                       </div>
                     )}
                    <span 
                      className={cn(
                        "block text-[8px] text-right mt-1.5 font-bold leading-none",
                        isMe ? "text-primary-foreground/60" : "text-muted-foreground/60"
                      )}
                    >
                      {new Date(msg.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Send Input */}
          <form onSubmit={handleSendMessage} className="pt-4 border-t border-border/50 flex flex-col gap-2 shrink-0">
            {filePreview && (
              <div className="flex items-center gap-2 bg-muted/40 p-2 rounded-xl border border-border/40 relative">
                <img src={filePreview} alt="upload preview" className="w-12 h-12 object-cover rounded-lg border border-border/60" />
                <span className="text-[10px] font-bold text-muted-foreground truncate max-w-50">
                  {selectedFile?.name || "Ekran Görüntüsü"}
                </span>
                <button
                  type="button"
                  onClick={clearFile}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-background rounded-full border hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-11 h-11 rounded-xl border border-border/50 bg-card hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all shrink-0"
                disabled={selectedRequest.status === "Çözüldü" || selectedRequest.status === "İptal"}
              >
                <Paperclip size={16} />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onPaste={handlePaste}
                placeholder="Personelle sohbet edin (Ekran görüntüsü yapıştırabilirsiniz)..."
                className="flex-1 h-11 px-4 rounded-xl bg-muted/30 border border-border/50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/60"
                disabled={selectedRequest.status === "Çözüldü" || selectedRequest.status === "İptal"}
              />
              <button
                type="submit"
                disabled={isSending || (!newMessage.trim() && !selectedFile) || selectedRequest.status === "Çözüldü" || selectedRequest.status === "İptal"}
                className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/95 disabled:opacity-50 transition-all shrink-0 shadow-md shadow-primary/10"
              >
                {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* RESİM ÖNİZLEME MODALI (LIGHTBOX) */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-9999 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
        >
          <button 
            onClick={() => setPreviewImage(null)}
            className="absolute top-6 right-6 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-all border border-white/10"
          >
            <X size={24} />
          </button>
          <img 
            src={previewImage} 
            alt="Preview" 
            onClick={(e) => e.stopPropagation()} 
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 cursor-default"
          />
        </div>
      )}
    </div>
  );
}
