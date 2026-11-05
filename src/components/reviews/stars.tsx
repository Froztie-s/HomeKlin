import { Star } from "lucide-react";
import { ratingValues } from "./rating";

type StarsProps = {
  /** 1 to 5: how many stars are filled. */
  value: number;
  size?: "sm" | "md";
};

const sizes = { sm: "size-3.5", md: "size-4.5" };

// Five stars, the first `value` filled in the rating colour (T30). Decorative: the number beside it
// always says the rating in words, so the stars are hidden from screen readers.
export function Stars({ value, size = "md" }: StarsProps) {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center gap-0.5">
      {ratingValues.map((star) => (
        <Star
          key={star}
          className={`${sizes[size]} ${star <= value ? "fill-rating text-rating" : "fill-none text-border-control"}`}
          strokeWidth={1.75}
        />
      ))}
    </span>
  );
}
