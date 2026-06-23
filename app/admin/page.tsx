import {
  getDashboardStats,
  getProperties,
  getBookings,
  getCustomers,
  getCalendarEvents,
} from "@/lib/queries";
import { listUserBusinesses, getActiveBusinessId } from "@/lib/auth";
import { AdminShell } from "./_components/admin-shell";

export default async function AdminPage() {
  // Each query verifies the session and scopes by the active businessId.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const [stats, properties, bookings, customers, calendar, businesses, activeId] =
    await Promise.all([
      getDashboardStats(),
      getProperties(),
      getBookings(),
      getCustomers(),
      getCalendarEvents(monthStart, monthEnd),
      listUserBusinesses(),
      getActiveBusinessId(),
    ]);

  return (
    <AdminShell
      stats={stats}
      properties={properties}
      bookings={bookings}
      customers={customers}
      calendar={calendar}
      businesses={businesses.map((b) => ({ id: b.id, name: b.name, role: b.role }))}
      activeBusinessId={activeId}
    />
  );
}
