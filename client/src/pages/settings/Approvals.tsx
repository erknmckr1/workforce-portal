import { ShieldCheck, Building2, GitMerge, Users, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo, useDeferredValue, useEffect, memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { toast } from "sonner";

interface IPersonnel {
  id_dec: string;
  name: string;
  surname: string;
  role_id: number;
  section: number;
  department: number;
  is_active: number;
}

interface ISection {
  id: number;
  name: string;
  manager_id: string | null;
}

interface IDepartment {
  id: number;
  section_id: number;
  name: string;
  supervisor_id: string | null;
}

interface IRole {
  id: number;
  name: string;
}

// Yazı yazarken gecikmeyi önleyen (Input Lag / INP) izole bileşen
function DebouncedSearchInput({ value, onChange, placeholder, className }: { value: string, onChange: (val: string) => void, placeholder?: string, className?: string }) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, 150); // 150ms gecikmeli arama
    return () => clearTimeout(timer);
  }, [localValue, onChange]);

  return (
    <Input
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}

// Performans optimizasyonu: Binlerce SelectItem'ı sayfa yüklenişinde renderlamamak için Select'i açılınca dolduralım.
const ApproverSelect = memo(function ApproverSelect({ value, onChange, disabled, personnel, getRoleName, placeholder }: { value: string | undefined, onChange: (v: string) => void, disabled: boolean, personnel: IPersonnel[], getRoleName: (id: number) => string, placeholder: string }) {
  const [open, setOpen] = useState(false);
  const selectedPerson = value ? personnel.find((p) => p.id_dec === value) : null;

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled} onOpenChange={setOpen}>
      <SelectTrigger className={cn(
        "h-12 rounded-xl font-bold border-border/50 bg-muted/20 transition-all",
        !value && "border-destructive/30 bg-destructive/5 text-destructive",
        value && "border-primary/20 bg-primary/5"
      )}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-2xl shadow-xl max-h-80">
        <div className="flex flex-col gap-1 p-2">
          {personnel.map((p: IPersonnel) => (
            <SelectItem key={p.id_dec} value={p.id_dec} className="py-3 cursor-pointer rounded-xl">
              <div className="flex flex-col">
                <span className="font-extrabold text-foreground">{p.name} {p.surname}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{getRoleName(p.role_id)} • DEC: {p.id_dec}</span>
              </div>
            </SelectItem>
          ))}
        </div>
      </SelectContent>
    </Select>
  );
});

// React.memo ile sarmalanan List Satırları (Sadece kendi verileri değiştiğinde render edilir)
const SectionRow = memo(({ section, count, personnel, getRoleName, onAssign, isPending }: {
  section: ISection,
  count: number,
  personnel: IPersonnel[],
  getRoleName: (id: number) => string,
  onAssign: (id: number, val: string) => void,
  isPending: boolean
}) => {
  return (
    <div className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-[1.5rem] border border-border/50 bg-card  hover:shadow-lg hover:shadow-primary/5 transition-all">
      <div className="flex flex-col">
        <span className="text-lg font-black text-foreground flex items-center gap-2">
          {section.name}
          {!section.manager_id && (
            <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse" title="Atama Bekliyor"></span>
          )}
        </span>
        <span className="text-sm font-bold text-muted-foreground flex items-center gap-1.5 mt-1">
          <Users size={14} className="text-primary/60" /> {count} Personel
        </span>
      </div>
      <div className="w-full sm:w-64 shrink-0">
        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1.5 block ml-1">Bölüm Müdürü</label>
        <ApproverSelect
          value={section.manager_id || undefined}
          onChange={(val: string) => onAssign(section.id, val)}
          disabled={isPending}
          personnel={personnel}
          getRoleName={getRoleName}
          placeholder="Müdür Ata..."
        />
      </div>
    </div>
  );
});

