import { registerRootComponent } from "expo";
import notifee from "@notifee/react-native";
import App from "./App";
import { handleDownloadNotificationEvent } from "@/utils/downloads";

// Tapping a download notification while the app is in the background opens the file.
notifee.onBackgroundEvent(handleDownloadNotificationEvent);

registerRootComponent(App);
