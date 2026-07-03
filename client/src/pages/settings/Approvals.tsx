import { ShieldCheck, Building2, GitMerge, Loader2, Search, UserRoundX, Plus, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo, useEffect, memo, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePersonnel } from "@/hooks/usePersonnel";
import type { Personnel } from "@/hooks/usePersonnel";
import { useLookups } from "@/hooks/useLookups";
import type { LookupSection, LookupDepartment } from "@/hooks/useLookups";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const CLEAR_APPROVER_VALUE = "__clear_approver__";

const ApproverSelect = memo(function ApproverSelect({ value, onChange, disabled, personnel, placeholder }: {
  value: string | undefined,
  onChange: (v: string) => void,
  disabled: boolean,
  personnel: Personnel[],
  placeholder: string
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [localValue, setLocalValue] = useState(value);

  // Prop'tan gelen veri değiştikçe yerel state'i güncelle (Senkronizasyon)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSelect = (val: string) => {
    const nextValue = val === CLEAR_APPROVER_VALUE ? "" : val;
    setLocalValue(nextValue); // UI anında güncellensin
    onChange(nextValue);      // Mutasyon arkada başlasın
  };

  const selectedName = useMemo(() => {
    if (!localValue) return null;
    const p = personnel.find(x => x.id_dec === localValue);
    return p ? `${p.name} ${p.surname}` : null;
  }, [localValue, personnel]);

  // Arama sonucuna göre sadece eşleşenleri filtrele (Performans için memoize)
  const filteredApprovers = useMemo(() => {
    if (!search.trim()) return personnel.slice(0, 50); // İlk açıldığında listeyi boğmamak için sadece 50 kişi
    const lower = search.toLowerCase();
    return personnel.filter(p =>
      p.name.toLowerCase().includes(lower) ||
      p.surname.toLowerCase().includes(lower) ||
      p.id_dec.toLowerCase().includes(lower)
    ).slice(0, 50); // Arama sonuçlarında da performansı koru
  }, [personnel, search]);


  return (
    <Select
      value={localValue || ""}
      onValueChange={handleSelect}
      disabled={disabled}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) setSearch("");
      }}
    >
      <SelectTrigger className={cn(
        "h-9 w-52 rounded-lg font-bold border-border/40 bg-muted/10 transition-all gap-2 shrink-0 text-xs",
        !localValue && "border-destructive/20 bg-destructive/5 text-destructive",
        localValue && "border-primary/10 bg-primary/5",
        disabled && "opacity-80"
      )}>
        <div className="flex-1 flex items-center gap-2 overflow-hidden text-left">
          {disabled && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
          <div className="truncate text-[13px]">
            {selectedName ? (
              <span className="text-foreground">{selectedName}</span>
            ) : (
              <span className="text-muted-foreground opacity-50">{placeholder}</span>
            )}
            {/* Radix UI için gizli tetikleyici */}
            <div className="hidden">
              <SelectValue />
            </div>
          </div>
        </div>
      </SelectTrigger>
      <SelectContent className="rounded-2xl shadow-xl max-h-100 w-52 min-w-50">
        {/* Sabit Arama Kutusu */}
        <div className="sticky top-0 z-10 bg-popover p-2 border-b border-border/50 shadow-sm">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input
              placeholder="İsim, Soyisim veya DEC Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              // Select'in klavye olaylarını engellememesi için:
              onKeyDown={(e) => e.stopPropagation()}
              className="pl-8 h-9 text-xs rounded-lg bg-muted/30 border-none focus-visible:ring-primary/40"
            />
          </div>
        </div>

        <div className="p-1">
          <SelectItem value={CLEAR_APPROVER_VALUE} className="py-3 cursor-pointer rounded-xl text-destructive focus:text-destructive">
            <div className="flex items-center gap-2 font-extrabold">
              <UserRoundX size={15} />
              Atamayı kaldır / Boş bırak
            </div>
          </SelectItem>
          {/* PERFORMANS: Liste sadece dropdown açıkken render edilir, donmayı önleyen asıl hamle budur. */}
          {open && (filteredApprovers.length > 0 ? (
            filteredApprovers.map((p) => (
              <SelectItem key={p.id_dec} value={p.id_dec} className="py-3 cursor-pointer rounded-xl hover:bg-primary/5">
                <div className="flex flex-col text-left">
                  <span className="font-extrabold text-foreground">{p.name} {p.surname}</span>
                </div>
              </SelectItem>
            ))
          ) : open && (
            <div className="py-6 text-center text-xs font-bold text-muted-foreground opacity-60 italic">
              Sonuç bulunamadı...
            </div>
          ))}
          {!open && (
            <div className="py-2 text-center text-[10px] text-muted-foreground opacity-30 animate-pulse">
              Yükleniyor...
            </div>
          )}
        </div>
      </SelectContent>
    </Select>
  );
});

