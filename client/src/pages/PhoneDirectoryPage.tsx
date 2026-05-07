import { useState } from "react";
import { usePhoneDirectory } from "@/hooks/usePhoneDirectory";
import { useDebounce } from "@/hooks/useDebounce";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Phone, Search, Loader2, Building2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PhoneDirectoryPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const { directoryQuery } = usePhoneDirectory(debouncedSearch);

  return (
    <div className="p-4 space-y-6 w-full  mx-auto animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Phone size={24} />
            </div>
            Telefon Rehberi
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">
            Fabrika içi dahili numaralar ve iletişim bilgileri
          </p>
        </div>

        <div className="relative w-full md:w-80 group">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors"
            size={18}
          />
          <Input
            placeholder="İsim, numara veya bölüm ara..."
            className="pl-10 h-11 rounded-xl bg-card border-border shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* List Section */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-xl shadow-border/5">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 pl-6">
                Numara
              </TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest py-4">
                İsim / Yer
              </TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest py-4">
                Bölüm
              </TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 text-right pr-6">
                Tür
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {directoryQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-64 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Yükleniyor...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : directoryQuery.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-64 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-muted w-12 h-12 rounded-full flex items-center justify-center text-muted-foreground/50">
                      <Search size={24} />
                    </div>
                    <p className="text-muted-foreground font-medium italic">
                      Sonuç bulunamadı.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              directoryQuery.data?.map((entry) => (
                <TableRow
                  key={entry.id}
                  className="group hover:bg-primary/5 transition-colors border-border/40"
                >
                  <TableCell className="py-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Phone size={14} />
                      </div>
                      <span className="text-lg font-black tracking-tighter text-foreground">
                        {entry.number}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/5 text-primary flex items-center justify-center shrink-0">
                        <User size={14} />
                      </div>
                      <span className="font-bold text-foreground">
                        {entry.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 size={14} />
                      <span className="text-[10px] font-black uppercase tracking-wider">
                        {entry.department}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-right pr-6">
                    <Badge
                      variant="secondary"
                      className="rounded-lg font-black text-[10px] px-2 py-0.5 bg-muted text-muted-foreground border-none uppercase group-hover:bg-primary/10 group-hover:text-primary transition-colors"
                    >
                      Dahili
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
