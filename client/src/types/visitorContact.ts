export interface IVisitorContact {
  id: number;
  departmentName: string;
  fullName: string;
  title?: string | null;
  phoneExtension?: string | null;
  email?: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateVisitorContactDTO {
  departmentName: string;
  fullName: string;
  title?: string;
  phoneExtension?: string;
  email?: string;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface VisitorSuggestionsResponse {
  success: boolean;
  sections: string[];
  staff: Array<{
    id: string;
    fullName: string;
    sectionName?: string | null;
    departmentName?: string | null;
    phoneExtension?: string | null;
  }>;
}
