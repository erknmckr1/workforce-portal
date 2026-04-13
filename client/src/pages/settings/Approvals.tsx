import { ShieldCheck, Building2, GitMerge, Loader2, Search } from "lucide-react";
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
    setLocalValue(val); // UI anında güncellensin
    onChange(val);      // Mutasyon arkada başlasın
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
        "h-10 w-64 rounded-lg font-bold border-border/40 bg-muted/10 transition-all gap-3 shrink-0",
        !localValue && "border-destructive/20 bg-destructive/5 text-destructive",
        localValue && "border-primary/10 bg-primary/5",
        disabled && "opacity-80"
      )}>
        <div className="flex-1 flex items-center gap-2 overflow-hidden text-left">
          {disabled && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
          <div className="truncate text-sm">
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
      <SelectContent className="rounded-2xl shadow-xl max-h-[400px] w-64 min-w-[250px]">
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

const SectionRow = memo(({ section, personnel, onAssign, isPending }: {
  section: LookupSection,
  count?: number,
  personnel: Personnel[],
  onAssign: (id: number, val: string) => void,
  isPending: boolean
}) => {
  return (
    <div className="group relative flex items-center justify-between gap-4 px-5 py-3 h-16 rounded-xl border border-border/40 bg-card/60 hover:bg-card hover:border-primary/20 transition-all">
      <div className="flex-1 flex items-center gap-3">
        <span className="text-sm font-extrabold text-foreground flex items-center gap-2">
          {section.name}
          {!section.manager_id && (
            <span className="flex h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" title="Atama Bekliyor"></span>
          )}
        </span>
      </div>
      <div className="shrink-0">
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

const DepartmentRow = memo(({ dept, sectionName, personnel, onAssign, isPending }: {
  dept: LookupDepartment,
  count?: number,
  sectionName: string,
  personnel: Personnel[],
  onAssign: (id: number, val: string) => void,
  isPending: boolean
}) => {
  return (
    <div className="group relative flex items-center justify-between gap-4 px-5 py-3 h-16 ml-6 rounded-xl border border-border/40 bg-card/40 hover:bg-card hover:border-primary/20 transition-all ">
      <div className="flex-1 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-extrabold text-foreground flex items-center gap-2 leading-none">
          {dept.name}
          {!dept.supervisor_id && (
            <span className="flex h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" title="Atama Bekliyor"></span>
          )}
        </span>
        <span className="text-[11px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
          <Building2 size={12} /> {sectionName}
        </span>
      </div>
      <div className="shrink-0">
        <ApproverSelect
          value={dept.supervisor_id || undefined}
          onChange={(val: string) => onAssign(Number(dept.id), val)}
          disabled={isPending}
          personnel={personnel}
          placeholder="Şef Ata..."
        />
      </div>
    </div>
  );
});

export default function Approvals() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const { data: lookups, isLoading: lookupsLoading, refetch: refetchLookups } = useLookups();
  const {
    data: personnelResponse,
    isLoading: personnelLoading,
    updateSectionManagerMutation,
    updateDepartmentSupervisorMutation,
    syncApprovalsMutation
  } = usePersonnel(1, 200, "", true);

  const personnel = useMemo(() => personnelResponse?.data || [], [personnelResponse]);

  const { sectionMap, sections, departments, eligibleApprovers } = useMemo(() => {
    const sMap = new Map<number, string>();
    const rMap = new Map<number, string>();
    const sArray = lookups?.sections || [];
    const dArray = lookups?.departments || [];
    const rArray = lookups?.roles || [];
    const actData = personnel.filter(p => Number(p.is_active) === 1);

    sArray.forEach(s => sMap.set(Number(s.id), s.name));
    rArray.forEach(r => rMap.set(Number(r.id), r.name));

    const allowedRolesRegex = /^(şef|müdür|admin|test)$/i;
    const approvers = actData.filter(p => {
      const rn = rMap.get(p.role_id) || "";
      return allowedRolesRegex.test(rn);
    });

    return { sectionMap: sMap, roleMap: rMap, sections: sArray, departments: dArray, eligibleApprovers: approvers };
  }, [lookups, personnel]);

  const filteredSections = useMemo(() => {
    if (!debouncedSearchTerm) return sections;
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return sections.filter(s => s.name.toLowerCase().includes(lowerSearch));
  }, [sections, debouncedSearchTerm]);

  const filteredDepartments = useMemo(() => {
    if (!debouncedSearchTerm) return departments;
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return departments.filter(d => d.name.toLowerCase().includes(lowerSearch));
  }, [departments, debouncedSearchTerm]);

  const getSectionName = useCallback((secId: number) => sectionMap.get(secId) || "Bölüm Belirtilmemiş", [sectionMap]);

  const handleSectionAssign = useCallback((id: number, manager_id: string) => {
    updateSectionManagerMutation.mutate({ id, manager_id }, {
      onSuccess: async () => {
        await refetchLookups();
        toast.success("Bölüm Yöneticisi atandı ve izin hiyerarşisi güncellendi.");
      }
    });
  }, [updateSectionManagerMutation, refetchLookups]);

  const handleDepartmentAssign = useCallback((id: number, supervisor_id: string) => {
    updateDepartmentSupervisorMutation.mutate({ id, supervisor_id }, {
      onSuccess: async () => {
        await refetchLookups();
        toast.success("Birim Sorumlusu atandı ve izin hiyerarşisi güncellendi.");
      }
    });
  }, [updateDepartmentSupervisorMutation, refetchLookups]);

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
            Onay Hiyerarşisi
          </h3>
          <p className="text-muted-foreground font-medium mt-2 text-sm max-w-xl">
            Sistem genelinde izin işleyişinin sorunsuz devam etmesi için Bölüm (Section) ve Birim (Part) sorumlularını atayın. Değişiklikler anında kaydedilir.
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
        <div className="flex flex-col gap-5">
          <h4 className="font-black text-xl flex items-center gap-3 text-foreground bg-muted/30 p-4 rounded-3xl border border-border/50">
            <div className="w-10 h-10 rounded-[1rem] bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Building2 size={20} />
            </div>
            <div>
              Bölüm Yöneticileri {filteredSections.length !== sections.length && <span className="ml-2 text-sm text-primary">({filteredSections.length} sonuç)</span>}
              <span className="block text-[11px] text-muted-foreground font-bold tracking-widest uppercase mt-0.5">2. Aşama Onaycılar (Manager)</span>
            </div>
          </h4>

          <div className="space-y-4">
            {filteredSections.map((section) => (
              <SectionRow
                key={section.id}
                section={section}
                personnel={eligibleApprovers}
                onAssign={handleSectionAssign}
                isPending={updateSectionManagerMutation.isPending}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <h4 className="font-black text-xl flex items-center gap-3 text-foreground bg-muted/30 p-4 rounded-3xl border border-border/50">
            <div className="w-10 h-10 rounded-[1rem] bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <GitMerge size={20} />
            </div>
            <div>
              Birim Sorumluları {filteredDepartments.length !== departments.length && <span className="ml-2 text-sm text-primary">({filteredDepartments.length} sonuç)</span>}
              <span className="block text-[11px] text-muted-foreground font-bold tracking-widest uppercase mt-0.5">1. Aşama Onaycılar (Supervisor)</span>
            </div>
          </h4>

          <div className="space-y-4">
            {filteredDepartments.map((dept) => (
              <DepartmentRow
                key={dept.id}
                dept={dept}
                sectionName={getSectionName(Number(dept.id))}
                personnel={eligibleApprovers}
                onAssign={handleDepartmentAssign}
                isPending={updateDepartmentSupervisorMutation.isPending}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DebouncedSearchInput({ value: initialValue, onChange, placeholder, className }: { value: string; onChange: (val: string) => void; placeholder?: string; className?: string; }) {
  const [localValue, setLocalValue] = useState(initialValue);
  const debouncedValue = useDebounce(localValue, 500);
  useEffect(() => { onChange(debouncedValue); }, [debouncedValue, onChange]);
  return <Input value={localValue} onChange={(e) => setLocalValue(e.target.value)} placeholder={placeholder} className={className} />;
}
