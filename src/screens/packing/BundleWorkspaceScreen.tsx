/**
 * Packing lists — the web console's BundleWorkspace, in two modes:
 *
 *   Repacking (booking is "Repacking Required"): Create bundle → fill its
 *   packing list → Save adds it to "Added bundles" (local only). Confirm, with
 *   "Repacked by", saves every bundle, sets the bundle count and marks the
 *   booking Ready to Ship.
 *
 *   Ready to ship (booking is "Ready to Ship"): pick a bundle without a packing
 *   list and Save it straight to cargo-backend. Once every bundle has one, the
 *   booking's package list is marked Added (and it shows up in Ready to stuff).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, CheckCircle2, ChevronLeft, Download, Plus, Save, X } from "lucide-react-native";
import { errorMessage } from "@/api/client";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge, Card, Chip, IconButton, SectionTitle } from "@/components/primitives";
import { NavHeader, Notice, Screen } from "@/components/Screen";
import { SelectField, type SelectOption } from "@/components/SelectSheet";
import { TextField } from "@/components/TextField";
import { Txt } from "@/components/Txt";
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import type { RootScreenProps } from "@/navigation/types";
import { bookingService } from "@/services/bookingService";
import { str } from "@/services/mappers";
import { packageService, type BookingPackingList, type PackingLine } from "@/services/packageService";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectPackingByBooking } from "@/store/selectors";
import { fetchBookings } from "@/store/slices/bookingsSlice";
import { fetchContainers } from "@/store/slices/containersSlice";
import { ensureMaster } from "@/store/ensure";
import { radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import type { Booking } from "@/types";
import { fullDate } from "@/utils/format";
import { downloadPackingListPdf } from "@/utils/tablePdf";

type Mode = "repack" | "ready";

/** One product line as typed into the form. */
interface Line {
  product: string;
  qty: string;
  fabric: string;
  description: string;
}

/** A bundle's packing list as typed (weights live on the bundle, not the lines). */
interface DraftBundle {
  bundleNo: number;
  netWeight: string;
  grossWeight: string;
  lines: Line[];
}

const emptyLine = (): Line => ({ product: "", qty: "", fabric: "", description: "" });
const hasData = (l: Line) => !!(l.product || l.qty || l.fabric || l.description);
const digits = (v: string) => v.replace(/\D/g, "");
/** Weights in kg: digits with at most one decimal point and two decimals. */
const decimal = (v: string) => v.replace(/[^\d.]/g, "").replace(/^(\d*\.?\d{0,2}).*$/, "$1");

const MAX_QTY = 100000;
const MAX_WEIGHT = 10000;
const MAX_DESCRIPTION = 200;

interface DraftErrors {
  netWeight?: string;
  grossWeight?: string;
  lines: { product?: string; qty?: string; description?: string }[];
}

/** Field-level checks for one bundle's packing list; null when it can be saved. */
function validateBundle(d: DraftBundle): DraftErrors | null {
  const errors: DraftErrors = { lines: d.lines.map(() => ({})) };
  let bad = false;
  const net = Number(d.netWeight);
  const gross = Number(d.grossWeight);
  if (!d.netWeight) errors.netWeight = "Enter the net weight.";
  else if (!(net > 0)) errors.netWeight = "Net weight must be more than 0.";
  else if (net > MAX_WEIGHT) errors.netWeight = `Net weight can't exceed ${MAX_WEIGHT} kg.`;
  if (!d.grossWeight) errors.grossWeight = "Enter the gross weight.";
  else if (!(gross > 0)) errors.grossWeight = "Gross weight must be more than 0.";
  else if (gross > MAX_WEIGHT) errors.grossWeight = `Gross weight can't exceed ${MAX_WEIGHT} kg.`;
  else if (net > 0 && gross < net) errors.grossWeight = "Gross weight can't be less than net weight.";
  if (errors.netWeight || errors.grossWeight) bad = true;

  const seen = new Set<string>();
  d.lines.forEach((l, i) => {
    const e = errors.lines[i];
    const qty = Number(l.qty);
    if (!l.product) e.product = "Choose a product.";
    else if (seen.has(`${l.product}|${l.fabric}`)) e.product = "This product and fabric is already listed in this bundle.";
    else seen.add(`${l.product}|${l.fabric}`);
    if (!l.qty) e.qty = "Enter qty.";
    else if (!(qty >= 1)) e.qty = "At least 1.";
    else if (qty > MAX_QTY) e.qty = "Too large.";
    if (l.description.length > MAX_DESCRIPTION) e.description = `Keep it under ${MAX_DESCRIPTION} characters.`;
    if (e.product || e.qty || e.description) bad = true;
  });
  return bad ? errors : null;
}

