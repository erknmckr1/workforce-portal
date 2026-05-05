import { Clock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Reports = () => {
  const navigate = useNavigate();

  const reportCategories = [
    {
      id: "personnel-movement",
      title: "Personel Hareket Analizi",
      description:
        "Giriş-çıkış saatleri, çalışma süreleri ve devamlılık çizelgesi.",
      icon: <Clock className="text-amber-500" size={32} />,
      status: "Aktif",
      color: "border-amber-500/20 bg-amber-500/5",
    },
  ];

  return (
    <div className="w-full mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tighter uppercase text-foreground">
          Raporlar <span className="text-amber-500">Merkezi</span>
        </h1>
        <p className="text-muted-foreground font-medium">
          Sistemdeki tüm verileri analiz edin ve performans raporlarını
          görüntüleyin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mt-10">
        {reportCategories.map((report) => (
          <div
            key={report.id}
            onClick={() =>
              report.status === "Aktif" && navigate(`/reports/${report.id}`)
            }
            className={`group relative p-8 rounded-[32px] border transition-all duration-500 cursor-pointer overflow-hidden ${report.color} ${report.status === "Aktif" ? "hover:scale-[1.02] hover:shadow-2xl hover:border-amber-500/40" : "opacity-60 cursor-not-allowed grayscale"}`}
          >
            {/* Background Decoration */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />

            <div className="relative flex flex-col gap-6">
              <div className="w-16 h-16 rounded-2xl bg-background shadow-lg border border-border flex items-center justify-center group-hover:rotate-6 transition-transform">
                {report.icon}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black uppercase tracking-tight text-foreground">
                    {report.title}
                  </h3>
                  {report.status === "Aktif" && (
                    <div className="w-10 h-10 rounded-full bg-amber-500 text-black flex items-center justify-center -translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 shadow-lg">
                      <ArrowRight size={20} />
                    </div>
                  )}
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-[80%]">
                  {report.description}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                <span
                  className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${report.status === "Aktif" ? "bg-amber-500 text-black shadow-lg" : "bg-muted text-muted-foreground"}`}
                >
                  {report.status}
                </span>
                {report.status === "Aktif" && (
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    İncelemek için tıklayın
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Reports;
