/**
 * Saving generated PDFs straight into the phone's Downloads folder, then
 * posting a "downloaded" notification (notifee) that opens the file when tapped.
 *
 * Android 10+ writes through MediaStore's Downloads collection (no permission,
 * no folder picker). Android 7–9 copies into the public Download directory
 * after asking for storage permission. iOS has no shared Downloads folder, so
 * there each file goes to the share sheet instead (Save to Files → Downloads).
 */
import { PermissionsAndroid, Platform, ToastAndroid } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Roboto_400Regular } from "@expo-google-fonts/roboto/400Regular";
import { Roboto_700Bold } from "@expo-google-fonts/roboto/700Bold";
import { Asset } from "expo-asset";
import notifee, { AndroidImportance, AuthorizationStatus, EventType, type Event } from "@notifee/react-native";
import ReactNativeBlobUtil from "react-native-blob-util";

const CHANNEL_ID = "downloads";
const PDF_MIME = "application/pdf";

export interface PdfFile {
  fileName: string;
  html: string;
  /** Page size in points; Android ignores CSS @page size. */
  size?: { width: number; height: number };
}

let notificationsReady: Promise<boolean> | null = null;

/** Creates the Android channel and asks for notification permission — once per launch. */
function prepareNotifications(): Promise<boolean> {
  notificationsReady ??= (async () => {
    await notifee.createChannel({ id: CHANNEL_ID, name: "Downloads", importance: AndroidImportance.DEFAULT });
    const { authorizationStatus } = await notifee.requestPermission();
    return authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  })().catch(() => false);
  return notificationsReady;
}

/** "Download complete" notification; tapping it opens the saved file. */
async function notifyDownloaded(fileName: string, uri: string) {
  if (!(await prepareNotifications())) {
    ToastAndroid.show(`${fileName} saved to Downloads`, ToastAndroid.SHORT);
    return;
  }
  await notifee.displayNotification({
    title: "Download complete",
    body: fileName,
    data: { uri, mime: PDF_MIME },
    android: { channelId: CHANNEL_ID, pressAction: { id: "default", launchActivity: "default" }, autoCancel: true },
  });
}

/** Opens a saved file in the phone's PDF viewer. */
export function openDownloadedFile(uri: string, mime = PDF_MIME) {
  return ReactNativeBlobUtil.android.actionViewIntent(uri, mime).catch(() => {
    ToastAndroid.show("No app found to open PDF files.", ToastAndroid.LONG);
  });
}

const opened = new Set<string>();

/** Notification tap → open its file. Registered for both foreground and background events. */
export async function handleDownloadNotificationEvent({ type, detail }: Event) {
  const { id, data } = detail.notification ?? {};
  if (type !== EventType.PRESS || typeof data?.uri !== "string") return;
  // A cold start can deliver the same tap twice (background event + initial notification).
  if (id) {
    if (opened.has(id)) return;
    opened.add(id);
    await notifee.cancelNotification(id);
  }
  await openDownloadedFile(data.uri, typeof data.mime === "string" ? data.mime : PDF_MIME);
}

/** Foreground taps, plus the tap that launched the app. Returns the unsubscribe function. */
export function listenForDownloadTaps(): () => void {
  if (Platform.OS !== "android") return () => {};
  void notifee.getInitialNotification().then((initial) => {
    if (initial) void handleDownloadNotificationEvent({ type: EventType.PRESS, detail: { notification: initial.notification, pressAction: initial.pressAction } });
  });
  return notifee.onForegroundEvent((event) => void handleDownloadNotificationEvent(event));
}

/**
 * Roboto regular + bold, embedded in every PDF. Phones substitute their own
 * system font for Helvetica/Arial (some, like OPPO's, have no bold at all),
 * so headings only print bold with a font that ships inside the document.
 */
