"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeMember } from "../actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";

export function RemoveMemberButton({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
      <ConfirmDialog
        trigger={
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
          >
            Ta bort
          </Button>
        }
        title="Ta bort användare?"
        description="Användaren förlorar sin åtkomst till företaget. Åtgärden kan inte ångras."
        confirmLabel="Ta bort"
        cancelLabel="Avbryt"
        disabled={pending}
        onConfirm={() => {
          setError(null);
          startTransition(async () => {
            try {
              await removeMember(memberId);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Något gick fel.");
            }
          });
        }}
      />
    </div>
  );
}
