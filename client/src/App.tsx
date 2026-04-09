import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import apiClient from "./lib/api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PersonnelManagement from "./pages/PersonnelManagement";
import MainLayout from "./components/layout/MainLayout";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import SettingsIndex from "./pages/settings/SettingsIndex";
import Approvals from "./pages/settings/Approvals";
import Leaves from "./pages/Leaves";
import LeaveApprovals from "./pages/LeaveApprovals";
import SecurityScreen from "./pages/SecurityScreen";
import Infirmary from "./pages/Infirmary";
import KioskPage from "./pages/KioskPage";
import { ThemeProvider } from "./components/theme-provider";
import { ConfirmProvider } from "@/providers/ConfirmProvider";
import "./App.css";

import { Toaster } from "@/components/ui/sonner"; 
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes standard stale time
      retry: 1,
    },
  },
});

function App() {
  const { isAuthenticated, isLoading, login, logout, setCheckingAuth } = useAuthStore();

  useEffect(() => {
    // Uygulama yüklendiğinde Cookie'deki oturumu kontrol et (checkAuth endpointi)
    const checkUserAuth = async () => {
      try {
        setCheckingAuth(true);
        const response = await apiClient.get("/auth/check");
        if (response.data.authenticated) {
          login(response.data.user);
        } else {
          logout();
        }
      } catch {
        // Oturum yoksa veya hata varsa logouthale getir
        logout();
      } finally {
        setCheckingAuth(false);
      }
    };

    checkUserAuth();
  }, [login, logout, setCheckingAuth]);

  // Sayfa İlk Yüklenirken (API Cevabı Bekleniyor)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-muted-foreground font-medium ">Oturum kontrol ediliyor...</span>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="midas-theme">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Toaster position="top-center" richColors />
          <ConfirmProvider>
          <Routes>
            {/* Giriş yapmamışsa Login'e yönlendir */}
            <Route
              path="/login"
              element={!isAuthenticated ? <Login /> : <Navigate to="/" />}
            />

            <Route path="/kiosk-terminal" element={<KioskPage />} />

            {/* Korumalı Rotalar (Layout ile birlikte) */}
            <Route
              path="/"
              element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />}
            >
              {/* Dashboard (Güvenlik Hariç) */}
              <Route element={<ProtectedRoute allowedRoles={["Admin", "Müdür", "Şef", "Personel", "İK", "Revir"]} />}>
                <Route index element={<Dashboard />} />
              </Route>

              {/* İzinlerim (Herkes Görebilir) */}
              <Route element={<ProtectedRoute allowedRoles={["Admin", "Müdür", "Şef", "Personel", "İK", "Revir", "Güvenlik"]} />}>
                <Route path="leaves" element={<Leaves />} />
              </Route>

              {/* Onay Bekleyenler */}
              <Route element={<ProtectedRoute allowedRoles={["Admin", "Müdür", "Şef", "İK"]} />}>
                <Route path="leave-approvals" element={<LeaveApprovals />} />
              </Route>

              {/* Personel Yönetimi */}
              <Route element={<ProtectedRoute allowedRoles={["Admin", "İK"]} />}>
                <Route path="management" element={<PersonnelManagement />} />
              </Route>

              {/* Güvenlik Paneli */}
              <Route element={<ProtectedRoute allowedRoles={["Admin", "Güvenlik"]} />}>
                <Route path="security" element={<SecurityScreen />} />
              </Route>

              {/* Revir İşlemleri */}
              <Route element={<ProtectedRoute allowedRoles={["Admin", "Revir"]} />}>
                <Route path="infirmary" element={<Infirmary />} />
              </Route>

              {/* Raporlar */}
              <Route element={<ProtectedRoute allowedRoles={["Admin", "İK", "Müdür"]} />}>
                <Route path="reports" element={<div className="p-4 border-2 border-dashed rounded-3xl">Raporlar Sayfası Yakında...</div>} />
              </Route>
              
              {/* Sistem Ayarları Düz Routing */}
              <Route element={<ProtectedRoute allowedRoles={["Admin", "İK"]} />}>
                <Route path="settings" element={<Navigate to="/settings/general" replace />} />
                <Route path="settings/general" element={<SettingsIndex />} />
                <Route path="settings/approvals" element={<Approvals />} />
              </Route>
              {/* 404 Yönlendirme */}
              <Route path="*" element={<Navigate to="/" />} />
            </Route>
          </Routes>
          </ConfirmProvider>
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