/** "Repacked by" must name a person. */
function repackedByError(v: string): string | null {
  const name = v.trim();
  if (!name) return "Enter who repacked these bundles.";
  if (name.length < 2) return "Enter at least 2 characters.";
  if (name.length > 60) return "Keep it under 60 characters.";
  return null;
}
const needed = (b: Booking) => Math.max(1, b.actualBundle || b.bundleCount || 1);

const toPackingLines = (lines: Line[]): PackingLine[] =>
  lines.filter(hasData).map((l) => ({ productId: l.product, quantity: Number(l.qty) || 1, fabricId: l.fabric || undefined, description: l.description || undefined }));

export function RepackingScreen(props: RootScreenProps<"Repacking">) {
  return (
    <BundleWorkspace
      mode="repack"
      bookingId={props.route.params?.bookingId}
      onBack={() => props.navigation.goBack()}
      // After repacking is confirmed, "Go back" returns to the Bookings list (closing the booking too).
      onDone={() => props.navigation.popTo("Main", { screen: "Bookings" })}
    />
  );
}

export function ReadyToShipScreen(props: RootScreenProps<"ReadyToShip">) {
  return (
    <BundleWorkspace
      mode="ready"
      bookingId={props.route.params?.bookingId}
      onBack={() => props.navigation.goBack()}
      // Once every bundle has its packing list, "Go back" returns to the Bookings list (closing the booking too).
      onDone={() => props.navigation.popTo("Main", { screen: "Bookings" })}
    />
  );
}

