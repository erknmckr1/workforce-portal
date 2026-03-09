import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import apiClient from "../lib/api";
import { useAuthStore } from "../store/authStore";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { User, Lock, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { AxiosError } from "axios";
import type { ControllerRenderProps } from "react-hook-form";

// Sadece ID ve Şifre
const schema = yup.object().shape({
  username: yup.string().required("Kullanıcı ID zorunludur."),
  password: yup.string().required("Şifre zorunludur."),
});

type FormData = yup.InferType<typeof schema>;

import { toast } from "sonner";

export default function Login() {
  const loginAction = useAuthStore((state) => state.login);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      setGlobalError(null);

      const response = await apiClient.post("/auth/login", {
        username: data.username,
        password: data.password,
      });

      toast.success("Giriş başarılı! Yönlendiriliyorsunuz...");
      loginAction(response.data.user);
    } catch (err: unknown) {
      const error = err as AxiosError<{ message?: string }>;
      const errorMsg = error.response?.data?.message || "Sunucuyla iletişim kurulamadı.";
      setGlobalError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background antialiased">
      {/* Sol Panel: Giriş Formu */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-20 py-12 relative z-10">
        <div className="max-w-[420px] mx-auto w-full space-y-10">
          <div className="space-y-3">
            <h1 className="text-4xl font-black tracking-tighter text-foreground leading-[1.1]">
              Midas <span className="text-primary italic">Workforce</span>
            </h1>
            <p className="text-muted-foreground text-lg font-medium leading-relaxed">
              İş gücü yönetim portalına hoş geldiniz. <br className="hidden sm:block" />
              Otunumu başlatmak için bilgilerinizi girin.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {globalError && (
                <div className="p-4 text-sm font-semibold text-destructive bg-destructive/10 border-l-4 border-destructive rounded-r-lg">
                  {globalError}
                </div>
              )}

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }: { field: ControllerRenderProps<FormData, "username"> }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-sm font-bold tracking-tight text-foreground/80">Kullanıcı ID</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors">
                            <User size={18} />
                          </div>
                          <Input
                            placeholder="Sicil No örn: 1001"
                            {...field}
                            className="h-13 pl-11 rounded-2xl border-input bg-background focus:ring-2 focus:ring-primary/20 transition-all text-base"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }: { field: ControllerRenderProps<FormData, "password"> }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-sm font-bold tracking-tight text-foreground/80">Şifre</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors">
                            <Lock size={18} />
                          </div>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                            className="h-13 pl-11 rounded-2xl border-input bg-background focus:ring-2 focus:ring-primary/20 transition-all text-base"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center space-x-2.5">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      id="remember"
                      className="peer h-4.5 w-4.5 rounded-md border-input text-primary focus:ring-primary bg-background transition-all"
                      defaultChecked
                    />
                  </div>
                  <label htmlFor="remember" className="text-sm font-semibold text-muted-foreground cursor-pointer hover:text-foreground">
                    Beni hatırla
                  </label>
                </div>
                <button type="button" className="text-sm font-bold text-primary hover:text-primary/80 transition-colors">
                  Yardım Al?
                </button>
              </div>

              <Button
                type="submit"
                className="w-full h-13 rounded-2xl text-base font-bold tracking-tight shadow-xl shadow-primary/25 hover:shadow-primary/35 active:scale-[0.98] transition-all gap-2"
                disabled={loading}
              >
                {loading ? "Giriş yapılıyor..." : (
                  <>
                    Sisteme Giriş Yap <ArrowRight size={18} />
                  </>
                )}
              </Button>
            </form>
          </Form>

          <p className="text-center text-xs font-bold text-muted-foreground/50 uppercase tracking-[0.2em] pt-4">
            Midas Hediyelik Eşya &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* Sağ Panel: Ultra-Elite Tasarım Alanı */}
      <div className="hidden lg:flex flex-[1.6] relative overflow-hidden items-center justify-center">
        {/* Arka Plan Görseli ve Overlay */}
        <div className="absolute inset-0 z-0 text-foreground">
          <img
            src="/login-bg-premium.png"
            alt="Midas Premium"
            className="w-full h-full object-cover scale-105"
          />

        </div>

        {/* İçerik Kartı */}
        <div className="relative z-10 w-full max-w-2xl p-12 space-y-12">
          {/* Üst Kısım: Slogan ve Başlık */}
          <div className="space-y-6">
            <p className="text-xl text-card font-medium leading-relaxed max-w-lg border-l-2 border-card pl-6">
              Midas Workforce ile süreçlerinizi dijitalleştirin, verimliliği en üst seviyeye taşıyın.
            </p>
          </div>

          {/* İstatistikler / Özellikler: Elit Kartlar */}
          <div className="grid grid-cols-2 gap-6">
            <div className="group p-8 rounded-[2rem] bg-card/10 border border-border/50 backdrop-blur-2xl transition-all hover:bg-card/20 hover:border-primary/30">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mb-6 transition-transform group-hover:scale-110">
                <Zap size={28} strokeWidth={2.5} />
              </div>
              <h4 className="text-foreground font-black text-xl tracking-tight mb-2">Performans</h4>
              <p className="text-card/70 text-sm font-medium leading-snug">
                Karmaşık süreçleri saniyeler içinde çözen akıllı algoritmalar.
              </p>
            </div>

            <div className="group p-8 rounded-[2rem] bg-card/10 border border-border/50 backdrop-blur-2xl transition-all hover:bg-card/20 hover:border-primary/30">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-muted-foreground mb-6 transition-transform group-hover:scale-110 group-hover:text-primary">
                <ShieldCheck size={28} strokeWidth={2.5} />
              </div>
              <h4 className="text-foreground font-black text-xl tracking-tight mb-2">Güven</h4>
              <p className="text-card/70 text-sm font-medium leading-snug">
                En üst segment güvenlik protokolleri ile verileriniz koruma altında.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


