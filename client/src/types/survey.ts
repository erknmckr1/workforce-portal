export interface CompanySurvey {
  id: number;
  title: string;
  description?: string | null;
  form_url: string;
  target_platforms: string; // e.g. "MES,KIOSK,PORTAL"
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
  order_index: number;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SurveyFormData {
  title: string;
  description?: string;
  form_url: string;
  target_platforms: string;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  order_index: number;
}
