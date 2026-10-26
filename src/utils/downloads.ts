/**
 * Saving generated PDFs straight into the phone's Downloads folder, then
 * posting a "downloaded" notification.
 *
 * Android 10+ writes through MediaStore's Downloads collection (no permission,
 * no folder picker). Android 7–9 copies into the public Download directory
 * after asking for storage permission. iOS has no shared Downloads folder, so
 * there each file goes to the share sheet instead (Save to Files → Downloads).
 */
import { PermissionsAndroid, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import ReactNativeBlobUtil from "react-native-blob-util";

const CHANNEL_ID = "downloads";
let notificationsReady: Promise<boolean> | null = null;

/** Show notifications even while the app is open, and set up the Android channel — once per launch. */
function prepareNotifications(): Promise<boolean> {
  notificationsReady ??= (async () => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, { name: "Downloads", importance: Notifications.AndroidImportance.DEFAULT });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  })().catch(() => false);
  return notificationsReady;
}

async function notify(title: string, body: string) {
  if (!(await prepareNotifications())) return;
  await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: Platform.OS === "android" ? { channelId: CHANNEL_ID } : null });
}

/** Writes one rendered PDF into Downloads (Android). */
async function saveToDownloads(localUri: string, fileName: string) {
  const path = localUri.replace(/^file:\/\//, "");
  if (Number(Platform.Version) >= 29) {
    await ReactNativeBlobUtil.MediaCollection.copyToMediaStore({ name: fileName, parentFolder: "", mimeType: "application/pdf" }, "Download", path);
    return;
  }
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error("Storage permission is needed to save to Downloads.");
  const target = `${ReactNativeBlobUtil.fs.dirs.LegacyDownloadDir}/${fileName}`;
  if (await ReactNativeBlobUtil.fs.exists(target)) await ReactNativeBlobUtil.fs.unlink(target);
  await ReactNativeBlobUtil.fs.cp(path, target);
  // Lists it in the Downloads app like any other download.
  await ReactNativeBlobUtil.android.addCompleteDownload({ title: fileName, description: "PDF", mime: "application/pdf", path: target, showNotification: false });
}

/**
 * Renders each PDF and saves it to Downloads, then shows one notification for
 * the batch. Returns how many files were saved.
 */
export async function downloadPdfs(files: { fileName: string; html: string }[], what: { one: string; many: string }): Promise<number> {
  if (files.length === 0) return 0;
  // Ask early so the prompt doesn't appear in the middle of the downloads.
  void prepareNotifications();
  for (const { fileName, html } of files) {
    const { uri } = await Print.printToFileAsync({ html });
    try {
      if (Platform.OS === "android") await saveToDownloads(uri, fileName);
      else {
        const target = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.deleteAsync(target, { idempotent: true });
        await FileSystem.moveAsync({ from: uri, to: target });
        await Sharing.shareAsync(target, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: fileName });
      }
    } finally {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
  }
  if (Platform.OS === "android") {
    const n = files.length;
    await notify(n === 1 ? `${what.one} downloaded` : `${n} ${what.many} downloaded`, n === 1 ? `${files[0].fileName} saved to Downloads.` : `Saved to Downloads: ${files.map((f) => f.fileName).join(", ")}`);
  }
  return files.length;
}
