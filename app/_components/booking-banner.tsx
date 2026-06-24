"use client";
import { useSearchParams } from "next/navigation";

export function BookingBanner() {
  const status = useSearchParams().get("booking");
  if (status !== "success" && status !== "cancelled") return null;
  const success = status === "success";
  return (
    <div className={`fixed inset-x-0 top-0 z-50 px-4 py-3 text-center text-sm font-medium text-white ${success ? "bg-emerald-600" : "bg-zinc-700"}`}>
      {success
        ? "Payment received — your booking is being confirmed. Check your email shortly."
        : "Checkout cancelled — you have not been charged."}
    </div>
  );
}
