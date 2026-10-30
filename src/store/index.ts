import { combineReducers, configureStore, type UnknownAction } from "@reduxjs/toolkit";
import { setSessionExpiredHandler } from "@/api/client";
import { clearSession } from "@/storage/authStorage";
import { cacheListener } from "./cache";
import authReducer, { logout, sessionExpired } from "./slices/authSlice";
import bookingsReducer from "./slices/bookingsSlice";
import containersReducer from "./slices/containersSlice";
import financeReducer from "./slices/financeSlice";
import mastersReducer from "./slices/mastersSlice";
import uiReducer from "./slices/uiSlice";

const appReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  bookings: bookingsReducer,
  containers: containersReducer,
  finance: financeReducer,
  masters: mastersReducer,
});

type AppState = ReturnType<typeof appReducer>;

/** Signing out (or the session expiring) wipes every cached list so the next user starts clean. */
const rootReducer = (state: AppState | undefined, action: UnknownAction): AppState => {
  if (state && (logout.fulfilled.match(action) || sessionExpired.match(action))) {
    return appReducer({ auth: state.auth, ui: state.ui } as AppState, action);
  }
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefault) => getDefault().prepend(cacheListener.middleware),
});

// The axios client reports rejected/expired tokens here.
setSessionExpiredHandler(() => {
  store.dispatch(sessionExpired());
  void clearSession();
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
