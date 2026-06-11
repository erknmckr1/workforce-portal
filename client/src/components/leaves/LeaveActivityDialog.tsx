import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  History,
  Mail,
  MailWarning,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  useLeaveActivity,
  type ILeave,
  type LeaveActivity,
} from "@/hooks/useLeaves";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const getActivityStyle = (activity: LeaveActivity) => {
  if (activity.delivery_status === "SENT")
    return { icon: Mail, tone: "text-emerald-600 bg-emerald-500/10" };
  if (activity.delivery_status === "FAILED")
    return { icon: AlertCircle, tone: "text-red-600 bg-red-500/10" };
  if (activity.delivery_status === "SKIPPED")
    return { icon: MailWarning, tone: "text-amber-600 bg-amber-500/10" };
  if (activity.action === "REJECTED" || activity.action.startsWith("CANCELLED"))
    return { icon: XCircle, tone: "text-red-600 bg-red-500/10" };
  if (activity.action.startsWith("APPROVED"))
    return { icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-500/10" };
  return { icon: Clock3, tone: "text-primary bg-primary/10" };
};

const getActor = (activity: LeaveActivity) => {
  if (activity.Performer)
    return `${activity.Performer.name} ${activity.Performer.surname}`;
  return activity.performed_by;
};

export function LeaveActivityDialog({
  leave,
  open,
  onOpenChange,
}: {
  leave: ILeave | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, isError } = useLeaveActivity(
    open ? leave?.id : undefined,
  );
  const activities = data?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <History className="text-primary" size={21} />
            İzin Detayı ve Aktivite Geçmişi
          </DialogTitle>
          <DialogDescription>
            {leave?.User?.name} {leave?.User?.surname} · İzin #{leave?.id}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto p-6">
          {isLoading && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aktivite geçmişi yükleniyor...
            </div>
          )}
          {isError && (
            <div className="py-12 text-center text-sm text-destructive">
              Aktivite geçmişi alınamadı.
            </div>
          )}
          {!isLoading && !isError && activities.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Bu izin için aktivite kaydı bulunamadı.
            </div>
          )}
          <div className="space-y-0">
            {activities.map((activity, index) => {
              const style = getActivityStyle(activity);
              const Icon = style.icon;
              return (
                <div
                  key={activity.id}
                  className="relative flex gap-4 pb-6 last:pb-0"
                >
                  {index < activities.length - 1 && (
                    <div className="absolute left-5 top-10 bottom-0 w-px bg-border" />
                  )}
                  <div
                    className={cn(
                      "relative z-10 h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                      style.tone,
                    )}
                  >
                    <Icon size={17} />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-black text-sm">
                        {activity.details || activity.action}
                      </span>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {format(
                          new Date(activity.created_at),
                          "d MMM yyyy HH:mm",
                          { locale: tr },
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      İşlemi yapan: {getActor(activity)}
                    </div>
                    {activity.Recipient && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Alıcı: {activity.Recipient.name}{" "}
                        {activity.Recipient.surname}
                        {activity.recipient_address
                          ? ` (${activity.recipient_address})`
                          : ""}
                      </div>
                    )}
                    {activity.error_message && (
                      <div className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive break-words">
                        {activity.error_message}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
