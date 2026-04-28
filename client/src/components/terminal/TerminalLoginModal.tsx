import React, { useState, useEffect, useRef } from "react";
import { ShieldCheck, XCircle, Loader2, CreditCard } from "lucide-react";
import apiClient from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

// Store'daki User tipini kullanabilmek için (opsiyonel ama iyi uygulama)
type User = NonNullable<ReturnType<typeof useAuthStore.getState>["user"]>;

interface TerminalLoginModalProps {
  onLoginSuccess: (userData: User) => void;
}

const TerminalLoginModal: React.FC<TerminalLoginModalProps> = ({
  onLoginSuccess,
}) => {
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sayfa açıldığında veya hata oluştuğunda input'a odaklan
  useEffect(() => {
    inputRef.current?.focus();
  }, [error]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post("/auth/login", {
        username: userId,
      });

      if (response.data.user) {
        onLoginSuccess(response.data.user);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Geçersiz Kart veya ID.");
      setUserId("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center">
      <div className="w-[500px] z-100 bg-card border border-border rounded-[2rem] shadow-[0_0_100px_rgba(0,0,0,0.4)] overflow-hidden animate-in fade-in zoom-in duration-500">
        {/* Glow Effect Top */}
        <div className="h-1.5 w-full bg-linear-to-r from-transparent via-amber-500 to-transparent opacity-50" />

        <div className="p-10 text-center">
          <div className="inline-flex p-5 rounded-3xl bg-primary/5 mb-6 ring-1 ring-primary/10 relative group">
            <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            <CreditCard size={48} className="text-amber-500 relative z-10" />
          </div>

          <h2 className="text-3xl font-black uppercase tracking-tighter text-foreground mb-2">
            Terminal Erişimi
          </h2>
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-[0.2em] mb-10">
            Lütfen personel kartınızı okutun
          </p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative group">
              <input
                ref={inputRef}
                type="password" // Kart numarasını gizli tutmak daha profesyonel durur
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="••••••••••••"
                className={`w-full bg-secondary/30 border-2 rounded-2xl p-6 text-center text-3xl font-mono tracking-[0.5em] transition-all duration-300 outline-none
                  ${error ? "border-destructive focus:border-destructive shadow-[0_0_20px_rgba(239,68,68,0.1)]" : "border-border focus:border-amber-500 shadow-inner"}
                `}
                autoComplete="off"
                disabled={loading}
              />
              {loading && (
                <div className="absolute right-6 top-1/2 -translate-y-1/2">
                  <Loader2 className="animate-spin text-amber-500" size={24} />
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center justify-center gap-2 text-destructive font-black text-[10px] uppercase tracking-widest bg-destructive/5 p-4 rounded-xl border border-destructive/10 animate-shake">
                <XCircle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!userId || loading}
              className="w-full bg-foreground text-background font-black py-5 rounded-2xl text-sm uppercase tracking-[0.3em] transition-all hover:opacity-90 active:scale-95 disabled:opacity-20 flex items-center justify-center gap-3"
            >
              {loading ? "Doğrulanıyor..." : "Giriş Yap"}
            </button>
          </form>

          <div className="mt-12 flex items-center justify-center gap-2 opacity-20 grayscale">
            <ShieldCheck size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Secure Terminal Access v2.0
            </span>
          </div>
        </div>
      </div>
      <div className="w-full h-full bg-foreground absolute opacity-70 top-0 left-0"></div>
    </div>
  );
};

export default TerminalLoginModal;
