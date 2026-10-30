import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { store } from "@/store";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { restoreSession } from "@/store/slices/authSlice";
import { loadTheme } from "@/store/slices/uiSlice";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { fontAssets } from "@/theme/fonts";
import { RootNavigator } from "@/navigation/RootNavigator";
import { listenForDownloadTaps } from "@/utils/downloads";

void SplashScreen.preventAutoHideAsync();

function Bootstrap() {
  const dispatch = useAppDispatch();
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  // Read the saved token/user and appearance preference from AsyncStorage.
  useEffect(() => {
    dispatch(loadTheme());
    dispatch(restoreSession());
  }, [dispatch]);

  // Download notifications open their PDF when tapped.
  useEffect(() => listenForDownloadTaps(), []);

  const fontsReady = fontsLoaded || !!fontError;
  const restored = useAppSelector((s) => s.auth.status !== "restoring");
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  // The native splash stays up until fonts load; AnimatedSplash hides it on its first frame.
  if (!fontsReady) return null;
  return (
    <View style={{ flex: 1 }}>
      <RootNavigator />
      {!splashDone && <AnimatedSplash ready={restored} onFinish={finishSplash} />}
    </View>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Bootstrap />
        </ThemeProvider>
      </SafeAreaProvider>
    </Provider>
  );
}
