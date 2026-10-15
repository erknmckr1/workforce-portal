export type TransportMode = 
  | "Yaya"
  | "Toplu Taşıma"
  | "Otomobil"
  | "Taksi"
  | "Motosiklet"
  | "Servis"
  | "Diğer";

export const TRANSPORT_MODES: TransportMode[] = [
  "Yaya",
  "Toplu Taşıma",
  "Otomobil",
  "Taksi",
  "Motosiklet",
  "Servis",
  "Diğer",
];

// Bu ulaşım modlarında Araç Plakası ve Araçtaki Kişi Sayısı zorunludur
export const VEHICLE_TRANSPORT_MODES: TransportMode[] = [
  "Otomobil",
  "Taksi",
  "Motosiklet",
  "Servis",
];

export type RegistrationSource = "QR – Ziyaretçi Kaydı" | "Güvenlik – Manuel Kayıt";

export interface IVisitor {
  id: string | number;
  fullName: string;
  company?: string;
  phone?: string;
  visitedPersonOrDept: string;
  visitPurpose?: string;
  originProvince: string;
  originDistrict: string;
  transportMode: TransportMode;
  vehiclePassengerCount?: number;
  licensePlate?: string;
  entryDate: string;
  entryTime: string;
  exitDate?: string;
  exitTime?: string;
  notes?: string;
  source: RegistrationSource;
  status: "inside" | "exited";
  createdAt?: string;
}

export interface CreateVisitorDTO {
  fullName: string;
  company?: string;
  phone?: string;
  visitedPersonOrDept: string;
  visitPurpose?: string;
  originProvince: string;
  originDistrict: string;
  transportMode: TransportMode;
  vehiclePassengerCount?: number;
  licensePlate?: string;
  notes?: string;
  source?: RegistrationSource;
}
