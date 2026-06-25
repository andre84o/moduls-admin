"use client";
import { useSearchParams } from "next/navigation";
import { customerContent } from "@/config/customer-content";

/**
 * Public booking status banner — shared, reusable section.
 *
 * Reads the `?booking=success|cancelled` query param and shows a fixed overlay.
 * Message text comes from props when provided, otherwise falls back to config.
 * The optional props let the future Website Content System drive the messages
 * from DB content without changing this component.
 */
export type BookingBannerProps = {
  successText?: string;
  cancelledText?: string;
};

export function BookingBanner({
  successText,
  cancelledText,
}: BookingBannerProps = {}) {
  const status = useSearchParams().get("booking");
  if (status !== "success" && status !== "cancelled") return null;
  const success = status === "success";
  const text = success
    ? successText ?? customerContent.bookingBanner.success
    : cancelledText ?? customerContent.bookingBanner.cancelled;
  return (
    <div className={`fixed inset-x-0 top-0 z-50 px-4 py-3 text-center text-sm font-medium text-white ${success ? "bg-emerald-600" : "bg-zinc-700"}`}>
      {text}
    </div>
  );
}
