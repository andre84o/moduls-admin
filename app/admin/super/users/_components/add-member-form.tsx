"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addMember } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Business = { id: string; name: string };

export function AddMemberForm({ businesses }: { businesses: Business[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(addMember, undefined);
  const [businessId, setBusinessId] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-post</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="namn@domän.se"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Företag</Label>
          <input type="hidden" name="businessId" value={businessId} />
          <Select value={businessId} onValueChange={(v) => setBusinessId(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Välj företag…">
                {businesses.find((b) => b.id === businessId)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {businesses.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Roll</Label>
          <input type="hidden" name="role" value={role} />
          <Select value={role} onValueChange={(v) => setRole(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Välj roll…" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="OWNER">OWNER</SelectItem>
              <SelectItem value="ADMIN">ADMIN</SelectItem>
              <SelectItem value="STAFF">STAFF</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : state?.success ? (
        <p className="text-sm text-green-600">{state.success}</p>
      ) : null}

      <Button type="submit" disabled={pending || !businessId || !role}>
        {pending ? "Sparar…" : "Lägg till användare"}
      </Button>
    </form>
  );
}
