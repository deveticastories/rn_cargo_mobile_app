import { useEffect } from "react";
import { useNavigation, useScrollToTop, type NavigationProp, type NavigationState, type ParamListBase } from "@react-navigation/native";

type ScrollRef = Parameters<typeof useScrollToTop>[0];

/**
 * For the root screen of a bottom tab: scrolls back to the top when the user
 * switches to another tab (so returning starts fresh) and when the active tab
 * is tapped again. Pushing a detail screen and coming back keeps the position.
 */
export function useTabScrollReset(ref: ScrollRef) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  useScrollToTop(ref);

  useEffect(() => {
    let tabs: NavigationProp<ParamListBase> | undefined = navigation;
    while (tabs && tabs.getState()?.type !== "tab") tabs = tabs.getParent();
    if (!tabs) return;
    const initial = tabs.getState();
    const ownTab = initial.routes[initial.index].key;

    return tabs.addListener("state", (e) => {
      const state = e.data.state as NavigationState;
      if (state.routes[state.index].key === ownTab) return;
      const list = ref.current as { scrollTo?: (o: { y: number; animated?: boolean }) => void; scrollToOffset?: (o: { offset: number; animated?: boolean }) => void } | null;
      if (list?.scrollToOffset) list.scrollToOffset({ offset: 0, animated: false });
      else list?.scrollTo?.({ y: 0, animated: false });
    });
  }, [navigation, ref]);
}
