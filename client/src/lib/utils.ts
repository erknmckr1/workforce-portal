import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Backend statik dosya yollarını (uploads, photos, vb.) tam ve erişilebilir URL'e çevirir.
 */
export function getBackendFileUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("blob:") ||
    path.startsWith("data:")
  ) {
    return path;
  }
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:3003/api";
  const serverBase = apiBase.replace(/\/api\/?$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${serverBase}${normalizedPath}`;
}

