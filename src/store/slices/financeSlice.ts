import { createSlice } from "@reduxjs/toolkit";
import { errorMessage } from "@/api/client";
import { financeService } from "@/services/financeService";
import type { CreditNoteEntry, DailyExpense, Invoice, LoadStatus, ReceiptEntry } from "@/types";
import { createAppAsyncThunk } from "../thunk";

interface FinanceState {
  invoices: Invoice[];
  receipts: ReceiptEntry[];
  expenses: DailyExpense[];
  creditNotes: CreditNoteEntry[];
  status: LoadStatus;
  error: string | null;
}

const initialState: FinanceState = {
  invoices: [],
  receipts: [],
  expenses: [],
  creditNotes: [],
  status: "idle",
  error: null,
};

/**
 * Loads all four finance lists side by side. One failing list (e.g. a role
 * without access) shouldn't blank the others, so each settles independently.
 */
export const fetchFinance = createAppAsyncThunk("finance/fetch", async (_: void, { getState }) => {
  const prev = getState().finance;
  const [invoices, receipts, expenses, creditNotes] = await Promise.allSettled([
    financeService.listInvoices(),
    financeService.listReceipts(),
    financeService.listExpenses(),
    financeService.listCreditNotes(),
  ]);
  const failed = [invoices, receipts, expenses, creditNotes].find((r) => r.status === "rejected") as
    | PromiseRejectedResult
    | undefined;
  return {
    invoices: invoices.status === "fulfilled" ? invoices.value : prev.invoices,
    receipts: receipts.status === "fulfilled" ? receipts.value : prev.receipts,
    expenses: expenses.status === "fulfilled" ? expenses.value : prev.expenses,
    creditNotes: creditNotes.status === "fulfilled" ? creditNotes.value : prev.creditNotes,
    error: failed ? errorMessage(failed.reason, "Some finance data couldn't be loaded.") : null,
  };
});

export const addExpense = createAppAsyncThunk(
  "finance/addExpense",
  async (
    body: { date: string; type: string; paymentType: string; amount: number; description?: string },
    { dispatch, rejectWithValue }
  ) => {
    try {
      await financeService.createExpense(body);
      await dispatch(fetchFinance());
    } catch (err) {
      return rejectWithValue(errorMessage(err, "Couldn't save the expense."));
    }
  }
);

const financeSlice = createSlice({
  name: "finance",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchFinance.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchFinance.fulfilled, (state, { payload }) => {
        state.status = payload.error ? "failed" : "succeeded";
        state.invoices = payload.invoices;
        state.receipts = payload.receipts;
        state.expenses = payload.expenses;
        state.creditNotes = payload.creditNotes;
        state.error = payload.error;
      })
      .addCase(fetchFinance.rejected, (state) => {
        state.status = "failed";
        state.error = "Couldn't load finance data.";
      });
  },
});

export default financeSlice.reducer;
