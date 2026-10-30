/**
 * "Make sure this list is loaded" for screens opening up. Unlike the plain
 * fetch thunks, these skip the request when the list loaded less than a minute
 * ago or a load is already running — opening a screen no longer waits on a
 * round trip for data the app already has. Pull-to-refresh, Retry and the
 * reload after a save keep using the fetch thunks, which always go to the server.
 */
import type { MasterKey } from "@/features/masters/config";
import { isFresh } from "./cache";
import { fetchBookings } from "./slices/bookingsSlice";
import { fetchContainers } from "./slices/containersSlice";
import { fetchFinance } from "./slices/financeSlice";
import { fetchMaster } from "./slices/mastersSlice";
import type { AppDispatch, RootState } from "./index";

const FRESH_MS = 60_000;

type Thunk = (dispatch: AppDispatch, getState: () => RootState) => void;

export const ensureBookings = (): Thunk => (dispatch, getState) => {
  if (getState().bookings.status === "loading" || isFresh("bookings", FRESH_MS)) return;
  void dispatch(fetchBookings());
};

export const ensureContainers = (): Thunk => (dispatch, getState) => {
  if (getState().containers.status === "loading" || isFresh("containers", FRESH_MS)) return;
  void dispatch(fetchContainers());
};

export const ensureFinance = (): Thunk => (dispatch, getState) => {
  if (getState().finance.status === "loading" || isFresh("finance", FRESH_MS)) return;
  void dispatch(fetchFinance());
};

export const ensureMaster =
  (key: MasterKey): Thunk =>
  (dispatch, getState) => {
    if (getState().masters[key].status === "loading" || isFresh(`masters/${key}`, FRESH_MS)) return;
    void dispatch(fetchMaster(key));
  };
