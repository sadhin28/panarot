export type UserRole = "admin" | "employee";

export interface Buyer {
  id: string;
  buyer_code: string;
  name: string;
  phone: string | null;
  address: string | null;
  opening_balance: number;
  is_active: boolean;
  created_at: string;
}

export interface Seller {
  id: string;
  seller_code: string;
  name: string;
  phone: string | null;
  address: string | null;
  opening_balance: number;
  is_active: boolean;
  created_at: string;
}

export interface PanType {
  id: string;
  name: string;
  unit_name: string;
  is_active: boolean;
}

export interface Purchase {
  id: string;
  buyer_id: string;
  pan_type_id: string;
  purchase_date: string;
  quantity_bira: number;
  rate_per_bira: number;
  total_amount: number;
  notes: string | null;
}

export interface Sale {
  id: string;
  seller_id: string;
  pan_type_id: string;
  sale_date: string;
  quantity_bira: number;
  rate_per_bira: number;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  net_amount: number;
  notes: string | null;
}