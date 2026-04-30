import React from "react";
import { User as UserIcon, LogOut } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

type User = NonNullable<ReturnType<typeof useAuthStore.getState>["user"]>;

interface TerminalLeftSideProps {
  operator: User | null;
  onLogout: () => void;
  onOpenKiosk: () => void;
  onOpenFoodMenu: () => void;
}

const TerminalLeftSide: React.FC<TerminalLeftSideProps> = ({
  operator,
  onLogout,
  onOpenKiosk,
  onOpenFoodMenu,
}) => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL.replace("/api", "");
  const photoUrl = operator?.photo_url
    ? `${apiBaseUrl}/photos/${operator.photo_url}`
    : null;

  return (
    <aside className="w-[240px] border-r border-sidebar-border bg-sidebar text-sidebar-foreground p-4 flex flex-col gap-4 shadow-2xl relative overflow-hidden">
      {/* Background Accent Glow using Amber */}
      <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-amber-500 to-transparent opacity-50" />

      <div className="flex flex-col items-center justify-center mb-6 pt-4">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-amber-500 to-yellow-500 rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
          <div className="relative w-32 h-32 bg-sidebar-accent rounded-lg overflow-hidden flex items-center justify-center mb-4 border border-sidebar-border shadow-2xl">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Operator"
                className="w-full h-full object-cover"
              />
            ) : (
              <UserIcon size={64} className="text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="text-[10px] font-bold text-amber-500 tracking-[0.2em] uppercase mb-1">
          Operator ID: {operator?.id_dec || "---"}
        </div>
        <div className="text-xl font-black uppercase tracking-tight text-foreground drop-shadow-md text-center leading-tight">
          {operator
            ? `${operator.name} ${operator.surname}`
            : "GİRİŞ YAPILMADI"}
        </div>
        <div className="h-px w-12 bg-amber-500/30 mt-3" />
      </div>

      <button
        onClick={onLogout}
        className="w-full bg-destructive/10 hover:bg-destructive border border-destructive/30 text-destructive hover:text-destructive-foreground font-bold py-3 rounded-lg shadow-lg transition-all duration-300 flex items-center justify-center gap-2 group"
      >
        <LogOut
          size={18}
          className="group-hover:-translate-x-1 transition-transform"
        />
        <span className="text-xs py-4 uppercase tracking-wider">Çıkış</span>
      </button>

      <div className="flex-1"></div>

      <div className="space-y-2 pb-4">
        {[
          { label: "Yemek Menüsü", variant: "info" },
          { label: "İzin Girişi", variant: "info" },
          { label: "Araya Çık", variant: "warning" },
          { label: "Moladan Dön", variant: "success" },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={() => {
              if (btn.label === "İzin Girişi") onOpenKiosk();
              if (btn.label === "Yemek Menüsü") onOpenFoodMenu();
            }}
            className={`w-full font-bold py-6 rounded-lg shadow-md transition-all duration-300 text-[11px] uppercase tracking-widest border border-border active:scale-95
              ${btn.variant === "info" ? "bg-secondary hover:bg-info hover:text-info-foreground" : ""}
              ${btn.variant === "warning" ? "bg-secondary hover:bg-warning hover:text-warning-foreground" : ""}
              ${btn.variant === "success" ? "bg-secondary hover:bg-success hover:text-success-foreground" : ""}
            `}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </aside>
  );
};

export default TerminalLeftSide;
