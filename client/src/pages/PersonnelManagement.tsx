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
import { PageHeader } from "@/components/layout/PageHeader";
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
    <div className="flex flex-col h-[calc(100vh-140px)] lg:h-[calc(100vh-160px)] gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden">
      {/* Üst Başlık ve Aksiyonlar (SABİT) */}
      <div className="flex flex-col gap-6 shrink-0 border-b border-border/50 pb-4">
        <PageHeader 
          title="Personel Yönetimi"
          description="İşe alım, düzenleme ve personel arşivleme işlemlerini buradan yönetin."
          icon={Users}
          action={
            <>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  placeholder="Personel Ara..."
                  className="w-full pl-11 h-11 bg-muted/40 border border-border/50 rounded-xl focus:bg-card focus:border-primary/20 focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm outline-none text-foreground placeholder:text-muted-foreground shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Button
                onClick={() => {
                  setEditingPersonnel(null);
                  setShowModal(true);
                }}
                className="h-11 px-6 w-full sm:w-auto rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2 text-sm shrink-0"
              >
                <UserPlus size={20} />
                Yeni Ekle
              </Button>
            </>
          }
        />
      </div>

      {/* Personel Tablosu (KAYDIRILABİLİR) */}
      <div className="flex-1 min-h-0 bg-card border border-border rounded-2xl shadow-sm overflow-hidden overflow-x-auto overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse relative">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="bg-muted/30 border-b border-border shadow-sm">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Profil & İsim</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">ID Bilgisi</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Görev / Bölüm</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Rol</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Durum</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right whitespace-nowrap">İşlemler</th>
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
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary font-black text-sm shadow-inner group-hover:scale-110 transition-transform uppercase">
                        {p.name[0]}{p.surname[0]}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-foreground leading-none tracking-tight">
                          {p.name} {p.surname}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1 text-muted-foreground/70">
                          <Mail size={12} />
                          <span className="text-[10px] font-bold leading-none">{p.email || 'E-posta tanımlı değil'}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded">DEC</span>
                        <span className="text-xs font-black text-foreground tabular-nums tracking-wider">{p.id_dec}</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-60">
                        <span className="text-[9px] font-black bg-muted text-muted-foreground px-1.5 py-0.5 rounded">HEX</span>
                        <span className="text-[9px] font-black font-mono tracking-widest">{p.id_hex}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                        <Building2 size={14} className="text-primary/60" />
                        {p.Section?.name || 'Bölüm Yok'}
                      </div>
                      <div className="text-[10px] font-bold text-muted-foreground/60 ml-5 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-border" />
                        {p.Department?.name || 'Departman Yok'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-primary text-primary-foreground shadow-sm shadow-primary/20">
                      {p.Role?.name || 'Rol Atanmamış'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className={cn(
                          "text-xs font-black tracking-tight",
                          p.leave_balance > 0 ? "text-green-500" : "text-destructive"
                        )}>
                          {p.leave_balance} Gün İzin
                        </span>
                        {p.route && (
                          <span className="text-[9px] font-bold text-muted-foreground/60 mt-0.5">
                            {p.route} / {p.stop_name || '---'}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setDetailPersonnel(p);
                          setShowDetailModal(true);
                        }}
                        className="w-8 h-8 rounded-lg bg-muted/50 text-muted-foreground hover:bg-info hover:text-info-foreground transition-all active:scale-90 flex items-center justify-center shadow-sm cursor-pointer"
                        title="Görüntüle"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleEdit(p)}
                        className="w-8 h-8 rounded-lg bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all active:scale-90 flex items-center justify-center shadow-sm cursor-pointer"
                        title="Düzenle"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleSoftDelete(p.id_dec)}
                        className="w-8 h-8 rounded-lg bg-muted/50 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-all active:scale-90 flex items-center justify-center shadow-sm cursor-pointer"
                        title="Sil"
                      >
                        <Trash2 size={16} />
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

      {/* Kayıt Özeti (SABİT ALT BÖLÜM) */}
      <div className="flex justify-between items-center px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 shrink-0">
        <span>Sistemde toplam {filteredPersonnel.length} personel kaydı bulundu</span>
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Veritabanı ile senkronize
        </span>
      </div>
    </div>
  );
}
