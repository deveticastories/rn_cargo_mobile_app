import { createSlice } from "@reduxjs/toolkit";
import { errorMessage } from "@/api/client";
import { containerService } from "@/services/containerService";
import { bookingService } from "@/services/bookingService";
import type { BookingPackage, Container, LoadStatus, Stuffing } from "@/types";
import { createAppAsyncThunk } from "../thunk";
import { cacheHydrated } from "../cacheActions";
import { fetchBookings } from "./bookingsSlice";

interface ContainersState {
  items: Container[];
  stuffings: Stuffing[];
  packages: BookingPackage[];
  status: LoadStatus;
  error: string | null;
  stuffingStatus: LoadStatus;
}

const initialState: ContainersState = { items: [], stuffings: [], packages: [], status: "idle", error: null, stuffingStatus: "idle" };

export const fetchContainers = createAppAsyncThunk("containers/fetch", async (_: void, { rejectWithValue }) => {
  try {
    const [items, stuffings, packages] = await Promise.all([
      containerService.list(),
      containerService.listStuffings(),
      // Like the web console, a failed packing-list load just means nothing counts as packed yet.
      containerService.listPackages().catch(() => [] as BookingPackage[]),
    ]);
    return { items, stuffings, packages };
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Couldn't load containers."));
  }
});

/**
 * "Submit stuffing" (same steps as the web console): records the bookings in
 * the container, marks each booking Stuffed, then refreshes both lists.
 */
export const loadIntoContainer = createAppAsyncThunk(
  "containers/stuff",
  async (args: { containerId: string; bookingIds: string[] }, { dispatch, rejectWithValue }) => {
    try {
      await containerService.createStuffing(args.containerId, args.bookingIds);
      await Promise.all(args.bookingIds.map((id) => bookingService.updateStuffStatus(id, "Stuffed")));
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
    // Saved data from last time, only until this list has loaded from the server.
    builder.addCase(cacheHydrated, (state, { payload }) => {
      if (state.status === "succeeded" || !payload.containers) return;
      state.items = payload.containers.items;
      state.stuffings = payload.containers.stuffings;
      state.packages = payload.containers.packages ?? [];
    });

    builder
      .addCase(fetchContainers.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchContainers.fulfilled, (state, { payload }) => {
        state.status = "succeeded";
        state.items = payload.items;
        state.stuffings = payload.stuffings;
        state.packages = payload.packages;
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
