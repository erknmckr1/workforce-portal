export interface ScrapRecord {
  id: number;
  order_no: string;
  karat: string | null;
  color: string | null;
  description: string | null;
  wire_code: string | null;
  defect_note: string | null;
  is_scrap: boolean;
  scrap_location: string | null;
  scrap_reason: string | null;
  image_url: string | null;
  operator_id: string | null;
  created_at: string;
  updated_at: string;
  Operator?: {
    id_dec: string;
    name: string;
    surname: string;
  };
}

export interface ScrapFormData {
  order_no: string;
  karat: string;
  color: string;
  description: string;
  wire_code: string;
  defect_note: string;
  is_scrap: boolean;
  scrap_location: string;
  scrap_reasons: string[];
  custom_reason: string;
}

export const INITIAL_SCRAP_FORM: ScrapFormData = {
  order_no: "",
  karat: "",
  color: "Y",
  description: "",
  wire_code: "",
  defect_note: "",
  is_scrap: true,
  scrap_location: "ÖRME",
  scrap_reasons: ["ÇAPAK PROBLEMI"],
  custom_reason: "",
};

export function parseImageUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === "/images/sample-scrap.svg") return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(Boolean)
          .map((s) => String(s).trim())
          .filter((s) => s.length > 0 && s !== "/images/sample-scrap.svg");
      }
    } catch {
      // ignore
    }
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "/images/sample-scrap.svg");
}

export const DEFAULT_LOCATIONS = [
  "ÖRME",
  "DÖKÜM",
  "CİLA",
  "TEL ÇEKME",
  "BUZLAMA",
  "ÇEKİÇ",
  "KURU TIRAŞ",
  "TASLAMA",
  "KALİTE KONTROL",
];

export const KARAT_OPTIONS = ["8", "9", "10", "14", "18", "21", "22"];

export const COLOR_OPTIONS = [
  { code: "Y", label: "Y - Yeşil / Sarı" },
  { code: "K", label: "K - Kırmızı / Rose" },
  { code: "B", label: "B - Beyaz" },
];

export const DEFAULT_SCRAP_REASONS = [
  "BAG - MAKARA HATASI",
  "BOY HATASI",
  "BOZUK DAMGA",
  "BOZUK HALKA",
  "BOZUK KILIT",
  "BOZUK KULAKCIK",
  "BOZUK MINE",
  "BOZUK PAPYON",
  "BOZUK PUL",
  "BOZUK SILIKON",
  "BOZUK ZINCIR",
  "ÇAPAK PROBLEMI",
  "ÇIZIK ÜRÜN",
  "DAMGASIZ",
  "DÜGÜMLÜ ZINCIR",
  "EKSIK BAR",
  "EKSIK BITIS HALKASI",
  "EKSIK DESEN",
  "EKSIK HALKA",
  "EKSIK KILIT",
  "EKSIK MINE",
  "EKSIK PAPYON",
  "EKSIK PUL",
  "EKSIK TAS",
  "EKSIK TOP",
  "ERIMIS DAMGA",
  "ERIMIS PAPYON",
  "ERIMIS PUL",
  "EZIK DAMGA",
  "EZIK FERMUAR",
  "EZIK HALKA",
  "EZIK KILIT",
  "EZIK MENGEÇ",
  "EZIK PAPYON",
  "EZIK PLAKA",
  "EZIK PUL",
  "EZIK SILIKONLU TOP",
  "EZIK TOP",
  "EZIK ZINCIR",
  "FIKS ZINCIR",
  "GÖRÜNTÜ PROBLEMI",
  "ISLEM GÖRMEMIS PAPYON",
  "KAYNAKSIZ URUN",
  "KILITTE TAKILMA",
  "KIRIK PAPYON",
  "KIRIK ZINCIR",
  "KOPUK",
  "LOGOSUZ KILIT",
  "MIKNATISLANMA",
  "ORTALAMA GRAM HATASI",
  "PIM AYAR YAPILMAMIS",
  "RENK PROBLEMI",
  "SILIK DAMGA",
  "TAMAMLANMAMIS ÜRÜN",
  "TIRASSIZ ÜRÜN",
  "ÜRÜNDE ÇIZIK",
  "ÜRÜNDE MATLIK",
  "UZAMIS ZINCIR",
  "YALDIZSIZ ZINCIR",
  "YAMUK KILIT",
  "YAMUK PIM",
  "YANLIS DAMGA",
  "YANLIS HALKA",
  "YANLIS KAYNAK",
  "YANLIS KILIT",
  "YANLIS MONTAJ",
  "YANLIS ZINCIR",
  "Diğer",
];
