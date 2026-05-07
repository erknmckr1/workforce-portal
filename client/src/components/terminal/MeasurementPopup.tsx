import React, { useState } from "react";
import { X, Save, Trash2, Search, History, Scale } from "lucide-react";
import { toast } from "sonner";
import apiClient from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { MeasurementRecord } from "../../types/mes";

interface MeasurementPopupProps {
  onClose: () => void;
  areaName: string;
  operatorId?: string;
}

const MeasurementPopup: React.FC<MeasurementPopupProps> = ({
  onClose,
  areaName,
  operatorId,
}) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<MeasurementRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [form, setForm] = useState({
    orderId: "",
    materialNo: "",
    entryMeasurement: "",
    exitMeasurement: "",
    entryWeight50cm: "",
    exitWeight50cm: "",
    quantity: "",
    description: "",
  });

  const [limits, setLimits] = useState<{
    lowerLimit: number;
    upperLimit: number;
    weight_50cm: number;
  } | null>(null);

  const isOutOfRange = React.useMemo(() => {
    if (!limits || !form.exitWeight50cm) return false;
    const val = parseFloat(form.exitWeight50cm);
    if (isNaN(val)) return false;
    return val < limits.lowerLimit || val > limits.upperLimit;
  }, [form.exitWeight50cm, limits]);

  const fetchHistory = async (materialNo: string) => {
    try {
      const res = await apiClient.get(
        `/mes/measurements?area_name=${areaName}&material_no=${materialNo}`,
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
      const matNo = res.data.MATERIAL_NO || "";
      const desc = res.data.ITEM_DESCRIPTION || "";

      setForm((prev) => ({
        ...prev,
        materialNo: matNo,
        description: desc,
      }));
      toast.success("Sipariş bilgileri getirildi.");
      if (matNo) {
        await fetchHistory(matNo);
        // Tolerans limitlerini çek
        try {
          const limitRes = await apiClient.get(`/mes/measure-limits/${matNo}`);
          setLimits(limitRes.data);
        } catch (err) {
          console.log(err);
          setLimits(null);
        }
      }
    } catch (error) {
      console.log(error);
      toast.error("Sipariş bulunamadı!");
      setForm((prev) => ({ ...prev, materialNo: "", description: "" }));
      setHistory([]);
      setLimits(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearchOrder();
    }
  };

  const handleSave = async () => {
    if (!form.orderId || !form.materialNo) {
      toast.error("Lütfen önce geçerli bir sipariş barkodu okutunuz.");
      return;
    }

    try {
      setLoading(true);
      await apiClient.post("/mes/measurements", {
        order_no: form.orderId,
        material_no: form.materialNo,
        operator: operatorId || user?.id_dec || "SYSTEM",
        area_name: areaName,
        entry_measurement: form.entryMeasurement,
        exit_measurement: form.exitMeasurement,
        entry_weight_50cm: parseFloat(form.entryWeight50cm) || 0,
        exit_weight_50cm: parseFloat(form.exitWeight50cm) || 0,
        measurement_package: parseFloat(form.quantity) || 0,
        description: form.description,
      });

      toast.success("Ölçüm başarıyla kaydedildi.");

      // Temizle
      setForm((prev) => ({
        ...prev,
        entryMeasurement: "",
        exitMeasurement: "",
        entryWeight50cm: "",
        exitWeight50cm: "",
        quantity: "",
      }));
      // Kayıttan sonra limitleri sıfırlamıyoruz çünkü aynı malzemeye devam edebilir,
      // ancak formu temizledik.

      await fetchHistory(form.materialNo);
    } catch (error) {
      console.log(error);
      toast.error("Kaydedilemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) {
      toast.error("Lütfen silmek için tablodan bir ölçüm seçin.");
      return;
    }

    try {
      setLoading(true);
      await apiClient.delete(`/mes/measurements/${selectedId}`);
      toast.success("Ölçüm silindi.");
      setSelectedId(null);
      await fetchHistory(form.materialNo);
    } catch (error) {
      toast.error("Silinemedi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-foreground/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl h-[90vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div className="flex-none p-6 border-b border-border bg-secondary/30 flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Scale size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-foreground">
                Ölçüm Veri Girişi
              </h2>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                {areaName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-xl transition-colors relative z-10"
          >
            <X size={24} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT: FORM */}
          <div className="w-full lg:w-1/3 p-6 border-r border-border bg-secondary/10 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
            {/* Barkod */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                SİPARİŞ BARKODU
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Siparişi Okutun..."
                  className="w-full h-12 pl-12 pr-4 bg-background border border-border rounded-xl font-mono text-sm uppercase focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm"
                  value={form.orderId}
                  onChange={(e) =>
                    setForm({ ...form, orderId: e.target.value.toUpperCase() })
                  }
                  onKeyDown={handleKeyDown}
                />
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </div>
              {form.materialNo && (
                <div className="mt-2 p-3 bg-secondary/30 rounded-lg border border-border">
                  <div className="text-xs font-mono font-bold text-primary">
                    {form.materialNo}
                  </div>
                  <div className="text-[10px] uppercase text-muted-foreground">
                    {form.description}
                  </div>
                </div>
              )}
            </div>

            {/* Ölçüler */}
            <div className="space-y-4 pt-4 border-t border-border/50">
              <h3 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Ölçü Bilgileri
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Giriş Ölçüsü (En x Boy)
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: 10x20"
                    className="w-full h-12 px-4 bg-background border border-border rounded-xl font-mono text-sm focus:ring-2 focus:ring-primary transition-all"
                    value={form.entryMeasurement}
                    onChange={(e) =>
                      setForm({ ...form, entryMeasurement: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Çıkış Ölçüsü (En x Boy)
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: 10x20"
                    className="w-full h-12 px-4 bg-background border border-border rounded-xl font-mono text-sm focus:ring-2 focus:ring-primary transition-all"
                    value={form.exitMeasurement}
                    onChange={(e) =>
                      setForm({ ...form, exitMeasurement: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Ağırlık */}
            <div className="space-y-4 pt-4 border-t border-border/50">
              <h3 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Ağırlık Bilgileri (50cm)
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Giriş Gramajı
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full h-12 px-4 bg-background border border-border rounded-xl font-mono text-sm focus:ring-2 focus:ring-primary transition-all"
                    value={form.entryWeight50cm}
                    onChange={(e) =>
                      setForm({ ...form, entryWeight50cm: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex justify-between">
                    <span>Çıkış Gramajı</span>
                    {limits && (
                      <span className="text-info tracking-normal text-[9px]">
                        Std: {limits.weight_50cm}g
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    className={`w-full h-12 px-4 bg-background border rounded-xl font-mono text-sm focus:ring-2 transition-all ${
                      isOutOfRange
                        ? "border-destructive text-destructive bg-destructive/5 focus:ring-destructive"
                        : "border-border focus:ring-primary"
                    }`}
                    value={form.exitWeight50cm}
                    onChange={(e) =>
                      setForm({ ...form, exitWeight50cm: e.target.value })
                    }
                  />
                  {limits && (
                    <div className="flex justify-between items-center text-[9px] font-bold text-muted-foreground mt-1">
                      <span>Min: {limits.lowerLimit}g</span>
                      <span>Max: {limits.upperLimit}g</span>
                    </div>
                  )}
                  {isOutOfRange && (
                    <div className="text-[10px] font-black text-destructive animate-pulse uppercase mt-1">
                      ⚠️ Tolerans Dışı!
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Miktar */}
            <div className="space-y-4 pt-4 border-t border-border/50">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Miktar / Adet
                </label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full h-12 px-4 bg-background border border-border rounded-xl font-mono text-sm focus:ring-2 focus:ring-primary transition-all"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                />
              </div>
            </div>

            {/* ACTIONS */}
            <div className="mt-auto pt-6 flex gap-3">
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Save size={18} />
                Kaydet
              </button>
            </div>
          </div>

          {/* RIGHT: TABLE */}
          <div className="flex-1 flex flex-col p-6 bg-background">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">
                    Önceki Ölçümler
                  </h3>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    Malzeme geçmişi
                  </p>
                </div>
              </div>
              <button
                onClick={handleDelete}
                disabled={!selectedId || loading}
                className="h-10 px-4 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              >
                <Trash2 size={16} />
                Seçiliyi Sil
              </button>
            </div>

            <div className="flex-1 bg-secondary/10 border border-border rounded-2xl overflow-hidden flex flex-col shadow-inner">
              <div className="grid grid-cols-6 gap-4 p-4 border-b border-border bg-secondary/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <div className="col-span-1">Operatör</div>
                <div className="col-span-1">Giriş Ölçü</div>
                <div className="col-span-1">Çıkış Ölçü</div>
                <div className="col-span-1">Gir. (50cm)</div>
                <div className="col-span-1">Çık. (50cm)</div>
                <div className="col-span-1">Tarih</div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {history.length > 0 ? (
                  history.map((row) => (
                    <div
                      key={row.id}
                      onClick={() =>
                        setSelectedId(row.id === selectedId ? null : row.id)
                      }
                      className={`grid grid-cols-6 gap-4 p-4 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
                        row.id === selectedId
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-background border border-border hover:border-primary/50 text-foreground"
                      }`}
                    >
                      <div className="col-span-1 flex items-center truncate opacity-80">
                        {row.operator}
                      </div>
                      <div className="col-span-1 flex items-center">
                        {row.entry_measurement || "-"}
                      </div>
                      <div className="col-span-1 flex items-center">
                        {row.exit_measurement || "-"}
                      </div>
                      <div className="col-span-1 flex items-center text-amber-500">
                        {row.entry_weight_50cm} g
                      </div>
                      <div className="col-span-1 flex items-center text-amber-500">
                        {row.exit_weight_50cm} g
                      </div>
                      <div className="col-span-1 flex items-center opacity-50">
                        {new Date(row.createdAt).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground/30 font-black uppercase tracking-widest text-sm flex-col gap-4">
                    <Scale size={48} className="opacity-20" />
                    Ölçüm Kaydı Yok
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeasurementPopup;
