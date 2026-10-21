/**
 * Raw records for every master/operations module, keyed by `MasterKey`.
 * Screens describe them through `MASTERS` config; booking creation also reads
 * customers, pickup partners and pickup assigns from here.
 */
import { createSlice } from "@reduxjs/toolkit";
import { errorMessage } from "@/api/client";
import { MASTERS, formValuesToPayload, type MasterKey } from "@/features/masters/config";
import { masterService } from "@/services/masterService";
import { nextSequentialCode } from "@/services/mappers";
import type { BackendDoc, LoadStatus } from "@/types";
import { createAppAsyncThunk } from "../thunk";

interface MasterEntry {
  items: BackendDoc[];
  status: LoadStatus;
  error: string | null;
}

type MastersState = Record<MasterKey, MasterEntry> & { mutatingId: string | null };

const emptyEntry = (): MasterEntry => ({ items: [], status: "idle", error: null });

const initialState: MastersState = {
  ...(Object.fromEntries((Object.keys(MASTERS) as MasterKey[]).map((k) => [k, emptyEntry()])) as Record<MasterKey, MasterEntry>),
  mutatingId: null,
};

export const fetchMaster = createAppAsyncThunk("masters/fetch", async (key: MasterKey, { rejectWithValue }) => {
  try {
    return { key, items: await masterService.list(MASTERS[key]) };
  } catch (err) {
    return rejectWithValue(errorMessage(err, `Couldn't load ${MASTERS[key].title.toLowerCase()}.`));
  }
});

/** Create (no `id`) or update a record from form values, then re-read the list so refs come back populated. */
export const saveMaster = createAppAsyncThunk(
  "masters/save",
  async (args: { key: MasterKey; id?: string; values: Record<string, string> }, { getState, rejectWithValue }) => {
    const def = MASTERS[args.key];
    try {
      const payload = formValuesToPayload(def, args.values);
      if (args.id) {
        await masterService.update(def, args.id, payload);
      } else {
        if (def.hasStatus) payload.status = true;
        if (def.autoCode) {
          // Generate from the freshest list so two devices don't pick the same code.
          const latest = await masterService.list(def).catch(() => getState().masters[args.key].items);
          payload[def.autoCode.field] = nextSequentialCode(latest, def.autoCode.field, def.autoCode.prefix);
        }
        await masterService.create(def, payload);
      }
      return { key: args.key, items: await masterService.list(def) };
    } catch (err) {
      return rejectWithValue(errorMessage(err, `Couldn't save the ${def.singular}.`));
    }
  }
);

export const toggleMasterStatus = createAppAsyncThunk(
  "masters/toggleStatus",
  async (args: { key: MasterKey; id: string; next: boolean }, { rejectWithValue }) => {
    const def = MASTERS[args.key];
    try {
      await masterService.update(def, args.id, { status: args.next });
      return { key: args.key, id: args.id, next: args.next };
    } catch (err) {
      return rejectWithValue(errorMessage(err, "Couldn't update the status."));
    }
  }
);

export const deleteMaster = createAppAsyncThunk(
  "masters/delete",
  async (args: { key: MasterKey; id: string }, { rejectWithValue }) => {
    try {
      await masterService.remove(MASTERS[args.key], args.id);
      return args;
    } catch (err) {
      return rejectWithValue(errorMessage(err, `Couldn't delete the ${MASTERS[args.key].singular}.`));
    }
  }
);

const mastersSlice = createSlice({
  name: "masters",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMaster.pending, (state, { meta }) => {
        state[meta.arg].status = "loading";
        state[meta.arg].error = null;
      })
      .addCase(fetchMaster.fulfilled, (state, { payload }) => {
        state[payload.key].status = "succeeded";
        state[payload.key].items = payload.items;
      })
      .addCase(fetchMaster.rejected, (state, { meta, payload }) => {
        state[meta.arg].status = "failed";
        state[meta.arg].error = payload ?? "Couldn't load.";
      })
      .addCase(saveMaster.fulfilled, (state, { payload }) => {
        state[payload.key].items = payload.items;
      })
      .addCase(toggleMasterStatus.pending, (state, { meta }) => {
        state.mutatingId = meta.arg.id;
      })
      .addCase(toggleMasterStatus.fulfilled, (state, { payload }) => {
        state.mutatingId = null;
        const doc = state[payload.key].items.find((d) => d._id === payload.id);
        if (doc) doc.status = payload.next;
      })
      .addCase(toggleMasterStatus.rejected, (state) => {
        state.mutatingId = null;
      })
      .addCase(deleteMaster.pending, (state, { meta }) => {
        state.mutatingId = meta.arg.id;
      })
      .addCase(deleteMaster.fulfilled, (state, { payload }) => {
        state.mutatingId = null;
        state[payload.key].items = state[payload.key].items.filter((d) => d._id !== payload.id);
      })
      .addCase(deleteMaster.rejected, (state) => {
        state.mutatingId = null;
      });
  },
});

export default mastersSlice.reducer;