const DepartmentRow = memo(({ dept, count, sectionName, personnel, getRoleName, onAssign, isPending }: {
  dept: IDepartment,
  count: number,
  sectionName: string,
  personnel: IPersonnel[],
  getRoleName: (id: number) => string,
  onAssign: (id: number, val: string) => void,
  isPending: boolean
}) => {
  return (
    <div className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-[1.5rem] border border-border/50 bg-card hover:shadow-lg hover:shadow-primary/5 transition-all">
      <div className="flex flex-col">
        <span className="text-lg font-black text-foreground flex items-center gap-2">
          {dept.name}
          {!dept.supervisor_id && (
            <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse" title="Atama Bekliyor"></span>
          )}
        </span>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[11px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
            <Building2 size={12} /> {sectionName}
          </span>
          <span className="text-sm font-bold text-muted-foreground flex items-center gap-1.5">
            <Users size={14} className="text-primary/60" /> {count} Personel
          </span>
        </div>
      </div>
      <div className="w-full sm:w-64 shrink-0">
        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1.5 block ml-1">Birim Şefi</label>
        <ApproverSelect
          value={dept.supervisor_id || undefined}
          onChange={(val: string) => onAssign(dept.id, val)}
          disabled={isPending}
          personnel={personnel}
          getRoleName={getRoleName}
          placeholder="Şef Ata..."
        />
      </div>
    </div>
  );
});

export default function Approvals() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // Veritabanından lookup'ları ve personelleri çek
  const { data: lookups, isLoading: lookupsLoading } = useQuery({
    queryKey: ["personnel-lookups"],
    queryFn: async () => {
      const { data } = await apiClient.get("/personnel/lookups");
      return data;
    }
  });

  const { data: personnel, isLoading: personnelLoading } = useQuery({
    queryKey: ["personnel-all"],
    queryFn: async () => {
      const { data } = await apiClient.get("/personnel");
      return data;
    }
  });

  // Mutasyonlar
  const sectionMutation = useMutation({
    mutationFn: async ({ id, manager_id }: { id: number; manager_id: string }) => {
      await apiClient.put(`/personnel/section-manager/${id}`, { manager_id });
    },
    onSuccess: () => {
      toast.success("Bölüm Yöneticisi atandı ve izin hiyerarşisi güncellendi.");
      queryClient.invalidateQueries({ queryKey: ["personnel-lookups"] });
      queryClient.invalidateQueries({ queryKey: ["lookups"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-all"] });
    },
    onError: () => toast.error("Atama sırasında hata oluştu!")
  });

  const departmentMutation = useMutation({
    mutationFn: async ({ id, supervisor_id }: { id: number; supervisor_id: string }) => {
      await apiClient.put(`/personnel/department-supervisor/${id}`, { supervisor_id });
    },
    onSuccess: () => {
      toast.success("Birim Sorumlusu atandı ve izin hiyerarşisi güncellendi.");
      queryClient.invalidateQueries({ queryKey: ["personnel-lookups"] });
      queryClient.invalidateQueries({ queryKey: ["lookups"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-all"] });
    },
    onError: () => toast.error("Atama sırasında hata oluştu!")
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/personnel/sync-approvals`);
    },
    onSuccess: () => {
      toast.success("Tüm Yetkiler Başarıyla Senkronize Edildi!");
      queryClient.invalidateQueries({ queryKey: ["personnel-all"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-lookups"] });
      queryClient.invalidateQueries({ queryKey: ["lookups"] });
    },
    onError: () => toast.error("Senkronizasyon işlemi başarısız oldu!")
  });

  // Personel sayılarını O(N) zamanda tek seferde (hızlıca) hesaplayıp cache'liyoruz
  const { sectionCounts, departmentCounts } = useMemo(() => {
    const sc: Record<number, number> = {};
    const dc: Record<number, number> = {};
    const act = (Array.isArray(personnel) ? personnel : []).filter((p: IPersonnel) => Number(p.is_active) === 1);
    act.forEach(p => {
      const s = Number(p.section);
      const d = Number(p.department);
      if (s) sc[s] = (sc[s] || 0) + 1;
      if (d) dc[d] = (dc[d] || 0) + 1;
    });
    return { sectionCounts: sc, departmentCounts: dc };
  }, [personnel]);

  // Hızlı Erişim için Map (Sözlük) Objeleri (O(1) Karmaşıklık)
  const { sectionMap, roleMap, sections, departments, eligibleApprovers, personnelMap } = useMemo(() => {
    const sMap = new Map<number, string>();
    const rMap = new Map<number, string>();
    const pMap = new Map<string, string>();
    const sArray = lookups?.sections || [];
    const dArray = lookups?.departments || [];
    const rArray = lookups?.roles || [];
    const actData = (Array.isArray(personnel) ? personnel : []).filter((p: IPersonnel) => Number(p.is_active) === 1);

    sArray.forEach((s: ISection) => sMap.set(s.id, s.name));
    rArray.forEach((r: IRole) => rMap.set(r.id, r.name));
    actData.forEach((p: IPersonnel) => pMap.set(p.id_dec, `${p.name} ${p.surname}`));

    // Sadece "Onaycı" olabilecek personelleri dropdownlara dahil ediyoruz:
    const allowedRolesRegex = /müdür|mühendis|ustabaşı|admin|ik|yönetici|genel/i;
    const approvers = actData.filter((p: IPersonnel) => {
      const rn = rMap.get(p.role_id) || "";
      return allowedRolesRegex.test(rn);
    });

    return { sectionMap: sMap, roleMap: rMap, sections: sArray, departments: dArray, eligibleApprovers: approvers, personnelMap: pMap };
  }, [lookups, personnel]);

  // Arama filtrelemesi - React tabanlı Input (Yazma gecikmesini / INP sorununu çözmek için)
  const deferredSearchTerm = useDeferredValue(searchTerm);



  const filteredSections = useMemo(() => {
    if (!deferredSearchTerm) return sections;
    const lowerSearch = deferredSearchTerm.toLowerCase();
    return sections.filter((s: ISection) => {
      const matchName = s.name.toLowerCase().includes(lowerSearch);
      const matchManager = s.manager_id && personnelMap.get(s.manager_id)?.toLowerCase().includes(lowerSearch);
      return matchName || matchManager;
    });
  }, [sections, deferredSearchTerm, personnelMap]);

  const filteredDepartments = useMemo(() => {
    if (!deferredSearchTerm) return departments;
    const lowerSearch = deferredSearchTerm.toLowerCase();
    return departments.filter((d: IDepartment) => {
      const matchName = d.name.toLowerCase().includes(lowerSearch);
      const matchSec = sectionMap.get(d.section_id)?.toLowerCase().includes(lowerSearch);
      const matchSup = d.supervisor_id && personnelMap.get(d.supervisor_id)?.toLowerCase().includes(lowerSearch);
      return matchName || matchSec || matchSup;
    });
  }, [departments, deferredSearchTerm, personnelMap, sectionMap]);

  const getSectionName = useCallback((secId: number) => sectionMap.get(secId) || "Bölüm Belirtilmemiş", [sectionMap]);
  const getRoleName = useCallback((roleId: number) => roleMap.get(roleId) || "-", [roleMap]);

  // Memoize assignment callbacks so rows don't unnecessarily re-render
  const handleSectionAssign = useCallback((id: number, manager_id: string) => {
    sectionMutation.mutate({ id, manager_id });
  }, [sectionMutation]);

  const handleDepartmentAssign = useCallback((id: number, supervisor_id: string) => {
    departmentMutation.mutate({ id, supervisor_id });
  }, [departmentMutation]);

  if ((lookupsLoading || personnelLoading) && (!lookups || !personnel)) {
    return (
      <div className="flex flex-col items-center justify-center py-10 opacity-60">
        <Loader2 className="animate-spin text-primary mb-4" size={32} />
        <span className="text-sm font-bold text-foreground">Veriler Yüklüyor...</span>
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
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="w-full sm:w-auto h-12 rounded-[1rem] font-bold border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all shrink-0"
          >
            {syncMutation.isPending ? <Loader2 size={18} className="mr-2 animate-spin" /> : <ShieldCheck size={18} className="mr-2" />}
            Tüm Yetkileri Senkronize Et
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-12">
        {/* SECTION SEÇİMLERİ (2. ONAYCILAR) */}
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
            {filteredSections.map((section: ISection) => (
              <SectionRow
                key={section.id}
                section={section}
                count={sectionCounts[section.id] || 0}
                personnel={eligibleApprovers}
                getRoleName={getRoleName}
                onAssign={handleSectionAssign}
                isPending={sectionMutation.isPending}
              />
            ))}
          </div>
        </div>

        {/* DEPARTMENT SEÇİMLERİ (1. ONAYCILAR) */}
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
            {filteredDepartments.map((dept: IDepartment) => (
              <DepartmentRow
                key={dept.id}
                dept={dept}
                count={departmentCounts[dept.id] || 0}
                sectionName={getSectionName(dept.section_id)}
                personnel={eligibleApprovers}
                getRoleName={getRoleName}
                onAssign={handleDepartmentAssign}
                isPending={departmentMutation.isPending}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
