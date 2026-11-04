/**
 * App-wide alerts: `showAlert` / `showError` can be called from anywhere, like
 * Alert.alert, and render as a themed ConfirmDialog from the one `AlertHost`
 * mounted in App.tsx. Alerts raised while one is open wait their turn.
 */
import React, { useEffect, useRef, useState } from "react";
import { CircleCheck, Info, TriangleAlert } from "lucide-react-native";
import type { Tone } from "@/theme/palette";
import { ConfirmDialog } from "./ConfirmDialog";

interface AlertOptions {
  tone?: Tone;
  confirmLabel?: string;
  /** Adds a cancel button; without one the alert is a single OK. */
  cancelLabel?: string;
  destructive?: boolean;
  /** Also runs when a single-button alert is dismissed, so follow-up work always happens. */
  onConfirm?: () => void;
  onCancel?: () => void;
}

type AlertRequest = AlertOptions & { title: string; message?: string };

let enqueue: ((alert: AlertRequest) => void) | null = null;

export function showAlert(title: string, message?: string, options?: AlertOptions): void {
  enqueue?.({ title, message, ...options });
}

export function showError(title: string, message?: string): void {
  showAlert(title, message, { tone: "danger" });
}

export function AlertHost() {
  const [queue, setQueue] = useState<AlertRequest[]>([]);
  // The closing alert keeps its text while the dialog fades out.
  const shown = useRef<AlertRequest>({ title: "" });
  if (queue[0]) shown.current = queue[0];
  const alert = shown.current;
  const tone = alert.tone ?? (alert.destructive ? "danger" : "info");

  useEffect(() => {
    enqueue = (next) => setQueue((q) => [...q, next]);
    return () => {
      enqueue = null;
    };
  }, []);

  const close = (then?: () => void) => {
    setQueue((q) => q.slice(1));
    then?.();
  };

  return (
    <ConfirmDialog
      visible={queue.length > 0}
      icon={tone === "success" ? CircleCheck : tone === "danger" || tone === "warning" ? TriangleAlert : Info}
      tone={tone}
      title={alert.title}
      message={alert.message}
      confirmLabel={alert.confirmLabel ?? "OK"}
      cancelLabel={alert.cancelLabel ?? null}
      destructive={alert.destructive}
      onConfirm={() => close(alert.onConfirm)}
      onCancel={() => close(alert.cancelLabel ? alert.onCancel : alert.onConfirm)}
    />
  );
}
