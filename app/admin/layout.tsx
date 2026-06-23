import { requireUser } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Protects all of /admin — redirects to /login when there is no session.
  await requireUser();

  return children;
}
