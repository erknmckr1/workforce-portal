import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { User, ArrowRight } from "lucide-react";
import { AxiosError } from "axios";
import type { ControllerRenderProps } from "react-hook-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// Zod Schema Definition
const loginSchema = z.object({
  username: z.string().min(1, "Kullanıcı ID zorunludur."),
  password: z.string().optional(),
});

type FormData = z.infer<typeof loginSchema>;

export default function Login() {
  const loginAction = useAuthStore((state) => state.login);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Şifre sıfırlama talebi için state'ler
  const [resetId, setResetId] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(loginSchema),
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

  const handleRequestReset = async () => {
    if (!resetId) {
      toast.error("Lütfen Kullanıcı ID numaranızı giriniz.");
      return;
    }

    try {
      setResetLoading(true);
      await apiClient.post("/auth/request-reset", { user_id: resetId });
      toast.success("Talebiniz İK birimine başarıyla iletildi.");
      setIsResetDialogOpen(false);
      setResetId("");
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Talep iletilirken bir hata oluştu.";
      toast.error(errorMsg);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background antialiased">
      {/* Sol Panel: Giriş Formu */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-20 py-12 relative z-10">
        <div className="max-w-[420px] mx-auto w-full space-y-10">
          <div className="space-y-3">
            <h1 className="text-4xl font-black tracking-tighter text-foreground leading-[1.1]">
              Midas
            </h1>
            <p className="text-muted-foreground text-lg font-medium leading-relaxed">
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
                            placeholder="ID No örn: 1001"
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
                <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                  <DialogTrigger asChild>
                    <button type="button" className="text-sm font-bold text-primary hover:text-primary/80 transition-colors">
                      Şifremi Unuttum?
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] rounded-[2rem] p-8 border-none shadow-2xl">
                    <DialogHeader className="space-y-3">
                      <DialogTitle className="text-2xl font-black tracking-tight">Şifre Sıfırlama Talebi</DialogTitle>
                      <DialogDescription className="text-muted-foreground font-medium">
                        TC veya Sicil numaranızı girin. İK ekibi talebinizi onayladığında şifreniz sıfırlanacaktır.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-2">
                      <Label htmlFor="reset_id" className="text-sm font-bold ml-1 text-foreground/70">Kullanıcı ID</Label>
                      <Input
                        id="reset_id"
                        placeholder="Örn: 123456"
                        value={resetId}
                        onChange={(e) => setResetId(e.target.value)}
                        className="h-12 rounded-2xl border-input bg-muted/30 focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleRequestReset}
                        disabled={resetLoading}
                        className="w-full h-12 rounded-2xl font-bold text-base shadow-lg shadow-primary/20"
                      >
                        {resetLoading ? "Gönderiliyor..." : "Talep Gönder"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
      </div>
    </div>
  );
}
