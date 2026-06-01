
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import apiClient from "../../lib/api";
import { Button } from "../ui/button";
import { Loader2, Users, UserMinus, MonitorSmartphone, Settings, Wrench, Package } from "lucide-react";

interface Participant {
  id: number;
  operator_id: string;
  op_name: string;
}

interface TerminalGroupAreaProps {
  areaName: string;
  requireOperatorAuth: (options?: { actionType?: "break" | "job"; skipBreakCheck?: boolean }) => Promise<string>;
  selectedField: string;
  setSelectedField: (field: string) => void;
}

const CEKIC_AREAS = [
  { field: "Makine", name: "makine", icon: <MonitorSmartphone size={20} /> },
  { field: "Tezgah", name: "tezgah", icon: <Wrench size={20} /> },
  { field: "Açma", name: "acma", icon: <Package size={20} /> },
  { field: "Sarma", name: "sarma", icon: <Settings size={20} /> },
];

export default function TerminalGroupArea({ areaName, requireOperatorAuth, selectedField, setSelectedField }: TerminalGroupAreaProps) {
  const queryClient = useQueryClient();

  // Fetch participants for the selected area and field
  const { data: participants, isLoading } = useQuery({
    queryKey: ["fieldParticipants", areaName, selectedField],
    queryFn: async () => {
      const res = await apiClient.get(`/mes/field/participants?areaName=${areaName}&field=${selectedField}`);
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  const joinMutation = useMutation({
    mutationFn: async (operatorId: string) => {
      const res = await apiClient.post("/mes/field/join", {
        operator_id: operatorId,
        area_name: areaName,
        field: selectedField,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Alana başarıyla katıldınız.");
      queryClient.invalidateQueries({ queryKey: ["fieldParticipants"] });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || "Alana katılırken bir hata oluştu.";
      toast.error(errorMessage);
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async (operatorId: string) => {
      const res = await apiClient.post("/mes/field/leave", {
        operator_id: operatorId,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Alandan başarıyla çıktınız.");
      queryClient.invalidateQueries({ queryKey: ["fieldParticipants"] });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || "Alandan çıkarken bir hata oluştu.";
      toast.error(errorMessage);
    },
  });

  const handleJoin = async () => {
    try {
      const opId = await requireOperatorAuth({ actionType: "job" });
      if (opId) {
        joinMutation.mutate(opId);
      }
    } catch (error) {
      console.log(error)
    }
  };

  const handleLeave = async (opId: string) => {
    try {
      // Çıkış yaparken güvenlik gereği kişinin kendisi olduğunu doğrulamak isteyebiliriz
      // Ancak hızlı kullanım için doğrudan leave de yapılabilir. 
      // Biz şimdilik direkt leaveMutation çağırıyoruz.
      leaveMutation.mutate(opId);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="w-full h-full flex flex-col xl:flex-row gap-x-4">
      {/* Sol Panel: Alan Listesi */}
      <div className="w-full xl:w-[40%] flex flex-col bg-card border-[1.5px] border-border/50  overflow-hidden shadow-sm">
        <div className="bg-muted/30 p-4 border-b border-border/50 text-center">
          <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground flex justify-center items-center gap-2">
            <Settings size={16} /> Alt Alan
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
          {CEKIC_AREAS.map((area) => (
            <button
              key={area.name}
              onClick={() => setSelectedField(area.name)}
              className={`w-full h-10 flex items-center justify-center gap-3 font-black text-lg transition-all ${
                selectedField === area.name
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted/20 text-foreground hover:bg-muted/50 border-[1.5px] border-border/50"
              }`}
            >
              {area.icon}
              {area.field}
            </button>
          ))}
        </div>
      </div>

      {/* Sağ Panel: Katılımcılar */}
      {selectedField === "makine" ? (
        <div className="w-full xl:w-[60%] flex flex-col bg-card border-[1.5px] border-dashed border-border/50 overflow-hidden shadow-sm items-center justify-center p-6 text-center gap-4">
           <div className="bg-muted/20 p-6 rounded-full shadow-inner mb-2">
             <MonitorSmartphone size={48} className="text-muted-foreground/30" />
           </div>
           <h2 className="text-xl font-black uppercase tracking-widest text-muted-foreground">Katılım Gerekmiyor</h2>
           <p className="text-xs font-bold text-muted-foreground/50 max-w-sm">
             "Makine" alanında çalışırken öncesinde gruba katılmanıza gerek yoktur. İş başlatmak için doğrudan sağdaki panelden proses ve makine seçimi yapabilirsiniz.
           </p>
        </div>
      ) : (
        <div className="w-full xl:w-[60%] flex flex-col bg-card border-[1.5px] border-border/50  overflow-hidden shadow-sm relative">
          <div className="bg-muted/30 p-4 border-b border-border/50 flex justify-between items-center">
            <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Users size={16} /> {CEKIC_AREAS.find((a) => a.name === selectedField)?.field || "Alan"} Ekibi
            </h3>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black">
              {participants?.length || 0} Kişi
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            ) : participants && participants.length > 0 ? (
              participants.map((p: Participant) => (
                <div
                  key={p.id}
                  className="bg-muted/20 border-[1.5px] border-border/50 px-3  flex justify-between items-center"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-foreground">{p.op_name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl h-10 w-10"
                    onClick={() => handleLeave(p.operator_id)}
                    title="Alandan Çıkar"
                  >
                    <UserMinus size={18} />
                  </Button>
                </div>
              ))
            ) : (
              <div className="flex flex-col justify-center items-center h-full text-center text-muted-foreground opacity-50">
                <Users size={48} className="mb-2" />
                <p className="font-black uppercase tracking-widest text-sm">Bu Alanda Kimse Yok</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border/50 bg-muted/10">
            <Button
              onClick={handleJoin}
              disabled={joinMutation.isPending}
              className="w-full h-10  bg-primary text-primary-foreground font-black uppercase tracking-widest"
            >
              {joinMutation.isPending ? <Loader2 className="animate-spin" size={24} /> : "Alana Katıl"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
