import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Trash2,
  Eye,
  Download,
  Plus,
  Search,
  Loader2,
  Upload,
  Calendar,
  Layers,
  User,
  AlertCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/providers/ConfirmProvider";

interface DocumentItem {
  id: number;
  title: string;
  description?: string;
  fileName: string;
  filePath: string;
  category: string;
  fileSize?: number;
  isActive: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  Creator?: {
    name: string;
    surname: string;
  };
}

const CATEGORIES = ["KVKK", "İSG", "Yönetmelikler", "Kurumsal"];

export default function DocumentManager() {
  const queryClient = useQueryClient();
  const { confirm } = useConfirm();

  // Dialog states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");

  // Fetch Documents
  const { data: documents = [], isLoading } = useQuery<DocumentItem[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await apiClient.get("/documents");
      return res.data;
    },
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await apiClient.post("/documents", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Döküman başarıyla yüklendi.");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setIsUploadOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message || "Döküman yüklenirken bir hata oluştu.";
      toast.error(msg);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/documents/${id}`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Döküman silindi.");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message || "Döküman silinirken bir hata oluştu.";
      toast.error(msg);
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("");
    setFile(null);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
        if (!title) {
          // Otomatik başlık önerisi (dosya uzantısı olmadan)
          const nameWithoutExt = droppedFile.name.substring(
            0,
            droppedFile.name.lastIndexOf("."),
          );
          setTitle(nameWithoutExt);
        }
      } else {
        toast.error("Yalnızca PDF formatındaki dosyalar kabul edilmektedir.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "application/pdf") {
        setFile(selectedFile);
        if (!title) {
          const nameWithoutExt = selectedFile.name.substring(
            0,
            selectedFile.name.lastIndexOf("."),
          );
          setTitle(nameWithoutExt);
        }
      } else {
        toast.error("Yalnızca PDF formatındaki dosyalar kabul edilmektedir.");
      }
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Lütfen yüklenecek bir PDF dosyası seçin.");
      return;
    }
    if (!title.trim() || !category) {
      toast.error("Lütfen Başlık ve Kategori alanlarını doldurun.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("category", category);

    uploadMutation.mutate(formData);
  };

  const handleDelete = async (id: number, name: string) => {
    const isConfirmed = await confirm({
      title: "Dökümanı Sil",
      description: `"${name}" isimli dökümanı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
      confirmText: "Sil",
      cancelText: "İptal",
    });
    if (isConfirmed) {
      await deleteMutation.mutateAsync(id);
    }
  };

  // Format Helper functions
  const formatBytes = (bytes?: number) => {
    if (!bytes) return "0 KB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Base URL for document preview link (removes /api)
  const serverBaseUrl =
    import.meta.env.VITE_API_BASE_URL?.replace("/api", "") ||
    "http://localhost:3003";

  // Filtered documents list
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategoryFilter === "all" ||
        doc.category === selectedCategoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [documents, searchQuery, selectedCategoryFilter]);

  return (
    <div className="space-y-8 p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <FileText size={32} className="text-primary" />
            Döküman Yönetimi
          </h3>
          <p className="text-muted-foreground font-medium mt-1">
            KVKK, İSG ve diğer kurumsal PDF dökümanlarını yükleyin ve yönetin.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsUploadOpen(true);
          }}
          className="h-12 px-6 rounded-2xl font-black text-base shadow-lg shadow-primary/20 gap-2 shrink-0 self-start sm:self-center"
        >
          <Plus size={18} />
          Yeni Döküman Yükle
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-muted/20 border border-border/40 p-4 rounded-3xl">
        <div className="relative flex-1">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
          />
          <Input
            placeholder="Döküman adı veya açıklamasında ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-2xl border-none bg-background shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase text-muted-foreground tracking-widest pl-2 shrink-0">
            Kategori:
          </span>
          <Select
            value={selectedCategoryFilter}
            onValueChange={setSelectedCategoryFilter}
          >
            <SelectTrigger className="h-12 min-w-[160px] rounded-2xl bg-background border-none shadow-sm font-bold">
              <SelectValue placeholder="Tüm Kategoriler" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all" className="font-medium rounded-xl">
                Tüm Kategoriler
              </SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem
                  key={cat}
                  value={cat}
                  className="font-medium rounded-xl"
                >
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content (Table) */}
      <Card className="border-border/50 shadow-xl shadow-border/5 overflow-hidden rounded-[2rem]">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Loader2 className="animate-spin text-primary" size={40} />
              <p className="font-bold text-sm">Dökümanlar yükleniyor...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3 bg-muted/5">
              <AlertCircle size={44} className="text-muted-foreground/60" />
              <div className="text-center">
                <p className="font-black text-lg text-foreground tracking-tight">
                  Kayıtlı Belge Bulunamadı
                </p>
                <p className="text-xs font-medium mt-1">
                  Arama kriterlerine uyan veya yüklenmiş herhangi bir belge yok.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-b border-border/50 hover:bg-transparent">
                  <TableHead className="font-black text-[11px] uppercase tracking-wider text-muted-foreground py-4 pl-6">
                    Belge Adı
                  </TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-wider text-muted-foreground py-4">
                    Kategori
                  </TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-wider text-muted-foreground py-4">
                    Boyut
                  </TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-wider text-muted-foreground py-4">
                    Eklenme Tarihi
                  </TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-wider text-muted-foreground py-4">
                    Yükleyen
                  </TableHead>
                  <TableHead className="font-black text-[11px] uppercase tracking-wider text-muted-foreground py-4 pr-6 text-right">
                    İşlemler
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocs.map((doc) => (
                  <TableRow
                    key={doc.id}
                    className="group border-b border-border/40 hover:bg-muted/10 transition-colors"
                  >
                    {/* Belge Adı ve Açıklama */}
                    <TableCell className="py-4 pl-6">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/5 dark:text-rose-400 shrink-0">
                          <FileText size={20} />
                        </div>
                        <div className="space-y-0.5 leading-tight">
                          <span className="font-bold text-foreground text-sm block group-hover:text-primary transition-colors">
                            {doc.title}
                          </span>
                          {doc.description && (
                            <span className="text-xs text-muted-foreground font-medium block max-w-md truncate">
                              {doc.description}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground italic block font-mono">
                            {doc.fileName}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Kategori */}
                    <TableCell className="py-4">
                      <span className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-black tracking-wide uppercase bg-primary/10 text-primary border border-primary/20">
                        <Layers size={10} />
                        {doc.category}
                      </span>
                    </TableCell>

                    {/* Dosya Boyutu */}
                    <TableCell className="py-4 font-bold text-xs text-muted-foreground">
                      {formatBytes(doc.fileSize)}
                    </TableCell>

                    {/* Eklenme Tarihi */}
                    <TableCell className="py-4 text-xs font-bold text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} />
                        {formatDate(doc.created_at)}
                      </div>
                    </TableCell>

                    {/* Yükleyen Kişi */}
                    <TableCell className="py-4 text-xs font-bold text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="text-muted-foreground/60" />
                        {doc.Creator
                          ? `${doc.Creator.name} ${doc.Creator.surname}`
                          : "Sistem"}
                      </div>
                    </TableCell>

                    {/* Aksiyon Butonları */}
                    <TableCell className="py-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedDoc(doc);
                            setIsPreviewOpen(true);
                          }}
                          title="Dökümanı Önizle"
                          className="h-9 w-9 rounded-xl text-primary hover:bg-primary/10"
                        >
                          <Eye size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            window.open(
                              `${serverBaseUrl}${doc.filePath}`,
                              "_blank",
                            )
                          }
                          title="Dökümanı İndir"
                          className="h-9 w-9 rounded-xl text-emerald-600 hover:bg-emerald-600/10 dark:text-emerald-400"
                        >
                          <Download size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(doc.id, doc.title)}
                          title="Sil"
                          className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10"
                        >
                          {deleteMutation.isPending &&
                          selectedDoc?.id === doc.id ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 1. Döküman Yükleme Modalı (Dialog) */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-[700px]! rounded-3xl p-6 bg-card border border-border/80 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
              <Upload size={24} className="text-primary" />
              Yeni Döküman Yükle
            </DialogTitle>
            <DialogDescription className="font-semibold text-muted-foreground">
              Sisteme yeni bir kurumsal PDF belgesi yükleyin.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadSubmit} className="space-y-5 pt-2">
            {/* Sürükle ve Bırak Alanı */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] ${
                file
                  ? "border-primary/50 bg-primary/3"
                  : "border-border hover:border-primary/50 hover:bg-muted/15"
              }`}
            >
              <input
                type="file"
                id="file-input"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <div className="space-y-2">
                  <div className="p-3 rounded-full bg-rose-500/10 text-rose-600 dark:bg-rose-500/5 dark:text-rose-400 inline-block">
                    <FileText size={32} />
                  </div>
                  <div className="leading-tight">
                    <p className="font-bold text-sm text-foreground max-w-sm truncate inline-block">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground font-semibold">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="h-8 rounded-lg text-xs font-black text-destructive hover:bg-destructive/10 gap-1 px-3 mt-1"
                  >
                    <X size={12} />
                    Dosyayı Kaldır
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="p-3 rounded-full bg-muted text-muted-foreground inline-block">
                    <Upload size={24} />
                  </div>
                  <div className="space-y-0.5 leading-tight">
                    <p className="font-bold text-sm text-foreground">
                      Dosyayı sürükleyip bırakın veya seçmek için tıklayın
                    </p>
                    <p className="text-xs text-muted-foreground font-semibold">
                      Sadece PDF dosyaları (Maksimum 10MB)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Döküman Başlığı */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Döküman Başlığı
              </label>
              <Input
                placeholder="Örn: KVKK Genel Aydınlatma Metni"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11 rounded-xl bg-muted/30 border-border"
                required
              />
            </div>

            {/* Kategori Seçimi */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Kategori
              </label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-border font-bold">
                  <SelectValue placeholder="Kategori Seçin" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {CATEGORIES.map((cat) => (
                    <SelectItem
                      key={cat}
                      value={cat}
                      className="font-medium rounded-lg"
                    >
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Açıklama */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Açıklama (Opsiyonel)
              </label>
              <Textarea
                placeholder="Bu belge hakkında kısa bir açıklama veya revizyon notu ekleyin..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl bg-muted/30 border-border min-h-[80px] resize-none"
              />
            </div>

            {/* Submit */}
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsUploadOpen(false)}
                className="rounded-xl font-bold hover:bg-muted"
              >
                Vazgeç
              </Button>
              <Button
                type="submit"
                disabled={
                  uploadMutation.isPending ||
                  !file ||
                  !title.trim() ||
                  !category
                }
                className="rounded-xl font-black gap-2"
              >
                {uploadMutation.isPending && (
                  <Loader2 className="animate-spin" size={16} />
                )}
                {uploadMutation.isPending ? "Yükleniyor..." : "Dökümanı Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Döküman Önizleme Modalı (Dialog) */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-[90vw] w-[90vw] sm:max-w-[90vw] h-[90vh] rounded-3xl p-6 bg-card border border-border/80 shadow-2xl flex flex-col">
          <DialogHeader className="flex-row items-center justify-between pb-2 border-b border-border/50 shrink-0">
            <div className="space-y-0.5 leading-tight">
              <DialogTitle className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                <FileText className="text-rose-500" size={22} />
                {selectedDoc?.title}
              </DialogTitle>
              <DialogDescription className="font-semibold text-muted-foreground text-xs">
                Kategori: {selectedDoc?.category} | Boyut:{" "}
                {formatBytes(selectedDoc?.fileSize)}
              </DialogDescription>
            </div>
            {/* Kapat Butonu DialogContent içinde zaten var ama biz sağa ek butonlar koyabiliriz */}
            <div className="flex items-center gap-2 pr-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedDoc) {
                    window.open(
                      `${serverBaseUrl}${selectedDoc.filePath}`,
                      "_blank",
                    );
                  }
                }}
                className="h-9 px-4 rounded-xl font-bold text-xs gap-1.5"
              >
                <Download size={14} />
                Tam Ekran İndir
              </Button>
            </div>
          </DialogHeader>

          {/* PDF Gösterici IFrame */}
          <div className="flex-1 w-full h-full bg-muted/20 rounded-2xl overflow-hidden mt-4 border border-border/50">
            {selectedDoc ? (
              <iframe
                src={`${serverBaseUrl}${selectedDoc.filePath}#toolbar=1&navpanes=0`}
                title={selectedDoc.title}
                className="w-full h-full border-none"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground font-bold">
                Döküman yüklenemedi.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
