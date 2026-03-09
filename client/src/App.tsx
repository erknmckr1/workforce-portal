import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import apiClient from "./lib/api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MainLayout from "./components/layout/MainLayout";
import "./App.css";

import { Toaster } from "@/components/ui/sonner";

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
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        {/* Giriş yapmamışsa Login'e yönlendir */}
        <Route
          path="/login"
          element={!isAuthenticated ? <Login /> : <Navigate to="/" />}
        />

        {/* Korumalı Rotalar (Layout ile birlikte) */}
        <Route
          path="/"
          element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />}
        >
          {/* Dashboard ana sayfa olarak kalsın */}
          <Route index element={<Dashboard />} />

          {/* Diğer Alt Rotalar Buraya Gelecek */}
          <Route path="leaves" element={<div className="p-4 border-2 border-dashed rounded-3xl">İzin Yönetimi Sayfası Yakında...</div>} />
          <Route path="management" element={<div className="p-4 border-2 border-dashed rounded-3xl">Personel Yönetimi Sayfası Yakında...</div>} />
          <Route path="reports" element={<div className="p-4 border-2 border-dashed rounded-3xl">Raporlar Sayfası Yakında...</div>} />
          <Route path="settings" element={<div className="p-4 border-2 border-dashed rounded-3xl">Ayarlar Sayfası Yakında...</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
