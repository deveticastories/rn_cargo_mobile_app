/**
 * Session state. The JWT lives in three places, each for a reason:
 *  - Redux (`token`, `user`)       → what screens render from
 *  - the axios client (in memory)  → attached to every request
 *  - AsyncStorage                  → survives app restarts, only when "Keep me signed in" is ticked
 */
import { createSlice } from "@reduxjs/toolkit";
import { errorMessage, setAccessToken } from "@/api/client";
import { loginRequest, roleName } from "@/services/authService";
import { clearSession, loadLastEmail, loadSession, saveLastEmail, saveSession } from "@/storage/authStorage";
import { isTokenValid } from "@/utils/jwt";
import type { AuthUser, LoadStatus } from "@/types";
import { createAppAsyncThunk } from "../thunk";

export interface AuthState {
  status: "restoring" | "authenticated" | "unauthenticated";
  user: AuthUser | null;
  token: string | null;
  loginStatus: LoadStatus;
  error: string | null;
  /** Shows the "Your session expired" notice on the sign-in screen. */
  sessionExpired: boolean;
  lastEmail: string;
}

const initialState: AuthState = {
  status: "restoring",
  user: null,
  token: null,
  loginStatus: "idle",
  error: null,
  sessionExpired: false,
  lastEmail: "",
};

export const restoreSession = createAppAsyncThunk("auth/restore", async () => {
  const [{ token, user }, lastEmail] = await Promise.all([loadSession(), loadLastEmail()]);
  if (token && user && isTokenValid(token)) {
    setAccessToken(token);
    // Sessions saved by older builds may hold the role as an object.
    return { token, user: { ...user, role: roleName(user.role) }, lastEmail: lastEmail ?? "", expired: false };
  }
  // A stored token that has since expired means the session ran out while the app was closed.
  const expired = Boolean(token);
  if (token) await clearSession();
  return { token: null, user: null, lastEmail: lastEmail ?? "", expired };
});

export const login = createAppAsyncThunk(
  "auth/login",
  async (args: { email: string; password: string; remember: boolean }, { rejectWithValue }) => {
    try {
      const { token, user } = await loginRequest(args.email.trim(), args.password);
      setAccessToken(token);
      if (args.remember) await saveSession(token, user);
      else await clearSession();
      await saveLastEmail(args.email.trim());
      return { token, user, email: args.email.trim() };
    } catch (err) {
      return rejectWithValue(errorMessage(err, "Couldn't sign in. Please try again."));
    }
  }
);

export const logout = createAppAsyncThunk("auth/logout", async () => {
  setAccessToken(null);
  await clearSession();
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /** Fired by the axios client when the server rejects the token, or locally when it expires. */
    sessionExpired(state) {
      state.status = "unauthenticated";
      state.user = null;
      state.token = null;
      state.sessionExpired = true;
      state.loginStatus = "idle";
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.fulfilled, (state, { payload }) => {
        state.lastEmail = payload.lastEmail;
        state.sessionExpired = payload.expired;
        if (payload.token && payload.user) {
          state.status = "authenticated";
          state.token = payload.token;
          state.user = payload.user;
        } else {
          state.status = "unauthenticated";
        }
      })
      .addCase(restoreSession.rejected, (state) => {
        state.status = "unauthenticated";
      })
      .addCase(login.pending, (state) => {
        state.loginStatus = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, { payload }) => {
        state.loginStatus = "succeeded";
        state.status = "authenticated";
        state.token = payload.token;
        state.user = payload.user;
        state.lastEmail = payload.email;
        state.sessionExpired = false;
      })
      .addCase(login.rejected, (state, { payload }) => {
        state.loginStatus = "failed";
        state.error = payload ?? "Couldn't sign in. Please try again.";
      })
      .addCase(logout.fulfilled, (state) => {
        state.status = "unauthenticated";
        state.user = null;
        state.token = null;
        state.sessionExpired = false;
        state.loginStatus = "idle";
      });
  },
});

/**
 * Finance users ("Fin" role) work on invoices, delivery notes and receipts
 * instead of bookings and stuffing.
 */
export const isFinanceRole = (role?: unknown) => /^fin/i.test(roleName(role));
export const selectFinanceMode = (s: { auth: AuthState }) => isFinanceRole(s.auth.user?.role);

export const { sessionExpired, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
