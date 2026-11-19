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
  scrap_reason: string;
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
  scrap_reason: "Döküm Boşluğu / Porozite",
  custom_reason: "",
};

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

export const DEFAULT_SCRAP_IMAGE = "/images/sample-scrap.svg";

export const DEFAULT_SCRAP_REASONS = [
  "Döküm Boşluğu / Porozite",
  "Çatlak / Kırık",
  "Tel Kopması / Ezilme",
  "Ölçü / Tolerans Dışı",
  "Kaynak / Lehim Hatası",
  "Yüzey Hatası / Çizik",
  "Renk / Alaşım Bozukluğu",
  "Çapak / Deformasyon",
  "Yanlış Montaj / Taş Düşmesi",
  "Diğer",
];
