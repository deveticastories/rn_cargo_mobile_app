import { createAsyncThunk } from "@reduxjs/toolkit";
import type { AppDispatch, RootState } from "./index";

/** `createAsyncThunk` pre-typed with the app's state, dispatch, and a string reject value. */
export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
  rejectValue: string;
}>();
