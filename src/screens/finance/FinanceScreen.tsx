/** 07 · Finance — invoices, receipts, expenses and petty cash. */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChartColumn, ChevronLeft, FileText, Plus, Receipt, Wallet, X } from "lucide-react-native";
import { Button } from "@/components/Button";
import { Badge, Card, IconButton, IconTile, ProgressBar, SectionTitle } from "@/components/primitives";
import { EmptyView, Notice, Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { TextField } from "@/components/TextField";
import { Txt } from "@/components/Txt";
import { useRefresh } from "@/hooks/useBootstrapData";
import type { MoreScreenProps } from "@/navigation/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { INVOICE_TONE, invoiceStatus, selectPettyCash, selectReceivedByInvoice } from "@/store/selectors";
import { fetchBookings } from "@/store/slices/bookingsSlice";
import { addExpense, fetchFinance } from "@/store/slices/financeSlice";
import { useTheme } from "@/theme/ThemeProvider";
import type { PaymentType } from "@/types";
import { isSameMonth, money, shortDate, todayISO } from "@/utils/format";

type Tab = "invoices" | "receipts" | "expenses";
const TABS = ["invoices", "receipts", "expenses"] as const;
const TAB_LABELS = { invoices: "Invoices", receipts: "Receipts", expenses: "Expenses" } as const;
const PAGE = 8;

export function FinanceScreen({ navigation, route }: MoreScreenProps<"Finance">) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const { invoices, receipts, expenses, error } = useAppSelector((s) => s.finance);
  const bookings = useAppSelector((s) => s.bookings.items);
  const receivedByInvoice = useAppSelector(selectReceivedByInvoice);
  const pettyCash = useAppSelector(selectPettyCash);

  const [tab, setTab] = useState<Tab>(route.params?.tab ?? "invoices");
  const [monthOnly, setMonthOnly] = useState(true);
  // Shortcuts (dashboard "Invoice", booking detail) can deep-link to a tab while this screen is already open.
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);
  const [showAll, setShowAll] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const load = useCallback(() => Promise.all([dispatch(fetchFinance()), dispatch(fetchBookings())]), [dispatch]);
  const { refreshing, onRefresh } = useRefresh(load);

  const inScope = useCallback((date?: string) => !monthOnly || isSameMonth(date), [monthOnly]);
  const scopeLabel = monthOnly ? "this month" : "overall";

  const bookingById = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);

  const invoiceRows = useMemo(
    () =>
      invoices
        .filter((i) => inScope(i.createdAt))
        .sort((a, b) => (b.code > a.code ? 1 : -1))
        .map((inv) => {
          const received = receivedByInvoice.get(inv.id) ?? 0;
          const booking = bookingById.get(inv.bookingId);
          return { inv, received, status: invoiceStatus(inv, received), party: booking?.receiver.name || booking?.sender.name || inv.bookingCode || "—" };
        }),
    [invoices, inScope, receivedByInvoice, bookingById]
  );
  const receiptRows = useMemo(() => receipts.filter((r) => inScope(r.receivedDate || r.date)).sort((a, b) => (b.id > a.id ? 1 : -1)), [receipts, inScope]);
  const expenseRows = useMemo(() => expenses.filter((e) => inScope(e.date)).sort((a, b) => (b.date > a.date ? 1 : -1)), [expenses, inScope]);

  const invoiced = invoiceRows.reduce((s, r) => s + r.inv.amount, 0);
  const collected = invoiceRows.reduce((s, r) => s + Math.min(r.received, r.inv.amount), 0);
  const receivedTotal = receiptRows.reduce((s, r) => s + r.receivedAmount, 0);
  const partnerPending = receiptRows.filter((r) => r.deliveryPartnerStatus === "Pending").reduce((s, r) => s + r.deliveryPartnerAmount, 0);
  const balancePending = receiptRows.reduce((s, r) => s + r.balanceAmount, 0);
  const spent = expenseRows.reduce((s, e) => s + e.amount, 0);
  const cash = expenseRows.filter((e) => e.paymentType === "Cash").reduce((s, e) => s + e.amount, 0);

  const summary = {
    invoices: {
      title: `Outstanding ${scopeLabel}`,
      value: invoiced - collected,
      progress: invoiced ? collected / invoiced : 0,
      left: `${invoiced ? Math.round((collected / invoiced) * 100) : 0}% collected`,
      right: `of ${money(invoiced)}`,
      tiles: [
        { label: "Received", value: money(collected), positive: true },
        { label: "Petty cash", value: money(pettyCash) },
      ],
    },
    receipts: {
      title: `Received ${scopeLabel}`,
      value: receivedTotal,
      progress: receivedTotal + balancePending ? receivedTotal / (receivedTotal + balancePending) : 0,
      left: `${receiptRows.length} receipt${receiptRows.length === 1 ? "" : "s"}`,
      right: `${money(balancePending)} balance`,
      tiles: [
        { label: "Balance pending", value: money(balancePending) },
        { label: "Partner payouts due", value: money(partnerPending) },
      ],
    },
    expenses: {
      title: `Spent ${scopeLabel}`,
      value: spent,
      progress: spent ? cash / spent : 0,
      left: `${spent ? Math.round((cash / spent) * 100) : 0}% cash`,
      right: `${expenseRows.length} entries`,
      tiles: [
        { label: "Cash · UPI", value: `${money(cash)} · ${money(spent - cash)}` },
        { label: "Petty cash", value: money(pettyCash), positive: pettyCash >= 0 },
      ],
    },
  }[tab];

  const listLength = tab === "invoices" ? invoiceRows.length : tab === "receipts" ? receiptRows.length : expenseRows.length;
  const limit = showAll ? Infinity : PAGE;

  return (
    <Screen>
      <View style={styles.header}>
        {navigation.canGoBack() && <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} accessibilityLabel="Back" />}
        <Txt size={30} weight="bold" style={{ flex: 1, marginLeft: navigation.canGoBack() ? 12 : 0 }}>
          Finance
        </Txt>
        <IconButton
          icon={ChartColumn}
          filled={!monthOnly}
          onPress={() => setMonthOnly((m) => !m)}
          accessibilityLabel={monthOnly ? "Show all-time totals" : "Show this month"}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Segmented
          options={TABS}
          value={tab}
          labels={TAB_LABELS}
          onChange={(v) => {
            setTab(v);
            setShowAll(false);
          }}
        />

        {error && (
          <View style={{ marginTop: 14 }}>
            <Notice message={error} onRetry={() => dispatch(fetchFinance())} />
          </View>
        )}

        <Card style={{ marginTop: 14 }}>
          <Txt size={13} muted>
            {summary.title}
          </Txt>
          <Txt size={34} weight="bold" style={{ marginTop: 4, lineHeight: 40 }}>
            {money(summary.value)}
          </Txt>
          <View style={{ marginTop: 14 }}>
            <ProgressBar value={summary.progress} color={t.tones.success.fg} height={7} />
          </View>
          <View style={styles.between}>
            <Txt size={12} muted>
              {summary.left}
            </Txt>
            <Txt size={12} muted>
              {summary.right}
            </Txt>
          </View>
          <View style={styles.tiles}>
            {summary.tiles.map((tile) => (
              <View key={tile.label} style={[styles.tile, { backgroundColor: t.surfaceAlt }]}>
                <Txt size={12} muted>
                  {tile.label}
                </Txt>
                <Txt size={17} weight="bold" color={"positive" in tile && tile.positive ? t.tones.success.fg : t.text} style={{ marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
                  {tile.value}
                </Txt>
              </View>
            ))}
          </View>
        </Card>

        <SectionTitle
          title={TAB_LABELS[tab]}
          action={tab === "expenses" ? "+ Add" : listLength > PAGE ? (showAll ? "Show less" : "See all") : undefined}
          onAction={() => (tab === "expenses" ? setExpenseOpen(true) : setShowAll((s) => !s))}
        />

        <Card padded={false}>
          {listLength === 0 && <EmptyView title={`No ${TAB_LABELS[tab].toLowerCase()} ${scopeLabel}`} message={monthOnly ? "Tap the chart button to see all-time." : undefined} />}

          {tab === "invoices" &&
            invoiceRows.slice(0, limit).map(({ inv, status, party }, i, arr) => (
              <Row
                key={inv.id}
                last={i === arr.length - 1}
                icon={<IconTile icon={FileText} tone={INVOICE_TONE[status]} size={40} />}
                title={party}
                subtitle={`${inv.code}${inv.container ? ` · ${inv.container}` : ""}`}
                amount={money(inv.amount)}
                badge={<Badge label={status} tone={INVOICE_TONE[status]} size="sm" />}
              />
            ))}

          {tab === "receipts" &&
            receiptRows.slice(0, limit).map((r, i, arr) => (
              <Row
                key={r.id}
                last={i === arr.length - 1}
                icon={<IconTile icon={Receipt} tone="success" size={40} />}
                title={r.invoiceNo || r.code}
                subtitle={`${shortDate(r.receivedDate || r.date)} · bal ${money(r.balanceAmount)}`}
                amount={money(r.receivedAmount)}
                badge={<Badge label={`Partner ${r.deliveryPartnerStatus.toLowerCase()}`} tone={r.deliveryPartnerStatus === "Paid" ? "success" : "warning"} size="sm" />}
              />
            ))}

          {tab === "expenses" &&
            expenseRows.slice(0, limit).map((e, i, arr) => (
              <Row
                key={e.id}
                last={i === arr.length - 1}
                icon={<IconTile icon={Wallet} tone="warning" size={40} />}
                title={e.type || "Expense"}
                subtitle={`${shortDate(e.date)}${e.description ? ` · ${e.description}` : ""}`}
                amount={money(e.amount)}
                badge={e.paymentType ? <Badge label={e.paymentType} tone="neutral" dot={false} size="sm" /> : null}
              />
            ))}
        </Card>
        {tab === "expenses" && listLength > PAGE && (
          <Pressable onPress={() => setShowAll((s) => !s)} style={{ alignSelf: "center", padding: 12 }}>
            <Txt size={13} weight="semibold" color={t.primary}>
              {showAll ? "Show less" : `See all ${listLength}`}
            </Txt>
          </Pressable>
        )}
      </ScrollView>

      <ExpenseSheet visible={expenseOpen} onClose={() => setExpenseOpen(false)} />
    </Screen>
  );
}