const SectionRow = memo(({ section, personnel, onAssign, onSelect, isSelected, isPending, onEdit }: {
  section: LookupSection,
  count?: number,
  personnel: Personnel[],
  onAssign: (id: number, val: string) => void,
  onSelect: (id: number) => void,
  isSelected: boolean,
  isPending: boolean,
  onEdit: (sec: LookupSection) => void
}) => {
  return (
    <div
      onClick={() => onSelect(Number(section.id))}
      className={cn(
        "group relative flex items-center justify-between gap-3 px-4 py-2 h-13 rounded-xl border border-border/30 bg-card/50 hover:bg-card hover:border-primary/20 transition-all cursor-pointer",
        isSelected && "bg-blue-500/5 border-blue-500/20 shadow-sm"
      )}
    >
      <div className="flex-1 flex items-center gap-2.5">
        <span className="text-sm font-extrabold text-foreground flex items-center gap-1.5 leading-none">
          {section.name}
          {!section.manager_id && (
            <span className="flex h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" title="Atama Bekliyor"></span>
          )}
          {section.is_active === false && (
            <span className="text-[9px] font-bold text-muted-foreground uppercase bg-muted/60 px-1 py-0.5 rounded leading-none">Pasif</span>
          )}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(section);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-all shrink-0"
          title="Bölümü Düzenle"
        >
          <Edit2 size={13} />
        </button>
      </div>
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <ApproverSelect
          value={section.manager_id || undefined}
          onChange={(val: string) => onAssign(Number(section.id), val)}
          disabled={isPending}
          personnel={personnel}
          placeholder="Müdür Ata..."
        />
      </div>
    </div>
  );
});

const DepartmentRow = memo(({ dept, sectionName, personnel, ustabasiPersonnel, onSupervisorAssign, onUstabasiAssign, isPending, onEdit }: {
  dept: LookupDepartment,
  count?: number,
  sectionName: string,
  personnel: Personnel[],
  ustabasiPersonnel: Personnel[],
  onSupervisorAssign: (id: number, val: string) => void,
  onUstabasiAssign: (id: number, val: string) => void,
  isPending: boolean,
  onEdit: (d: LookupDepartment) => void
}) => {
  return (
    <div className="group relative flex flex-col xl:flex-row xl:items-center justify-between gap-3 px-4 py-2 min-h-13 ml-4 rounded-xl border border-border/30 bg-card/30 hover:bg-card hover:border-primary/20 transition-all ">
      <div className="flex-1 flex items-center gap-2.5 flex-wrap">
        <span className="text-sm font-extrabold text-foreground flex items-center gap-1.5 leading-none">
          {dept.name}
          {(!dept.supervisor_id || !dept.ustabasi_id) && (
            <span className="flex h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" title="Atama Bekliyor"></span>
          )}
          {dept.is_active === false && (
            <span className="text-[9px] font-bold text-muted-foreground uppercase bg-muted/60 px-1 py-0.5 rounded leading-none">Pasif</span>
          )}
        </span>
        <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 leading-none">
          <Building2 size={11} /> {sectionName}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(dept);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-all shrink-0"
          title="Birimi Düzenle"
        >
          <Edit2 size={13} />
        </button>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ApproverSelect
          value={dept.ustabasi_id || undefined}
          onChange={(val: string) => onUstabasiAssign(Number(dept.id), val)}
          disabled={isPending}
          personnel={ustabasiPersonnel}
          placeholder="Ustabaşı..."
        />
        <ApproverSelect
          value={dept.supervisor_id || undefined}
          onChange={(val: string) => onSupervisorAssign(Number(dept.id), val)}
          disabled={isPending}
          personnel={personnel}
          placeholder="Yönetici..."
        />
      </div>
    </div>
  );
});

