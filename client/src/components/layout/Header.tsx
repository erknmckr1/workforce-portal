import { Bell, Search, User as UserIcon, Settings, Menu } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { useAuthStore } from "@/store/authStore";
import { useNotifications, type INotification } from "@/hooks/useNotifications";
import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import FactoryStatus from "../common/FactoryStatus";
interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuthStore();

  const { notifications, unreadCount, markAsRead, markAllRead } =
    useNotifications();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Dışarı tıklayınca menüleri kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = (notif: INotification) => {
    if (!notif.is_read) {
      markAsRead(notif.id);
    }
    // Burada istenirse related_id'ye göre sayfaya yönlendirme yapılabilir
    setShowNotifications(false);
  };
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
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors"
          />
          <input
            type="text"
            placeholder="Modülleri ara..."
            className="w-full h-11 pl-11 pr-4 rounded-xl bg-muted/30 border border-border/50 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
          />
        </div>
      </div>

      {/* Sağ Kısım: Tema, Bildirimler ve Profil */}
      <div className="flex items-center gap-2 lg:gap-4">
        <FactoryStatus externalId={user?.external_id || 0} />
        <ModeToggle />

        {/* BİLDİRİMLER */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 h-10 w-10 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-all active:scale-90 group"
          >
            <Bell
              size={22}
              className={cn(
                "transition-colors",
                showNotifications ? "text-primary" : "group-hover:text-primary",
              )}
            />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground border-2 border-background animate-in zoom-in duration-300">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/20">
                <h3 className="font-black text-sm uppercase tracking-tighter">
                  Bildirimler
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead()}
                    className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest"
                  >
                    Tümünü Oku
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center gap-2 opacity-50">
                    <Bell size={32} className="text-muted-foreground" />
                    <span className="text-xs font-bold uppercase tracking-widest">
                      Bildirim bulunmuyor
                    </span>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={cn(
                        "w-full p-4 text-left border-b border-border/30 last:border-0 hover:bg-muted/50 transition-all flex gap-3 group relative",
                        !notif.is_read && "bg-primary/3",
                      )}
                    >
                      {!notif.is_read && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                      )}
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl shrink-0 flex items-center justify-center transition-colors",
                          notif.is_read
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary",
                        )}
                      >
                        <Bell size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className={cn(
                              "text-sm tracking-tight truncate",
                              notif.is_read
                                ? "font-medium text-muted-foreground"
                                : "font-black text-foreground",
                            )}
                          >
                            {notif.title}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(notif.created_at), {
                              addSuffix: true,
                              locale: tr,
                            })}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "text-xs leading-relaxed line-clamp-2",
                            notif.is_read
                              ? "text-muted-foreground/70"
                              : "text-muted-foreground font-medium",
                          )}
                        >
                          {notif.message}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-3 bg-muted/10 border-t border-border/50 text-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Son 20 bildirim gösteriliyor
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-border/50 hidden sm:block" />

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="group flex items-center gap-3 p-1 rounded-2xl hover:bg-muted transition-all active:scale-95 border border-transparent hover:border-border/50 lg:p-1.5"
          >
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-sm font-black text-foreground leading-tight tracking-tight">
                {user?.name} {user?.surname}
              </span>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-0.5">
                {user?.role || "PERSONEL"}
              </span>
            </div>
            <div className="relative">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm group-hover:shadow-md transition-all overflow-hidden relative">
                {user?.photo_url ? (
                  <img
                    src={`${import.meta.env.VITE_API_BASE_URL.replace("/api", "")}/photos/${user.photo_url}`}
                    alt="Profil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon size={20} strokeWidth={2.5} />
                )}
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
