import { useState, useEffect, useRef } from "react";

import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Send, 
  LifeBuoy, 
  Search, 
  Plus, 
  Calendar,
  X,
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
  };
}

interface ITRequest {
  id: number;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  Assignee?: {
    name: string;
    surname: string;
  };
}

const CATEGORIES = [
  "🖥️ Donanım / Bilgisayar Arızası",
  "🖨️ Yazıcı / Çıktı Alma Sorunu",
  "🌐 İnternet / Ağ Bağlantı Problemi",
  "🔐 Şifre Sıfırlama / Hesap Kilidi",
  "💾 Program / SAP / Lisans Hatası",
  "📧 E-Posta / Outlook Sorunları",
  "❓ Diğer Destek Talepleri"
];

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

export default function ITRequests() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<ITRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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
  
  // Drawer / Chat state
  const [selectedRequest, setSelectedRequest] = useState<ITRequest | null>(null);
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // New Request Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);



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
    // Kullanıcının talep listesini arka planda her 12 saniyede bir güncelle
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get("/it-requests");
        const reqs = res.data.requests || [];
        setRequests(reqs);

        // Eğer aktif detay sohbet ekranı açıksa ve durumu/sorumlusu değiştiyse güncelle
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
        console.error("Kullanıcı arka plan talep güncelleme hatası:", err);
      }
    }, 12000);

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
      loadRequests(); // Refresh main list to update timestamps
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

  const handleCreateRequest = async () => {
    if (!selectedCategory || (!description.trim() && !selectedFile)) {
      toast.error("Lütfen kategori seçin ve açıklama yazın veya resim ekleyin.");
      return;
    }

    try {
      setIsCreating(true);
      const formData = new FormData();
      formData.append("subject", selectedCategory);
      formData.append("message", description.trim());
      if (selectedFile) {
        formData.append("attachment", selectedFile);
      }

      const res = await apiClient.post("/it-requests", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      toast.success("Destek talebi açıldı.");
      setIsCreateOpen(false);
      setSelectedCategory(null);
      setDescription("");
      clearFile();
      loadRequests();
      
      // Open chat automatically
      handleSelectRequest(res.data.data);
    } catch {
      toast.error("Talep oluşturulamadı.");
    } finally {
      setIsCreating(false);
    }
  };

  const filteredRequests = requests.filter(req => 
    req.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Beklemede":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-orange-500/10 text-orange-500">
            <Clock size={14} /> Beklemede
          </span>
        );
      case "İşlemde":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-blue-500/10 text-blue-500">
            <Loader2 size={14} className="animate-spin" /> İşlemde
          </span>
        );
      case "Çözüldü":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 size={14} /> Çözüldü
          </span>
        );
      case "İptal":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-red-500/10 text-red-500">
            <AlertCircle size={14} /> İptal
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] relative overflow-hidden">
      {/* SOL TARAF: TALEPLER LİSTESİ */}
      <div className="flex-1 flex flex-col bg-card border border-border/50 rounded-[2.5rem] p-6 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5 mb-5 shrink-0">
          <div>
            <h3 className="text-2xl font-black text-foreground flex items-center gap-2.5">
              <LifeBuoy className="text-primary" size={28} />
              IT Taleplerim
            </h3>
            <p className="text-muted-foreground font-medium text-xs mt-1">
              Bilgi İşlem birimine ilettiğiniz arıza, şifre ve donanım taleplerini buradan izleyebilirsiniz.
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="h-11 px-5 bg-primary text-primary-foreground rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-primary/95 transition-all shadow-md shadow-primary/10 shrink-0"
          >
            <Plus size={16} /> Yeni Destek Talebi
          </button>
        </div>

        {/* Filters */}
        <div className="relative mb-4 shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            placeholder="Talepler içinde ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-muted/30 border border-border/40 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground transition-all"
          />
        </div>

        {/* Requests List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-60">
              <Loader2 className="animate-spin text-primary mb-3" size={32} />
              <span className="text-sm font-bold">Talepler yükleniyor...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="font-bold text-sm">Henüz kayıtlı bir IT talebiniz bulunmuyor.</p>
              <button 
                onClick={() => setIsCreateOpen(true)} 
                className="mt-3 text-xs font-black text-primary hover:underline"
              >
                İlk talebini şimdi oluştur.
              </button>
            </div>
          ) : (
            filteredRequests.map((req) => (
              <div
                key={req.id}
                onClick={() => handleSelectRequest(req)}
                className={cn(
                  "p-4 bg-muted/10 hover:bg-muted/30 border rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer shadow-sm relative overflow-hidden group",
                  selectedRequest?.id === req.id ? "border-primary bg-primary/5" : "border-border/50"
                )}
              >
                {selectedRequest?.id === req.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                )}
                <div className="space-y-1.5">
                  <h4 className="font-black text-sm text-foreground group-hover:text-primary transition-colors leading-snug">
                    {req.subject.split(" ").slice(1).join(" ") || req.subject}
                  </h4>
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-bold">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> {new Date(req.created_at).toLocaleDateString("tr-TR")} {new Date(req.created_at).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {req.Assignee && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        • Sorumlu: {req.Assignee.name} {req.Assignee.surname}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {getStatusBadge(req.status)}
                  <button className="h-9 px-4 rounded-lg bg-card border border-border/60 text-[11px] font-black uppercase text-muted-foreground group-hover:text-primary group-hover:border-primary/30 transition-all">
                    Sohbeti Aç
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SAĞ TARAF: CHAT PANEL / DRAWER */}
      {selectedRequest && (
        <div className="w-112.5 bg-card border border-border/50 rounded-[2.5rem] p-6 shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-4 shrink-0">
            <div className="space-y-0.5">
              <h4 className="font-black text-sm text-foreground truncate max-w-70">
                {selectedRequest.subject.split(" ").slice(1).join(" ") || selectedRequest.subject}
              </h4>
              <span className="block text-[10px] text-muted-foreground font-bold">
                Talep No: #{selectedRequest.id}
                {selectedRequest.Assignee && ` | Destek Sorumlusu: ${selectedRequest.Assignee.name} ${selectedRequest.Assignee.surname}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(selectedRequest.status)}
              <button 
                onClick={handleCloseChat}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-2 flex flex-col custom-scrollbar">
            {messagesLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-60">
                <Loader2 className="animate-spin text-primary mb-2" size={24} />
                <span className="text-xs font-bold">Mesaj geçmişi yükleniyor...</span>
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

          {/* Terminal Status Alert */}
          {(selectedRequest.status === "Çözüldü" || selectedRequest.status === "İptal") && (
            <div className={cn(
              "p-3 rounded-2xl mb-2 border text-center text-xs font-black uppercase tracking-wider space-y-1 shrink-0",
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

          {/* Form Input */}
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
                placeholder="Mesajınızı yazın (Ekran görüntüsü yapıştırabilirsiniz)..."
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

      {/* YENİ TALEP OLUŞTURMA MODALI */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border/60 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-4">
              <h4 className="text-xl font-black text-foreground">Yeni Destek Talebi Aç</h4>
              <button 
                onClick={() => { setIsCreateOpen(false); setSelectedCategory(null); setDescription(""); }}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-2 space-y-4 pr-1 custom-scrollbar">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Arıza Kategorisi</label>
                <div className="grid grid-cols-1 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-xl border text-xs font-bold transition-all shadow-sm",
                        selectedCategory === cat
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/10 border-border/50 text-foreground hover:bg-muted/40"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {selectedCategory && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Detaylı Açıklama</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="Lütfen arızayı, bilgisayar numarasını veya yaşadığınız problemi buraya detaylıca yazın (Ctrl+V ile ekran görüntüsü yapıştırabilirsiniz)..."
                    rows={3}
                    className="w-full p-3 rounded-xl bg-muted/30 border border-border/50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60 resize-none"
                  />

                  {filePreview ? (
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
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-10 px-4 rounded-xl border border-border/50 bg-card hover:bg-muted flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-all w-full justify-center"
                      >
                        <Paperclip size={14} /> Resim / Ekran Görüntüsü Ekle
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border/50 pt-4 mt-4 flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={() => { setIsCreateOpen(false); setSelectedCategory(null); setDescription(""); clearFile(); }}
                className="h-10 px-4 rounded-xl border border-border/60 text-xs font-bold hover:bg-muted transition-all text-muted-foreground"
              >
                Vazgeç
              </button>
              <button
                onClick={handleCreateRequest}
                disabled={isCreating || !selectedCategory || (!description.trim() && !selectedFile)}
                className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-primary/95 disabled:opacity-50 transition-all shadow-md shadow-primary/10"
              >
                {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Talebi Gönder
              </button>
            </div>
          </div>
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
