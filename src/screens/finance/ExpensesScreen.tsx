/** Expenses (More → Masters) — daily expenses with their cash / UPI split. */
import React, { useCallback, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChartColumn, ChevronLeft, Plus, Wallet, X } from "lucide-react-native";
import { Button } from "@/components/Button";
import { Badge, Card, IconButton, IconTile, ProgressBar, SectionTitle } from "@/components/primitives";
import { EmptyView, Notice, Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { TextField } from "@/components/TextField";
import { Txt } from "@/components/Txt";
import { useRefresh } from "@/hooks/useBootstrapData";
import type { MoreScreenProps, RootScreenProps } from "@/navigation/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addExpense, fetchFinance } from "@/store/slices/financeSlice";
import { useTheme } from "@/theme/ThemeProvider";
import type { PaymentType } from "@/types";
import { isSameMonth, money, shortDate, todayISO } from "@/utils/format";
import { FinanceRow } from "./FinanceScreen";

const PAGE = 8;

export function ExpensesScreen({ navigation }: MoreScreenProps<"Expenses">) {
  return <ExpensesView onBack={() => navigation.goBack()} />;
}

/** Pickup role's + → Expense: the same Expenses screen (list + "+ Add"), opened over the tabs. */
export function ExpenseListScreen({ navigation }: RootScreenProps<"ExpenseList">) {
  return <ExpensesView onBack={() => navigation.goBack()} />;
}

/** `onBack` adds the back button (absent when it's a tab). */
function ExpensesView({ onBack }: { onBack?: () => void }) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const { expenses, error } = useAppSelector((s) => s.finance);

  const [monthOnly, setMonthOnly] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const load = useCallback(() => dispatch(fetchFinance()), [dispatch]);
  const { refreshing, onRefresh } = useRefresh(load);

  const scopeLabel = monthOnly ? "this month" : "overall";
  const rows = useMemo(
    () => expenses.filter((e) => !monthOnly || isSameMonth(e.date)).sort((a, b) => (b.date > a.date ? 1 : -1)),
    [expenses, monthOnly]
  );
  const spent = rows.reduce((s, e) => s + e.amount, 0);
  const cash = rows.filter((e) => e.paymentType === "Cash").reduce((s, e) => s + e.amount, 0);
  const tiles = [
    { label: "Cash", value: money(cash), positive: false },
    { label: "UPI", value: money(spent - cash), positive: false },
  ];

  return (
    <Screen>
      <View style={styles.header}>
        {onBack && <IconButton icon={ChevronLeft} onPress={onBack} accessibilityLabel="Back" />}
        <Txt size={24} weight="bold" style={{ flex: 1, marginLeft: onBack ? 12 : 0 }}>
          Expenses
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
        {error && <Notice message={error} onRetry={() => dispatch(fetchFinance())} />}

        <Card>
          <Txt size={13} muted>
            Spent {scopeLabel}
          </Txt>
          <Txt size={34} weight="bold" style={{ marginTop: 4, lineHeight: 40 }}>
            {money(spent)}
          </Txt>
          <View style={{ marginTop: 14 }}>
            <ProgressBar value={spent ? cash / spent : 0} color={t.tones.success.fg} height={7} />
          </View>
          <View style={styles.between}>
            <Txt size={12} muted>
              {spent ? Math.round((cash / spent) * 100) : 0}% cash
            </Txt>
            <Txt size={12} muted>
              {rows.length} entries
            </Txt>
          </View>
          <View style={styles.tiles}>
            {tiles.map((tile) => (
              <View key={tile.label} style={[styles.tile, { backgroundColor: t.surfaceAlt }]}>
                <Txt size={12} muted>
                  {tile.label}
                </Txt>
                <Txt size={17} weight="bold" color={tile.positive ? t.tones.success.fg : t.text} style={{ marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
                  {tile.value}
                </Txt>
              </View>
            ))}
          </View>
        </Card>

        <SectionTitle title="Expenses" action="+ Add" onAction={() => setExpenseOpen(true)} />

        <Card padded={false}>
          {rows.length === 0 && <EmptyView title={`No expenses ${scopeLabel}`} message={monthOnly ? "Tap the chart button to see all-time." : undefined} />}
          {rows.slice(0, showAll ? Infinity : PAGE).map((e, i, arr) => (
            <FinanceRow
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
        {rows.length > PAGE && (
          <Pressable onPress={() => setShowAll((s) => !s)} style={{ alignSelf: "center", padding: 12 }}>
            <Txt size={13} weight="semibold" color={t.primary}>
              {showAll ? "Show less" : `See all ${rows.length}`}
            </Txt>
          </Pressable>
        )}
      </ScrollView>

      <ExpenseSheet visible={expenseOpen} onClose={() => setExpenseOpen(false)} />
    </Screen>
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
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
});
