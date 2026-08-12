"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMemberRole } from "../actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MemberRole } from "@/app/generated/prisma/enums";

const ROLES: MemberRole[] = ["OWNER", "ADMIN", "STAFF"];

export function MemberRoleSelect({
  memberId,
  currentRole,
}: {
  memberId: string;
  currentRole: MemberRole;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={currentRole}
      disabled={pending}
      onValueChange={(v) => {
        if (!v) return;
        startTransition(async () => {
          await updateMemberRole(memberId, v as MemberRole);
          router.refresh();
        });
      }}
    >
      <SelectTrigger className="h-7 w-28 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {ROLES.map((r) => (
          <SelectItem key={r} value={r} className="text-xs">
            {r}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
