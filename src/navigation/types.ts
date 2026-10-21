import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { MasterKey } from "@/features/masters/config";
import type { BookingStage } from "@/store/selectors";

export type BookingFilter = "all" | BookingStage;

export type MoreStackParamList = {
  MoreHome: undefined;
  Finance: { tab?: "invoices" | "receipts" | "expenses" } | undefined;
  MasterList: { masterKey: MasterKey };
};

export type MainTabParamList = {
  Home: undefined;
  Bookings: { filter?: BookingFilter } | undefined;
  Containers: undefined;
  More: NavigatorScreenParams<MoreStackParamList> | undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  BookingDetail: { id: string };
  NewBooking: undefined;
  MasterForm: { masterKey: MasterKey; id?: string };
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type MoreScreenProps<T extends keyof MoreStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<MoreStackParamList, T>,
  CompositeScreenProps<BottomTabScreenProps<MainTabParamList>, NativeStackScreenProps<RootStackParamList>>
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
