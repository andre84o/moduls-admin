import "server-only";

export type AssignableRestaurantTable = {
  id: string;
  minSeats: number;
  maxSeats: number;
  combinationGroup: string | null;
};

export function restaurantTableSelectionFitsParty(
  tables: Pick<AssignableRestaurantTable, "minSeats" | "maxSeats">[],
  partySize: number,
): boolean {
  if (!Number.isInteger(partySize) || partySize < 1 || tables.length === 0) return false;
  const minimumSeats = tables.reduce((sum, table) => sum + table.minSeats, 0);
  const maximumSeats = tables.reduce((sum, table) => sum + table.maxSeats, 0);
  return partySize >= minimumSeats && partySize <= maximumSeats;
}

/** Pick the smallest fitting single table, otherwise the smallest valid combination. */
export function chooseRestaurantTables(input: {
  tables: AssignableRestaurantTable[];
  occupied: Set<string>;
  partySize: number;
  allowCombinations: boolean;
}): string[] | null {
  const free = input.tables.filter((table) => !input.occupied.has(table.id));
  const singles = free
    .filter((table) => restaurantTableSelectionFitsParty([table], input.partySize))
    .sort((a, b) => a.maxSeats - b.maxSeats || a.minSeats - b.minSeats || a.id.localeCompare(b.id));
  if (singles[0]) return [singles[0].id];
  if (!input.allowCombinations) return null;

  const groups = new Map<string, AssignableRestaurantTable[]>();
  for (const table of free) {
    if (!table.combinationGroup) continue;
    const list = groups.get(table.combinationGroup) ?? [];
    list.push(table);
    groups.set(table.combinationGroup, list);
  }

  let best: { ids: string[]; maximumSeats: number } | null = null;
  for (const group of groups.values()) {
    if (group.length < 2) continue;

    // Keep minimum and maximum capacity in the DP key. Keeping only max capacity
    // can discard a valid combination when two combinations have the same max
    // seats but different summed minimum-seat requirements.
    const dp = new Map<string, { ids: string[]; minimumSeats: number; maximumSeats: number }>();
    dp.set("0:0", { ids: [], minimumSeats: 0, maximumSeats: 0 });
    for (const table of group) {
      const snapshot = [...dp.values()];
      for (const candidate of snapshot) {
        const next = {
          ids: [...candidate.ids, table.id],
          minimumSeats: candidate.minimumSeats + table.minSeats,
          maximumSeats: candidate.maximumSeats + table.maxSeats,
        };
        const key = `${next.minimumSeats}:${next.maximumSeats}`;
        const existing = dp.get(key);
        if (!existing || next.ids.length < existing.ids.length) dp.set(key, next);
      }
    }

    for (const candidate of dp.values()) {
      if (candidate.ids.length < 2) continue;
      if (input.partySize < candidate.minimumSeats || input.partySize > candidate.maximumSeats) continue;
      if (
        !best ||
        candidate.maximumSeats < best.maximumSeats ||
        (candidate.maximumSeats === best.maximumSeats && candidate.ids.length < best.ids.length)
      ) {
        best = { ids: candidate.ids, maximumSeats: candidate.maximumSeats };
      }
    }
  }
  return best?.ids ?? null;
}
