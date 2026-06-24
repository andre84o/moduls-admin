"use client";

import { Button } from "@/components/ui/button";

export type GuestCounts = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

export type GuestLimits = {
  maxGuests: number | null;
  maxAdults: number | null;
  maxChildren: number | null;
  maxInfants: number | null;
  maxPets: number | null;
  petsAllowed: boolean;
};

type Props = {
  value: GuestCounts;
  onChange: (g: GuestCounts) => void;
  limits: GuestLimits;
};

type RowKey = keyof GuestCounts;

export default function GuestSelector({ value, onChange, limits }: Props) {
  // adults+children count toward maxGuests; infants and pets do not.
  const guestCount = value.adults + value.children;

  const set = (key: RowKey, next: number) =>
    onChange({ ...value, [key]: next });

  const rows: {
    key: RowKey;
    label: string;
    helper?: string;
    min: number;
    perCategoryMax: number | null;
    countsTowardGuests: boolean;
  }[] = [
    {
      key: "adults",
      label: "Adults",
      min: 1,
      perCategoryMax: limits.maxAdults,
      countsTowardGuests: true,
    },
    {
      key: "children",
      label: "Children",
      helper: "Ages 2–12",
      min: 0,
      perCategoryMax: limits.maxChildren,
      countsTowardGuests: true,
    },
    {
      key: "infants",
      label: "Infants",
      helper: "Under 2",
      min: 0,
      perCategoryMax: limits.maxInfants,
      countsTowardGuests: false,
    },
  ];

  if (limits.petsAllowed) {
    rows.push({
      key: "pets",
      label: "Pets",
      min: 0,
      perCategoryMax: limits.maxPets,
      countsTowardGuests: false,
    });
  }

  return (
    <div className="guest-selector flex flex-col gap-3">
      {rows.map((row) => {
        const current = value[row.key];

        const atPerCategoryMax =
          row.perCategoryMax != null && current >= row.perCategoryMax;

        const wouldExceedGuests =
          row.countsTowardGuests &&
          limits.maxGuests != null &&
          guestCount >= limits.maxGuests;

        const incDisabled = atPerCategoryMax || wouldExceedGuests;
        const decDisabled = current <= row.min;

        return (
          <div
            key={row.key}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{row.label}</span>
              {row.helper && (
                <span className="text-xs text-muted-foreground">
                  {row.helper}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={`Decrease ${row.label}`}
                disabled={decDisabled}
                onClick={() => set(row.key, current - 1)}
              >
                −
              </Button>

              <span className="w-4 text-center text-sm tabular-nums">
                {current}
              </span>

              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={`Increase ${row.label}`}
                disabled={incDisabled}
                onClick={() => set(row.key, current + 1)}
              >
                +
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
