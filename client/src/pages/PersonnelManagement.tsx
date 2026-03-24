import { useState } from "react";
import {
  Users,
  Search,
  Edit2,
  Trash2,
  UserPlus,
  Mail,
  Building2,
  Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { useLookups } from "@/hooks/useLookups";
import { usePersonnel, type Personnel } from "@/hooks/usePersonnel";
import { PersonnelFormModal } from "@/components/personnel/PersonnelFormModal";
import { PersonnelDetailModal } from "@/components/personnel/PersonnelDetailModal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function PersonnelManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
  const [detailPersonnel, setDetailPersonnel] = useState<Personnel | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  const { data: lookups = { roles: [], sections: [], departments: [], titles: [] } } = useLookups();
  const { data: personnel = [], isLoading: loading, createMutation, updateMutation, deleteMutation } = usePersonnel();

  const handleEdit = (p: Personnel) => {
    setEditingPersonnel(p);
    setShowModal(true);
  };

  const handleFormSubmit = async (formData: Partial<Personnel> & { password?: string }) => {
    try {
      if (editingPersonnel) {
        await updateMutation.mutateAsync({ id: editingPersonnel.id_dec, data: formData });
        toast.success("Personel güncellendi.");
      } else {
        await createMutation.mutateAsync(formData);
        toast.success("Yeni personel oluşturuldu.");
      }
      setShowModal(false);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Bir hata oluştu.");
    }
  };

  const handleSoftDelete = (id: string) => {
    setConfirmModal({ isOpen: true, id });
  };

  const executeDelete = async () => {
    if (!confirmModal.id) return;

    try {
      await deleteMutation.mutateAsync(confirmModal.id);
      toast.success("Personel pasif duruma getirildi.");
    } catch {
      toast.error("İşlem başarısız.");
    } finally {
      setConfirmModal({ isOpen: false, id: null });
    }
  };

  const filteredPersonnel = personnel.filter(p => {
    const term = searchTerm.toLowerCase();
    return (
      `${p.name} ${p.surname}`.toLowerCase().includes(term) ||
      p.id_dec.includes(term) ||
      (p.Section?.name || '').toLowerCase().includes(term) ||
      (p.Department?.name || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Üst Başlık ve Aksiyonlar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-foreground flex items-center gap-3">
            <Users className="text-primary" size={40} />
            Personel Yönetimi
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            İşe alım, düzenleme ve personel arşivleme işlemlerini buradan yönetin.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              placeholder="Personel Ara..."
              className="w-full pl-14 h-14 bg-muted/40 border border-border/50 rounded-[1.25rem] focus:bg-card focus:border-primary/20 focus:ring-4 focus:ring-primary/10 transition-all font-bold text-base outline-none text-foreground placeholder:text-muted-foreground shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Button
            onClick={() => {
              setEditingPersonnel(null);
              setShowModal(true);
            }}
            className="h-14 px-8 w-full sm:w-auto rounded-[1.25rem] bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center gap-3 text-lg shrink-0"
          >
            <UserPlus size={24} />
            Yeni Ekle
          </Button>
        </div>
      </div>

      {/* Personel Tablosu */}
      <div className="bg-card border border-border rounded-[2.5rem] shadow-sm overflow-hidden overflow-x-auto max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse relative">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="bg-muted/30 border-b border-border shadow-sm">
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Profil & İsim</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">ID Bilgisi</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Görev / Bölüm</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Rol</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Durum</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right whitespace-nowrap">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-8 py-32 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-[6px] border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-muted-foreground font-black text-xl tracking-tighter">Personel listesi hazırlanıyor...</span>
                  </div>
                </td>
              </tr>
            ) : filteredPersonnel.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-8 py-32 text-center text-muted-foreground font-bold italic text-lg">
                  Kriterlere uygun personel bulunamadı.
                </td>
              </tr>
            ) : (
              filteredPersonnel.map((p) => (
                <tr key={p.id_dec} className="group hover:bg-muted/20 transition-all duration-300">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary font-black text-xl shadow-inner group-hover:scale-110 transition-transform uppercase">
                        {p.name[0]}{p.surname[0]}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-base font-black text-foreground leading-none tracking-tight">
                          {p.name} {p.surname}
                        </span>
                        <div className="flex items-center gap-2 mt-2 text-muted-foreground/70">
                          <Mail size={14} />
                          <span className="text-xs font-bold leading-none">{p.email || 'E-posta tanımlı değil'}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black bg-primary/10 text-primary px-2 py-0.5 rounded-md">DEC</span>
                        <span className="text-sm font-black text-foreground tabular-nums tracking-wider">{p.id_dec}</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-60">
                        <span className="text-[10px] font-black bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md">HEX</span>
                        <span className="text-[10px] font-black font-mono tracking-widest">{p.id_hex}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <Building2 size={16} className="text-primary/60" />
                        {p.Section?.name || 'Bölüm Yok'}
                      </div>
                      <div className="text-[11px] font-bold text-muted-foreground/60 ml-6 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-border" />
                        {p.Department?.name || 'Departman Yok'}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="inline-flex items-center px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                      {p.Role?.name || 'Rol Atanmamış'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className={cn(
                          "text-sm font-black tracking-tight",
                          p.leave_balance > 0 ? "text-green-500" : "text-destructive"
                        )}>
                          {p.leave_balance} Gün İzin
                        </span>
                        {p.route && (
                          <span className="text-[10px] font-bold text-muted-foreground/60 mt-0.5">
                            {p.route} / {p.stop_name || '---'}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => {
                          setDetailPersonnel(p);
                          setShowDetailModal(true);
                        }}
                        className="w-10 h-10 rounded-xl bg-muted/50 text-muted-foreground hover:bg-info hover:text-info-foreground transition-all active:scale-90 flex items-center justify-center shadow-sm cursor-pointer"
                        title="Görüntüle"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleEdit(p)}
                        className="w-10 h-10 rounded-xl bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all active:scale-90 flex items-center justify-center shadow-sm cursor-pointer"
                        title="Düzenle"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleSoftDelete(p.id_dec)}
                        className="w-10 h-10 rounded-xl bg-muted/50 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-all active:scale-90 flex items-center justify-center shadow-sm cursor-pointer"
                        title="Sil"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PERSONNEL FORM MODAL */}
      <PersonnelFormModal
        open={showModal}
        onOpenChange={setShowModal}
        editingPersonnel={editingPersonnel}
        lookups={lookups}
        onSubmit={handleFormSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* PERSONNEL DETAIL MODAL */}
      <PersonnelDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        personnel={detailPersonnel}
      />

      {/* CONFIRM DELETE MODAL */}
      <ConfirmDialog 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, id: null })}
        onConfirm={executeDelete}
        title="Personeli Pasife Al"
        description="Bu personeli pasif duruma getirmek istediğinize emin misiniz? Kayıt sistemden tamamen silinmez ancak tüm erişimleri kısıtlanır."
        confirmText="Evet, Pasife Al"
        cancelText="Vazgeç"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />

      {/* Kayıt Özeti */}
      <div className="flex justify-between items-center px-8 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
        <span>Sistemde toplam {filteredPersonnel.length} personel kaydı bulundu</span>
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Veritabanı ile senkronize
        </span>
      </div>
    </div>
  );
}
