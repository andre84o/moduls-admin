import "server-only";

export type AssignableRestaurantTable = {
  id: string;
  minSeats: number;
  maxSeats: number;
  combinationGroup: string | null;
};

/** Pick the smallest fitting single table, otherwise the smallest valid combination. */
export function chooseRestaurantTables(input: {
  tables: AssignableRestaurantTable[];
  occupied: Set<string>;
  partySize: number;
  allowCombinations: boolean;
}): string[] | null {
  const free = input.tables.filter((table) => !input.occupied.has(table.id));
  const singles = free
    .filter((table) => input.partySize >= table.minSeats && input.partySize <= table.maxSeats)
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

  let best: { ids: string[]; capacity: number } | null = null;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const dp = new Map<number, string[]>();
    dp.set(0, []);
    for (const table of group) {
      const snapshot = [...dp.entries()];
      for (const [capacity, ids] of snapshot) {
        const nextCapacity = capacity + table.maxSeats;
        const nextIds = [...ids, table.id];
        const existing = dp.get(nextCapacity);
        if (!existing || nextIds.length < existing.length) dp.set(nextCapacity, nextIds);
      }
    }
    for (const [capacity, ids] of dp.entries()) {
      if (ids.length < 2 || capacity < input.partySize) continue;
      if (
        !best ||
        capacity < best.capacity ||
        (capacity === best.capacity && ids.length < best.ids.length)
      ) {
        best = { ids, capacity };
      }
    }
  }
  return best?.ids ?? null;
}
