import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { MasterKey } from "@/features/masters/config";
import type { BookingListTab } from "@/store/selectors";

export type BookingFilter = "all" | BookingListTab;

export type MoreStackParamList = {
  MoreHome: undefined;
  Finance: { tab?: "invoices" | "receipts" | "expenses" } | undefined;
  MasterList: { masterKey: MasterKey };
  /** Web console's Stuffing → "Stuffed list": every stuffed container. */
  StuffedContainers: undefined;
  /** One stuffed container's bookings, their charges and bundles. */
  StuffedContainer: { stuffingId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Bookings: { filter?: BookingFilter } | undefined;
  Invoices: undefined;
  DeliveryNotes: undefined;
  Stuffing: undefined;
  More: NavigatorScreenParams<MoreStackParamList> | undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  BookingDetail: { id: string };
  Containers: undefined;
  /** Web console's Repacking page: build the bundles of a "Repacking Required" booking. */
  Repacking: { bookingId?: string } | undefined;
  /** Web console's Ready to ship page: save the packing list of each bundle. */
  ReadyToShip: { bookingId?: string } | undefined;
  NewBooking: undefined;
  /** Finance mode's + action: record a payment received against an invoice. */
  ReceiptEntry: undefined;
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
