import { useCallback, useEffect, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import { fetchBookings } from "@/store/slices/bookingsSlice";
import { fetchContainers } from "@/store/slices/containersSlice";
import { fetchFinance } from "@/store/slices/financeSlice";
import { fetchMaster } from "@/store/slices/mastersSlice";

/**
 * Everything the tab screens summarise, loaded once after sign-in. Each list
 * loads independently so a slow or failing endpoint doesn't block the rest.
 */
export function useBootstrapData() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(fetchBookings());
    dispatch(fetchContainers());
    dispatch(fetchFinance());
    dispatch(fetchMaster("customers"));
    dispatch(fetchMaster("pickupAssigns"));
    dispatch(fetchMaster("pickupPartners"));
    dispatch(fetchMaster("team"));
  }, [dispatch]);
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
