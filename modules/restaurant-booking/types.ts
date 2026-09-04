export type RestaurantConfirmationModeValue = "AUTO_CONFIRM" | "REQUEST";

export type RestaurantBookingSettingsInput = {
  slotIntervalMin: number;
  defaultDurationMin: number;
  turnaroundMin: number;
  minLeadTimeMin: number;
  bookingHorizonDays: number;
  maxPartySize: number;
  confirmationMode: RestaurantConfirmationModeValue;
  allowTableCombinations: boolean;
};

export const DEFAULT_RESTAURANT_BOOKING_SETTINGS: RestaurantBookingSettingsInput = {
  slotIntervalMin: 30,
  defaultDurationMin: 120,
  turnaroundMin: 0,
  minLeadTimeMin: 60,
  bookingHorizonDays: 60,
  maxPartySize: 12,
  confirmationMode: "REQUEST",
  allowTableCombinations: true,
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
