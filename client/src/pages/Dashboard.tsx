import { useAuthStore } from "../store/authStore";
import apiClient from "../lib/api";

export default function Dashboard() {
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
      logout();
    } catch (error) {
      console.error("Çıkış yaparken hata oluştu:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="shrink-0 flex items-center">
                <span className="text-xl font-bold tracking-tight text-primary">
                  Workforce Portal
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground italic">
                {user?.name} {user?.surname} ({user?.role})
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg text-destructive-foreground bg-destructive hover:bg-destructive/90 transition-all shadow-sm shadow-destructive/20"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Dashboard içeriði buraya gelecek */}
      </main>
    </div>
  );
}
