import type { RestaurantTableLayoutInput } from "./types";

export const RESTAURANT_FLOOR_PLAN_WIDTH = 1000;
export const RESTAURANT_FLOOR_PLAN_HEIGHT = 650;
export const RESTAURANT_FLOOR_PLAN_DEFAULT_WIDTH = 140;
export const RESTAURANT_FLOOR_PLAN_DEFAULT_HEIGHT = 90;

export function isValidRestaurantFloorPlanItem(
  item: RestaurantTableLayoutInput,
): boolean {
  if (!item.tableId.trim()) return false;
  if (!Number.isInteger(item.x) || !Number.isInteger(item.y)) return false;
  if (!Number.isInteger(item.width) || !Number.isInteger(item.height)) return false;
  if (!Number.isInteger(item.rotation)) return false;
  if (item.shape !== "RECTANGLE" && item.shape !== "ROUND") return false;
  if (item.x < 0 || item.y < 0) return false;
  if (item.width < 40 || item.width > 300) return false;
  if (item.height < 40 || item.height > 220) return false;
  if (item.rotation < 0 || item.rotation > 359) return false;
  if (item.x + item.width > RESTAURANT_FLOOR_PLAN_WIDTH) return false;
  if (item.y + item.height > RESTAURANT_FLOOR_PLAN_HEIGHT) return false;
  return true;
}

export function clampRestaurantFloorPlanPosition(input: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return {
    x: Math.max(
      0,
      Math.min(
        RESTAURANT_FLOOR_PLAN_WIDTH - input.width,
        Math.round(input.x),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        RESTAURANT_FLOOR_PLAN_HEIGHT - input.height,
        Math.round(input.y),
      ),
    ),
  };
}
