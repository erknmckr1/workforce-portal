import React from "react";

export interface Job {
  id: string;
  operatorId: string;
  operatorName: string;
  orderId: string;
  oldCode: string;
  processId: string;
  section: string;
  process: string;
  quantity: string;
  materialNo?: string;
  status?: number;
  statusName?: string;
  statusColor?: string;
  machine: string;
}

interface TerminalJobTableProps {
  jobs: Job[];
  selectedJobs: string[];
  onSelectJob: (id: string) => void;
}

const TerminalJobTable: React.FC<TerminalJobTableProps> = ({
  jobs,
  selectedJobs,
  onSelectJob,
}) => {
  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden border-r border-border">
      <div className="flex-1 overflow-auto custom-scrollbar p-2">
        <table className="w-full text-left border-separate border-spacing-y-1">
          <thead className="sticky top-0 z-10">
            <tr className="bg-secondary/50 backdrop-blur-md text-muted-foreground">
              <th className="p-3 first:rounded-l-lg border-y border-border text-[10px] uppercase tracking-[0.2em] font-black">
                ID
              </th>
              <th className="p-3 border-y border-border text-[10px] uppercase tracking-[0.2em] font-black">
                Operator
              </th>
              <th className="p-3 border-y border-border text-[10px] uppercase tracking-[0.2em] font-black">
                Order No
              </th>
              <th className="p-3 border-y border-border text-[10px] uppercase tracking-[0.2em] font-black">
                Eski Kod
              </th>
              <th className="p-3 border-y border-border text-[10px] uppercase tracking-[0.2em] font-black">
                Process
              </th>
              <th className="p-3 border-y border-border text-[10px] uppercase tracking-[0.2em] font-black">
                Makine
              </th>
              <th className="p-3 border-y border-border text-[10px] uppercase tracking-[0.2em] font-black text-right">
                Miktar
              </th>
              <th className="p-3 last:rounded-r-lg border-y border-border text-[10px] uppercase tracking-[0.2em] font-black text-center">
                Durum
              </th>
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {jobs.map((job) => (
              <tr
                key={job.id}
                onClick={() => onSelectJob(job.id)}
                className={`group cursor-pointer transition-all duration-150 border-l-2
                  ${
                    selectedJobs.includes(job.id)
                      ? "bg-blue-500/20 border-blue-500" // Seçili işin rengini değiştiriyoruz çakışmaması için
                      : job.status === 1
                        ? "bg-success border-transparent hover:bg-success"
                        : job.status === 2 || job.status === 9
                          ? "bg-destructive border-transparent hover:bg-destructive"
                          : job.status === 0
                            ? "bg-gray-500/20 border-transparent hover:bg-gray-500/30"
                            : job.status === 5
                              ? "bg-amber-500/20 border-transparent hover:bg-amber-500/30"
                              : job.status === 6
                                ? "bg-emerald-500/20 border-transparent hover:bg-emerald-500/30"
                                : "bg-card/40 border-transparent hover:bg-secondary/40"
                  }
                `}
              >
                <td className="p-3 first:rounded-l-lg font-mono text-amber-500 font-bold tracking-tighter">
                  {job.id}
                </td>
                <td className="p-3">
                  <div className="flex flex-col">
                    <span className="font-bold text-lg text-foreground">
                      {job.operatorName}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono italic">
                      #{job.operatorId}
                    </span>
                  </div>
                </td>
                <td className="p-3 text-lg font-mono font-bold text-zinc-300">
                  {job.orderId}
                </td>
                <td className="p-3 text-primary">{job.materialNo}</td>
                <td className="p-3">
                  <div className="flex flex-col">
                    <span className="text-foreground text-lg ">
                      {job.process}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">
                      {job.section}
                    </span>
                  </div>
                </td>
                <td className="p-3 font-mono font-black text-right text-foreground">
                  {job.machine}
                </td>
                <td className="p-3 font-mono font-black text-right text-foreground">
                  {job.quantity}
                </td>
                <td className="p-3 last:rounded-r-lg text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${job.status === 1 ? "animate-pulse" : ""}`}
                      style={{ backgroundColor: job.statusColor || "#6b7280" }}
                    />
                    <span
                      className="text-xs font-bold"
                      style={{ color: job.statusColor || "#6b7280" }}
                    >
                      {job.statusName || "Bilinmiyor"}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom Footer Area */}
      <div className="flex items-center justify-between px-4 py-2 bg-secondary/50 border-t border-border text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
        <div className="flex gap-4">
          <span>
            Toplam İş: <span className="text-primary">{jobs.length}</span>
          </span>
          <span>
            Aktif İş: <span className="text-success">0</span>
          </span>
        </div>
        <div className="flex gap-2 items-center">
          <span>Sayfa: 1/1</span>
          <div className="h-4 w-px bg-border mx-2" />
          <span>Rows: 100</span>
        </div>
      </div>
    </div>
  );
};

export default TerminalJobTable;
