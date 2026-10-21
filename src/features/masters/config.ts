/**
 * Declarative description of every master / operations module the "More"
 * tab manages. One generic list screen + one generic form screen render all
 * of them from this config, mirroring the web app's `MasterView`.
 */
import type { ComponentType } from "react";
import {
  CalendarClock,
  ClipboardList,
  Globe,
  Package,
  Shirt,
  Store,
  Tag,
  Truck,
  User,
  Users,
  Bike,
} from "lucide-react-native";
import { API_ENDPOINTS } from "@/api/endpoints";
import type { BackendDoc } from "@/types";
import type { Tone } from "@/theme/palette";
import { money } from "@/utils/format";
import { refField, str } from "@/services/mappers";

export type MasterKey =
  | "team"
  | "customers"
  | "stores"
  | "countries"
  | "deliveryPartners"
  | "pickupPartners"
  | "pricing"
  | "products"
  | "fabrics"
  | "pickupAssigns"
  | "preBookings";

export type FieldType = "text" | "number" | "email" | "phone" | "password" | "date" | "select" | "ref";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  /** For `ref` fields: which master the options come from and how to label them. */
  ref?: { master: MasterKey; labelKey: string; filter?: (doc: BackendDoc) => boolean };
  /** Only shown when this returns true for the current form values. */
  visibleWhen?: (values: Record<string, string>) => boolean;
  /** Password-style fields: blank on edit means "keep current". */
  optionalOnEdit?: boolean;
}

type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export interface MasterDef {
  key: MasterKey;
  title: string;
  singular: string;
  endpoint: string;
  listKey: string;
  itemKey: string;
  icon: IconType;
  tone: Tone;
  hasStatus: boolean;
  fields: FieldDef[];
  primary: (doc: BackendDoc) => string;
  secondary: (doc: BackendDoc) => string;
  /** Extra badge besides Active/Inactive (e.g. a pickup's collection status). */
  badge?: (doc: BackendDoc) => { label: string; tone: Tone } | null;
  /** cargo-backend requires a unique code this module's form never collects — generated on create. */
  autoCode?: { field: string; prefix: string };
  /** Other masters a ref field needs loaded. */
  dependsOn?: MasterKey[];
}

const name = (doc: BackendDoc) => str(doc.name);
const join = (...parts: unknown[]) => parts.filter((p) => p !== undefined && p !== null && p !== "").map(String).join(" · ");

const BUNDLE_TYPES = ["Bundle", "Box", "CBM", "KG"];

