import type { Personnel } from "@/hooks/usePersonnel";
import apiClient from "@/lib/api";

interface PersonnelCardProps {
  personnel: Personnel | null;
  renderPhoto?: () => React.ReactNode;
}

export function PersonnelCard({ personnel, renderPhoto }: PersonnelCardProps) {
  if (!personnel) return null;

  const photoUrl = personnel.photo_url 
    ? `${apiClient.defaults.baseURL?.replace('/api', '')}/photos/${personnel.photo_url}`
    : null;

  return (
    <div className="card-wrapper relative w-[600px] h-[380px] overflow-hidden bg-white shadow-2xl flex font-sans rounded-2xl">
      {/* ARKA PLAN GÖRSELİ */}
      <img 
        src="/card-bg.jpg" 
        className="absolute inset-0 w-full h-full object-cover z-0" 
        alt="Card Background" 
      />

      {/* SOL TARAF: FOTOĞRAF VE ID */}
      <div className="relative z-10 w-[240px] flex flex-col items-center pt-[90px] pl-[10px]">
        {/* FOTOĞRAF KUTUSU */}
        <div className="w-[170px] h-[210px] bg-white border-[3px] border-white shadow-lg overflow-hidden flex items-center justify-center relative">
          {renderPhoto ? (
             renderPhoto()
          ) : photoUrl ? (
            <img src={photoUrl} className="w-full h-full object-cover" alt="Personnel" />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground font-black text-4xl">
              {personnel.name[0]}{personnel.surname[0]}
            </div>
          )}
        </div>

        {/* ID NUMARASI KUTUSU */}
        <div className="mt-4 bg-white px-4 py-1 shadow-md">
          <span className="text-3xl font-black text-black tracking-tight tabular-nums">
            {personnel.id_dec}
          </span>
        </div>
      </div>

      {/* SAĞ TARAF: BİLGİLER */}
      <div className="relative z-10 flex-1 flex flex-col justify-center pr-10 pt-[60px] text-right">
        {/* İSİM BÖLÜMÜ */}
        <div className="mb-6">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">Ad Soyad</p>
          <h2 className="text-4xl font-black text-black uppercase leading-tight tracking-[0.02em]">
            {personnel.name} {personnel.surname}
          </h2>
        </div>

        {/* BÖLÜM BÖLÜMÜ */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">Bölüm & Birim</p>
          <p className="text-2xl font-black text-black leading-tight">
            {personnel.Section?.name || 'Genel'}
            <br />
            <span className="text-xl font-bold opacity-60">{personnel.Department?.name || '---'}</span>
            <br />
            <span className="text-sm font-bold opacity-40 uppercase tracking-widest">{personnel.JobTitle?.name || ''}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
