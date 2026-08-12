import { requireSuperAdmin } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { AddMemberForm } from "./_components/add-member-form";
import { MemberRoleSelect } from "./_components/member-role-select";
import { RemoveMemberButton } from "./_components/remove-member-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SuperUsersPage() {
  // Platform-level access. Only SUPER_ADMIN may manage cross-business members.
  await requireSuperAdmin();

  const prisma = getPrisma();

  const [businesses, members] = await Promise.all([
    prisma.business.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.businessMember.findMany({
      include: {
        user: { select: { email: true, firstName: true, lastName: true, supabaseId: true } },
        business: { select: { name: true } },
      },
      orderBy: [{ business: { name: "asc" } }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Användare</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lägg till användare och tilldela roll per företag. Användaren kopplas
          automatiskt när de loggar in för första gången.
        </p>
      </header>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Lägg till användare</CardTitle>
        </CardHeader>
        <CardContent>
          <AddMemberForm businesses={businesses} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alla medlemmar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              Inga medlemmar ännu.
            </p>
          ) : (
            <ul className="divide-y">
              {members.map((m) => {
                const pending = m.user.supabaseId.startsWith("pending-");
                const name =
                  m.user.firstName || m.user.lastName
                    ? `${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim()
                    : null;
                return (
                  <li key={m.id} className="flex items-center gap-3 px-6 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {name ?? m.user.email}
                      </p>
                      {name ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {m.user.email}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {m.business.name}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {m.role === "SUPER_ADMIN" ? (
                        <Badge variant="outline">SUPER_ADMIN</Badge>
                      ) : (
                        <MemberRoleSelect memberId={m.id} currentRole={m.role} />
                      )}
                      {pending ? (
                        <Badge variant="secondary" className="text-xs">
                          Inväntar inlogg
                        </Badge>
                      ) : null}
                      <RemoveMemberButton memberId={m.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
