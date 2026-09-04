import { describe, expect, it } from "vitest";
import { chooseRestaurantTables } from "@/modules/restaurant-booking/table-assignment";

const tables = [
  { id: "t2", minSeats: 1, maxSeats: 2, combinationGroup: "A" },
  { id: "t4", minSeats: 2, maxSeats: 4, combinationGroup: "A" },
  { id: "t6", minSeats: 2, maxSeats: 6, combinationGroup: "B" },
  { id: "t8", minSeats: 4, maxSeats: 8, combinationGroup: null },
];

describe("Restaurant Booking table allocator", () => {
  it("prefers the smallest fitting single table", () => {
    expect(
      chooseRestaurantTables({ tables, occupied: new Set(), partySize: 3, allowCombinations: true }),
    ).toEqual(["t4"]);
  });

  it("skips occupied tables", () => {
    expect(
      chooseRestaurantTables({
        tables,
        occupied: new Set(["t4"]),
        partySize: 3,
        allowCombinations: true,
      }),
    ).toEqual(["t6"]);
  });

  it("returns null when no single table fits and combinations are disabled", () => {
    expect(
      chooseRestaurantTables({
        tables: tables.slice(0, 2),
        occupied: new Set(),
        partySize: 5,
        allowCombinations: false,
      }),
    ).toBeNull();
  });

  it("combines only tables from the same combination group", () => {
    expect(
      chooseRestaurantTables({
        tables: [
          { id: "a2", minSeats: 1, maxSeats: 2, combinationGroup: "A" },
          { id: "a4", minSeats: 1, maxSeats: 4, combinationGroup: "A" },
          { id: "b4", minSeats: 1, maxSeats: 4, combinationGroup: "B" },
        ],
        occupied: new Set(),
        partySize: 5,
        allowCombinations: true,
      }),
    ).toEqual(["a2", "a4"]);
  });

  it("chooses the smallest total capacity combination", () => {
    expect(
      chooseRestaurantTables({
        tables: [
          { id: "a2", minSeats: 1, maxSeats: 2, combinationGroup: "A" },
          { id: "a4", minSeats: 1, maxSeats: 4, combinationGroup: "A" },
          { id: "a6", minSeats: 7, maxSeats: 6, combinationGroup: "A" },
        ],
        occupied: new Set(),
        partySize: 6,
        allowCombinations: true,
      }),
    ).toEqual(["a2", "a4"]);
  });

  it("prefers fewer tables when total capacity is equal", () => {
    expect(
      chooseRestaurantTables({
        tables: [
          { id: "a2a", minSeats: 1, maxSeats: 2, combinationGroup: "A" },
          { id: "a2b", minSeats: 1, maxSeats: 2, combinationGroup: "A" },
          { id: "a4a", minSeats: 5, maxSeats: 4, combinationGroup: "A" },
          { id: "a4b", minSeats: 5, maxSeats: 4, combinationGroup: "A" },
        ],
        occupied: new Set(),
        partySize: 8,
        allowCombinations: true,
      }),
    ).toEqual(["a4a", "a4b"]);
  });

  it("does not combine ungrouped tables", () => {
    expect(
      chooseRestaurantTables({
        tables: [
          { id: "x4", minSeats: 1, maxSeats: 4, combinationGroup: null },
          { id: "y4", minSeats: 1, maxSeats: 4, combinationGroup: null },
        ],
        occupied: new Set(),
        partySize: 6,
        allowCombinations: true,
      }),
    ).toBeNull();
  });
});
