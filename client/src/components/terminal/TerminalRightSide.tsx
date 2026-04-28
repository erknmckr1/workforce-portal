import { Play, Square, CheckCircle2, XCircle } from "lucide-react";

const TerminalRightSide = () => {
  return (
    <div className="w-[200px] bg-background border-l border-border p-4 flex flex-col justify-center gap-4 ">
      <button className="group relative w-full bg-secondary hover:bg-info text-foreground hover:text-info-foreground font-black py-6 rounded-xl  transition-all duration-300 border border-border hover:border-info/50 active:scale-95 overflow-hidden text-center">
        <div className="absolute inset-0 bg-linear-to-br from-info/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex flex-col items-center gap-2">
          <Play
            size={24}
            className="fill-current text-blue-400 group-hover:text-info-foreground"
          />
          <span className="text-[10px] uppercase tracking-[0.2em]">
            Yeniden Başlat
          </span>
        </div>
      </button>

      <button className="group relative w-full bg-secondary hover:bg-destructive text-foreground hover:text-destructive-foreground font-black py-6 rounded-xl  transition-all duration-300 border border-border hover:border-destructive/50 active:scale-95 overflow-hidden text-center">
        <div className="absolute inset-0 bg-linear-to-br from-destructive/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex flex-col items-center gap-2">
          <Square
            size={24}
            className="fill-current text-red-500 group-hover:text-destructive-foreground"
          />
          <span className="text-[10px] uppercase tracking-[0.2em]">
            Siparişi Durdur
          </span>
        </div>
      </button>

      <button className="group relative w-full bg-secondary hover:bg-success text-foreground hover:text-success-foreground font-black py-6 rounded-xl  transition-all duration-300 border border-border hover:border-success/50 active:scale-95 overflow-hidden text-center">
        <div className="absolute inset-0 bg-linear-to-br from-success/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex flex-col items-center gap-2">
          <CheckCircle2
            size={24}
            className="text-emerald-500 group-hover:text-success-foreground"
          />
          <span className="text-[10px] uppercase tracking-[0.2em]">
            Prosesi Bitir
          </span>
        </div>
      </button>

      <button className="group relative w-full bg-secondary hover:bg-accent text-foreground hover:text-accent-foreground font-black py-6 rounded-xl shadow-lg transition-all duration-300 border border-border hover:border-accent active:scale-95 overflow-hidden text-center">
        <div className="relative flex flex-col items-center gap-2">
          <XCircle
            size={24}
            className="text-muted-foreground group-hover:text-accent-foreground"
          />
          <span className="text-[10px] uppercase tracking-[0.2em]">
            Sipariş İptal
          </span>
        </div>
      </button>
    </div>
  );
};

export default TerminalRightSide;