let pdfFontCss: Promise<string> | null = null;
function loadPdfFontCss(): Promise<string> {
  pdfFontCss ??= (async () => {
    const dataUri = async (mod: number) => {
      const asset = Asset.fromModule(mod);
      await asset.downloadAsync();
      return `data:font/ttf;base64,${await FileSystem.readAsStringAsync(asset.localUri ?? asset.uri, { encoding: FileSystem.EncodingType.Base64 })}`;
    };
    const [regular, bold] = await Promise.all([dataUri(Roboto_400Regular), dataUri(Roboto_700Bold)]);
    const face = (uri: string, weight: number) => `@font-face { font-family: "PdfSans"; font-weight: ${weight}; src: url(${uri}) format("truetype"); }`;
    // expo-print prints as soon as the page reports loaded (its WebView has JavaScript off), and an
    // off-screen WebView may not lay out — so never request the font — before then. Preloading starts
    // both fetches while parsing and holds the load event until they're in.
    const preload = (uri: string) => `<link rel="preload" as="font" type="font/ttf" href="${uri}" crossorigin/>`;
    return `${preload(regular)}${preload(bold)}<style>${face(regular, 400)}${face(bold, 700)} body, body * { font-family: "PdfSans", Helvetica, Arial, sans-serif !important; }</style>`;
  })();
  // A failed load falls back to the phone's fonts and is retried next time.
  pdfFontCss.catch(() => (pdfFontCss = null));
  return pdfFontCss;
}

async function withPdfFont(html: string): Promise<string> {
  const css = await loadPdfFontCss().catch(() => "");
  if (!css) return html;
  return html.includes("</head>") ? html.replace("</head>", `${css}</head>`) : css + html;
}

/** Writes one rendered PDF into Downloads (Android) and returns a URI other apps can open. */
async function saveToDownloads(localUri: string, fileName: string): Promise<string> {
  const path = localUri.replace(/^file:\/\//, "");
  if (Number(Platform.Version) >= 29) {
    return ReactNativeBlobUtil.MediaCollection.copyToMediaStore({ name: fileName, parentFolder: "", mimeType: PDF_MIME }, "Download", path);
  }
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error("Storage permission is needed to save to Downloads.");
  const target = `${ReactNativeBlobUtil.fs.dirs.LegacyDownloadDir}/${fileName}`;
  if (await ReactNativeBlobUtil.fs.exists(target)) await ReactNativeBlobUtil.fs.unlink(target);
  await ReactNativeBlobUtil.fs.cp(path, target);
  // Lists it in the Downloads app like any other download.
  await ReactNativeBlobUtil.android.addCompleteDownload({ title: fileName, description: "PDF", mime: PDF_MIME, path: target, showNotification: false });
  return target;
}

/**
 * Renders each PDF and saves it to Downloads with a notification per file
 * (iOS: share sheet). Returns how many files were saved.
 */
export async function downloadPdfs(files: PdfFile[]): Promise<number> {
  if (files.length === 0) return 0;
  // Ask early so the prompt doesn't appear in the middle of the downloads.
  if (Platform.OS === "android") void prepareNotifications();
  for (const { fileName, html, size } of files) {
    const name = fileName.replace(/[^\w.-]/g, "_");
    const page = await withPdfFont(html);
    const { uri } = await Print.printToFileAsync(size ? { html: page, ...size } : { html: page });
    try {
      if (Platform.OS === "android") await notifyDownloaded(name, await saveToDownloads(uri, name));
      else {
        const target = `${FileSystem.cacheDirectory}${name}`;
        await FileSystem.deleteAsync(target, { idempotent: true });
        await FileSystem.moveAsync({ from: uri, to: target });
        await Sharing.shareAsync(target, { mimeType: PDF_MIME, UTI: "com.adobe.pdf", dialogTitle: name });
      }
    } finally {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
  }
  return files.length;
}

/** Renders one PDF and saves it to Downloads (iOS: share sheet). */
export const downloadPdf = (file: PdfFile) => downloadPdfs([file]).then(() => undefined);
