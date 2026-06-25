"use client";
import { useSearchParams } from "next/navigation";
import { customerContent } from "@/config/customer-content";

export function BookingBanner() {
  const status = useSearchParams().get("booking");
  if (status !== "success" && status !== "cancelled") return null;
  const success = status === "success";
  const { success: successText, cancelled: cancelledText } =
    customerContent.bookingBanner;
  return (
    <div className={`fixed inset-x-0 top-0 z-50 px-4 py-3 text-center text-sm font-medium text-white ${success ? "bg-emerald-600" : "bg-zinc-700"}`}>
      {success ? successText : cancelledText}
    </div>
  );
}
