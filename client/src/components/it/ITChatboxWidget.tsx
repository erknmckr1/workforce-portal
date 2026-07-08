import { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  X, 
  Send, 
  Plus, 
  ChevronLeft, 
  LifeBuoy, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Paperclip
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import apiClient from "@/lib/api";
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

export default function ITChatboxWidget() {
  const { user, isAuthenticated } = useAuthStore();
  const isITUser = user?.role === "Bilgi İşlem" || 
    user?.department === "Bilgi İşlem" || 
    (user?.department ? (
      user.department.toLowerCase().replace(/ı/g, 'i').replace(/ş/g, 's').replace(/\s+/g, '').includes("bilgiislem") ||
      user.department.toLowerCase().replace(/ı/g, 'i').replace(/ş/g, 's').replace(/\s+/g, '').includes("bilgislem")
    ) : false);
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"list" | "create" | "chat">("list");
  
  // List view state
  const [requests, setRequests] = useState<ITRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Create view state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Chat view state
  const [activeRequest, setActiveRequest] = useState<ITRequest | null>(null);
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

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

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (view === "chat") {
      scrollToBottom();
    }
  }, [messages, view]);

  // Load user requests
  const loadRequests = async () => {
    try {
      setRequestsLoading(true);
      const res = await apiClient.get("/it-requests");
      setRequests(res.data.requests || []);
    } catch (err) {
      console.error("Talepler yüklenemedi:", err);
    } finally {
      setRequestsLoading(false);
    }
  };

  // Fetch messages for active request
  const fetchMessages = async (requestId: number) => {
    try {
      const res = await apiClient.get(`/it-requests/${requestId}/messages`);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error("Mesajlar alınamadı:", err);
    }
  };

  // Start polling messages
  const startPolling = (requestId: number) => {
    stopPolling();
    fetchMessages(requestId);
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
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isOpen) {
      if (view === "list") {
        loadRequests();
        stopPolling();
      }

      // Her 12 saniyede bir arka planda talep listesini güncelle
      interval = setInterval(async () => {
        try {
          const res = await apiClient.get("/it-requests");
          const reqs = res.data.requests || [];
          setRequests(reqs);

          // Eğer detay sohbet ekranı açıksa ve durumu/sorumlusu değiştiyse arayüzü güncelle
          if (activeRequest) {
            const updated = reqs.find((r: ITRequest) => r.id === activeRequest.id);
            if (updated) {
              if (
                updated.status !== activeRequest.status ||
                updated.Assignee?.name !== activeRequest.Assignee?.name
              ) {
                setActiveRequest(updated);
              }
            }
          }
        } catch (err) {
          console.error("Chatbox widget arka plan güncelleme hatası:", err);
        }
      }, 12000);
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
      if (interval) clearInterval(interval);
    };
  }, [isOpen, view, activeRequest]);

  const handleOpenChat = (request: ITRequest) => {
    setActiveRequest(request);
    setView("chat");
    setMessages([]);
    setMessagesLoading(true);
    fetchMessages(request.id).finally(() => setMessagesLoading(false));
    startPolling(request.id);
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
      toast.success("Talep başarıyla oluşturuldu.");
      setDescription("");
      setSelectedCategory(null);
      clearFile();
      
      // Go straight to the newly created chat
      handleOpenChat(res.data.data);
    } catch {
      toast.error("Talep oluşturulurken bir hata oluştu.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !activeRequest || isSending) return;

    const messageText = newMessage.trim();
    const fileToSend = selectedFile;
    setNewMessage("");
    clearFile();

    try {
      setIsSending(true);
      const formData = new FormData();
      formData.append("message", messageText);
      if (fileToSend) {
        formData.append("attachment", fileToSend);
      }

      const res = await apiClient.post(`/it-requests/${activeRequest.id}/messages`, formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      setMessages(prev => [...prev, res.data.message]);
    } catch {
      toast.error("Mesaj gönderilemedi.");
      setNewMessage(messageText); // restore text
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

  if (!isAuthenticated || !user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* 1. SOHBET PENCERESİ */}
      {isOpen && (
        <div className="w-95 h-137.5 bg-card border border-border/60 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden mb-4 animate-in slide-in-from-bottom-5 fade-in duration-300">
          
          {/* Header */}
          <div className="bg-primary p-5 flex items-center justify-between text-primary-foreground shrink-0 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shadow-inner">
                <LifeBuoy size={22} className="text-primary-foreground animate-pulse" />
              </div>
              <div>
                <h4 className="font-black text-sm tracking-tight leading-tight">Midas IT Destek</h4>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl hover:bg-white/10 text-primary-foreground/80 hover:text-primary-foreground transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto bg-muted/10 p-4 flex flex-col custom-scrollbar">
            
            {/* VIEW A: TALEP LİSTESİ */}
            {view === "list" && (
              <div className="flex-1 flex flex-col h-full">
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  <div className="p-3 bg-primary/5 border border-primary/10 rounded-2xl mb-4">
                    <p className="text-xs font-bold text-primary/80 leading-relaxed">
                      Merhaba {user.name}, Bilgi İşlem Destek Hattı üzerinden tüm donanım, ağ ve lisans taleplerini bildirebilirsin.
                    </p>
                  </div>

                  {requestsLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-60">
                      <Loader2 className="animate-spin text-primary mb-2" size={24} />
                      <span className="text-xs font-bold">Talepler yükleniyor...</span>
                    </div>
                  ) : requests.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-xs text-muted-foreground font-bold">Henüz hiç IT destek talebin bulunmuyor.</p>
                    </div>
                  ) : (
                    requests.map(req => (
                      <button
                        key={req.id}
                        onClick={() => handleOpenChat(req)}
                        className="w-full text-left p-3.5 bg-card hover:bg-muted/30 border border-border/50 rounded-2xl transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div className="space-y-1">
                          <h5 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors leading-tight">
                            {req.subject.split(" ").slice(1).join(" ") || req.subject}
                          </h5>
                          <span className="block text-[10px] text-muted-foreground font-bold">
                            {new Date(req.created_at).toLocaleDateString("tr-TR")}
                          </span>
                        </div>
                        <div>{getStatusBadge(req.status)}</div>
                      </button>
                    ))
                  )}
                </div>

                <button
                  onClick={() => setView("create")}
                  className="w-full h-11 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-primary/95 transition-all mt-4 shrink-0 shadow-lg shadow-primary/15"
                >
                  <Plus size={16} /> Yeni Destek Talebi Aç
                </button>
              </div>
            )}

            {/* VIEW B: TALEP OLUŞTURMA */}
            {view === "create" && (
              <div className="flex-1 flex flex-col h-full justify-between">
                <div className="space-y-4 overflow-y-auto pr-1">
                  <button 
                    onClick={() => setView("list")}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline uppercase tracking-wider"
                  >
                    <ChevronLeft size={14} /> Geri Dön
                  </button>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Destek Konusu</label>
                    <div className="grid grid-cols-1 gap-2 max-h-45 overflow-y-auto custom-scrollbar p-1">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={cn(
                            "w-full text-left px-3 py-2.5 rounded-xl border text-xs font-bold transition-all shadow-sm",
                            selectedCategory === cat
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card border-border/50 text-foreground hover:bg-muted/40"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedCategory && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sorununuzu Açıklayın</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onPaste={handlePaste}
                        placeholder="Lütfen arızayı, bilgisayar adını veya detayları yazın..."
                        rows={3}
                        className="w-full p-3 rounded-xl bg-card border border-border/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/60 resize-none"
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

                <button
                  onClick={handleCreateRequest}
                  disabled={isCreating || !selectedCategory || (!description.trim() && !selectedFile)}
                  className="w-full h-11 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-primary/95 transition-all mt-4 disabled:opacity-50 shadow-lg shadow-primary/15 shrink-0"
                >
                  {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Talep Gönder
                </button>
              </div>
            )}

            {/* VIEW C: CHAT YAZIŞMA EKRANI */}
            {view === "chat" && activeRequest && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-border/40 shrink-0">
                  <button 
                    onClick={() => setView("list")}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline uppercase tracking-wider"
                  >
                    <ChevronLeft size={14} /> Talepler
                  </button>
                  {activeRequest.Assignee && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-37.5">
                      Sorumlu: {activeRequest.Assignee.name}
                    </span>
                  )}
                  {getStatusBadge(activeRequest.status)}
                </div>

                <div className="flex-1 overflow-y-auto py-4 space-y-3 flex flex-col custom-scrollbar">
                  {messagesLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-60">
                      <Loader2 className="animate-spin text-primary mb-2" size={24} />
                      <span className="text-xs font-bold">Yazışmalar yükleniyor...</span>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isSystem = msg.sender_id === "system";
                      const isMe = msg.sender_id === user.id_dec;

                      if (isSystem) {
                        return (
                          <div key={msg.id} className="w-full flex justify-center py-1">
                            <span className="text-[10px] font-bold px-3 py-1 bg-muted text-muted-foreground rounded-full border border-border/40 text-center max-w-[80%] leading-tight italic">
                              {msg.message}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div 
                          key={msg.id} 
                          className={cn(
                            "flex flex-col max-w-[80%] rounded-2xl px-3 py-2 text-xs shadow-sm",
                            isMe 
                              ? "self-end bg-primary text-primary-foreground rounded-tr-none" 
                              : "self-start bg-card border border-border/50 text-foreground rounded-tl-none"
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

                  {/* Terminal Status Alert veya Beklemede Uyarısı */}
                  {(!isITUser && activeRequest.status === "Beklemede") ? (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl text-center text-xs font-semibold mb-2">
                      ℹ Talebiniz bilgi işlem birimi tarafından kabul edildikten sonra sohbet başlayacaktır.
                    </div>
                  ) : (activeRequest.status === "Çözüldü" || activeRequest.status === "İptal") && (
                    <div className={cn(
                      "p-3 rounded-2xl mb-2 border text-center text-xs font-black uppercase tracking-wider space-y-1 shrink-0",
                      activeRequest.status === "Çözüldü"
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/15 border-red-500/30 text-red-600 dark:text-red-400"
                    )}>
                      <div>
                        {activeRequest.status === "Çözüldü"
                          ? "✓ Bu destek talebi çözüldü olarak kapatılmıştır."
                          : "✗ Bu destek talebi iptal edilmiştir."}
                      </div>
                      {activeRequest.resolved_at && (
                        <div className="text-[10px] opacity-80 normal-case font-semibold mt-1">
                          {activeRequest.Assignee ? `${activeRequest.Assignee.name} ${activeRequest.Assignee.surname} tarafından ` : ""}
                          {getDurationText(activeRequest.created_at, activeRequest.resolved_at)} içinde tamamlandı.
                        </div>
                      )}
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="pt-2 border-t border-border/40 flex flex-col gap-2 shrink-0">
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
                      className="w-10 h-10 rounded-xl border border-border/50 bg-card hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all shrink-0"
                      disabled={activeRequest.status === "Çözüldü" || activeRequest.status === "İptal" || (!isITUser && activeRequest.status === "Beklemede")}
                    >
                      <Paperclip size={16} />
                    </button>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onPaste={handlePaste}
                      placeholder={(!isITUser && activeRequest.status === "Beklemede") ? "Talep kabul edildikten sonra yazabilirsiniz..." : "IT birimine mesaj gönderin (Ekran görüntüsü yapıştırabilirsiniz)..."}
                      className="flex-1 h-10 px-4 rounded-xl bg-card border border-border/50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/60"
                      disabled={activeRequest.status === "Çözüldü" || activeRequest.status === "İptal" || (!isITUser && activeRequest.status === "Beklemede")}
                    />
                    <button
                      type="submit"
                      disabled={isSending || (!newMessage.trim() && !selectedFile) || activeRequest.status === "Çözüldü" || activeRequest.status === "İptal" || (!isITUser && activeRequest.status === "Beklemede")}
                      className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/95 disabled:opacity-50 transition-all shrink-0 shadow-md shadow-primary/15"
                    >
                      {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. TETİKLEYİCİ BALON BUTONU */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-primary hover:bg-primary/95 text-primary-foreground rounded-2xl flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer relative group border-2 border-primary-foreground/10"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        <span className="absolute right-full mr-3 bg-card border border-border/60 text-foreground font-black text-xs px-3 py-1.5 rounded-xl shadow-lg opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none uppercase tracking-wide whitespace-nowrap">
          Bilgi İşlem Desteği
        </span>
      </button>

      {/* 3. RESİM ÖNİZLEME MODALI (LIGHTBOX) */}
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
