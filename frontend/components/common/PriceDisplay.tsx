interface PriceDisplayProps {
  value: number;
  className?: string;
  freeText?: string;
}

export function PriceDisplay({ value, freeText = "Free", className = "" }: PriceDisplayProps) {
  if (value <= 0) {
    return <span className={`font-semibold text-success ${className}`}>{freeText}</span>;
  }
  return (
    <span className={`font-semibold text-textPrimary ${className}`}>${value.toFixed(2)}</span>
  );
}
