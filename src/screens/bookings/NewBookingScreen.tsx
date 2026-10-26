/** 05 · New booking — 3-step form with segmented controls and live charge hints. */
import React, { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, Info, Minus, Plus, X } from "lucide-react-native";
import { Button } from "@/components/Button";
import { DatePickerField } from "@/components/DatePickerField";
import { Card, Chip, DashedDivider, IconButton } from "@/components/primitives";
import { NavHeader, Notice, Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { SelectField, type SelectOption } from "@/components/SelectSheet";
import { TextField } from "@/components/TextField";
import { Txt } from "@/components/Txt";
import type { RootScreenProps } from "@/navigation/types";
import { refField, str } from "@/services/mappers";
import type { BookingInput } from "@/services/bookingService";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { createBooking } from "@/store/slices/bookingsSlice";
import { fetchMaster } from "@/store/slices/mastersSlice";
import { radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import type { BackendDoc, BillOption, BundleType, ProductType, RepackingStatus } from "@/types";
import { money, todayISO } from "@/utils/format";

const STEP_TITLES = ["Pickup & date", "Shipment details", "Charges & review"] as const;
const BUNDLE_TYPES: BundleType[] = ["Bundle", "Box", "CBM", "KG"];
const PACKAGE_STATUSES: readonly RepackingStatus[] = ["Ready to Ship", "Repacking Required"];
const ANY_PARTNER = "__latest__";

/** cargo-backend requires every booking to reference a Pickup Assign; like the web form, link the newest one. */
function latestPickupAssign(assigns: BackendDoc[], partner: string | null): BackendDoc | undefined {
  return assigns
    .filter((a) => a.status !== false && (!partner || str(refField(a.transport, "name")) === partner))
    .reduce<BackendDoc | undefined>((latest, a) => (!latest || a._id > latest._id ? a : latest), undefined);
}

export function NewBookingScreen({ navigation }: RootScreenProps<"NewBooking">) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const customers = useAppSelector((s) => s.masters.customers.items);
  const assigns = useAppSelector((s) => s.masters.pickupAssigns.items);
  const partners = useAppSelector((s) => s.masters.pickupPartners.items);

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(todayISO());
  const [partner, setPartner] = useState<string>(ANY_PARTNER);
  const [senderId, setSenderId] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [billOption, setBillOption] = useState<BillOption>("With Bill");
  const [bundleType, setBundleType] = useState<BundleType>("Box");
  const [productType, setProductType] = useState<ProductType>("Normal");
  const [packingStatus, setPackingStatus] = useState<RepackingStatus>("Ready to Ship");
  const [bundleCount, setBundleCount] = useState(1);
  const [brandCharge, setBrandCharge] = useState("");
  const [pickupCharge, setPickupCharge] = useState("");
  const [bundleCharge, setBundleCharge] = useState("");

  useEffect(() => {
    dispatch(fetchMaster("customers"));
    dispatch(fetchMaster("pickupAssigns"));
    dispatch(fetchMaster("pickupPartners"));
  }, [dispatch]);

  const toOption = (c: BackendDoc): SelectOption => ({
    value: c._id,
    label: str(c.name),
    sublabel: [c.location, c.country].filter(Boolean).map(String).join(", "),
  });
  const senders = useMemo(() => customers.filter((c) => c.customerType === "Sender" && c.status !== false).map(toOption), [customers]);
  const receivers = useMemo(() => customers.filter((c) => c.customerType === "Receiver" && c.status !== false).map(toOption), [customers]);
  const partnerOptions = useMemo<SelectOption[]>(
    () => [
      { value: ANY_PARTNER, label: "Our pickup boy" },
      ...partners.filter((p) => p.status !== false).map((p) => ({ value: str(p.name), label: str(p.name) })),
    ],
    [partners]
  );
  const assign = latestPickupAssign(assigns, partner === ANY_PARTNER ? null : partner);

  const showBrand = productType === "Branded";
  const showPickup = billOption === "Without Bill";
  const showBundle = bundleCount > 0 && bundleCount < 5;
  const extra = (showBrand ? Number(brandCharge) || 0 : 0) + (showPickup ? Number(pickupCharge) || 0 : 0) + (showBundle ? Number(bundleCharge) || 0 : 0);
  const shortCity = (o?: SelectOption) => (o ? `${o.label}${o.sublabel ? ` · ${o.sublabel.split(",")[0]}` : ""}` : "");

  const validate = (s: number): string | null => {
    if (s === 0) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) return "Choose a booking date.";
      if (!assign)
        return partner === ANY_PARTNER
          ? "No pickup assign exists yet — create one under More → Pickup assign first."
          : `No pickup assign exists for ${partner} yet — create one under More → Pickup assign first.`;
    }
    if (s === 1) {
      if (!senderId) return "Choose a sender.";
      if (!receiverId) return "Choose a receiver.";
      if (bundleCount < 1) return "Bundle count must be at least 1.";
    }
    if (s === 2) {
      for (const [show, v, label] of [
        [showBrand, brandCharge, "Brand handling charge"],
        [showPickup, pickupCharge, "Pickup charge"],
        [showBundle, bundleCharge, "Bundle handling charge"],
      ] as const) {
        if (show && v !== "" && !(Number(v) >= 0)) return `${label} must be a positive number.`;
      }
    }
    return null;
  };

  const next = async () => {
    const problem = validate(step);
    setError(problem);
    if (problem) return;
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    const input: BookingInput = {
      senderId,
      receiverId,
      pickupAssignId: assign!._id,
      date,
      billOption,
      bundleType,
      productType,
      packingStatus,
      bundleCount,
      brandHandlingCharge: Number(brandCharge) || 0,
      pickupCharge: Number(pickupCharge) || 0,
      bundleHandlingCharge: Number(bundleCharge) || 0,
    };
    setSaving(true);
    const result = await dispatch(createBooking(input));
    setSaving(false);
    if (createBooking.fulfilled.match(result)) {
      // Done — close the modal and go back to where it was opened from.
      navigation.goBack();
    } else {
      setError(result.payload ?? "Couldn't create the booking.");
    }
  };

  const close = () => {
    if (senderId || receiverId) {
      Alert.alert("Discard booking?", "What you've entered will be lost.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => navigation.goBack() },
      ]);
    } else navigation.goBack();
  };

  return (
    <Screen>
      <NavHeader
        left={<IconButton icon={X} onPress={close} accessibilityLabel="Close" />}
        title="New booking"
      />

      {/* Step indicator */}
      <View style={{ paddingHorizontal: 20 }}>
        <View style={styles.steps}>
          {STEP_TITLES.map((_, i) => (
            <Pressable
              key={i}
              style={[styles.stepBar, { backgroundColor: i <= step ? t.primary : t.border }]}
              onPress={() => i < step && setStep(i)}
              hitSlop={8}
            />
          ))}
        </View>
        <View style={styles.stepLabel}>
          <Txt size={12.5} muted>
            Step {step + 1} of 3
          </Txt>
          <Txt size={12.5} weight="bold">
            {STEP_TITLES[step]}
          </Txt>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error && <Notice message={error} tone="danger" />}

          {step === 0 && (
            <>
              <DatePickerField label="Booking date" value={date} onChange={setDate} />
              <SelectField label="Pick up via" placeholder="Choose pickup" value={partner} options={partnerOptions} onChange={setPartner} />
            </>
          )}

          {step === 1 && (
            <>
              <SelectField label="Sender" placeholder="Choose sender" value={senderId} options={senders} onChange={setSenderId} withAvatar display={shortCity} emptyText="No senders yet — add one under More → Customers." />
              <SelectField label="Receiver" placeholder="Choose receiver" value={receiverId} options={receivers} onChange={setReceiverId} withAvatar display={shortCity} emptyText="No receivers yet — add one under More → Customers." />

              <Label text="Bill option" />
              <Segmented options={["With Bill", "Without Bill"] as const} value={billOption} onChange={setBillOption} />
              {showPickup && <Hint text="Without bill adds a pickup charge — you'll enter it in the next step." />}

              <Label text="Bundle type" />
              <View style={{ flexDirection: "row" }}>
                {BUNDLE_TYPES.map((b) => (
                  <Chip key={b} label={b} active={bundleType === b} onPress={() => setBundleType(b)} />
                ))}
              </View>

              <Label text="Product type" />
              <Segmented options={["Branded", "Normal"] as const} value={productType} onChange={setProductType} />
              {showBrand && <Hint text="Branded goods carry a brand handling charge." />}

              <Label text="Package status" />
              <Segmented options={PACKAGE_STATUSES} value={packingStatus} onChange={setPackingStatus} />

              <Label text="Bundle count" />
              <View style={[styles.stepper, { borderColor: t.border, backgroundColor: t.surface }]}>
                <Pressable
                  onPress={() => setBundleCount((n) => Math.max(1, n - 1))}
                  style={[styles.stepBtn, { backgroundColor: t.surfaceAlt }]}
                  accessibilityLabel="Decrease bundle count"
                >
                  <Minus size={18} color={t.text} />
                </Pressable>
                <Txt size={24} weight="bold">
                  {bundleCount}
                </Txt>
                <Pressable onPress={() => setBundleCount((n) => n + 1)} style={[styles.stepBtn, { backgroundColor: t.primary }]} accessibilityLabel="Increase bundle count">
                  <Plus size={18} color={t.onPrimary} />
                </Pressable>
              </View>
              {showBundle && <Hint text="Fewer than 5 bundles adds a bundle handling charge." />}
            </>
          )}

          {step === 2 && (
            <>
              {showBrand && <TextField label="Brand handling charge" value={brandCharge} onChangeText={setBrandCharge} keyboardType="numeric" placeholder="0" hint="Branded product" />}
              {showPickup && <TextField label="Pickup charge" value={pickupCharge} onChangeText={setPickupCharge} keyboardType="numeric" placeholder="0" hint="Without bill" />}
              {showBundle && <TextField label="Bundle handling charge" value={bundleCharge} onChangeText={setBundleCharge} keyboardType="numeric" placeholder="0" hint="Below 5 bundles" />}
              {!showBrand && !showPickup && !showBundle && (
                <Hint text="No extra charges apply: product is normal, it's billed, and there are 5 or more bundles." />
              )}

              <Card style={{ marginTop: 6 }}>
                <ReviewRow label="Sender" value={shortCity(senders.find((s) => s.value === senderId))} />
                <ReviewRow label="Receiver" value={shortCity(receivers.find((r) => r.value === receiverId))} />
                <ReviewRow label="Date" value={date} />
                <ReviewRow label="Pickup" value={assign ? `LR ${str(assign.lrNo)}` : "—"} />
                <ReviewRow label="Shipment" value={`${bundleCount} × ${bundleType} · ${productType} · ${billOption}`} />
                <ReviewRow label="Package status" value={packingStatus} />
                <DashedDivider />
                <View style={styles.reviewRow}>
                  <Txt size={14} weight="bold">
                    Extra charges
                  </Txt>
                  <Txt size={20} weight="bold">
                    {money(extra)}
                  </Txt>
                </View>
              </Card>
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: t.bg, paddingBottom: insets.bottom + 12 }]}>
          {step > 0 && <Button title="Back" variant="secondary" onPress={() => { setError(null); setStep(step - 1); }} style={{ width: 96 }} />}
          <Button title={step < 2 ? "Continue" : "Create booking"} icon={ArrowRight} onPress={next} loading={saving} style={{ flex: 1 }} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Label({ text }: { text: string }) {
  return (
    <Txt size={13} weight="semibold" style={{ marginBottom: 8, marginTop: 16 }}>
      {text}
    </Txt>
  );
}

function Hint({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View style={[styles.hint, { backgroundColor: t.tones.info.bg }]}>
      <Info size={14} color={t.tones.info.fg} />
      <Txt size={12.5} color={t.tones.info.fg} style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Txt size={13} muted>
        {label}
      </Txt>
      <Txt size={13.5} weight="semibold" style={{ flex: 1, textAlign: "right", marginLeft: 16 }} numberOfLines={2}>
        {value || "—"}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: "row", gap: 6 },
  stepBar: { flex: 1, height: 4, borderRadius: 2 },
  stepLabel: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, marginBottom: 6 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30 },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 60, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 8 },
  stepBtn: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  hint: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, marginTop: 10 },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  footer: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 10 },
});
