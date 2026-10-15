import { Outlet } from "react-router-dom";
import { Building2 } from "lucide-react";

export default function VisitorPublicLayout() {
  return (
    <div className="min-h-screen w-full bg-muted/30 flex flex-col items-center justify-start py-8 px-4 sm:px-6">
      {/* Üst Logo ve Kurumsal Başlık */}
      <div className="w-full max-w-xl flex flex-col items-center mb-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3 shadow-sm">
          <Building2 size={28} />
        </div>
        <h1 className="text-xl font-black tracking-tight text-foreground">
          Midas Hediyelik Eşya
        </h1>
        <p className="text-xs font-semibold text-muted-foreground mt-0.5 uppercase tracking-wider">
          Ziyaretçi Kayıt ve Bilgilendirme Sistemi
        </p>
      </div>

      {/* Form & İçerik Alanı */}
      <div className="w-full max-w-xl bg-card border border-border/80 shadow-lg shadow-black/5 rounded-2xl p-5 sm:p-7">
        <Outlet />
      </div>

      <footer className="mt-8 text-center text-[11px] text-muted-foreground font-semibold">
        © {new Date().getFullYear()} Midas Hediyelik Eşya San. ve Tic. A.Ş. • Bilgi İşlem Departmanı
      </footer>
    </div>
  );
}
