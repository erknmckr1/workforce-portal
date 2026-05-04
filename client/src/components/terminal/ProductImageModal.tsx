import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Search,
  Image as ImageIcon,
  FileText,
  Download,
  Maximize2,
  Minimize2,
  ScanBarcode,
} from "lucide-react";
import apiClient from "@/lib/api";
import { toast } from "sonner";

interface ProductImageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProductImageModal: React.FC<ProductImageModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [searchInput, setSearchInput] = useState("");
  const [searchType, setSearchType] = useState<"material" | "order">(
    "material",
  );
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchInput("");
      setFileUrl(null);
      // Modal açıldığında inputa odaklan (Barkod okutma için kritik)
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const fetchImageByMaterial = async (mNo: string) => {
    try {
      const response = await apiClient.get(`/mes/get-product-file/${mNo}`, {
        responseType: "blob",
      });
      const contentType = response.headers["content-type"];
      const blob = new Blob([response.data], { type: contentType });
      const url = URL.createObjectURL(blob);
      setFileUrl(url);
      setFileType(contentType);
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchInput) return;

    setIsLoading(true);
    setFileUrl(null);

    try {
      if (searchType === "order") {
        // 1. Önce siparişten malzeme numarasını bul
        const orderRes = await apiClient.get(`/mes/order/${searchInput}`);
        if (orderRes.data?.MATERIAL_NO) {
          const success = await fetchImageByMaterial(orderRes.data.MATERIAL_NO);
          if (!success) toast.error("Bu siparişe ait görsel bulunamadı.");
        } else {
          toast.error("Sipariş bulundu ancak malzeme numarası eksik.");
        }
      } else {
        // 2. Doğrudan malzeme no ile ara
        const success = await fetchImageByMaterial(searchInput);
        if (!success) toast.error("Görsel bulunamadı.");
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Arama sırasında bir hata oluştu.",
      );
    } finally {
      setIsLoading(false);
      setSearchInput(""); // Barkod okutulduktan sonra temizle ki yeni okutmaya hazır olsun
      inputRef.current?.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 md:p-8">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className={`relative w-full h-full bg-card/60 backdrop-blur-xl border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 ${isFullscreen ? "max-w-none" : "max-w-6xl"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-mds/20 flex items-center justify-center text-mds">
              <ScanBarcode size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-foreground">
                Görsel Arama
              </h2>
              <p className="text-[10px] text-mds font-bold uppercase tracking-[0.2em] opacity-70">
                Barkod Okutun veya Manuel Girin
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSearch}
            className="flex-1 max-w-2xl mx-8 flex gap-3"
          >
            <div className="flex bg-secondary/50 border border-border rounded-2xl p-1">
              <button
                type="button"
                onClick={() => setSearchType("material")}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${searchType === "material" ? "bg-mds text-black shadow-lg" : "text-muted-foreground hover:text-foreground"}`}
              >
                Malzeme No
              </button>
              <button
                type="button"
                onClick={() => setSearchType("order")}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${searchType === "order" ? "bg-mds text-black shadow-lg" : "text-muted-foreground hover:text-foreground"}`}
              >
                Sipariş No
              </button>
            </div>

            <div className="relative flex-1 group">
              <div className="absolute inset-0 bg-mds/5 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center bg-secondary/50 border border-border rounded-2xl px-4 py-2 focus-within:border-mds/50 transition-all">
                <Search size={18} className="text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                  placeholder={
                    searchType === "material"
                      ? "MALZEME BARKODU OKUTUN..."
                      : "SİPARİŞ BARKODU OKUTUN..."
                  }
                  className="bg-transparent border-none focus:ring-0 text-sm font-mono tracking-widest text-foreground placeholder:text-muted-foreground/30 w-full ml-3 uppercase"
                />
              </div>
            </div>
          </form>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="w-12 h-12 rounded-2xl bg-secondary/50 hover:bg-secondary flex items-center justify-center text-foreground transition-all active:scale-90 border border-border"
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button
              onClick={onClose}
              className="w-12 h-12 rounded-2xl bg-destructive/20 hover:bg-destructive/30 flex items-center justify-center text-destructive transition-all active:scale-90 border border-destructive/20"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4 bg-secondary/10">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 animate-pulse">
              <div className="w-16 h-16 border-4 border-mds/20 border-t-mds rounded-full animate-spin" />
              <span className="text-xs font-black uppercase tracking-widest text-mds">
                Sistem Aranıyor...
              </span>
            </div>
          ) : fileUrl ? (
            fileType === "application/pdf" ? (
              <iframe
                src={fileUrl}
                className="w-full h-full rounded-xl border border-border shadow-2xl bg-card"
                title="Product Document"
              />
            ) : (
              <div className="relative w-full h-full flex items-center justify-center group">
                <img
                  src={fileUrl}
                  alt="Product"
                  className="max-w-full max-h-full object-contain rounded-xl shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 bg-card/80 backdrop-blur-md rounded-2xl border border-border opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-4 group-hover:translate-y-0 shadow-2xl">
                  <a
                    href={fileUrl}
                    download="PRODUCT_IMAGE.jpg"
                    className="flex items-center gap-2 text-foreground hover:text-mds transition-colors"
                  >
                    <Download size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      İndir
                    </span>
                  </a>
                  <div className="w-px h-4 bg-border mx-2" />
                  <div className="flex items-center gap-2 text-muted-foreground italic">
                    <FileText size={14} />
                    <span className="text-[9px] font-bold uppercase">
                      {fileType?.split("/")[1]} FORMAT
                    </span>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center gap-6 text-muted-foreground/20">
              <div className="relative">
                <ImageIcon size={120} strokeWidth={1} />
                <ScanBarcode
                  size={40}
                  className="absolute -bottom-2 -right-2 text-mds/20"
                />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black uppercase tracking-widest text-foreground/10">
                  Sistem Beklemede
                </h3>
                <p className="text-xs font-bold uppercase tracking-tighter mt-2 max-w-xs mx-auto text-foreground/40">
                  Lütfen barkodu okutun. Görsel otomatik olarak yüklenecektir.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductImageModal;
