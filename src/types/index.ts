/**
 * Domain types, mirroring the web app's `src/types/index.ts` (and therefore
 * what cargo-backend returns once mapped by `src/services`). `id` is the
 * Mongo id used for API calls; `code` is the human-readable id shown on screen.
 */

export type ThemePreference = "system" | "light" | "dark";

export type Status = "Active" | "Inactive";
export type BillOption = "With Bill" | "Without Bill";
export type BundleType = "Bundle" | "Box" | "CBM" | "KG";
export type ProductType = "Branded" | "Normal";
export type RepackingStatus = "Ready to Ship" | "Repacking Required";
export type StuffStatus = "Pending" | "Ready to Stuff" | "Stuffed";
export type PackageListStatus = "Pending" | "Added";
export type PaymentType = "Cash" | "UPI";
export type DeliveryPartnerStatus = "Pending" | "Paid";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string;
}

/** Raw cargo-backend document — what the generic master screens work with. */
export interface BackendDoc {
  _id: string;
  status?: boolean;
  [key: string]: unknown;
}

export interface PartyRef {
  id: string;
  name: string;
  whatsapp?: string;
  location?: string;
  country?: string;
}

export interface Booking {
  id: string;
  code: string;
  sender: PartyRef;
  receiver: PartyRef;
  /** LR No of the linked pickup assign. */
  pickupOption: string;
  date: string;
  billOption: BillOption | "";
  bundleCount: number;
  bundleType: BundleType | "";
  productType: ProductType | "";
  repackingStatus: RepackingStatus | "";
  stuffStatus: StuffStatus;
  /** "Added" once every bundle has a packing list (set by Ready to ship / Repacking). */
  packageListStatus: PackageListStatus;
  /** Only meaningful when `productType` is "Branded". */
  brandHandlingCharge: number;
  /** Only meaningful when `billOption` is "Without Bill". */
  pickupCharge: number;
  /** Only meaningful when `bundleCount` is below 5. */
  bundleHandlingCharge: number;
  /** Real bundle count set by repacking — 0 until confirmed. */
  actualBundle: number;
  status: Status;
  createdAt?: string;
}

export type ContainerStatus = Status | "Stuffed";

export interface Container {
  id: string;
  code: string;
  status: ContainerStatus;
  company: string;
  stuffingCode?: string;
  stuffingDate: string;
  cutOffDate?: string;
  etaCok?: string;
  etdCok?: string;
  etaUae?: string;
}

export interface Stuffing {
  id: string;
  container: string;
  bookings: string[];
  date: string;
}

/** A booking's packing list: one entry per repacked bundle. */
export interface BookingPackage {
  id: string;
  booking: string;
  bundles: { id: string; bundleNo: number }[];
}

export interface Invoice {
  id: string;
  code: string;
  bookingId: string;
  bookingCode: string;
  containerId: string;
  container?: string;
  deliveryPartner?: string;
  deliveryCharge?: number;
  subtotal: number;
  additionalCharges: number;
  receivableDiscount: number;
  amount: number;
  createdAt?: string;
}

export interface ReceiptEntry {
  id: string;
  code: string;
  date: string;
  invoiceId: string;
  invoiceNo: string;
  receivableAmount: number;
  receivedAmount: number;
  balanceAmount: number;
  receivedDate: string;
  deliveryPartnerAmount: number;
  deliveryPartnerStatus: DeliveryPartnerStatus;
}

export interface DailyExpense {
  id: string;
  code: string;
  date: string;
  type: string;
  paymentType: PaymentType | "";
  amount: number;
  description?: string;
}

export interface CreditNoteEntry {
  id: string;
  code: string;
  date: string;
  amount: number;
  description?: string;
}

export type LoadStatus = "idle" | "loading" | "succeeded" | "failed";
