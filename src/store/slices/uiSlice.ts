import { createSlice } from "@reduxjs/toolkit";
import { loadThemePreference, saveThemePreference } from "@/storage/authStorage";
import type { ThemePreference } from "@/types";
import { createAppAsyncThunk } from "../thunk";

interface UiState {
  themePreference: ThemePreference;
}

const initialState: UiState = { themePreference: "system" };

export const loadTheme = createAppAsyncThunk("ui/loadTheme", () => loadThemePreference());

export const setThemePreference = createAppAsyncThunk("ui/setTheme", async (pref: ThemePreference) => {
  await saveThemePreference(pref);
  return pref;
});

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadTheme.fulfilled, (state, { payload }) => {
        state.themePreference = payload;
      })
      // Apply instantly; persistence happens in the background.
      .addCase(setThemePreference.pending, (state, { meta }) => {
        state.themePreference = meta.arg;
      });
  },
});

export default uiSlice.reducer;
