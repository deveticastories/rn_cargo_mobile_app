/** Invoices, receipt entries, daily expenses and petty-cash credit notes. */
import { api } from "@/api/client";
import { API_ENDPOINTS } from "@/api/endpoints";
import type { BackendDoc, CreditNoteEntry, DailyExpense, Invoice, ReceiptEntry } from "@/types";
import { fallbackCode, listFrom, num, refField, refId, str } from "./mappers";

function toInvoice(doc: BackendDoc): Invoice {
  const charge = refField(doc.deliveryPartner, "charge");
  return {
    id: doc._id,
    code: str(doc.invoiceNo ?? doc._id),
    bookingId: refId(doc.booking),
    bookingCode: str(refField(doc.booking, "bookingId") ?? ""),
    containerId: refId(doc.container),
    container: refField(doc.container, "containerCode") ? str(refField(doc.container, "containerCode")) : undefined,
    deliveryPartner: refField(doc.deliveryPartner, "name") ? str(refField(doc.deliveryPartner, "name")) : undefined,
    deliveryCharge: charge !== undefined ? num(charge) : undefined,
    subtotal: num(doc.subtotal),
    additionalCharges: num(doc.additionalCharges),
    receivableDiscount: num(doc.receivableDiscount),
    amount: num(doc.total),
    createdAt: doc.createdAt ? str(doc.createdAt) : undefined,
  };
}

function toReceipt(doc: BackendDoc): ReceiptEntry {
  return {
    id: doc._id,
    code: fallbackCode("RCP", doc._id),
    date: str(doc.date),
    invoiceId: refId(doc.invoice),
    invoiceNo: str(refField(doc.invoice, "invoiceNo") ?? ""),
    receivableAmount: num(doc.receivableAmount),
    receivedAmount: num(doc.receivedAmount),
    balanceAmount: num(doc.balanceAmount),
    receivedDate: str(doc.receivedDate),
    deliveryPartnerAmount: num(doc.deliveryPartnerAmount),
    deliveryPartnerStatus: doc.deliveryPartnerStatus === "Paid" ? "Paid" : "Pending",
  };
}

function toExpense(doc: BackendDoc): DailyExpense {
  return {
    id: doc._id,
    code: fallbackCode("EXP", doc._id),
    date: str(doc.date),
    type: str(doc.expenseType),
    paymentType: (doc.paymentType as DailyExpense["paymentType"]) ?? "",
    amount: num(doc.amount),
    description: doc.description ? str(doc.description) : "",
  };
}

function toCreditNote(doc: BackendDoc): CreditNoteEntry {
  return {
    id: doc._id,
    code: fallbackCode("CRN", doc._id),
    date: str(doc.createdAt),
    amount: num(doc.amount),
    description: doc.description ? str(doc.description) : "",
  };
}

export const financeService = {
  async listInvoices(): Promise<Invoice[]> {
    const { data } = await api.get(API_ENDPOINTS.INVOICES.BASE);
    return listFrom(data, "invoiceList").map(toInvoice);
  },
  async listReceipts(): Promise<ReceiptEntry[]> {
    const { data } = await api.get(API_ENDPOINTS.RECEIPT_ENTRIES.BASE);
    return listFrom(data, "receiptEntryList").map(toReceipt);
  },
  async listExpenses(): Promise<DailyExpense[]> {
    const { data } = await api.get(API_ENDPOINTS.DAILY_EXPENSES.BASE);
    return listFrom(data, "data").map(toExpense);
  },
  async listCreditNotes(): Promise<CreditNoteEntry[]> {
    // This one nests a level deeper: `{ creditNotes: { creditNoteList, pettyCashBalance, ... } }`.
    const { data } = await api.get<{ creditNotes?: { creditNoteList?: BackendDoc[] } }>(API_ENDPOINTS.CREDIT_NOTES.BASE);
    return (data.creditNotes?.creditNoteList ?? []).map(toCreditNote);
  },
  async createExpense(body: { date: string; type: string; paymentType: string; amount: number; description?: string }) {
    await api.post(API_ENDPOINTS.DAILY_EXPENSES.BASE, {
      date: body.date,
      expenseType: body.type,
      paymentType: body.paymentType,
      amount: body.amount,
      description: body.description,
    });
  },
};