// --- SUB-COMPONENTS FOR HIGH-PERFORMANCE MODALS ---

interface AddSectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
  isPending: boolean;
}

const AddSectionModal = memo(function AddSectionModal({ open, onOpenChange, onSubmit, isPending }: AddSectionModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[2.5rem] p-8 border border-border/20 bg-card">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">Yeni Bölüm Ekle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Bölüm Adı</label>
            <Input
              placeholder="Örn: Buzlama"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-2xl h-14 bg-muted/40 border-none font-bold text-foreground focus-visible:ring-primary/30"
              required
            />
          </div>
          <DialogFooter className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-11">Vazgeç</Button>
            <Button type="submit" disabled={isPending} className="rounded-xl h-11 font-bold">
              {isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

interface EditSectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: number, name: string, is_active: boolean) => void;
  isPending: boolean;
  section: LookupSection | null;
}

const EditSectionModal = memo(function EditSectionModal({ open, onOpenChange, onSubmit, isPending, section }: EditSectionModalProps) {
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open && section) {
      setName(section.name);
      setIsActive(section.is_active !== false);
    }
  }, [open, section]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!section || !name.trim()) return;
    onSubmit(Number(section.id), name.trim(), isActive);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[2.5rem] p-8 border border-border/20 bg-card">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">Bölümü Düzenle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Bölüm Adı</label>
            <Input
              placeholder="Bölüm Adı"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-2xl h-14 bg-muted/40 border-none font-bold text-foreground focus-visible:ring-primary/30"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Durum</label>
            <Select
              value={isActive ? "true" : "false"}
              onValueChange={(val) => setIsActive(val === "true")}
            >
              <SelectTrigger className="w-full h-14 px-6 rounded-2xl bg-muted/40 border-none text-sm font-bold shadow-none p-0 flex items-center [&>span]:w-full [&>span]:text-left pl-6 focus:ring-0 text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-xl">
                <SelectItem value="true" className="font-bold py-3 cursor-pointer">Aktif</SelectItem>
                <SelectItem value="false" className="font-bold py-3 cursor-pointer">Pasif</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-11">Vazgeç</Button>
            <Button type="submit" disabled={isPending} className="rounded-xl h-11 font-bold">
              {isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

interface AddDeptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, sectionId: number) => void;
  isPending: boolean;
  sections: LookupSection[];
  defaultSectionId?: number | null;
}

