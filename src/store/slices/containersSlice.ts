import { createSlice } from "@reduxjs/toolkit";
import { errorMessage } from "@/api/client";
import { containerService } from "@/services/containerService";
import type { Container, LoadStatus, Stuffing } from "@/types";
import { createAppAsyncThunk } from "../thunk";
import { fetchBookings } from "./bookingsSlice";

interface ContainersState {
  items: Container[];
  stuffings: Stuffing[];
  status: LoadStatus;
  error: string | null;
  stuffingStatus: LoadStatus;
}

const initialState: ContainersState = { items: [], stuffings: [], status: "idle", error: null, stuffingStatus: "idle" };

export const fetchContainers = createAppAsyncThunk("containers/fetch", async (_: void, { rejectWithValue }) => {
  try {
    const [items, stuffings] = await Promise.all([containerService.list(), containerService.listStuffings()]);
    return { items, stuffings };
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Couldn't load containers."));
  }
});

/** Loads one booking into a container (a `/stuffings` record), then refreshes both lists. */
export const loadIntoContainer = createAppAsyncThunk(
  "containers/stuff",
  async (args: { containerId: string; bookingIds: string[] }, { dispatch, rejectWithValue }) => {
    try {
      await containerService.createStuffing(args.containerId, args.bookingIds);
      await Promise.all([dispatch(fetchContainers()), dispatch(fetchBookings())]);
    } catch (err) {
      return rejectWithValue(errorMessage(err, "Couldn't load the booking into the container."));
    }
  }
);

const containersSlice = createSlice({
  name: "containers",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchContainers.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchContainers.fulfilled, (state, { payload }) => {
        state.status = "succeeded";
        state.items = payload.items;
        state.stuffings = payload.stuffings;
      })
      .addCase(fetchContainers.rejected, (state, { payload }) => {
        state.status = "failed";
        state.error = payload ?? "Couldn't load containers.";
      })
      .addCase(loadIntoContainer.pending, (state) => {
        state.stuffingStatus = "loading";
      })
      .addCase(loadIntoContainer.fulfilled, (state) => {
        state.stuffingStatus = "succeeded";
      })
      .addCase(loadIntoContainer.rejected, (state) => {
        state.stuffingStatus = "failed";
      });
  },
});

export default containersSlice.reducer;
