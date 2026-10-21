import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import type { Booking } from "@/types";

export interface CustomerInfo {
  name: string;
  location: string;
  country: string;
  whatsapp: string;
  alternativeNo: string;
}

/**
 * Bookings carry populated sender/receiver refs, but older backend builds may
 * populate only `name`; fall back to the Customers master for place and phone.
 */
export function useCustomerLookup() {
  const customers = useAppSelector((s) => s.masters.customers.items);
  return useMemo(() => {
    const map = new Map<string, CustomerInfo>();
    for (const c of customers) {
      map.set(c._id, {
        name: String(c.name ?? ""),
        location: String(c.location ?? ""),
        country: String(c.country ?? ""),
        whatsapp: String(c.whatsapp ?? ""),
        alternativeNo: String(c.alternativeNo ?? ""),
      });
    }
    const senderPlace = (b: Booking) => b.sender.location || map.get(b.sender.id)?.location || "";
    const receiverPlace = (b: Booking) => {
      const c = map.get(b.receiver.id);
      return [b.receiver.location || c?.location, b.receiver.country || c?.country].filter(Boolean).join(", ");
    };
    const receiverCity = (b: Booking) => b.receiver.location || map.get(b.receiver.id)?.location || b.receiver.country || "";
    return { map, senderPlace, receiverPlace, receiverCity };
  }, [customers]);
}