const AddDeptModal = memo(function AddDeptModal({ open, onOpenChange, onSubmit, isPending, sections, defaultSectionId }: AddDeptModalProps) {
  const [name, setName] = useState("");
  const [sectionId, setSectionId] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setSectionId(defaultSectionId ? String(defaultSectionId) : "");
    }
  }, [open, defaultSectionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sectionId) return;
    onSubmit(name.trim(), Number(sectionId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[2.5rem] p-8 border border-border/20 bg-card">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">Yeni Birim Ekle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Birim Adı</label>
            <Input
              placeholder="Örn: CNC 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-2xl h-14 bg-muted/40 border-none font-bold text-foreground focus-visible:ring-primary/30"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Bağlı Olduğu Bölüm</label>
            <Select
              value={sectionId}
              onValueChange={setSectionId}
            >
              <SelectTrigger className="w-full h-14 px-6 rounded-2xl bg-muted/40 border-none text-sm font-bold shadow-none p-0 flex items-center [&>span]:w-full [&>span]:text-left pl-6 focus:ring-0 text-foreground">
                <SelectValue placeholder="Bölüm Seçin..." />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-xl">
                {sections.filter(s => s.is_active !== false).map((sec) => (
                  <SelectItem key={sec.id} value={String(sec.id)} className="font-bold py-3 cursor-pointer">
                    {sec.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-11">Vazgeç</Button>
            <Button type="submit" disabled={isPending} className="rounded-xl h-11 font-bold">
              {isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

interface EditDeptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: number, name: string, sectionId: number, is_active: boolean) => void;
  isPending: boolean;
  dept: LookupDepartment | null;
  sections: LookupSection[];
}

const EditDeptModal = memo(function EditDeptModal({ open, onOpenChange, onSubmit, isPending, dept, sections }: EditDeptModalProps) {
  const [name, setName] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open && dept) {
      setName(dept.name);
      setSectionId(dept.section_id ? String(dept.section_id) : "");
      setIsActive(dept.is_active !== false);
    }
  }, [open, dept]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dept || !name.trim() || !sectionId) return;
    onSubmit(Number(dept.id), name.trim(), Number(sectionId), isActive);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[2.5rem] p-8 border border-border/20 bg-card">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">Birimi Düzenle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Birim Adı</label>
            <Input
              placeholder="Birim Adı"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-2xl h-14 bg-muted/40 border-none font-bold text-foreground focus-visible:ring-primary/30"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Bağlı Olduğu Bölüm</label>
            <Select
              value={sectionId}
              onValueChange={setSectionId}
            >
              <SelectTrigger className="w-full h-14 px-6 rounded-2xl bg-muted/40 border-none text-sm font-bold shadow-none p-0 flex items-center [&>span]:w-full [&>span]:text-left pl-6 focus:ring-0 text-foreground">
                <SelectValue placeholder="Bölüm Seçin..." />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-xl">
                {sections.filter(s => s.is_active !== false || Number(s.id) === Number(dept?.section_id)).map((sec) => (
                  <SelectItem key={sec.id} value={String(sec.id)} className="font-bold py-3 cursor-pointer">
                    {sec.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Durum</label>
            <Select
              value={isActive ? "true" : "false"}
              onValueChange={(val) => setIsActive(val === "true")}
            >
              <SelectTrigger className="w-full h-14 px-6 rounded-2xl bg-muted/40 border-none text-sm font-bold shadow-none p-0 flex items-center [&>span]:w-full [&>span]:text-left pl-6 focus:ring-0 text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-xl">
                <SelectItem value="true" className="font-bold py-3 cursor-pointer">Aktif</SelectItem>
                <SelectItem value="false" className="font-bold py-3 cursor-pointer">Pasif</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-11">Vazgeç</Button>
            <Button type="submit" disabled={isPending} className="rounded-xl h-11 font-bold">
              {isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});


export default function Approvals() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const queryClient = useQueryClient();
  const { data: lookups, isLoading: lookupsLoading, refetch: refetchLookups } = useLookups();
  const {
    data: personnelResponse,
    isLoading: personnelLoading,
    updateSectionManagerMutation,
    updateDepartmentSupervisorMutation,
    updateDepartmentUstabasiMutation,
    syncApprovalsMutation
  } = usePersonnel(1, 200, "", true);

  // Modals state
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [isEditSectionOpen, setIsEditSectionOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<LookupSection | null>(null);

  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [isEditDeptOpen, setIsEditDeptOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<LookupDepartment | null>(null);

  const personnel = useMemo(() => personnelResponse?.data || [], [personnelResponse]);

  const { sectionMap, sections, departments, eligibleApprovers, ustabasiApprovers } = useMemo(() => {
    const sMap = new Map<number, string>();
    const rMap = new Map<number, string>();
    const sArray = lookups?.sections || [];
    const dArray = lookups?.departments || [];
    const rArray = lookups?.roles || [];
    const actData = personnel.filter(p => Number(p.is_active) === 1);

    sArray.forEach(s => sMap.set(Number(s.id), s.name));
    rArray.forEach(r => rMap.set(Number(r.id), r.name));

    const allowedRolesRegex = /^(yönetici|müdür|admin|test)$/i;
    const approvers = actData.filter(p => {
      const rn = rMap.get(p.role_id) || "";
      return allowedRolesRegex.test(rn);
    });
    const ustabasi = actData.filter(p => Number(p.role_id) === 9);

    return { sectionMap: sMap, roleMap: rMap, sections: sArray, departments: dArray, eligibleApprovers: approvers, ustabasiApprovers: ustabasi };
  }, [lookups, personnel]);

  const filteredSections = useMemo(() => {
    if (!debouncedSearchTerm) return sections;
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return sections.filter(s => s.name.toLowerCase().includes(lowerSearch));
  }, [sections, debouncedSearchTerm]);

  const filteredDepartments = useMemo(() => {
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return departments.filter(d => {
      const matchesSection = selectedSectionId ? Number(d.section_id) === selectedSectionId : true;
      const matchesSearch = debouncedSearchTerm ? d.name.toLowerCase().includes(lowerSearch) : true;
      return matchesSection && matchesSearch;
    });
  }, [departments, debouncedSearchTerm, selectedSectionId]);

  const getSectionName = useCallback((secId: number) => sectionMap.get(secId) || "Bölüm Belirtilmemiş", [sectionMap]);
  const getDepartmentSectionName = useCallback((dept: LookupDepartment) => {
    if (!dept.section_id) return "Bölüm Belirtilmemiş";
    return getSectionName(Number(dept.section_id));
  }, [getSectionName]);

  const selectedSectionName = useMemo(() => {
    if (!selectedSectionId) return null;
    return sectionMap.get(selectedSectionId) || null;
  }, [sectionMap, selectedSectionId]);

  const handleSectionFilter = useCallback((sectionId: number) => {
    setSelectedSectionId((current) => current === sectionId ? null : sectionId);
  }, []);

  // --- MUTATIONS ---
  const createSectionMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiClient.post("/personnel/sections", { name });
    },
    onSuccess: async () => {
      await refetchLookups();
      queryClient.invalidateQueries({ queryKey: ["lookups"] });
      toast.success("Bölüm başarıyla eklendi.");
      setIsAddSectionOpen(false);
    },
    onError: () => {
      toast.error("Bölüm eklenirken bir hata oluştu.");
    }
  });

  const updateSectionMutation = useMutation({
    mutationFn: async ({ id, name, is_active }: { id: number; name: string; is_active: boolean }) => {
      return apiClient.put(`/personnel/sections/${id}`, { name, is_active });
    },
    onSuccess: async () => {
      await refetchLookups();
      queryClient.invalidateQueries({ queryKey: ["lookups"] });
      toast.success("Bölüm güncellendi.");
      setIsEditSectionOpen(false);
      setEditingSection(null);
    },
    onError: () => {
      toast.error("Bölüm güncellenirken bir hata oluştu.");
    }
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async ({ name, section_id }: { name: string; section_id: number }) => {
      return apiClient.post("/personnel/departments", { name, section_id });
    },
    onSuccess: async () => {
      await refetchLookups();
      queryClient.invalidateQueries({ queryKey: ["lookups"] });
      toast.success("Birim başarıyla eklendi.");
      setIsAddDeptOpen(false);
    },
    onError: () => {
      toast.error("Birim eklenirken bir hata oluştu.");
    }
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, name, section_id, is_active }: { id: number; name: string; section_id: number; is_active: boolean }) => {
      return apiClient.put(`/personnel/departments/${id}`, { name, section_id, is_active });
    },
    onSuccess: async () => {
      await refetchLookups();
      queryClient.invalidateQueries({ queryKey: ["lookups"] });
      toast.success("Birim güncellendi.");
      setIsEditDeptOpen(false);
      setEditingDept(null);
    },
    onError: () => {
      toast.error("Birim güncellenirken bir hata oluştu.");
    }
  });

  // --- ACTIONS ---
  const handleSectionAssign = useCallback((id: number, manager_id: string) => {
    updateSectionManagerMutation.mutate({ id, manager_id }, {
      onSuccess: async () => {
        await refetchLookups();
        toast.success(manager_id
          ? "Bölüm yöneticisi atandı ve izin hiyerarşisi güncellendi."
          : "Bölüm yöneticisi kaldırıldı ve izin hiyerarşisi güncellendi.");
      }
    });
  }, [updateSectionManagerMutation, refetchLookups]);

  const handleDepartmentAssign = useCallback((id: number, supervisor_id: string) => {
    updateDepartmentSupervisorMutation.mutate({ id, supervisor_id }, {
      onSuccess: async () => {
        await refetchLookups();
        toast.success(supervisor_id
          ? "Birim sorumlusu atandı ve izin hiyerarşisi güncellendi."
          : "Birim sorumlusu kaldırıldı ve izin hiyerarşisi güncellendi.");
      }
    });
  }, [updateDepartmentSupervisorMutation, refetchLookups]);

  const handleDepartmentUstabasiAssign = useCallback((id: number, ustabasi_id: string) => {
    updateDepartmentUstabasiMutation.mutate({ id, ustabasi_id }, {
      onSuccess: async () => {
        await refetchLookups();
        toast.success(ustabasi_id
          ? "Birim ustabaşısı atandı."
          : "Birim ustabaşısı kaldırıldı.");
      }
    });
  }, [updateDepartmentUstabasiMutation, refetchLookups]);

  // Section Edit modal trigger
  const handleOpenEditSection = useCallback((sec: LookupSection) => {
    setEditingSection(sec);
    setIsEditSectionOpen(true);
  }, []);

  // Department Edit modal trigger
  const handleOpenEditDept = useCallback((d: LookupDepartment) => {
    setEditingDept(d);
    setIsEditDeptOpen(true);
  }, []);

  // Submit wrappers
  const handleAddSectionSubmit = useCallback((name: string) => {
    createSectionMutation.mutate(name);
  }, [createSectionMutation]);

  const handleEditSectionSubmit = useCallback((id: number, name: string, is_active: boolean) => {
    updateSectionMutation.mutate({ id, name, is_active });
  }, [updateSectionMutation]);

  const handleAddDeptSubmit = useCallback((name: string, section_id: number) => {
    createDepartmentMutation.mutate({ name, section_id });
  }, [createDepartmentMutation]);

  const handleEditDeptSubmit = useCallback((id: number, name: string, section_id: number, is_active: boolean) => {
    updateDepartmentMutation.mutate({ id, name, section_id, is_active });
  }, [updateDepartmentMutation]);


  if ((lookupsLoading || personnelLoading) && (!lookups || !personnel.length)) {
    return (
      <div className="flex flex-col items-center justify-center py-10 opacity-60">
        <Loader2 className="animate-spin text-primary mb-4" size={32} />
        <span className="text-sm font-bold text-foreground">Veriler Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 ">
      <div className="mb-8 border-b border-border/50 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-3xl font-black text-foreground flex items-center gap-3">
            <ShieldCheck className="text-primary" size={32} />
            Onay Hiyerarşisi & Organizasyon Yapısı
          </h3>
          <p className="text-muted-foreground font-medium mt-2 text-sm max-w-xl">
            Sistem genelinde Bölüm (Section) ve Birim (Part) tanımlarını oluşturun, düzenleyin ve bunların yetkili sorumlularını atayın.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
          <div className="relative w-full sm:w-64 xl:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <DebouncedSearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Bölüm, Birim veya Kişi Ara..."
              className="pl-10 h-12 rounded-xl border-border/50 bg-muted/20 focus-visible:ring-primary/50 text-foreground transition-all"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => syncApprovalsMutation.mutate(undefined, {
              onSuccess: () => toast.success("Tüm Yetkiler Başarıyla Senkronize Edildi!")
            })}
            disabled={syncApprovalsMutation.isPending}
            className="w-full sm:w-auto h-12 rounded-[1rem] font-bold border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all shrink-0"
          >
            {syncApprovalsMutation.isPending ? <Loader2 size={18} className="mr-2 animate-spin" /> : <ShieldCheck size={18} className="mr-2" />}
            Tüm Yetkileri Senkronize Et
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-12">
        {/* BÖLÜM PANELİ */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between bg-muted/30 p-4 rounded-3xl border border-border/50 flex-none">
            <h4 className="font-black text-xl flex items-center gap-3 text-foreground">
              <div className="w-10 h-10 rounded-[1rem] bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <Building2 size={20} />
              </div>
              <div>
                Bölüm Yöneticileri {filteredSections.length !== sections.length && <span className="ml-2 text-sm text-primary">({filteredSections.length} sonuç)</span>}
                <span className="block text-[11px] text-muted-foreground font-bold tracking-widest uppercase mt-0.5">2. Aşama Onaycılar (Manager)</span>
              </div>
            </h4>
            <Button
              onClick={() => setIsAddSectionOpen(true)}
              size="sm"
              className="h-10 px-4 rounded-xl font-bold flex items-center gap-1.5 shrink-0"
            >
              <Plus size={16} /> Bölüm Ekle
            </Button>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredSections.map((section) => (
              <SectionRow
                key={section.id}
                section={section}
                personnel={eligibleApprovers}
                onAssign={handleSectionAssign}
                onSelect={handleSectionFilter}
                isSelected={selectedSectionId === Number(section.id)}
                isPending={updateSectionManagerMutation.isPending}
                onEdit={handleOpenEditSection}
              />
            ))}
          </div>
        </div>

        {/* BİRİM PANELİ */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between bg-muted/30 p-4 rounded-3xl border border-border/50 flex-none">
            <h4 className="font-black text-xl flex items-center gap-3 text-foreground">
              <div className="w-10 h-10 rounded-[1rem] bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                <GitMerge size={20} />
              </div>
              <div className="flex-1">
                Birim Sorumluları {filteredDepartments.length !== departments.length && <span className="ml-2 text-sm text-primary">({filteredDepartments.length} sonuç)</span>}
                {selectedSectionName && <span className="ml-2 text-sm text-blue-500">({selectedSectionName})</span>}
                <span className="block text-[11px] text-muted-foreground font-bold tracking-widest uppercase mt-0.5">1. Aşama Onaycılar (Yönetici)</span>
              </div>
            </h4>
            <div className="flex items-center gap-2 shrink-0">
              {selectedSectionName && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSectionId(null)}
                  className="h-9 rounded-lg px-3 text-xs font-bold text-muted-foreground hover:text-foreground shrink-0"
                >
                  Tümü
                </Button>
              )}
              <Button
                onClick={() => setIsAddDeptOpen(true)}
                size="sm"
                className="h-10 px-4 rounded-xl font-bold flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-card shrink-0"
              >
                <Plus size={16} /> Birim Ekle
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredDepartments.map((dept) => (
              <DepartmentRow
                key={dept.id}
                dept={dept}
                sectionName={getDepartmentSectionName(dept)}
                personnel={eligibleApprovers}
                ustabasiPersonnel={ustabasiApprovers}
                onSupervisorAssign={handleDepartmentAssign}
                onUstabasiAssign={handleDepartmentUstabasiAssign}
                isPending={updateDepartmentSupervisorMutation.isPending || updateDepartmentUstabasiMutation.isPending}
                onEdit={handleOpenEditDept}
              />
            ))}
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      <AddSectionModal
        open={isAddSectionOpen}
        onOpenChange={setIsAddSectionOpen}
        onSubmit={handleAddSectionSubmit}
        isPending={createSectionMutation.isPending}
      />

      <EditSectionModal
        open={isEditSectionOpen}
        onOpenChange={setIsEditSectionOpen}
        onSubmit={handleEditSectionSubmit}
        isPending={updateSectionMutation.isPending}
        section={editingSection}
      />

      <AddDeptModal
        open={isAddDeptOpen}
        onOpenChange={setIsAddDeptOpen}
        onSubmit={handleAddDeptSubmit}
        isPending={createDepartmentMutation.isPending}
        sections={sections}
        defaultSectionId={selectedSectionId}
      />

      <EditDeptModal
        open={isEditDeptOpen}
        onOpenChange={setIsEditDeptOpen}
        onSubmit={handleEditDeptSubmit}
        isPending={updateDepartmentMutation.isPending}
        dept={editingDept}
        sections={sections}
      />
    </div>
  );
}

function DebouncedSearchInput({ value: initialValue, onChange, placeholder, className }: { value: string; onChange: (val: string) => void; placeholder?: string; className?: string; }) {
  const [localValue, setLocalValue] = useState(initialValue);
  const debouncedValue = useDebounce(localValue, 500);
  useEffect(() => { onChange(debouncedValue); }, [debouncedValue, onChange]);
  return <Input value={localValue} onChange={(e) => setLocalValue(e.target.value)} placeholder={placeholder} className={className} />;
}

