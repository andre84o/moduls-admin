import { describe, expect, it } from "vitest";
import {
  clampRestaurantFloorPlanPosition,
  isValidRestaurantFloorPlanItem,
  RESTAURANT_FLOOR_PLAN_HEIGHT,
  RESTAURANT_FLOOR_PLAN_WIDTH,
} from "@/modules/restaurant-booking/floor-plan";

describe("Restaurant Booking floor plan", () => {
  it("accepts a valid tenant-neutral layout item", () => {
    expect(
      isValidRestaurantFloorPlanItem({
        tableId: "table-1",
        x: 100,
        y: 80,
        width: 140,
        height: 90,
        shape: "RECTANGLE",
        rotation: 0,
      }),
    ).toBe(true);
  });

  it("rejects layout items outside the canvas", () => {
    expect(
      isValidRestaurantFloorPlanItem({
        tableId: "table-1",
        x: RESTAURANT_FLOOR_PLAN_WIDTH - 50,
        y: 80,
        width: 140,
        height: 90,
        shape: "RECTANGLE",
        rotation: 0,
      }),
    ).toBe(false);
  });

  it("rejects unsupported shapes and rotations", () => {
    expect(
      isValidRestaurantFloorPlanItem({
        tableId: "table-1",
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        shape: "ROUND",
        rotation: 360,
      }),
    ).toBe(false);
  });

  it("clamps dragged tables inside the canvas", () => {
    expect(
      clampRestaurantFloorPlanPosition({
        x: RESTAURANT_FLOOR_PLAN_WIDTH + 500,
        y: RESTAURANT_FLOOR_PLAN_HEIGHT + 500,
        width: 140,
        height: 90,
      }),
    ).toEqual({
      x: RESTAURANT_FLOOR_PLAN_WIDTH - 140,
      y: RESTAURANT_FLOOR_PLAN_HEIGHT - 90,
    });
  });

  it("clamps negative drag coordinates to zero", () => {
    expect(
      clampRestaurantFloorPlanPosition({
        x: -50,
        y: -20,
        width: 140,
        height: 90,
      }),
    ).toEqual({ x: 0, y: 0 });
  });
});
