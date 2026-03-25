import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

interface ProtectedRouteProps {
  allowedRoles: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-140px)] animate-in fade-in zoom-in duration-300">
        <div className="text-destructive w-20 h-20 mb-6 bg-destructive/10 rounded-full flex items-center justify-center border-4 border-destructive/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        </div>
        <h1 className="text-3xl font-black text-foreground tracking-tighter mb-2 uppercase">Erişim Reddedildi</h1>
        <p className="text-muted-foreground font-bold text-sm tracking-wider uppercase mb-6 text-center max-w-sm">
          Bu sayfayı görüntülemek veya işlem yapmak için yetkiniz (Yetki Matrisi) bulunmuyor.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
