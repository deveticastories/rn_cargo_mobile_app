/**
 * Makes the cargo-backend round trips (~1 s each) hurt less:
 *
 *  - Freshness: every successful list load is timestamped, so `ensure.ts` can
 *    skip asking again for a list that loaded moments ago.
 *  - Device cache: the lists are saved per user (debounced) and restored on
 *    the next launch, so screens open with the last data instead of a spinner
 *    while the fresh copy loads. Signing out deletes them.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { MASTERS, type MasterKey } from "@/features/masters/config";
import { cacheHydrated, type CachedData } from "./cacheActions";
import { login, logout, restoreSession, sessionExpired } from "./slices/authSlice";
import { fetchBookings } from "./slices/bookingsSlice";
import { fetchContainers } from "./slices/containersSlice";
import { fetchFinance } from "./slices/financeSlice";
import { fetchMaster, saveMaster } from "./slices/mastersSlice";
import type { RootState } from "./index";

/* ------------------------------- Freshness ------------------------------- */

const loadedAt = new Map<string, number>();

/** True if this list was loaded from the server less than `maxAgeMs` ago. */
export function isFresh(resource: string, maxAgeMs: number): boolean {
  const at = loadedAt.get(resource);
  return at !== undefined && Date.now() - at < maxAgeMs;
}

/* ------------------------------ Device cache ----------------------------- */

const PREFIX = "@cargo/cache/";
const SECTIONS = ["bookings", "containers", "finance", "masters"] as const;
type Section = (typeof SECTIONS)[number];
/** Android's AsyncStorage can't read back very large single values; skip anything bigger. */
const MAX_ENTRY_CHARS = 1_500_000;

const keyFor = (userId: string, section: Section) => `${PREFIX}${userId}/${section}`;

function snapshot(state: RootState): Record<Section, unknown> {
  const masters: Partial<Record<MasterKey, unknown>> = {};
  for (const k of Object.keys(MASTERS) as MasterKey[]) if (state.masters[k].items.length) masters[k] = state.masters[k].items;
  return {
    bookings: state.bookings.items,
    containers: { items: state.containers.items, stuffings: state.containers.stuffings, packages: state.containers.packages },
    finance: {
      invoices: state.finance.invoices,
      receipts: state.finance.receipts,
      expenses: state.finance.expenses,
      creditNotes: state.finance.creditNotes,
    },
    masters,
  };
}

async function readCache(userId: string): Promise<CachedData> {
  const entries = await AsyncStorage.multiGet(SECTIONS.map((s) => keyFor(userId, s)));
  const data: CachedData = {};
  entries.forEach(([, value], i) => {
    if (!value) return;
    try {
      (data as Record<string, unknown>)[SECTIONS[i]] = JSON.parse(value);
    } catch {
      // A damaged entry is just ignored; the fresh load will replace it.
    }
  });
  return data;
}

async function clearAllCaches() {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
  if (keys.length) await AsyncStorage.multiRemove(keys);
}

/* ------------------------------- Listeners ------------------------------- */

export const cacheListener = createListenerMiddleware();

// Timestamp every successful load (including pull-to-refresh and post-save reloads).
cacheListener.startListening({
  matcher: isAnyOf(fetchBookings.fulfilled, fetchContainers.fulfilled, fetchFinance.fulfilled, fetchMaster.fulfilled, saveMaster.fulfilled),
  effect: (action) => {
    if (fetchBookings.fulfilled.match(action)) loadedAt.set("bookings", Date.now());
    else if (fetchContainers.fulfilled.match(action)) loadedAt.set("containers", Date.now());
    else if (fetchFinance.fulfilled.match(action)) loadedAt.set("finance", Date.now());
    else if (fetchMaster.fulfilled.match(action) || saveMaster.fulfilled.match(action)) loadedAt.set(`masters/${action.payload.key}`, Date.now());
  },
});

// Signed in (or session restored): show what this user had last time while fresh data loads.
cacheListener.startListening({
  matcher: isAnyOf(restoreSession.fulfilled, login.fulfilled),
  effect: async (action, api) => {
    const userId = (action as { payload?: { user?: { id?: string } | null } }).payload?.user?.id;
    if (!userId) return;
    try {
      api.dispatch(cacheHydrated(await readCache(userId)));
    } catch {
      // No cache is fine — the screens load from the server as usual.
    }
  },
});

// Signed out or expired: forget every cached list and every freshness stamp.
cacheListener.startListening({
  matcher: isAnyOf(logout.fulfilled, sessionExpired),
  effect: async () => {
    loadedAt.clear();
    await clearAllCaches().catch(() => {});
  },
});

// Save the lists a moment after they change (one write per burst of updates).
cacheListener.startListening({
  predicate: (_action, current, previous) => {
    const now = current as RootState;
    const before = previous as RootState;
    return (
      now.auth.status === "authenticated" &&
      (now.bookings.items !== before.bookings.items ||
        now.containers !== before.containers ||
        now.finance !== before.finance ||
        now.masters !== before.masters)
    );
  },
  effect: async (_action, api) => {
    api.cancelActiveListeners();
    await api.delay(1500);
    const state = api.getState() as RootState;
    const userId = state.auth.user?.id;
    if (!userId || state.auth.status !== "authenticated") return;
    const snap = snapshot(state);
    const pairs: [string, string][] = [];
    for (const section of SECTIONS) {
      const json = JSON.stringify(snap[section]);
      if (json.length <= MAX_ENTRY_CHARS) pairs.push([keyFor(userId, section), json]);
    }
    await AsyncStorage.multiSet(pairs).catch(() => {});
  },
});
