/**
 * Every cargo-backend path the app calls, relative to `API_BASE_URL`.
 * Ported 1:1 from the web app's `src/constants/ApiConstants.ts`.
 */
function crud<P extends string>(base: P) {
  return {
    BASE: base,
    BY_ID: (id: string) => `${base}/${id}`,
    STATUS: (id: string) => `${base}/${id}/status`,
  } as const;
}

export const API_ENDPOINTS = {
  AUTH: { LOGIN: "/auth/login" },
  EMPLOYEES: crud("/employees"),
  CUSTOMERS: crud("/customers"),
  STORES: crud("/stores"),
  COUNTRIES: crud("/countries"),
  DELIVERY_PARTNERS: crud("/delivery-partners"),
  PICKUP_PARTNERS: crud("/pickup-partners"),
  PRICING: { BASE: "/pricing", BY_ID: (id: string) => `/pricing/${id}` },
  FABRICS: crud("/fabrics"),
  PRODUCTS: crud("/products"),
  PICKUP_ASSIGNS: {
    ...crud("/pickup-assigns"),
    PAYMENT_STATUS: (id: string) => `/pickup-assigns/${id}/payment-status`,
    COLLECTED: (id: string) => `/pickup-assigns/${id}/collected`,
  },
  PRE_BOOKINGS: crud("/pre-bookings"),
  BOOKINGS: {
    ...crud("/bookings"),
    PACKAGE_LIST_STATUS: (id: string) => `/bookings/${id}/package-list-status`,
    STUFF_STATUS: (id: string) => `/bookings/${id}/stuff-status`,
  },
  CONTAINERS: crud("/containers"),
  STUFFINGS: { BASE: "/stuffings", BY_ID: (id: string) => `/stuffings/${id}` },
  INVOICES: { BASE: "/invoices", BY_ID: (id: string) => `/invoices/${id}` },
  CREDIT_NOTES: crud("/credit-notes"),
  DAILY_EXPENSES: crud("/daily-expenses"),
  RECEIPT_ENTRIES: {
    ...crud("/receipt-entries"),
    DELIVERY_PARTNER_STATUS: (id: string) => `/receipt-entries/${id}/delivery-partner-status`,
  },
} as const;