function BundleWorkspace({
  mode,
  bookingId: initialId,
  onBack,
  onDone,
}: {
  mode: Mode;
  bookingId?: string;
  onBack: () => void;
  /** Where "Go back" leads once the work is finished (defaults to onBack). */
  onDone?: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const bookings = useAppSelector((s) => s.bookings.items);
  const products = useAppSelector((s) => s.masters.products.items);
  const fabrics = useAppSelector((s) => s.masters.fabrics.items);
  const packing = useAppSelector(selectPackingByBooking);
  const packages = useAppSelector((s) => s.containers.packages);
  const lookup = useCustomerLookup();

  const [bookingId, setBookingId] = useState(initialId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Field errors for the open bundle, shown once Save has been tapped; re-checked as the user types.
  const [draftErrors, setDraftErrors] = useState<DraftErrors | null>(null);
  const [triedConfirm, setTriedConfirm] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // The bundle being edited (null = editor closed).
  const [draft, setDraft] = useState<DraftBundle | null>(null);
  // Repacking: bundles created so far, the ones saved to "Added bundles", and who repacked them.
  const [created, setCreated] = useState(0);
  const [staged, setStaged] = useState<DraftBundle[]>([]);
  const [repackedBy, setRepackedBy] = useState("");
  const [repackDone, setRepackDone] = useState(false);
  // The bundle count as it was when the booking was opened: Confirm overwrites the booking's
  // bundleCount with the repacked total, but "Actual bundles" keeps showing the original.
  const firstCounts = useRef(new Map<string, number>());
  // Ready to ship: the booking's packing list as saved on cargo-backend.
  const [saved, setSaved] = useState<BookingPackingList | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    dispatch(ensureMaster("products"));
    dispatch(ensureMaster("fabrics"));
  }, [dispatch]);

  const booking = bookings.find((b) => b.id === bookingId);
  const productOptions = useMemo<SelectOption[]>(() => products.filter((p) => p.status !== false).map((p) => ({ value: p._id, label: str(p.name) })), [products]);
  const fabricOptions = useMemo<SelectOption[]>(() => fabrics.filter((f) => f.status !== false).map((f) => ({ value: f._id, label: str(f.name) })), [fabrics]);
  const productName = (id?: string) => (id ? str(products.find((p) => p._id === id)?.name) || "—" : "");
  const fabricName = (id?: string) => (id ? str(fabrics.find((f) => f._id === id)?.name) : "");

  // Same booking lists as the web pages.
  const eligible = useMemo(
    () =>
      bookings.filter((b) =>
        mode === "repack"
          ? b.repackingStatus === "Repacking Required" && (!b.actualBundle || b.id === bookingId)
          : b.repackingStatus === "Ready to Ship" &&
            (b.id === bookingId || b.packageListStatus !== "Added" || (packing.get(b.id)?.bundleNos.size ?? 0) < needed(b))
      ),
    [bookings, mode, bookingId, packing]
  );
  const bookingOptions = eligible.map((b) => ({ value: b.id, label: b.code, sublabel: `${b.sender.name} → ${b.receiver.name}` }));

  // Bundle mark ID of each saved bundle of this booking, by bundle no. Unsaved bundles have no mark yet.
  const markByBundleNo = useMemo(() => bundleMarks(packages, bookingId), [packages, bookingId]);
  // Popup after a save: each saved bundle with its mark ID and the items added.
  const [savedPopup, setSavedPopup] = useState<{ title: string; message: string; bundles: { bundleNo: number; mark?: number; lines: PopupLine[] }[] } | null>(null);
  const popupLines = (lines: DraftBundle["lines"]): PopupLine[] =>
    lines.filter(hasData).map((l) => ({ product: [productName(l.product), fabricName(l.fabric)].filter(Boolean).join(" · "), qty: l.qty || "1" }));
  const savedNos = useMemo(() => new Set(saved?.bundles.map((b) => b.bundleNo) ?? []), [saved]);
  if (booking && !firstCounts.current.has(booking.id)) firstCounts.current.set(booking.id, booking.bundleCount || 0);
  const actualBundles = booking ? firstCounts.current.get(booking.id) ?? booking.bundleCount : 0;
  const bundleNos = booking ?Array.from({ length: Math.max(1, booking.bundleCount || 1) }, (_, i) => i + 1) : [];
  const allPacked = !loadingList && bundleNos.length > 0 && bundleNos.every((n) => savedNos.has(n));

  const openBundle = (bundleNo: number) => {
    setDraftErrors(null);
    setDraft({ bundleNo, netWeight: "", grossWeight: "", lines: [emptyLine()] });
  };

  // After a failed Save, keep the highlighted fields in step with what's typed.
  useEffect(() => {
    if (draftErrors && draft) setDraftErrors(validateBundle(draft) ?? { lines: draft.lines.map(() => ({})) });
    // Only re-check when the draft changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const loadSaved = useCallback(async (id: string) => {
    setLoadingList(true);
    try {
      const list = await packageService.getByBooking(id);
      setSaved(list);
      return list;
    } catch (e) {
      setError(errorMessage(e, "Couldn't load the packing list."));
      return null;
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Choosing a booking resets the workspace; Ready to ship opens its first bundle without a packing list.
  useEffect(() => {
    setError(null);
    setNotice(null);
    setDraft(null);
    setCreated(0);
    setStaged([]);
    setRepackedBy("");
    setTriedConfirm(false);
    setDraftErrors(null);
    setSaved(null);
    if (!bookingId || mode !== "ready") return;
    void loadSaved(bookingId).then((list) => {
      const b = bookings.find((x) => x.id === bookingId);
      const done = new Set(list?.bundles.map((x) => x.bundleNo) ?? []);
      const first = b ? Array.from({ length: Math.max(1, b.bundleCount || 1) }, (_, i) => i + 1).find((n) => !done.has(n)) : undefined;
      if (first) openBundle(first);
      // Every bundle already has a packing list but the status was never set — set it now.
      else if (b && list && list.bundles.length >= needed(b) && b.packageListStatus !== "Added") {
        void bookingService
          .markPackageListAdded(b.id)
          .then(() => dispatch(fetchBookings()))
          .then(() => setNotice("Every bundle has a packing list — package list marked as added."))
          .catch((e) => setError(errorMessage(e, "Couldn't update the package list status.")));
      }
    });
    // Only when the booking changes — not on every bookings refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, mode, loadSaved]);

  const updateLine = (i: number, patch: Partial<Line>) => {
    setNotice(null);
    setDraft((d) => (d ? { ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) } : d));
  };

  const saveDraft = async () => {
    if (!draft || !booking || saving) return;
    setNotice(null);
    if (draft.lines.length === 0) return setError("Add at least one item to the packing list before saving.");
    const errors = validateBundle(draft);
    setDraftErrors(errors);
    if (errors) return setError("Fix the highlighted fields before saving.");
    if (mode === "ready" && savedNos.has(draft.bundleNo)) return setError(`Bundle ${draft.bundleNo} already has a packing list.`);
    setError(null);

    if (mode === "repack") {
      setStaged((s) => [...s.filter((b) => b.bundleNo !== draft.bundleNo), draft].sort((a, b) => a.bundleNo - b.bundleNo));
      setDraftErrors(null);
      setNotice(`Added Bundle ${draft.bundleNo} to the list below — tap Confirm to save it.`);
      setDraft(null);
      return;
    }

    setSaving(true);
    try {
      const count = draft.lines.length;
      const list = await packageService.upsertBundle(booking.id, {
        bundleNo: draft.bundleNo,
        netWeight: Number(draft.netWeight) || 0,
        grossWeight: Number(draft.grossWeight) || 0,
        lines: toPackingLines(draft.lines),
      });
      setSaved(list);
      const complete = list.bundles.length >= needed(booking);
      if (complete) await bookingService.markPackageListAdded(booking.id).catch(() => {});
      const [containersRes] = await Promise.all([dispatch(fetchContainers()), dispatch(fetchBookings())]);
      const freshPackages = fetchContainers.fulfilled.match(containersRes) ? containersRes.payload.packages : packages;
      // Like the web: a popup with the saved bundle's mark ID and what was added.
      const mark = bundleMarks(freshPackages, booking.id).get(draft.bundleNo);
      setSavedPopup({
        title: mark !== undefined ? `Bundle mark ID ${mark}` : "Bundle mark ID pending",
        message: `Bundle ${draft.bundleNo} saved`,
        bundles: [{ bundleNo: draft.bundleNo, mark, lines: popupLines(draft.lines) }],
      });
      const done = new Set(list.bundles.map((b) => b.bundleNo));
      const next = bundleNos.find((n) => !done.has(n));
      setNotice(`Saved ${count} item${count === 1 ? "" : "s"} for Bundle ${draft.bundleNo}.${next ? "" : " Every bundle now has a packing list."}`);
      if (next) openBundle(next);
      else setDraft(null);
    } catch (e) {
      setError(errorMessage(e, "Failed to save the packing list."));
    } finally {
      setSaving(false);
    }
  };

  const confirmRepack = async () => {
    if (!booking || saving) return;
    setTriedConfirm(true);
    if (draft) return setError(`Save or discard Bundle ${draft.bundleNo} before confirming.`);
    if (staged.length === 0) return setError("Create and save at least one bundle before confirming.");
    const who = repackedByError(repackedBy);
    if (who) return setError(who);
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      for (const b of staged) {
        await packageService.upsertBundle(
          booking.id,
          { bundleNo: b.bundleNo, netWeight: Number(b.netWeight) || 0, grossWeight: Number(b.grossWeight) || 0, lines: toPackingLines(b.lines) },
          { repackedBy: repackedBy.trim() }
        );
      }
      await bookingService.update(booking.id, { bundleCount: staged.length, packingStatus: "Ready to Ship" });
      await bookingService.markPackageListAdded(booking.id).catch(() => {});
      const [, containersRes] = await Promise.all([dispatch(fetchBookings()), dispatch(fetchContainers())]);
      const freshPackages = fetchContainers.fulfilled.match(containersRes) ? containersRes.payload.packages : packages;
      const marks = bundleMarks(freshPackages, booking.id);
      setSavedPopup({
        title: "Repacking confirmed",
        message: `${staged.length} bundle${staged.length === 1 ? "" : "s"} saved`,
        bundles: staged.map((b) => ({ bundleNo: b.bundleNo, mark: marks.get(b.bundleNo), lines: popupLines(b.lines) })),
      });
      setRepackDone(true);
      setNotice(`Repacking confirmed: saved ${staged.length} bundle${staged.length === 1 ? "" : "s"} for ${booking.code}. It's now package ready.`);
    } catch (e) {
      setError(errorMessage(e, "Failed to save the bundles."));
    } finally {
      setSaving(false);
    }
  };

  // What "Added bundles" / "Added items" lists, and the PDF prints.
  const added: { bundleNo: number; lines: { product: string; fabric: string; qty: string; description: string }[] }[] =
    mode === "repack"
      ? staged.map((b) => ({ bundleNo: b.bundleNo, lines: b.lines.filter(hasData).map((l) => ({ product: productName(l.product), fabric: fabricName(l.fabric), qty: l.qty, description: l.description })) }))
      : (saved?.bundles ?? []).map((b) => ({
          bundleNo: b.bundleNo,
          lines: b.lines.map((l) => ({ product: productName(l.productId), fabric: fabricName(l.fabricId), qty: String(l.quantity || ""), description: l.description ?? "" })),
        }));

  const downloadPdf = async () => {
    if (!booking || added.length === 0) return;
    const party = (id: string, name: string) => {
      const c = lookup.map.get(id);
      return { name, lines: c ? [c.location, c.whatsapp ? `Ph: ${c.whatsapp}` : ""] : [] };
    };
    setDownloading(true);
    try {
      await downloadPackingListPdf(`${booking.code}-packing-list.pdf`, {
        lrNo: booking.code,
        bookingDate: fullDate(booking.date),
        sender: party(booking.sender.id, booking.sender.name),
        receiver: party(booking.receiver.id, booking.receiver.name),
        bundles: added.map((b) => ({ bundleNo: b.bundleNo, items: b.lines.map((l) => ({ product: [l.product, l.fabric].filter(Boolean).join(" - "), qty: l.qty })) })),
      });
    } catch (e) {
      Alert.alert("Couldn't create the PDF", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const title = mode === "repack" ? "Repacking" : "Package ready";

  return (
    <Screen>
      <NavHeader
        left={<IconButton icon={ChevronLeft} onPress={onBack} accessibilityLabel="Back" />}
        title={title}
        right={
          downloading ? (
            <ActivityIndicator color={t.primary} style={{ width: 40 }} />
          ) : added.length > 0 ? (
            <IconButton icon={Download} onPress={downloadPdf} accessibilityLabel="Download packing list PDF" />
          ) : null
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Opened from a booking, the workspace works on that booking only. */}
          {initialId ? (
            <TextField
              label="Booking"
              value={booking?.code ?? "—"}
              editable={false}
            />
          ) : (
            <SelectField
              label="Booking"
              placeholder="Choose a booking"
              value={bookingId}
              options={bookingOptions}
              onChange={setBookingId}
              emptyText={mode === "repack" ? "No bookings need repacking." : "Every ready-to-ship booking already has its packing list."}
            />
          )}
          {booking && (
            <>
              <TextField label="Sender" value={[booking.sender.name, lookup.senderPlace(booking)].filter(Boolean).join(" · ") || "—"} editable={false} />
              <TextField label="Receiver" value={[booking.receiver.name, lookup.receiverPlace(booking)].filter(Boolean).join(" · ") || "—"} editable={false} />
            </>
          )}

          {error && <Notice message={error} tone="danger" />}
          {notice && <SuccessNote text={notice} />}

          {!booking ? (
            <Txt size={13} muted align="center" style={{ marginTop: 24 }}>
              Choose a booking above to build its packing list.
            </Txt>
          ) : (
            <>
              {mode === "repack" ? (
                <Card style={{ marginBottom: 14 }}>
                  <View style={styles.rowBetween}>
                    <View>
                      <Txt size={12} muted>
                        Actual bundles
                      </Txt>
                      <Txt size={20} weight="bold">
                        {actualBundles}
                      </Txt>
                    </View>
                    <Button
                      title="Create bundle"
                      icon={Plus}
                      variant="secondary"
                      height={44}
                      disabled={!!draft || repackDone}
                      onPress={() => {
                        const n = created + 1;
                        setCreated(n);
                        setNotice(null);
                        openBundle(n);
                      }}
                    />
                  </View>
                  {draft && (
                    <Txt size={12} muted style={{ marginTop: 8 }}>
                      Save the open packing list before creating the next bundle.
                    </Txt>
                  )}
                </Card>
              ) : (
                <>
                  <Txt size={13} weight="semibold" style={{ marginBottom: 8 }}>
                    Bundle
                  </Txt>
                  {loadingList ? (
                    <ActivityIndicator color={t.primary} style={{ marginVertical: 12 }} />
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {bundleNos.map((n) => (
                        <BundleChip
                          key={n}
                          n={n}
                          saved={savedNos.has(n)}
                          mark={markByBundleNo.get(n)}
                          active={draft?.bundleNo === n}
                          onPress={() => {
                            setNotice(null);
                            setError(null);
                            openBundle(n);
                          }}
                        />
                      ))}
                    </ScrollView>
                  )}
                </>
              )}

              {draft ? (
                <DraftEditor
                  draft={draft}
                  mode={mode}
                  productOptions={productOptions}
                  fabricOptions={fabricOptions}
                  errors={draftErrors}
                  onWeight={(key, v) => setDraft((d) => (d ? { ...d, [key]: decimal(v) } : d))}
                  onLine={updateLine}
                  onAddLine={() => setDraft((d) => (d ? { ...d, lines: [...d.lines, emptyLine()] } : d))}
                  onRemoveLine={(i) => setDraft((d) => (d ? { ...d, lines: d.lines.filter((_, j) => j !== i) } : d))}
                  onDiscard={
                    mode === "repack"
                      ? () => {
                          // Discarding the newest unsaved bundle gives its number back.
                          if (!staged.some((b) => b.bundleNo === draft.bundleNo) && draft.bundleNo === created) setCreated(created - 1);
                          setDraft(null);
                          setDraftErrors(null);
                          setError(null);
                        }
                      : undefined
                  }
                  onSave={saveDraft}
                  saving={saving}
                />
              ) : mode === "ready" ? (
                <Txt size={13} muted align="center" style={{ marginVertical: 12 }}>
                  {allPacked ? "Every bundle has its packing list." : "Select another bundle above to add its packing list."}
                </Txt>
              ) : null}

              {mode === "repack" && (
                <Card style={{ marginTop: 14 }}>
                  <Txt size={12} muted>
                    Bundle count
                  </Txt>
                  <Txt size={18} weight="bold" style={{ marginBottom: 10 }}>
                    {staged.length}
                  </Txt>
                  <TextField
                    label="Repacked by"
                    value={repackedBy}
                    onChangeText={(v) => setRepackedBy(v.replace(/[^\p{L}\p{M} .,\-'&/()]/gu, ""))}
                    placeholder="Who repacked these bundles?"
                    editable={!repackDone}
                    error={triedConfirm || (staged.length > 0 && repackedBy !== "") ? repackedByError(repackedBy) : null}
                  />
                </Card>
              )}

              {added.length > 0 && (
                <View style={{ marginTop: 18 }}>
                  <SectionTitle title={mode === "repack" ? "Added bundles" : "Added items"} />
                  {added.map((b) => (
                    <AddedBundle key={b.bundleNo} bundleNo={b.bundleNo} mark={markByBundleNo.get(b.bundleNo)} lines={b.lines} />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>

        {mode === "repack" && booking && (
          <View style={[styles.footer, { backgroundColor: t.bg, borderTopColor: t.border, paddingBottom: insets.bottom + 12 }]}>
            {repackDone ? (
              <Button title="Go back" onPress={onDone ?? onBack} />
            ) : (
              <Button
                title={saving && !draft ? "Saving…" : "Confirm"}
                icon={CheckCircle2}
                onPress={confirmRepack}
                loading={saving}
                disabled={staged.length === 0}
              />
            )}
          </View>
        )}

        {/* Package ready: once every bundle has its packing list, offer the way back. */}
        {mode === "ready" && booking && !draft && allPacked && (
          <View style={[styles.footer, { backgroundColor: t.bg, borderTopColor: t.border, paddingBottom: insets.bottom + 12 }]}>
            <Button title="Go back" onPress={onDone ?? onBack} />
          </View>
        )}
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={savedPopup !== null}
        icon={CheckCircle2}
        tone="success"
        title={savedPopup?.title ?? ""}
        message={savedPopup?.message}
        confirmLabel="OK"
        cancelLabel={null}
        onConfirm={() => setSavedPopup(null)}
        onCancel={() => setSavedPopup(null)}
      >
        <ScrollView style={{ alignSelf: "stretch", maxHeight: 320, marginTop: 14 }}>
          {savedPopup?.bundles.map((b) => (
            <View key={b.bundleNo} style={[styles.popupBundle, { borderColor: t.border }]}>
              <View style={styles.addedHead}>
                <View>
                  <Txt size={11} muted uppercase weight="semibold">
                    Bundle mark ID
                  </Txt>
                  <Txt mono size={26} weight="bold" color={t.code}>
                    {b.mark ?? "—"}
                  </Txt>
                </View>
                <Txt size={12.5} muted weight="semibold">
                  Bundle {b.bundleNo}
                </Txt>
              </View>
              {b.lines.map((l, i) => (
                <View key={i} style={styles.popupLine}>
                  <Txt size={13} style={{ flex: 1 }} numberOfLines={2}>
                    {l.product || "—"}
                  </Txt>
                  <Txt size={13} weight="bold">
                    × {l.qty}
                  </Txt>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </ConfirmDialog>
    </Screen>
  );
}

function DraftEditor({
  draft,
  mode,
  productOptions,
  fabricOptions,
  onWeight,
  onLine,
  onAddLine,
  onRemoveLine,
  onSave,
  onDiscard,
  saving,
  errors,
}: {
  draft: DraftBundle;
  errors: DraftErrors | null;
  onDiscard?: () => void;
  mode: Mode;
  productOptions: SelectOption[];
  fabricOptions: SelectOption[];
  onWeight: (key: "netWeight" | "grossWeight", value: string) => void;
  onLine: (i: number, patch: Partial<Line>) => void;
  onAddLine: () => void;
  onRemoveLine: (i: number) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const t = useTheme();
  return (
    <Card>
      <Txt size={15} weight="bold" style={{ marginBottom: 12 }}>
        Packing list — Bundle {draft.bundleNo}
      </Txt>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Net wt (kg)" value={draft.netWeight} onChangeText={(v) => onWeight("netWeight", v)} keyboardType="decimal-pad" placeholder="0" error={errors?.netWeight} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Gross wt (kg)" value={draft.grossWeight} onChangeText={(v) => onWeight("grossWeight", v)} keyboardType="decimal-pad" placeholder="0" error={errors?.grossWeight} />
        </View>
      </View>

      {draft.lines.map((l, i) => (
        <View key={i} style={[styles.line, { borderColor: t.border, backgroundColor: t.surfaceAlt }]}>
          <View style={styles.rowBetween}>
            <Txt size={12.5} weight="semibold" muted>
              Item {i + 1}
            </Txt>
            {draft.lines.length > 1 && (
              <Pressable onPress={() => onRemoveLine(i)} hitSlop={10} accessibilityLabel={`Remove item ${i + 1}`}>
                <X size={16} color={t.textMuted} />
              </Pressable>
            )}
          </View>
          <SelectField label="Product" placeholder="Choose product" value={l.product} options={productOptions} onChange={(v) => onLine(i, { product: v })} emptyText="No products yet — add one under More → Products." error={errors?.lines[i]?.product} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ width: 90 }}>
              <TextField label="Qty" value={l.qty} onChangeText={(v) => onLine(i, { qty: digits(v).slice(0, 6) })} keyboardType="number-pad" placeholder="1" error={errors?.lines[i]?.qty} />
            </View>
            <View style={{ flex: 1 }}>
              <SelectField label="Fabric" placeholder="Choose fabric" value={l.fabric} options={fabricOptions} onChange={(v) => onLine(i, { fabric: v })} emptyText="No fabrics yet — add one under More → Fabrics." />
            </View>
          </View>
          <TextField
            label="Description"
            value={l.description}
            onChangeText={(v) => onLine(i, { description: v })}
            placeholder="Optional"
            maxLength={MAX_DESCRIPTION}
            error={errors?.lines[i]?.description}
          />
        </View>
      ))}

      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <Button title="Add item" icon={Plus} variant="secondary" height={46} onPress={onAddLine} disabled={saving} style={{ flex: 1 }} />
        <Button title={mode === "repack" ? "Save bundle" : "Save packing list"} icon={Save} height={46} onPress={onSave} loading={saving} style={{ flex: 1.4 }} />
      </View>
      {onDiscard && (
        <Pressable onPress={onDiscard} hitSlop={8} style={{ alignSelf: "center", marginTop: 12 }} accessibilityRole="button">
          <Txt size={13} weight="semibold" muted>
            Discard this bundle
          </Txt>
        </Pressable>
      )}
    </Card>
  );
}

type PopupLine = { product: string; qty: string };

/** Bundle mark IDs of one booking's saved bundles, by bundle no — every saved bundle across all packing lists numbered in id order, like the web. */
function bundleMarks(packages: { booking: string; bundles: { id: string; bundleNo: number }[] }[], bookingId: string): Map<number, number> {
  const markOf = new Map(
    packages
      .flatMap((p) => p.bundles.map((x) => x.id))
      .filter(Boolean)
      .sort()
      .map((id, i) => [id, i + 1] as const)
  );
  const own = packages.find((p) => p.booking === bookingId)?.bundles ?? [];
  return new Map(own.map((b) => [b.bundleNo, markOf.get(b.id)]).filter((e): e is [number, number] => e[1] !== undefined));
}

function BundleChip({ n, saved, mark, active, onPress }: { n: number; saved: boolean; mark?: number; active: boolean; onPress: () => void }) {
  const t = useTheme();
  if (!saved) return <Chip label={`Bundle ${n}`} active={active} onPress={onPress} />;
  // Saved bundles can't be picked again, same as the web's "(saved)" options.
  return (
    <View style={[styles.savedChip, { borderColor: t.border, backgroundColor: t.tones.success.bg }]} accessibilityLabel={`Bundle ${n}, saved${mark ? `, mark ${mark}` : ""}`}>
      <Check size={13} color={t.tones.success.fg} strokeWidth={2.6} />
      <Txt size={13} weight="semibold" color={t.tones.success.fg}>
        Bundle {n}
        {mark !== undefined ? ` · Mark ${mark}` : ""}
      </Txt>
    </View>
  );
}

function AddedBundle({
  bundleNo,
  mark,
  lines,
}: {
  bundleNo: number;
  /** Bundle mark ID, once the bundle is saved. */
  mark?: number;
  lines: { product: string; fabric: string; qty: string; description: string }[];
}) {
  const t = useTheme();
  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={[styles.addedHead, { marginBottom: 6 }]}>
        <Txt size={13.5} weight="bold">
          Bundle {bundleNo}
        </Txt>
        {mark !== undefined && <Badge label={`Mark ${mark}`} tone="info" size="sm" />}
      </View>
      {lines.length === 0 ? (
        <Txt size={12.5} muted>
          No items
        </Txt>
      ) : (
        lines.map((l, i) => (
          <View key={i} style={[styles.addedLine, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}>
            <View style={{ flex: 1 }}>
              <Txt size={13.5} weight="semibold">
                {[l.product, l.fabric].filter(Boolean).join(" · ") || "—"}
              </Txt>
              {l.description ? (
                <Txt size={12} muted>
                  {l.description}
                </Txt>
              ) : null}
            </View>
            <Txt size={13.5} weight="bold">
              × {l.qty || 1}
            </Txt>
          </View>
        ))
      )}
    </Card>
  );
}

function SuccessNote({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View style={[styles.note, { backgroundColor: t.tones.success.bg }]}>
      <CheckCircle2 size={15} color={t.tones.success.fg} />
      <Txt size={12.5} color={t.tones.success.fg} style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  line: { borderWidth: 1, borderRadius: radius.md, padding: 12, marginTop: 4, marginBottom: 10 },
  addedLine: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  addedHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  popupBundle: { borderWidth: 1, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  popupLine: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  savedChip: { flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, marginRight: 8 },
  note: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, marginBottom: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
