import { syncLeaveBalancesFromLocalFile } from "./leaveBalanceSyncService";

const DEFAULT_SYNC_INTERVAL_MINUTES = 120;

let syncTimer: NodeJS.Timeout | null = null;
let isSyncRunning = false;

const getSyncIntervalMs = () => {
  const configuredMinutes = Number(process.env.LEAVE_SYNC_INTERVAL_MINUTES);
  const intervalMinutes =
    Number.isFinite(configuredMinutes) && configuredMinutes > 0
      ? configuredMinutes
      : DEFAULT_SYNC_INTERVAL_MINUTES;

  return intervalMinutes * 60 * 1000;
};

const runScheduledLeaveBalanceSync = async () => {
  if (isSyncRunning) {
    console.warn(
      "[LeaveBalanceSync] Önceki senkronizasyon devam ettiği için bu tur atlandı.",
    );
    return;
  }

  isSyncRunning = true;

  try {
    const summary = await syncLeaveBalancesFromLocalFile();
    console.log("[LeaveBalanceSync] Otomatik senkronizasyon tamamlandı:", summary);
  } catch (error) {
    console.error("[LeaveBalanceSync] Otomatik senkronizasyon hatası:", error);
  } finally {
    isSyncRunning = false;
  }
};

export const startLeaveBalanceSyncScheduler = () => {
  if (process.env.LEAVE_SYNC_ENABLED === "false") {
    console.log("[LeaveBalanceSync] Otomatik senkronizasyon kapalı.");
    return;
  }

  if (syncTimer) {
    return;
  }

  const intervalMs = getSyncIntervalMs();

  syncTimer = setInterval(runScheduledLeaveBalanceSync, intervalMs);

  console.log(
    `[LeaveBalanceSync] Otomatik senkronizasyon başlatıldı. Periyot: ${intervalMs / 60000} dakika.`,
  );
};