function Row({
  icon,
  title,
  subtitle,
  amount,
  badge,
  last,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  amount: string;
  badge: React.ReactNode;
  last?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}>
      {icon}
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Txt size={14.5} weight="bold" numberOfLines={1}>
          {title}
        </Txt>
        <Txt size={11.5} mono muted numberOfLines={1} style={{ marginTop: 2 }}>
          {subtitle}
        </Txt>
      </View>
      <View style={{ alignItems: "flex-end", gap: 5 }}>
        <Txt size={14.5} weight="bold">
          {amount}
        </Txt>
        {badge}
      </View>
    </View>
  );
}

/** Quick "log an expense" sheet — the one finance write that makes sense on a phone. */
function ExpenseSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const [type, setType] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("Cash");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setType("");
    setAmount("");
    setDescription("");
    setDate(todayISO());
    setErr(null);
  };

  const save = async () => {
    if (!type.trim()) return setErr("Expense type is required.");
    if (!(Number(amount) > 0)) return setErr("Enter an amount above zero.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr("Date must be YYYY-MM-DD.");
    setSaving(true);
    const res = await dispatch(addExpense({ date, type: type.trim(), paymentType, amount: Number(amount), description: description.trim() || undefined }));
    setSaving(false);
    if (addExpense.fulfilled.match(res)) {
      reset();
      onClose();
    } else setErr(res.payload ?? "Couldn't save the expense.");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }]} onPress={onClose} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: t.bg, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.between, { marginBottom: 14, marginTop: 0 }]}>
            <Txt size={18} weight="bold">
              Log expense
            </Txt>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={t.textMuted} />
            </Pressable>
          </View>
          {err && <Notice message={err} tone="danger" />}
          <TextField label="Type" value={type} onChangeText={setType} placeholder="Fuel, packing material…" />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
            </View>
          </View>
          <Txt size={13} weight="semibold" style={{ marginBottom: 7 }}>
            Paid by
          </Txt>
          <Segmented options={["Cash", "UPI"] as const} value={paymentType} onChange={setPaymentType} />
          <View style={{ height: 14 }} />
          <TextField label="Description" value={description} onChangeText={setDescription} placeholder="Optional" />
          <Button title="Save expense" icon={Plus} onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  tiles: { flexDirection: "row", gap: 10, marginTop: 14 },
  tile: { flex: 1, padding: 12, borderRadius: 12 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
});