export const MASTERS: Record<MasterKey, MasterDef> = {
  team: {
    key: "team",
    title: "Team",
    singular: "team member",
    endpoint: API_ENDPOINTS.EMPLOYEES.BASE,
    listKey: "employees",
    itemKey: "employee",
    icon: Users,
    tone: "purple",
    hasStatus: true,
    primary: name,
    secondary: (d) => join(d.empId, d.role, d.contact),
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "empId", label: "Employee ID", type: "text", required: true },
      { key: "contact", label: "Contact", type: "phone", required: true },
      { key: "role", label: "Role", type: "select", options: ["Admin", "Employee"], required: true },
      { key: "email", label: "Login email", type: "email" },
      { key: "password", label: "Password", type: "password", optionalOnEdit: true, placeholder: "Leave blank to keep current" },
      { key: "bloodGroup", label: "Blood group", type: "select", options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
    ],
  },
  customers: {
    key: "customers",
    title: "Customers",
    singular: "customer",
    endpoint: API_ENDPOINTS.CUSTOMERS.BASE,
    listKey: "customers",
    itemKey: "customer",
    icon: User,
    tone: "info",
    hasStatus: true,
    primary: name,
    secondary: (d) => join(d.customerType, d.location, d.country, d.whatsapp),
    badge: (d) => (d.customerType ? { label: str(d.customerType), tone: d.customerType === "Sender" ? "info" : "purple" } : null),
    fields: [
      { key: "customerType", label: "Type", type: "select", options: ["Sender", "Receiver"], required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "whatsapp", label: "WhatsApp", type: "phone", required: true },
      { key: "location", label: "Location", type: "text", required: true },
      { key: "country", label: "Country", type: "text", visibleWhen: (v) => v.customerType === "Receiver", required: true },
      { key: "alternativeNo", label: "Alternative number", type: "phone", visibleWhen: (v) => v.customerType === "Receiver" },
      { key: "discount", label: "Discount", type: "number", visibleWhen: (v) => v.customerType === "Receiver" },
    ],
  },
  stores: {
    key: "stores",
    title: "Stores",
    singular: "store",
    endpoint: API_ENDPOINTS.STORES.BASE,
    listKey: "stores",
    itemKey: "store",
    icon: Store,
    tone: "success",
    hasStatus: true,
    primary: (d) => str(d.location),
    secondary: (d) => join(d.inCharge, d.contact),
    fields: [
      { key: "location", label: "Location", type: "text", required: true },
      { key: "inCharge", label: "In charge", type: "text", required: true },
      { key: "contact", label: "Contact", type: "phone", required: true },
    ],
  },
  countries: {
    key: "countries",
    title: "Country",
    singular: "country",
    endpoint: API_ENDPOINTS.COUNTRIES.BASE,
    listKey: "countries",
    itemKey: "country",
    icon: Globe,
    tone: "purple",
    hasStatus: true,
    primary: name,
    secondary: () => "Delivery route endpoint",
    fields: [{ key: "name", label: "Country name", type: "text", required: true }],
  },
  deliveryPartners: {
    key: "deliveryPartners",
    title: "Delivery",
    singular: "delivery partner",
    endpoint: API_ENDPOINTS.DELIVERY_PARTNERS.BASE,
    listKey: "deliveryPartners",
    itemKey: "deliveryPartner",
    icon: Truck,
    tone: "warning",
    hasStatus: true,
    dependsOn: ["countries"],
    primary: name,
    secondary: (d) => join(`${str(refField(d.from, "name"))} → ${str(refField(d.toCountry, "name"))}`, d.charge !== undefined ? money(Number(d.charge)) : ""),
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "whatsapp", label: "WhatsApp", type: "phone", required: true },
      { key: "from", label: "From", type: "ref", ref: { master: "countries", labelKey: "name" }, required: true },
      { key: "toCountry", label: "To", type: "ref", ref: { master: "countries", labelKey: "name" }, required: true },
      { key: "charge", label: "Charge", type: "number" },
    ],
  },
  pickupPartners: {
    key: "pickupPartners",
    title: "Pickup",
    singular: "pickup partner",
    endpoint: API_ENDPOINTS.PICKUP_PARTNERS.BASE,
    listKey: "pickupPartners",
    itemKey: "pickupPartner",
    icon: Bike,
    tone: "info",
    hasStatus: true,
    primary: name,
    secondary: (d) => str(d.whatsapp),
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "whatsapp", label: "WhatsApp", type: "phone", required: true },
    ],
  },
  pricing: {
    key: "pricing",
    title: "Pricing",
    singular: "price",
    endpoint: API_ENDPOINTS.PRICING.BASE,
    listKey: "pricings",
    itemKey: "pricing",
    icon: Tag,
    tone: "success",
    hasStatus: false,
    primary: (d) => `${str(d.from)} → ${str(d.to)}`,
    secondary: (d) => `${money(Number(d.price ?? 0))} per ${str(d.uom)}`,
    fields: [
      { key: "from", label: "From", type: "text", required: true, placeholder: "India" },
      { key: "to", label: "To", type: "text", required: true, placeholder: "UAE" },
      { key: "uom", label: "Unit", type: "select", options: BUNDLE_TYPES, required: true },
      { key: "price", label: "Price", type: "number", required: true },
    ],
  },
  products: {
    key: "products",
    title: "Product",
    singular: "product",
    endpoint: API_ENDPOINTS.PRODUCTS.BASE,
    listKey: "products",
    itemKey: "product",
    icon: Package,
    tone: "purple",
    hasStatus: true,
    primary: name,
    secondary: () => "Packing list product",
    fields: [{ key: "name", label: "Product name", type: "text", required: true }],
  },
  fabrics: {
    key: "fabrics",
    title: "Fabric",
    singular: "fabric",
    endpoint: API_ENDPOINTS.FABRICS.BASE,
    listKey: "fabrics",
    itemKey: "fabric",
    icon: Shirt,
    tone: "purple",
    hasStatus: true,
    primary: name,
    secondary: () => "Packing list fabric",
    fields: [{ key: "name", label: "Fabric name", type: "text", required: true }],
  },
  pickupAssigns: {
    key: "pickupAssigns",
    title: "Pickup assign",
    singular: "pickup assign",
    endpoint: API_ENDPOINTS.PICKUP_ASSIGNS.BASE,
    listKey: "pickupAssigns",
    itemKey: "pickupAssign",
    icon: ClipboardList,
    tone: "info",
    hasStatus: true,
    dependsOn: ["pickupPartners"],
    primary: (d) => `LR ${str(d.lrNo)}`,
    secondary: (d) => join(str(refField(d.transport, "name")), `${str(d.bundleCount)} bundles`, money(Number(d.amount ?? 0)), d.paymentStatus),
    badge: (d) =>
      d.pickupStatus ? { label: str(d.pickupStatus), tone: d.pickupStatus === "Collected" ? "success" : "warning" } : null,
    fields: [
      { key: "transport", label: "Transport", type: "ref", ref: { master: "pickupPartners", labelKey: "name" }, required: true },
      { key: "lrNo", label: "LR No", type: "text", required: true },
      { key: "bundleCount", label: "Bundle count", type: "number", required: true },
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "paymentStatus", label: "Payment", type: "select", options: ["Unpaid", "Paid"] },
      { key: "pickupStatus", label: "Pickup status", type: "select", options: ["Pending", "Collected"] },
      {
        key: "collectedBundle",
        label: "Collected bundles",
        type: "number",
        visibleWhen: (v) => v.pickupStatus === "Collected",
      },
    ],
  },
  preBookings: {
    key: "preBookings",
    title: "Pre-booking",
    singular: "pre-booking",
    endpoint: API_ENDPOINTS.PRE_BOOKINGS.BASE,
    listKey: "preBookingList",
    itemKey: "preBooking",
    icon: CalendarClock,
    tone: "purple",
    hasStatus: false,
    dependsOn: ["customers"],
    autoCode: { field: "preBookingId", prefix: "PBK" },
    primary: (d) => `${str(d.preBookingId)} · ${str(refField(d.sender, "name"))}`,
    secondary: (d) => join(`${str(d.bundleCount)} × ${str(d.bundleType)}`, d.phoneNumber, str(d.date).slice(0, 10)),
    badge: (d) => {
      const s = str(d.preBookingStatus || "Pending");
      return { label: s, tone: s === "Collected" ? "success" : s === "Canceled" ? "danger" : "warning" };
    },
    fields: [
      {
        key: "sender",
        label: "Sender",
        type: "ref",
        ref: { master: "customers", labelKey: "name", filter: (d) => d.customerType === "Sender" },
        required: true,
      },
      { key: "phoneNumber", label: "Phone number", type: "phone", required: true },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "bundleCount", label: "Bundle count", type: "number", required: true },
      { key: "bundleType", label: "Bundle type", type: "select", options: BUNDLE_TYPES, required: true },
      { key: "preBookingStatus", label: "Status", type: "select", options: ["Pending", "Collected", "Canceled"] },
    ],
  },
};

