import { QrCode, ClipboardCheck } from "lucide-react";

export default function VisitorRegisterPage() {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        <QrCode size={36} />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-black text-foreground tracking-tight">
          Ziyaretçi Kayıt Formu
        </h2>
        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
          Midas ziyaretçi güvenlik ve yönetim sistemleri için hazırlanmış mobil form alanı.
        </p>
      </div>

      <div className="w-full p-4 rounded-xl bg-muted/40 border border-border/60 text-left space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <ClipboardCheck size={16} className="text-primary" />
          <span>Form Hazırlık Aşaması</span>
        </div>
        <p>
          QR kod üzerinden gelen ziyaretçilerin Ad Soyad, Firma, Gelinen İl/İlçe ve Ulaşım Şekli gibi bilgileri gireceği <strong>Ziyaretçi Kayıt Formu</strong> ve onay sonrası <strong>Ziyaretçi Kuralları</strong> bilgilendirmesi burada yer alacaktır.
        </p>
      </div>
    </div>
  );
}
