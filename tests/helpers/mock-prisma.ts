// Minimal in-memory Prisma stand-in for unit/E2E tests. It implements ONLY the
// query shapes used by the booking flow (checkout + confirm + CRM), with a tiny
// where-matcher supporting equality, lt/lte/gt/gte, in/notIn, null, and OR.
// State is shared across calls, so a single instance can drive a whole flow
// (create hold -> webhook confirm -> CRM upsert) exactly like the real DB would.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRow = Record<string, any>;

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

function matchWhere(row: AnyRow, where: AnyRow): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (key === "OR") {
      if (!(cond as AnyRow[]).some((w) => matchWhere(row, w))) return false;
      continue;
    }
    const val = row[key];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as AnyRow;
      if ("lt" in c && !(val < c.lt)) return false;
      if ("lte" in c && !(val <= c.lte)) return false;
      if ("gt" in c && !(val > c.gt)) return false;
      if ("gte" in c && !(val >= c.gte)) return false;
      if ("in" in c && !(c.in as any[]).includes(val)) return false;
      if ("notIn" in c && (c.notIn as any[]).includes(val)) return false;
    } else if (val !== cond) {
      return false;
    }
  }
  return true;
}

export type Seed = {
  businesses?: AnyRow[];
  properties?: AnyRow[];
  bookings?: AnyRow[];
  blockedTimes?: AnyRow[];
  customers?: AnyRow[];
};

export type MockPrisma = any;

export function createMockPrisma(seed: Seed = {}): MockPrisma {
  const businesses: AnyRow[] = [...(seed.businesses ?? [])];
  const properties: AnyRow[] = [...(seed.properties ?? [])];
  const bookings: AnyRow[] = [...(seed.bookings ?? [])];
  const blockedTimes: AnyRow[] = [...(seed.blockedTimes ?? [])];
  const customers: AnyRow[] = [...(seed.customers ?? [])];

  function withRelations(b: AnyRow): AnyRow {
    return {
      ...b,
      property: properties.find((p) => p.id === b.propertyId) ?? null,
      business: businesses.find((x) => x.id === b.businessId) ?? null,
    };
  }

  const db: AnyRow = {
    // Direct access to the underlying stores for assertions.
    _stores: { businesses, properties, bookings, blockedTimes, customers },

    property: {
      findFirst: async ({ where }: AnyRow) =>
        properties.find((p) => matchWhere(p, where)) ?? null,
    },

    booking: {
      create: async ({ data }: AnyRow) => {
        const row: AnyRow = {
          id: newId("booking"),
          customerId: null,
          paid: false,
          stripeSessionId: null,
          stripePaymentIntentId: null,
          ...data,
        };
        bookings.push(row);
        return row;
      },
      findMany: async ({ where }: AnyRow) =>
        bookings.filter((b) => matchWhere(b, where)),
      findUnique: async ({ where }: AnyRow) =>
        bookings.find((b) => matchWhere(b, where)) ?? null,
      findFirst: async ({ where }: AnyRow) => {
        const b = bookings.find((x) => matchWhere(x, where));
        return b ? withRelations(b) : null;
      },
      updateMany: async ({ where, data }: AnyRow) => {
        let count = 0;
        for (const b of bookings) {
          if (matchWhere(b, where)) {
            Object.assign(b, data);
            count += 1;
          }
        }
        return { count };
      },
      deleteMany: async ({ where }: AnyRow) => {
        let count = 0;
        for (let i = bookings.length - 1; i >= 0; i -= 1) {
          if (matchWhere(bookings[i], where)) {
            bookings.splice(i, 1);
            count += 1;
          }
        }
        return { count };
      },
    },

    blockedTime: {
      findFirst: async ({ where }: AnyRow) =>
        blockedTimes.find((x) => matchWhere(x, where)) ?? null,
    },

    customer: {
      findFirst: async ({ where }: AnyRow) =>
        customers.find((c) => matchWhere(c, where)) ?? null,
      aggregate: async ({ where }: AnyRow) => {
        const nums = customers
          .filter((c) => matchWhere(c, where))
          .map((c) => (c.number ?? 0) as number);
        return { _max: { number: nums.length ? Math.max(...nums) : null } };
      },
      create: async ({ data }: AnyRow) => {
        const row: AnyRow = { id: newId("customer"), ...data };
        customers.push(row);
        return row;
      },
      updateMany: async ({ where, data }: AnyRow) => {
        let count = 0;
        for (const c of customers) {
          if (matchWhere(c, where)) {
            Object.assign(c, data);
            count += 1;
          }
        }
        return { count };
      },
    },

    // Run the callback with the same in-memory db as the "transaction" client.
    $transaction: async (fn: (tx: AnyRow) => Promise<any>) => fn(db),
  };

  return db;
}
