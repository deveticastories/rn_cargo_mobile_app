import { useCallback, useEffect, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import { ensureBookings, ensureContainers, ensureFinance, ensureMaster } from "@/store/ensure";

/**
 * Everything the tab screens summarise, loaded once after sign-in. Each list
 * loads independently so a slow or failing endpoint doesn't block the rest.
 */
export function useBootstrapData() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(ensureBookings());
    dispatch(ensureContainers());
    dispatch(ensureFinance());
    dispatch(ensureMaster("customers"));
    dispatch(ensureMaster("pickupAssigns"));
    dispatch(ensureMaster("pickupPartners"));
    dispatch(ensureMaster("team"));
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
