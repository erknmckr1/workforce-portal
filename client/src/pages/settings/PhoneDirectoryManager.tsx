import { useState, useMemo, memo, useCallback, useEffect } from "react";
import { usePhoneDirectory, type PhoneEntry } from "@/hooks/usePhoneDirectory";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Phone,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Building2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/providers/ConfirmProvider";

// Row component memoized to prevent re-renders
const PhoneEntryRow = memo(({ entry, onEdit, onDelete }: { 
  entry: PhoneEntry; 
  onEdit: (e: PhoneEntry) => void; 
  onDelete: (id: number) => void;
}) => (
  <TableRow className="group hover:bg-muted/30 transition-colors">
    <TableCell className="font-black text-lg tracking-tighter py-4">
      {entry.number}
    </TableCell>
    <TableCell className="py-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/5 text-primary flex items-center justify-center shrink-0">
          <User size={14} />
        </div>
        <span className="font-bold">{entry.name}</span>
      </div>
    </TableCell>
    <TableCell className="py-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Building2 size={14} />
        <span className="text-[10px] font-black uppercase tracking-wider">{entry.department}</span>
      </div>
    </TableCell>
    <TableCell className="py-4 text-right">
      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(entry)}
          className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10"
        >
          <Pencil size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => entry.id && onDelete(entry.id)}
          className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </TableCell>
  </TableRow>
));

PhoneEntryRow.displayName = "PhoneEntryRow";

// Separate Form component to isolate state updates while typing
const PhoneEntryForm = ({ 
  entry, 
  onSubmit, 
  onCancel,
  isPending 
}: { 
  entry: PhoneEntry | null; 
  onSubmit: (data: PhoneEntry) => void; 
  onCancel: () => void;
  isPending: boolean;
}) => {
  const [formData, setFormData] = useState<PhoneEntry>({
    number: "",
    name: "",
    department: "",
  });

  useEffect(() => {
    if (entry) {
      setFormData(entry);
    } else {
      setFormData({ number: "", name: "", department: "" });
    }
  }, [entry]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-2">
        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Numara (Dahili/Mobil)</label>
        <Input
          required
          placeholder="Örn: 101 veya 0530..."
          value={formData.number}
          onChange={(e) => setFormData({ ...formData, number: e.target.value })}
          className="rounded-xl h-12"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">İsim / Yer</label>
        <Input
          required
          placeholder="Örn: Ahmet Yılmaz veya Toplantı Odası"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="rounded-xl h-12"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Bölüm</label>
        <Input
          required
          placeholder="Örn: ÜRETİM, BİLGİ İŞLEM..."
          value={formData.department}
          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
          className="rounded-xl h-12"
        />
      </div>
      <DialogFooter className="pt-4 gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl h-12 font-bold uppercase tracking-widest">
           İptal
        </Button>
        <Button type="submit" disabled={isPending} className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-primary/20">
          {isPending ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            entry ? "Güncelle" : "Kaydet"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default function PhoneDirectoryManager() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const { directoryQuery, createMutation, updateMutation, deleteMutation } = usePhoneDirectory(debouncedSearch);
  const { confirm } = useConfirm();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PhoneEntry | null>(null);

  const handleOpenDialog = useCallback((entry?: PhoneEntry) => {
    setEditingEntry(entry || null);
    setIsDialogOpen(true);
  }, []);

  const handleFormSubmit = async (formData: PhoneEntry) => {
    try {
      if (editingEntry?.id) {
        await updateMutation.mutateAsync({ id: editingEntry.id, data: formData });
        toast.success("Kayıt başarıyla güncellendi.");
      } else {
        await createMutation.mutateAsync(formData);
        toast.success("Yeni kayıt oluşturuldu.");
      }
      setIsDialogOpen(false);
    } catch {
      toast.error("İşlem sırasında bir hata oluştu.");
    }
  };

  const handleDelete = useCallback(async (id: number) => {
    const isConfirmed = await confirm({
      title: "Kaydı Sil",
      description: "Bu telefon kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
      confirmText: "Sil",
      variant: "destructive",
    });

    if (isConfirmed) {
      try {
        await deleteMutation.mutateAsync(id);
        toast.success("Kayıt silindi.");
      } catch {
        toast.error("Silme işlemi sırasında bir hata oluştu.");
      }
    }
  }, [confirm, deleteMutation]);

  // Memoize the table body to avoid re-rendering rows when modal opens/closes
  const tableContent = useMemo(() => {
    if (directoryQuery.isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={4} className="h-64 text-center">
            <Loader2 className="animate-spin mx-auto text-primary" size={32} />
          </TableCell>
        </TableRow>
      );
    }

    if (directoryQuery.data?.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={4} className="h-64 text-center text-muted-foreground font-medium italic">
            Kayıt bulunamadı.
          </TableCell>
        </TableRow>
      );
    }

    return directoryQuery.data?.map((entry) => (
      <PhoneEntryRow 
        key={entry.id} 
        entry={entry} 
        onEdit={handleOpenDialog} 
        onDelete={handleDelete} 
      />
    ));
  }, [directoryQuery.isLoading, directoryQuery.data, handleOpenDialog, handleDelete]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Phone className="text-primary" size={24} />
            Telefon Rehberi Yönetimi
          </h2>
          <p className="text-muted-foreground text-sm font-medium">
            Sistemdeki dahili numaraları ekleyin, düzenleyin veya silin.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
            <Input
              placeholder="Ara..."
              className="pl-9 h-10 w-64 rounded-xl bg-card border-border shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="rounded-xl h-10 font-bold gap-2 shadow-lg shadow-primary/20">
                <Plus size={18} />
                Yeni Kayıt
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">
                  {editingEntry ? "Kaydı Düzenle" : "Yeni Telefon Kaydı"}
                </DialogTitle>
                <DialogDescription>
                   Lütfen aşağıdakı alanları doldurarak kaydı tamamlayın.
                </DialogDescription>
              </DialogHeader>
              
              <PhoneEntryForm 
                entry={editingEntry}
                isPending={createMutation.isPending || updateMutation.isPending}
                onSubmit={handleFormSubmit}
                onCancel={() => setIsDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-xl shadow-border/5">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 pl-6">Numara</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest py-4">İsim / Açıklama</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest py-4">Bölüm</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 text-right pr-6">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableContent}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
