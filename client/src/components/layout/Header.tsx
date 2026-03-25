import { 
  Bell, 
  Search, 
  User as UserIcon, 
  Settings,
  Menu
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useState } from "react";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuthStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="h-[73px] flex items-center justify-between px-4 lg:px-8 bg-background border-b border-border transition-all duration-300 backdrop-blur-md sticky top-0 z-30">
      {/* Sol Kısım: Menu (Mobile) + Search */}
      <div className="flex items-center gap-4 w-full max-w-lg">
        <button 
          onClick={onMenuClick}
          className="p-2 rounded-xl hover:bg-muted xl:hidden text-muted-foreground transition-all active:scale-90"
        >
          <Menu size={20} />
        </button>

        <div className="relative group w-full hidden sm:block">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Modülleri ara..."
            className="w-full h-11 pl-11 pr-4 rounded-xl bg-muted/30 border border-border/50 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
          />
        </div>
      </div>

      {/* Sağ Kısım: Bildirimler ve Profil */}
      <div className="flex items-center gap-3 lg:gap-6">
        <button className="relative p-2 rounded-xl text-muted-foreground hover:bg-muted transition-all active:scale-90 group">
          <Bell size={20} className="group-hover:text-primary transition-colors" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary border-2 border-background animate-pulse" />
        </button>

        <div className="h-8 w-px bg-border/50 hidden sm:block" />

        <div className="relative">
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="group flex items-center gap-3 p-1 rounded-2xl hover:bg-muted transition-all active:scale-95 border border-transparent hover:border-border/50 lg:p-1.5"
          >
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-sm font-black text-foreground leading-tight tracking-tight">
                {user?.name} {user?.surname}
              </span>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-0.5">
                {user?.role || 'PERSONEL'}
              </span>
            </div>
            <div className="relative">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm group-hover:shadow-md transition-all">
                <UserIcon size={20} strokeWidth={2.5} />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
            </div>
          </button>

          {/* Profil Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-3 w-56 rounded-2xl bg-card border border-border shadow-2xl p-2 animate-in fade-in slide-in-from-top-2 duration-200">
               <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted text-foreground transition-all">
                  <UserIcon size={18} />
                  <span className="text-sm font-bold">Profil Bilgilerim</span>
               </button>
               <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted text-foreground transition-all">
                  <Settings size={18} />
                  <span className="text-sm font-bold">Hesap Ayarları</span>
               </button>
               <div className="h-px bg-border/50 my-1 mx-2" />
               <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted text-destructive transition-all">
                  <Menu size={18} />
                  <span className="text-sm font-bold">Hızlı İşlemler</span>
               </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
