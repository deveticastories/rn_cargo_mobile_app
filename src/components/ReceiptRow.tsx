/** One receipt entry, as listed on the finance dashboard and the Receipts screen. */
import React from "react";
import { StyleSheet, View } from "react-native";
import { ReceiptText } from "lucide-react-native";
import { Badge, IconTile } from "@/components/primitives";
import { Txt } from "@/components/Txt";
import type { ReceiptRowData } from "@/store/selectors";
import { useTheme } from "@/theme/ThemeProvider";
import { money, shortDate } from "@/utils/format";

export function ReceiptRow({ row: { receipt: r, party }, last }: { row: ReceiptRowData; last?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}>
      <IconTile icon={ReceiptText} tone="success" size={40} />
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Txt size={14.5} weight="bold" numberOfLines={1}>
          {r.invoiceNo || r.code}
        </Txt>
        <Txt size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>
          {[shortDate(r.receivedDate || r.date), party].filter(Boolean).join(" · ")}
        </Txt>
        {r.deliveryPartnerAmount > 0 && (
          <Txt size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>
            Partner {money(r.deliveryPartnerAmount)} · {r.deliveryPartnerStatus}
          </Txt>
        )}
      </View>
      <View style={{ alignItems: "flex-end", gap: 5 }}>
        <Txt size={14.5} weight="bold">
          {money(r.receivedAmount)}
        </Txt>
        {r.balanceAmount > 0 ? <Badge label={`Bal ${money(r.balanceAmount)}`} tone="warning" size="sm" /> : <Badge label="Settled" tone="success" size="sm" />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14 },
});
