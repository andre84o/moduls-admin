"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import {
  submitCateringRequest,
  type CateringFormState,
} from "@/modules/catering/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Three-step catering enquiry form.
 *   1. Name, email, phone
 *   2. Guest count + menu selection
 *   3. Message, summary, consent
 *
 * Fields stay mounted across steps (hidden with CSS) so a single <form>
 * submits everything to the server action. Client validation only gates step
 * transitions — the server re-validates everything (modules/catering/actions.ts).
 */

const INPUT =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring";
const LABEL = "mb-1.5 block text-sm font-medium";
const ERR = "mt-1 text-sm text-destructive";

const STEPS = ["Kontakt", "Meny", "Meddelande"];

export function CateringForm({
  menus,
  successText,
  consentLabel,
}: {
  menus: readonly string[];
  successText: string;
  consentLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitCateringRequest,
    {} as CateringFormState,
  );
  const [step, setStep] = useState(1);
  const [v, setV] = useState({
    name: "",
    email: "",
    phone: "",
    guests: "10",
    menu: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);

  if (state.ok) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="size-7" />
        </div>
        <h3 className="mt-5 text-2xl font-semibold">Tack!</h3>
        <p className="mx-auto mt-3 max-w-sm text-muted-foreground">{successText}</p>
      </div>
    );
  }

  const set =
    (k: keyof typeof v) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV((prev) => ({ ...prev, [k]: e.target.value }));

  function validateStep1() {
    const e: Record<string, string> = {};
    if (v.name.trim().length < 2) e.name = "Ange ditt namn.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()))
      e.email = "Ange en giltig e-postadress.";
    if (!/^[0-9+()\-\s]{5,30}$/.test(v.phone.trim()))
      e.phone = "Ange ett giltigt telefonnummer.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2() {
    const e: Record<string, string> = {};
    const g = Number.parseInt(v.guests, 10);
    if (!Number.isInteger(g) || g < 1 || g > 1000)
      e.guests = "Ange antal gäster.";
    if (!v.menu) e.menu = "Välj en meny.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  }

  function back() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  const fieldError = (k: string) => errors[k] ?? state.fieldErrors?.[k];

  return (
    <div className="rounded-xl border bg-card p-6 sm:p-8">
      {/* Step indicator */}
      <ol className="mb-8 flex items-center">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <li key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-primary/15 text-primary"
                        : "border border-input text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="size-4" /> : n}
                </span>
                <span
                  className={`hidden text-sm sm:block ${active ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </span>
              </div>
              {n < STEPS.length ? (
                <span className="mx-3 h-px flex-1 bg-border" />
              ) : null}
            </li>
          );
        })}
      </ol>

      <form
        action={formAction}
        onSubmit={(e) => {
          if (step !== 3) {
            e.preventDefault();
            return;
          }
          if (!consent) {
            e.preventDefault();
            setErrors({ consent: "Du måste godkänna innan du skickar." });
          }
        }}
        className="space-y-5"
      >
        {/* Step 1 — contact */}
        <fieldset hidden={step !== 1} className="space-y-4">
          <div>
            <label htmlFor="cf-name" className={LABEL}>
              Namn *
            </label>
            <input
              id="cf-name"
              name="name"
              value={v.name}
              onChange={set("name")}
              maxLength={100}
              autoComplete="name"
              className={INPUT}
              placeholder="För- och efternamn"
            />
            {fieldError("name") && <p className={ERR}>{fieldError("name")}</p>}
          </div>
          <div>
            <label htmlFor="cf-email" className={LABEL}>
              E-postadress *
            </label>
            <input
              id="cf-email"
              name="email"
              type="email"
              value={v.email}
              onChange={set("email")}
              maxLength={200}
              autoComplete="email"
              className={INPUT}
              placeholder="du@exempel.se"
            />
            {fieldError("email") && <p className={ERR}>{fieldError("email")}</p>}
          </div>
          <div>
            <label htmlFor="cf-phone" className={LABEL}>
              Telefonnummer *
            </label>
            <input
              id="cf-phone"
              name="phone"
              type="tel"
              value={v.phone}
              onChange={set("phone")}
              maxLength={30}
              autoComplete="tel"
              className={INPUT}
              placeholder="+46 ..."
            />
            {fieldError("phone") && <p className={ERR}>{fieldError("phone")}</p>}
          </div>
        </fieldset>

        {/* Step 2 — guests + menu */}
        <fieldset hidden={step !== 2} className="space-y-4">
          <div>
            <label htmlFor="cf-guests" className={LABEL}>
              Antal gäster *
            </label>
            <input
              id="cf-guests"
              name="guests"
              type="number"
              min={1}
              max={1000}
              value={v.guests}
              onChange={set("guests")}
              className={INPUT}
              placeholder="t.ex. 20"
            />
            {fieldError("guests") && <p className={ERR}>{fieldError("guests")}</p>}
          </div>
          <div>
            <label htmlFor="cf-menu-trigger" className={LABEL}>
              Välj meny *
            </label>
            <input type="hidden" name="menu" value={v.menu} />
            <Select
              value={v.menu}
              onValueChange={(val) =>
                setV((prev) => ({ ...prev, menu: val ?? "" }))
              }
            >
              <SelectTrigger id="cf-menu-trigger" className="w-full">
                <SelectValue placeholder="Välj en meny …" />
              </SelectTrigger>
              <SelectContent>
                {menus.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError("menu") && <p className={ERR}>{fieldError("menu")}</p>}
          </div>
        </fieldset>

        {/* Step 3 — message + summary */}
        <fieldset hidden={step !== 3} className="space-y-4">
          <div>
            <label htmlFor="cf-message" className={LABEL}>
              Meddelande
            </label>
            <textarea
              id="cf-message"
              name="message"
              value={v.message}
              onChange={set("message")}
              maxLength={2000}
              rows={4}
              className={INPUT}
              placeholder="Datum, tillfälle, allergier eller andra önskemål …"
            />
            {fieldError("message") && <p className={ERR}>{fieldError("message")}</p>}
          </div>

          {/* Summary */}
          <dl className="rounded-lg border bg-muted/50 p-4 text-sm">
            {(
              [
                ["Namn", v.name],
                ["E-post", v.email],
                ["Telefon", v.phone],
                ["Antal gäster", v.guests],
                ["Meny", v.menu],
              ] as [string, string][]
            ).map(([k, val]) => (
              <div key={k} className="flex justify-between gap-4 py-1">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right">{val || "—"}</dd>
              </div>
            ))}
          </dl>

          {/* Consent */}
          <div>
            <label
              htmlFor="cf-consent"
              className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-muted-foreground"
            >
              <input
                id="cf-consent"
                name="consent"
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary focus:ring-primary"
              />
              <span>{consentLabel} *</span>
            </label>
            {fieldError("consent") && <p className={ERR}>{fieldError("consent")}</p>}
          </div>
        </fieldset>

        {/* Honeypot — hidden from real users, traps bots */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />

        {state.error && !state.fieldErrors && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={back}
              className="rounded-full border px-6 py-2.5 text-sm font-semibold transition hover:bg-accent"
            >
              Tillbaka
            </button>
          ) : (
            <span />
          )}

          {step < 3 ? (
            <button
              key="next"
              type="button"
              onClick={next}
              className="rounded-full bg-primary px-7 py-2.5 text-sm font-semibold uppercase tracking-wide text-primary-foreground transition hover:bg-primary/90"
            >
              Next
            </button>
          ) : (
            <button
              key="submit"
              type="submit"
              disabled={pending}
              className="rounded-full bg-primary px-7 py-2.5 text-sm font-semibold uppercase tracking-wide text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Skickar …" : "Skicka förfrågan"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
