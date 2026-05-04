export interface MesProcess {
  process_id: string;
  section: string;
  process_name: string;
  area_name: string;
  process_group: string | null;
}

export interface MesRepairReason {
  repair_reason_id: string;
  repair_reason: string;
  section: string;
  area_name: string;
}

export interface MesStopReason {
  stop_reason_id: string;
  stop_reason_name: string;
  section: string;
  area_name: string;
}

export interface WorkLog {
  id: number;
  operator_id: string;
  order_no: string;
  section_id: string;
  area_name: string;
  field: string;
  process_id: string;
  process_name: string;
  machine_name: string;
  material_no?: string;
  status: number;
  StatusDetail?: {
    id: number;
    name: string;
    color_code: string;
  };
  Operator?: {
    name: string;
    surname: string;
  };
  start_date: string;
}

export interface SapOrder {
  ORDER_ID: string;
  CLIENT_NAME?: string;
  MATERIAL_NAME?: string;
  MATERIAL_NO?: string;
  ORDER_QTY?: number;
  REMAINING_QTY?: number;
  OLD_CODE?: string;
  PRODUCT_TYPE?: string;
  PRODUCT_COLOR?: string;
  // Gerektiğinde diğer SAP alanları buraya eklenebilir
}

export interface OperatorBreak {
  id: number;
  operator_id: string;
  area_name: string;
  break_reason: string;
  start_date: string;
  end_date: string | null;
  status: number;
  Operator?: {
    name: string;
    surname: string;
    id_dec: string;
  };
}
