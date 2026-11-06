import { useCallback, useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { ensureBookings, ensureContainers, ensureFinance, ensureMaster } from "@/store/ensure";
import { selectPickupMode } from "@/store/slices/authSlice";
import { prewarmPdfFonts } from "@/utils/downloads";

/**
 * Everything the tab screens summarise, loaded once after sign-in. Each list
 * loads independently so a slow or failing endpoint doesn't block the rest.
 */
export function useBootstrapData() {
  const dispatch = useAppDispatch();
  const pickupMode = useAppSelector(selectPickupMode);
  useEffect(() => {
    dispatch(ensureFinance());
    dispatch(ensureMaster("team"));
    dispatch(ensureMaster("pickupAssigns"));
    dispatch(ensureMaster("pickupPartners"));
    // The Pickup role's screens are pickups, pre-bookings and expenses only.
    if (!pickupMode) {
      dispatch(ensureBookings());
      dispatch(ensureContainers());
      dispatch(ensureMaster("customers"));
    }
    // PDFs are booking / finance work; get their fonts ready once the first screen has settled.
    if (pickupMode) return;
    const task = InteractionManager.runAfterInteractions(prewarmPdfFonts);
    return () => task.cancel();
  }, [dispatch, pickupMode]);
}

/** Pull-to-refresh helper: runs the given loads and tracks the spinner. */
export function useRefresh(load: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);
  return { refreshing, onRefresh };
}
