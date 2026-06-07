export type BundleStatus = "active" | "inactive" | "draft";

export type DiscountType = "percentage" | "fixed" | string;

export interface Bundle {
  id?: string;
  name: string;
  products: string[]; // array of Product IDs (GIDs)
  discount_type: DiscountType;
  discount_value: number;
  status: BundleStatus | string;
}
