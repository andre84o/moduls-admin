import {
  getDashboardStats,
  getProperties,
  getBookings,
  getCustomers,
  getMedia,
} from "@/lib/queries";
import { listUserBusinesses, getActiveBusinessId } from "@/lib/auth";
import { AdminShell } from "./_components/admin-shell";

export default async function AdminPage() {
  // Each query verifies the session and scopes by the active businessId.
  const [stats, properties, bookings, customers, media, businesses, activeId] =
    await Promise.all([
      getDashboardStats(),
      getProperties(),
      getBookings(),
      getCustomers(),
      getMedia(),
      listUserBusinesses(),
      getActiveBusinessId(),
    ]);

  return (
    <AdminShell
      stats={stats}
      properties={properties}
      bookings={bookings}
      customers={customers}
      media={media}
      businesses={businesses.map((b) => ({ id: b.id, name: b.name, role: b.role }))}
      activeBusinessId={activeId}
    />
  );
}
