export type RestaurantConfirmationModeValue = "AUTO_CONFIRM" | "REQUEST";

export type RestaurantBookingSettingsInput = {
  timezone?: string;
  slotIntervalMin: number;
  defaultDurationMin: number;
  turnaroundMin: number;
  minLeadTimeMin: number;
  bookingHorizonDays: number;
  maxPartySize: number;
  confirmationMode: RestaurantConfirmationModeValue;
  allowTableCombinations: boolean;
};

export const DEFAULT_RESTAURANT_BOOKING_SETTINGS: Required<RestaurantBookingSettingsInput> = {
  timezone: "Europe/Stockholm",
  slotIntervalMin: 30,
  defaultDurationMin: 120,
  turnaroundMin: 0,
  minLeadTimeMin: 60,
  bookingHorizonDays: 60,
  maxPartySize: 12,
  confirmationMode: "REQUEST",
  allowTableCombinations: true,
};

export type RestaurantServicePeriodInput = {
  weekday: number;
  startMinute: number;
  endMinute: number;
};

export type AdminRestaurantServicePeriod = RestaurantServicePeriodInput & {
  id: string;
};

export type AdminRestaurantBlockedPeriod = {
  id: string;
  startAt: string;
  endAt: string;
  reason: string | null;
};

export type RestaurantAvailabilitySlot = {
  startAt: string;
  endAt: string;
  available: boolean;
};

export type RestaurantAvailabilityResult = {
  date: string;
  timezone: string;
  partySize: number;
  slots: RestaurantAvailabilitySlot[];
};

export type RestaurantTableInput = {
  name: string;
  zoneId?: string | null;
  minSeats: number;
  maxSeats: number;
  combinationGroup?: string | null;
  active?: boolean;
  sortOrder?: number;
};

export type AdminRestaurantTable = {
  id: string;
  name: string;
  zoneId: string | null;
  minSeats: number;
  maxSeats: number;
  combinationGroup: string | null;
  active: boolean;
  sortOrder: number;
};

export type AdminRestaurantZone = {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  tables: AdminRestaurantTable[];
};

export type AdminRestaurantBookingStatus =
  | "PENDING"
  | "PAYMENT_PENDING"
  | "CONFIRMED"
  | "DECLINED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED";

export type AdminRestaurantBooking = {
  id: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  partySize: number;
  startAt: string;
  endAt: string;
  status: AdminRestaurantBookingStatus;
  notes: string | null;
  tables: Array<{
    id: string;
    name: string;
    minSeats: number;
    maxSeats: number;
    zone: { id: string; name: string } | null;
  }>;
};
