import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
}

export function PageHeader({ title, description, icon: Icon, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20 shrink-0">
            <Icon size={24} />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground font-bold text-xs uppercase tracking-wider flex items-center gap-2">
              {description}
            </p>
          )}
        </div>
      </div>
      
      {action && (
        <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
