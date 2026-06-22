interface RatingStarsProps {
  value: number;
  total?: number;
}

export function RatingStars({ value, total = 5 }: RatingStarsProps) {
  const filled = Math.round(value);
  return (
    <div className="flex items-center gap-1 text-sm">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={index < filled ? "text-warning" : "text-textSecondary"}
        >
          ★
        </span>
      ))}
      <span className="ml-1 text-textSecondary">{value.toFixed(1)}</span>
    </div>
  );
}
