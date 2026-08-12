"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { resetPassword } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RULES = [
  { label: "Minst 8 tecken", check: (p: string) => p.length >= 8 },
  { label: "Minst 1 stor bokstav", check: (p: string) => /[A-Z]/.test(p) },
];

function StrengthBar({ password }: { password: string }) {
  if (!password) return null;
  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex gap-1.5">
        {RULES.map((rule, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              rule.check(password) ? "bg-green-500" : "bg-amber-500/70"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {RULES.map((r) => r.label).join(" · ")}
      </p>
    </div>
  );
}

function MatchBar({ password, confirm }: { password: string; confirm: string }) {
  if (!confirm) return null;
  const matches = password === confirm;
  return (
    <div className="pt-1">
      <div
        className={`h-1 w-full rounded-full transition-colors duration-300 ${
          matches ? "bg-green-500" : "bg-red-500/60"
        }`}
      />
    </div>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const allRulesMet = RULES.every((r) => r.check(password));
  const matches = password.length > 0 && password === confirm;
  const canSubmit = allRulesMet && matches;

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="password">Nytt lösenord</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <StrengthBar password={password} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm">Upprepa lösenord</Label>
        <div className="relative">
          <Input
            id="confirm"
            name="confirm"
            type={showConfirm ? "text" : "password"}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <MatchBar password={password} confirm={confirm} />
      </div>

      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <Button
        type="submit"
        disabled={pending || !canSubmit}
        className="w-full disabled:opacity-40"
      >
        {pending ? "Sparar…" : "Sätt lösenord"}
      </Button>
    </form>
  );
}
