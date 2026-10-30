/**
 * Add receipt entry — the web console's Receipt entry form: a payment received
 * against an invoice. Only invoices with a balance left are offered; the
 * receivable is the invoice amount minus what earlier receipts already
 * received, and the delivery partner amount starts at the invoice's delivery
 * charge on its first receipt.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { errorMessage } from "@/api/client";
import { Button } from "@/components/Button";
import { DatePickerField } from "@/components/DatePickerField";
import { IconButton } from "@/components/primitives";
import { NavHeader, Notice, Screen } from "@/components/Screen";
import { SelectField } from "@/components/SelectSheet";
import { TextField } from "@/components/TextField";
import type { RootScreenProps } from "@/navigation/types";
import { financeService } from "@/services/financeService";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchFinance } from "@/store/slices/financeSlice";
import { useTheme } from "@/theme/ThemeProvider";
import { money, todayISO } from "@/utils/format";

const amount = (v: string) => v.replace(/[^\d.]/g, "").replace(/^(\d*\.?\d{0,2}).*$/, "$1");

export function ReceiptEntryScreen({ navigation }: RootScreenProps<"ReceiptEntry">) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const invoices = useAppSelector((s) => s.finance.invoices);
  const receipts = useAppSelector((s) => s.finance.receipts);

  const [receivedDate, setReceivedDate] = useState(todayISO());
  const [invoiceId, setInvoiceId] = useState("");
  const [received, setReceived] = useState("");
  const [partnerAmount, setPartnerAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatch(fetchFinance());
  }, [dispatch]);

  const receivedSoFar = (id: string) => receipts.filter((r) => r.invoiceId === id).reduce((n, r) => n + r.receivedAmount, 0);
  const balanceOf = (id: string) => Math.max(0, (invoices.find((i) => i.id === id)?.amount ?? 0) - receivedSoFar(id));

  // Only invoices that still have something left to receive.
  const options = useMemo(
    () =>
      invoices
        .filter((i) => i.id === invoiceId || balanceOf(i.id) > 0)
        .map((i) => ({ value: i.id, label: i.code, sublabel: `${i.bookingCode} · ${money(balanceOf(i.id))} due` })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, receipts, invoiceId]
  );

  const invoice = invoices.find((i) => i.id === invoiceId);
  const receivable = invoice ? balanceOf(invoice.id) : 0;

  const chooseInvoice = (id: string) => {
    setInvoiceId(id);
    setReceived("");
    const inv = invoices.find((i) => i.id === id);
    // The delivery partner is paid once: pre-fill their charge only on the invoice's first receipt.
    const first = !receipts.some((r) => r.invoiceId === id);
    setPartnerAmount(inv && first && inv.deliveryCharge ? String(inv.deliveryCharge) : "0");
    setError(null);
  };

  const save = async () => {
    if (!receivedDate || !invoice) return setError("Received date and invoice number are required.");
    const got = Number(received);
    if (!(got > 0)) return setError("Enter the received amount.");
    if (got > receivable) return setError(`Received amount can't be more than the ${money(receivable)} still due.`);
    const partner = Number(partnerAmount || 0);
    if (!(partner >= 0)) return setError("Delivery partner amount can't be negative.");
    setError(null);
    setSaving(true);
    try {
      await financeService.createReceipt({
        invoiceId: invoice.id,
        date: todayISO(),
        receivableAmount: receivable,
        receivedAmount: got,
        receivedDate,
        deliveryPartnerAmount: partner,
      });
      await dispatch(fetchFinance());
      Alert.alert("Receipt saved", `${money(got)} received against ${invoice.code}.`);
      navigation.goBack();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save the receipt."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <NavHeader left={<IconButton icon={X} onPress={() => navigation.goBack()} accessibilityLabel="Close" />} title="Add receipt entry" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error && <Notice message={error} tone="danger" />}
          <DatePickerField label="Received date" value={receivedDate} onChange={setReceivedDate} />
          <SelectField
            label="Invoice number"
            placeholder="Choose invoice number"
            value={invoiceId}
            options={options}
            onChange={chooseInvoice}
            emptyText="No invoices with a balance due."
          />
          {invoice && (
            <>
              <TextField label="Invoice amount (receivable amount)" value={money(receivable)} editable={false} />
              <TextField
                label="Received amount"
                value={received}
                onChangeText={(v) => setReceived(amount(v))}
                keyboardType="decimal-pad"
                placeholder="0"
              />
              <TextField
                label={`Delivery partner amount${invoice.deliveryPartner ? ` (${invoice.deliveryPartner})` : ""}`}
                value={partnerAmount}
                onChangeText={(v) => setPartnerAmount(amount(v))}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </>
          )}
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: t.bg, paddingBottom: insets.bottom + 12 }]}>
          <Button title="Save receipt" icon={Check} onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30 },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
});