export const MASTER_GRID: MasterKey[] = [
  "team",
  "customers",
  "stores",
  "countries",
  "deliveryPartners",
  "pickupPartners",
  "pricing",
  "products",
  "fabrics",
];

/** Turns a raw doc into editable string form values (refs → their id, dates → YYYY-MM-DD). */
export function docToFormValues(def: MasterDef, doc: BackendDoc | undefined): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of def.fields) {
    const raw = doc?.[field.key];
    if (field.type === "password") values[field.key] = "";
    else if (field.type === "ref") values[field.key] = raw && typeof raw === "object" ? str((raw as { _id?: unknown })._id) : str(raw);
    else if (field.type === "date") values[field.key] = str(raw).slice(0, 10);
    else values[field.key] = str(raw);
  }
  return values;
}

/** Turns form values into a cargo-backend payload. */
export function formValuesToPayload(def: MasterDef, values: Record<string, string>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of def.fields) {
    if (field.visibleWhen && !field.visibleWhen(values)) continue;
    const value = values[field.key]?.trim() ?? "";
    // Blank optional fields (and a blank password on edit) are simply not sent.
    if (value === "") continue;
    payload[field.key] = field.type === "number" ? Number(value) : value;
  }
  return payload;
}

export function validateForm(def: MasterDef, values: Record<string, string>, isEdit: boolean): string | null {
  for (const field of def.fields) {
    if (field.visibleWhen && !field.visibleWhen(values)) continue;
    const value = values[field.key]?.trim() ?? "";
    if (field.required && !value && !(isEdit && field.optionalOnEdit)) return `${field.label} is required.`;
    if (value && field.type === "number" && !Number.isFinite(Number(value))) return `${field.label} must be a number.`;
    if (value && field.type === "email" && !/^\S+@\S+\.\S+$/.test(value)) return `${field.label} must be a valid email.`;
    if (value && field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${field.label} must be in YYYY-MM-DD format.`;
  }
  return null;
}
