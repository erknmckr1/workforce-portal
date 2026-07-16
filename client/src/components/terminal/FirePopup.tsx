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
  weighed_quantity?: number;
  weighed_weight?: number;
  result_weight?: number;
  createdAt: string;
}

interface FirePopupProps {
  onClose: () => void;
  areaName: string;
  operatorId?: string;
}

const FirePopup: React.FC<FirePopupProps> = ({
  onClose,
  areaName,
  operatorId,
}) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ScrapMeasurement[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [orderInfo, setOrderInfo] = useState<{
    materialNo: string;
    description: string;
    systemWeight: number | null;
  } | null>(null);

  const [form, setForm] = useState({
    orderId: "",
    goldSetting: 0,
    entryGramage: 0,
    exitGramage: 0,
    gold_pure_scrap: 0,
    diffirence: 0,
    weighedQuantity: "",
    weighedWeight: "",
    resultWeight: "",
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

  // Otomatik tartılan adet/gramaj sonuç hesaplaması
  useEffect(() => {
    const qty = parseFloat(form.weighedQuantity);
    const wt = parseFloat(form.weighedWeight);
    if (!isNaN(qty) && qty > 0 && !isNaN(wt) && wt > 0) {
      const res = wt / qty;
      setForm((prev) => ({ ...prev, resultWeight: res.toFixed(4) }));
    } else {
      setForm((prev) => ({ ...prev, resultWeight: "" }));
    }
  }, [form.weighedQuantity, form.weighedWeight]);

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

      const matNo = res.data.MATERIAL_NO || "";
      const desc = res.data.ITEM_DESCRIPTION || "";
      let sysWeight: number | null = null;

      if (matNo) {
        try {
          const limitRes = await apiClient.get(`/mes/measure-limits/${matNo}`);
          sysWeight = limitRes.data.weight_50cm || null;
        } catch (err) {
          console.log("Zincir limitleri çekilemedi:", err);
        }
      }

      setForm((prev) => ({
        orderId: prev.orderId,
        goldSetting: numericCarat,
        entryGramage: 0,
        exitGramage: 0,
        gold_pure_scrap: 0,
        diffirence: 0,
        weighedQuantity: "",
        weighedWeight: "",
        resultWeight: "",
      }));

      setOrderInfo({
        materialNo: matNo,
        description: desc,
        systemWeight: sysWeight,
      });

      toast.success("Sipariş bilgileri getirildi.");
      await fetchHistory(form.orderId);
    } catch (error) {
      console.log(error);
      toast.error("Sipariş bulunamadı veya bir hata oluştu.");
      setOrderInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.orderId) {
      toast.error("Lütfen önce geçerli bir sipariş barkodu okutunuz.");
      return;
    }

    const weighedQty = parseInt(form.weighedQuantity);
    const weighedWt = parseFloat(form.weighedWeight);
    if (isNaN(weighedQty) || weighedQty <= 0 || isNaN(weighedWt) || weighedWt <= 0) {
      toast.error("Lütfen Tartılan Adet ve Tartılan Gram alanlarını sıfırdan büyük olacak şekilde doldurunuz.");
      return;
    }

    setLoading(true);
    try {
      const payloadFormState = {
        ...form,
        weighedQuantity: weighedQty,
        weighedWeight: weighedWt,
        resultWeight: form.resultWeight
      };

      if (selectedId) {
        await apiClient.put("/mes/scrap-measurements", {
          formState: payloadFormState,
          id: selectedId,
        });
        toast.success("Ölçüm güncellendi.");
      } else {
        await apiClient.post("/mes/scrap-measurements", {
          formState: payloadFormState,
          user_id: operatorId || user?.id_dec,
          areaName,
        });
        toast.success("Ölçüm kaydedildi.");
      }
      await fetchHistory(form.orderId);
      resetForm(false); // Sadece ölçüleri sıfırla, sipariş no ve geçmiş kalsın
    } catch (error) {
      toast.error("İşlem başarısız oldu.", { description: (error as any)?.message || "Bilinmeyen bir hata oluştu." });
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
      weighedQuantity: "",
      weighedWeight: "",
      resultWeight: "",
    }));
    setOrderInfo(null);
    if (full) {
      setHistory([]);
      setSelectedId(null);
    }
  };

  const handleEdit = async (item: ScrapMeasurement) => {
    setSelectedId(item.id);
    setForm({
      orderId: item.order_no,
      goldSetting: item.gold_setting,
      entryGramage: item.entry_measurement,
      exitGramage: item.exit_measurement,
      gold_pure_scrap: item.gold_pure_scrap,
      diffirence: item.measurement_diff,
      weighedQuantity: String(item.weighed_quantity ?? ""),
      weighedWeight: String(item.weighed_weight ?? ""),
      resultWeight: String(item.result_weight ?? ""),
    });

    // Edit modunda sipariş detaylarını göster
    try {
      const res = await apiClient.get(`/mes/order/${item.order_no}`);
      const matNo = res.data.MATERIAL_NO || "";
      const desc = res.data.ITEM_DESCRIPTION || "";
      let sysWeight: number | null = null;
      if (matNo) {
        try {
          const limitRes = await apiClient.get(`/mes/measure-limits/${matNo}`);
          sysWeight = limitRes.data.weight_50cm || null;
        } catch (err) {
          console.log("Zincir limitleri çekilemedi:", err);
        }
      }
      setOrderInfo({
        materialNo: matNo,
        description: desc,
        systemWeight: sysWeight,
      });
    } catch (err) {
      console.log(err);
      setOrderInfo(null);
    }
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
                {areaName === "taslama" ? "Veri Girişi" : "Fire Veri Girişi"}
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
              {orderInfo && (
                <div className="mt-3 p-4 bg-secondary/40 rounded-2xl border border-border space-y-2 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center gap-4">
                    <div className="text-xs font-mono font-black text-primary truncate">
                      {orderInfo.materialNo}
                    </div>
                    {orderInfo.systemWeight !== null && (
                      <div className="text-[10px] font-mono font-black text-foreground bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20 shrink-0">
                        Sistem Gramı: {orderInfo.systemWeight} g
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground leading-normal">
                    {orderInfo.description}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  Ayar
                </label>
                <input
                  type="number"
                  value={form.goldSetting}
                  disabled
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

            {/* Tartım Alanları */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  Tartılan Adet
                </label>
                <input
                  type="number"
                  value={form.weighedQuantity}
                  onChange={(e) =>
                    setForm({ ...form, weighedQuantity: e.target.value })
                  }
                  placeholder="0"
                  className="w-full bg-secondary/30 border border-border rounded-xl px-4 py-3 outline-none focus:border-primary transition-all font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  Tartılan Gram
                </label>
                <input
                  type="number"
                  value={form.weighedWeight}
                  onChange={(e) => {
                    const val = e.target.value.replace(",", ".");
                    setForm({ ...form, weighedWeight: val });
                  }}
                  placeholder="0.00"
                  className="w-full bg-secondary/30 border border-border rounded-xl px-4 py-3 outline-none focus:border-primary transition-all font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  Sonuç Gram
                </label>
                <div className="w-full bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 font-black text-primary text-sm h-12 flex items-center justify-center">
                  {form.resultWeight ? `${form.resultWeight} g` : "-"}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  Sistem Gramı
                </label>
                <div className="w-full bg-secondary/30 border border-border rounded-xl px-4 py-3 font-black text-foreground text-sm h-12 flex items-center justify-center">
                  {orderInfo && orderInfo.systemWeight !== null ? `${orderInfo.systemWeight} g` : "Tanımsız"}
                </div>
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
                  className=" transition-transform"
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

            <div className="flex-1 bg-secondary/20 rounded-3xl border border-border overflow-hidden flex flex-col min-h-100">
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
                          Sonuç Gram
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
                            <span className="text-xs font-mono font-bold text-foreground">
                              {item.result_weight ? `${item.result_weight} g` : "-"}
                            </span>
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
