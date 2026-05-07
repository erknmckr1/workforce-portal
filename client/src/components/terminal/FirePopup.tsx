import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  RotateCcw,
  Search,
  History,
  Calculator,
  AlertCircle,
  Edit2,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

interface ScrapMeasurement {
  id: number;
  order_no: string;
  operator_id: string;
  area_name: string;
  entry_measurement: number;
  exit_measurement: number;
  gold_setting: number;
  gold_pure_scrap: number;
  measurement_diff: number;
  createdAt: string;
}

interface FirePopupProps {
  onClose: () => void;
  areaName: string;
  operatorId?: string;
}

const FirePopup: React.FC<FirePopupProps> = ({ onClose, areaName, operatorId }) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ScrapMeasurement[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [form, setForm] = useState({
    orderId: "",
    goldSetting: 0,
    entryGramage: 0,
    exitGramage: 0,
    gold_pure_scrap: 0,
    diffirence: 0,
  });

  // Otomatik hesaplamalar
  useEffect(() => {
    const entry = Number(form.entryGramage) || 0;
    const exit = Number(form.exitGramage) || 0;
    const diff = entry - exit;

    const caratMultiplier: Record<number, number> = {
      8: 0.33,
      10: 0.416,
      14: 0.585,
      18: 0.75,
      21: 0.875,
      22: 0.916,
    };

    const multiplier = caratMultiplier[Number(form.goldSetting)] || 1;
    const pureScrap = diff * multiplier;

    setForm((prev) => ({
      ...prev,
      diffirence: Number(diff.toFixed(4)),
      gold_pure_scrap: Number(pureScrap.toFixed(4)),
    }));
  }, [form.entryGramage, form.exitGramage, form.goldSetting]);

  const fetchHistory = async (orderId: string) => {
    try {
      const res = await apiClient.get(
        `/mes/scrap-measurements?order_no=${orderId}`,
      );
      setHistory(res.data);
    } catch (error) {
      console.error("History fetch error", error);
    }
  };

  const handleSearchOrder = async () => {
    if (!form.orderId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/mes/order/${form.orderId}`);
      // CARAT bazen string içinde gelebilir (örn: "14K"), sadece rakamları alalım
      const rawCarat = res.data.CARAT || "0";
      const numericCarat = parseFloat(rawCarat.replace(/[^0-9.]/g, ""));

      setForm((prev) => ({
        ...prev,
        goldSetting: numericCarat,
      }));
      toast.success("Sipariş bilgileri getirildi.");
      await fetchHistory(form.orderId);
    } catch (error) {
      console.log(error);
      toast.error("Sipariş bulunamadı veya bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.orderId || form.entryGramage <= 0) {
      toast.error("Lütfen sipariş no ve giriş ölçüsünü kontrol edin.");
      return;
    }

    setLoading(true);
    try {
      if (selectedId) {
        await apiClient.put("/mes/scrap-measurements", {
          formState: form,
          id: selectedId,
        });
        toast.success("Ölçüm güncellendi.");
      } else {
        await apiClient.post("/mes/scrap-measurements", {
          formState: form,
          user_id: operatorId || user?.id_dec,
          areaName,
        });
        toast.success("Ölçüm kaydedildi.");
      }
      await fetchHistory(form.orderId);
      resetForm(false); // Sadece ölçüleri sıfırla, sipariş no kalsın
    } catch (error) {
      toast.error("İşlem başarısız oldu.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = (full = true) => {
    setForm((prev) => ({
      orderId: full ? "" : prev.orderId,
      goldSetting: full ? 0 : prev.goldSetting,
      entryGramage: 0,
      exitGramage: 0,
      gold_pure_scrap: 0,
      diffirence: 0,
    }));
    if (full) {
      setHistory([]);
      setSelectedId(null);
    }
  };

  const handleEdit = (item: ScrapMeasurement) => {
    setSelectedId(item.id);
    setForm({
      orderId: item.order_no,
      goldSetting: item.gold_setting,
      entryGramage: item.entry_measurement,
      exitGramage: item.exit_measurement,
      gold_pure_scrap: item.gold_pure_scrap,
      diffirence: item.measurement_diff,
    });
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-card/80 backdrop-blur-xl border border-border w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-linear-to-r from-mds/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-mds/20 rounded-2xl">
              <Calculator className="text-mds" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-foreground uppercase">
                Fire Veri Girişi
              </h2>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {areaName} Terminali
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Form */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-mds uppercase tracking-[0.2em] ml-1">
                Sipariş No / Barkod
              </label>
              <div className="relative group">
                <input
                  type="text"
                  value={form.orderId}
                  onChange={(e) =>
                    setForm({ ...form, orderId: e.target.value.toUpperCase() })
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearchOrder()}
                  placeholder="OKUTUN VEYA YAZIN..."
                  className="w-full bg-secondary/50 border border-border rounded-2xl px-5 py-4 text-lg font-mono tracking-widest focus:border-mds/50 outline-none transition-all placeholder:text-muted-foreground/30"
                />
                <button
                  onClick={handleSearchOrder}
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-mds text-primary-foreground rounded-xl hover:bg-mds/80 transition-colors shadow-lg shadow-mds/20"
                >
                  <Search size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  Ayar
                </label>
                <input
                  type="number"
                  value={form.goldSetting}
                  onChange={(e) =>
                    setForm({ ...form, goldSetting: Number(e.target.value) })
                  }
                  className="w-full bg-secondary/30 border border-border rounded-xl px-4 py-3 outline-none focus:border-border transition-all font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  Fark (Gr)
                </label>
                <div className="w-full bg-mds/10 border border-mds/20 rounded-xl px-4 py-3 font-black text-mds">
                  {form.diffirence}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  Giriş Ölçüsü
                </label>
                <input
                  type="text"
                  value={form.entryGramage}
                  onChange={(e) => {
                    const val = e.target.value.replace(",", ".");
                    if (!isNaN(Number(val)) || val === "" || val === ".") {
                      setForm({ ...form, entryGramage: val as any });
                    }
                  }}
                  className="w-full bg-secondary/30 border border-border rounded-xl px-4 py-3 outline-none focus:border-success/50 transition-all font-bold text-success"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  Çıkış Ölçüsü
                </label>
                <input
                  type="text"
                  value={form.exitGramage}
                  onChange={(e) => {
                    const val = e.target.value.replace(",", ".");
                    if (!isNaN(Number(val)) || val === "" || val === ".") {
                      setForm({ ...form, exitGramage: val as any });
                    }
                  }}
                  className="w-full bg-secondary/30 border border-border rounded-xl px-4 py-3 outline-none focus:border-destructive/50 transition-all font-bold text-destructive"
                />
              </div>
            </div>

            <div className="p-5 bg-linear-to-br from-mds/20 to-orange-500/5 rounded-3xl border border-mds/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <Calculator size={64} />
              </div>
              <div className="relative z-10">
                <div className="text-[10px] font-black text-mds uppercase tracking-[0.2em] mb-1">
                  Has Fire Hesabı
                </div>
                <div className="text-4xl font-black text-foreground tabular-nums tracking-tighter">
                  {form.gold_pure_scrap}{" "}
                  <span className="text-sm font-light text-muted-foreground ml-1">
                    gr
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-mds hover:bg-mds/80 text-primary-foreground font-bold py-4 rounded-2xl shadow-xl shadow-mds/20 transition-all flex items-center justify-center gap-2 group active:scale-95"
              >
                <Save
                  size={20}
                  className="group-hover:translate-y-[-2px] transition-transform"
                />
                <span className="uppercase tracking-widest text-xs">
                  {selectedId ? "Güncelle" : "Kaydet"}
                </span>
              </button>
              <button
                onClick={() => resetForm(true)}
                className="p-4 bg-secondary hover:bg-secondary/70 rounded-2xl border border-border transition-all text-muted-foreground hover:text-foreground active:scale-95"
                title="Sıfırla"
              >
                <RotateCcw size={20} />
              </button>
            </div>
          </div>

          {/* Right Column: History */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <History size={16} />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Geçmiş Ölçümler
                </span>
              </div>
              {history.length > 0 && (
                <span className="text-[10px] font-bold bg-secondary px-2 py-1 rounded-lg text-muted-foreground uppercase">
                  {history.length} Kayıt
                </span>
              )}
            </div>

            <div className="flex-1 bg-secondary/20 rounded-3xl border border-border overflow-hidden flex flex-col min-h-[400px]">
              {history.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-16 h-16 bg-secondary flex items-center justify-center mb-4 rounded-full">
                    <Search className="text-muted-foreground/30" size={32} />
                  </div>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                    {form.orderId
                      ? "Bu sipariş için kayıt bulunamadı"
                      : "Sipariş okutarak geçmişi görebilirsiniz"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Tarih
                        </th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Giriş / Çıkış
                        </th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Has Fire
                        </th>
                        <th className="px-6 py-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {history.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => handleEdit(item)}
                          className={`transition-all group cursor-pointer border-l-4 ${
                            selectedId === item.id
                              ? "bg-mds/10 border-mds shadow-inner"
                              : "hover:bg-secondary/50 border-transparent"
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="text-xs font-bold text-foreground">
                              {new Date(item.createdAt).toLocaleDateString(
                                "tr-TR",
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(item.createdAt).toLocaleTimeString(
                                "tr-TR",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-success font-bold">
                                {item.entry_measurement}
                              </span>
                              <span className="text-muted-foreground/30">
                                /
                              </span>
                              <span className="text-xs font-mono text-destructive font-bold">
                                {item.exit_measurement}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-black text-mds tracking-tighter">
                              {item.gold_pure_scrap}{" "}
                              <span className="text-[10px] font-normal text-muted-foreground">
                                gr
                              </span>
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div
                              className={`p-2 rounded-lg transition-all ${
                                selectedId === item.id
                                  ? "text-mds bg-mds/20 scale-110"
                                  : "text-muted-foreground group-hover:text-mds"
                              }`}
                            >
                              <Edit2 size={16} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-start gap-3 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
              <AlertCircle className="text-blue-500 shrink-0" size={18} />
              <p className="text-[10px] text-blue-500/70 font-medium leading-relaxed uppercase">
                Has fire hesabı otomatik olarak (Giriş - Çıkış) * Ayar / 1000
                formülü ile hesaplanır. Manuel müdahale gerekiyorsa Ayar veya
                Ölçü alanlarını güncelleyebilirsiniz.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirePopup;
