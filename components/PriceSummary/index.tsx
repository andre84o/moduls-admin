import { Separator } from "@/components/ui/separator";

type Props = {
  nights: number;
  pricePerNight: number;
  cleaningFee: number;
  total: number;
  currency: string;
};

// Money is in minor units (integers).
const money = (amount: number, currency: string) =>
  `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;

export default function PriceSummary({
  nights,
  pricePerNight,
  cleaningFee,
  total,
  currency,
}: Props) {
  return (
    <div className="price-summary flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between">
        <span>
          {nights} night{nights === 1 ? "" : "s"} × {money(pricePerNight, currency)}
        </span>
        <span>{money(pricePerNight * nights, currency)}</span>
      </div>

      <div className="flex items-center justify-between">
        <span>Cleaning fee</span>
        <span>{money(cleaningFee, currency)}</span>
      </div>

      <Separator className="my-1" />

      <div className="flex items-center justify-between font-bold">
        <span>Total</span>
        <span>{money(total, currency)}</span>
      </div>
    </div>
  );
}
