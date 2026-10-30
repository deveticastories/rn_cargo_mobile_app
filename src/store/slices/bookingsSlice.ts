import { createSlice } from "@reduxjs/toolkit";
import { errorMessage } from "@/api/client";
import { bookingService, type BookingInput } from "@/services/bookingService";
import type { Booking, LoadStatus } from "@/types";
import { createAppAsyncThunk } from "../thunk";
import { cacheHydrated } from "../cacheActions";

interface BookingsState {
  items: Booking[];
  status: LoadStatus;
  error: string | null;
  /** Id of the booking a write is in flight for (dims its action button). */
  mutatingId: string | null;
}

const initialState: BookingsState = { items: [], status: "idle", error: null, mutatingId: null };

export const fetchBookings = createAppAsyncThunk("bookings/fetch", async (_: void, { rejectWithValue }) => {
  try {
    return await bookingService.list();
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Couldn't load bookings."));
  }
});

/** Creates the booking, then re-reads the list so sender/receiver come back populated. */
export const createBooking = createAppAsyncThunk("bookings/create", async (input: BookingInput, { rejectWithValue }) => {
  try {
    const created = await bookingService.create(input);
    const items = await bookingService.list();
    return { items, createdId: created.id };
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Couldn't create the booking."));
  }
});

export const markReadyToShip = createAppAsyncThunk("bookings/readyToShip", async (id: string, { rejectWithValue }) => {
  try {
    await bookingService.update(id, { packingStatus: "Ready to Ship" });
    return await bookingService.list();
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Couldn't update the booking."));
  }
});

/** "Go to stuffing" — moves a ready-to-ship booking onto the stuffing queue. */
export const sendToStuffing = createAppAsyncThunk("bookings/sendToStuffing", async (id: string, { rejectWithValue }) => {
  try {
    await bookingService.updateStuffStatus(id, "Ready to Stuff");
    return await bookingService.list();
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Couldn't send the booking to stuffing."));
  }
});

/**
 * "Go to stuffing" for several bookings from the Ready to stuff list. Each one
 * is tried; the list is re-read either way and any that failed are named.
 */
export const sendManyToStuffing = createAppAsyncThunk(
  "bookings/sendManyToStuffing",
  async (ids: string[], { dispatch, getState, rejectWithValue }) => {
    const failed: string[] = [];
    await Promise.all(
      ids.map((id) =>
        bookingService.updateStuffStatus(id, "Ready to Stuff").catch(() => {
          failed.push(getState().bookings.items.find((b) => b.id === id)?.code ?? id);
        })
      )
    );
    await dispatch(fetchBookings());
    if (failed.length) return rejectWithValue(`Couldn't move ${failed.join(", ")} to stuffing — please try again.`);
  }
);

/** "Send back" — takes a booking off the stuffing queue, back to Ready to stuff. */
export const sendBackFromStuffing = createAppAsyncThunk("bookings/sendBack", async (id: string, { rejectWithValue }) => {
  try {
    await bookingService.updateStuffStatus(id, "Pending");
    return await bookingService.list();
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Couldn't send the booking back."));
  }
});

export const deleteBooking = createAppAsyncThunk("bookings/delete", async (id: string, { rejectWithValue }) => {
  try {
    await bookingService.remove(id);
    return id;
  } catch (err) {
    return rejectWithValue(errorMessage(err, "Couldn't delete the booking."));
  }
});

const bookingsSlice = createSlice({
  name: "bookings",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // Saved data from last time, only until this list has loaded from the server.
    builder.addCase(cacheHydrated, (state, { payload }) => {
      if (state.status !== "succeeded" && payload.bookings) state.items = payload.bookings;
    });

    builder
      .addCase(fetchBookings.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchBookings.fulfilled, (state, { payload }) => {
        state.status = "succeeded";
        state.items = payload;
      })
      .addCase(fetchBookings.rejected, (state, { payload }) => {
        state.status = "failed";
        state.error = payload ?? "Couldn't load bookings.";
      })
      .addCase(createBooking.fulfilled, (state, { payload }) => {
        state.items = payload.items;
      });

    for (const thunk of [markReadyToShip, sendToStuffing, sendBackFromStuffing] as const) {
      builder
        .addCase(thunk.pending, (state, { meta }) => {
          state.mutatingId = meta.arg;
        })
        .addCase(thunk.fulfilled, (state, { payload }) => {
          state.mutatingId = null;
          state.items = payload;
        })
        .addCase(thunk.rejected, (state) => {
          state.mutatingId = null;
        });
    }

    builder
      .addCase(deleteBooking.pending, (state, { meta }) => {
        state.mutatingId = meta.arg;
      })
      .addCase(deleteBooking.fulfilled, (state, { payload }) => {
        state.mutatingId = null;
        state.items = state.items.filter((b) => b.id !== payload);
      })
      .addCase(deleteBooking.rejected, (state) => {
        state.mutatingId = null;
      });
  },
});

export default bookingsSlice.reducer;
