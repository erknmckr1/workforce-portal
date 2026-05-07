import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings,
  Droplets,
  Zap,
  Hammer,
  Scissors,
  Activity,
  ShieldCheck,
  ChevronRight,
  Monitor,
} from "lucide-react";

interface ScreenCard {
  id: string;
  title: string;
  area: string;
  section: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const screens: ScreenCard[] = [
  {
    id: "taslama",
    title: "Taslama",
    area: "taslama",
    section: "atolye",
    icon: <Settings size={32} />,
    color: "from-amber-500 to-orange-600",
    description: "",
  },
  {
    id: "tezgah",
    title: "Tezgah",
    area: "tezgah",
    section: "atolye",
    icon: <Monitor size={32} />,
    color: "from-blue-500 to-indigo-600",
    description: "",
  },
  {
    id: "cila",
    title: "Cila",
    area: "cila",
    section: "atolye",
    icon: <Zap size={32} />,
    color: "from-purple-500 to-pink-600",
    description: "",
  },
  {
    id: "kalite",
    title: "Kalite Kontrol",
    area: "kalite",
    section: "atolye",
    icon: <ShieldCheck size={32} />,
    color: "from-emerald-500 to-teal-600",
    description: "",
  },
  {
    id: "buzlama",
    title: "Buzlama",
    area: "buzlama",
    section: "atolye",
    icon: <Droplets size={32} />,
    color: "from-cyan-500 to-blue-600",
    description: "",
  },
  {
    id: "cekic",
    title: "Çekiç",
    area: "cekic",
    section: "atolye",
    icon: <Hammer size={32} />,
    color: "from-red-500 to-rose-600",
    description: "",
  },
  {
    id: "kurutiras",
    title: "Kuru Tıraş",
    area: "kurutiras",
    section: "atolye",
    icon: <Scissors size={32} />,
    color: "from-lime-500 to-green-600",
    description: "",
  },
  {
    id: "telcekme",
    title: "Tel Çekme",
    area: "telcekme",
    section: "atolye",
    icon: <Activity size={32} />,
    color: "from-orange-500 to-amber-600",
    description: "",
  },
];

const MesScreensNavigator = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col space-y-8">
      {/* Header Area */}
      <div className="relative overflow-hidden p-8 rounded-[2rem] bg-linear-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] -mr-32 -mt-32 rounded-full" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
          <div className="p-5 bg-primary rounded-3xl shadow-xl shadow-primary/20">
            <Monitor size={40} className="text-primary-foreground" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight uppercase">
              MES Terminal Gezgini
            </h1>
            <p className="text-sm text-muted-foreground font-medium max-w-xl">
              Üretim bölümlerine hızlı erişim sağlayın. İzlemek veya veri girişi
              yapmak istediğiniz terminali aşağıdan seçebilirsiniz.
            </p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {screens.map((screen) => (
          <button
            key={screen.id}
            onClick={() => navigate(`/uretim/${screen.section}/${screen.area}`)}
            className="group relative flex flex-col items-start p-6 bg-card border border-border rounded-[2.5rem] text-left transition-all  hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/50 overflow-hidden"
          >
            <div
              className={`p-4 bg-linear-to-br ${screen.color} text-card rounded-2xl mb-6 shadow-lg shadow-black/5 group-hover:scale-110 transition-transform duration-500`}
            >
              {screen.icon}
            </div>

            <div className="space-y-2 relative z-10 flex-1">
              <h3 className="text-xl font-black uppercase tracking-tight group-hover:text-primary transition-colors">
                {screen.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                {screen.description}
              </p>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0 duration-500">
              Giriş Yap <ChevronRight size={14} />
            </div>

            {/* Decorative corner element */}
            <div className="absolute bottom-0 right-0 p-1 opacity-10">
              <Monitor size={48} className="text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MesScreensNavigator;
