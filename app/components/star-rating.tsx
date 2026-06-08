import { Star } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";

export function StarRatingDisplay({
  average,
  count,
  className = "",
}: {
  average: number | null;
  count: number;
  className?: string;
}) {
  if (count === 0) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = average !== null && i < Math.round(average);
          return (
            <Star
              key={i}
              className={`size-3.5 ${
                filled
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/40"
              }`}
            />
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">
        {average !== null ? average.toFixed(1) : "—"} ({count})
      </span>
    </div>
  );
}

export function StarRatingInput({
  courseSlug,
  currentRating,
}: {
  courseSlug: string;
  currentRating: number | null;
}) {
  const fetcher = useFetcher();
  const [hovered, setHovered] = useState<number | null>(null);

  const optimisticRating = fetcher.formData
    ? Number(fetcher.formData.get("rating"))
    : currentRating;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Your rating:</span>
      <fetcher.Form method="post" action={`/courses/${courseSlug}`}>
        <div
          className="flex items-center gap-0.5"
          onMouseLeave={() => setHovered(null)}
        >
          {Array.from({ length: 5 }).map((_, i) => {
            const value = i + 1;
            const filled =
              hovered !== null
                ? value <= hovered
                : optimisticRating !== null && value <= optimisticRating;
            return (
              <button
                key={i}
                type="submit"
                name="rating"
                value={value}
                onMouseEnter={() => setHovered(value)}
                className="cursor-pointer p-0.5 transition-transform hover:scale-110"
              >
                <Star
                  className={`size-5 ${
                    filled
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/40 hover:text-yellow-300"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </fetcher.Form>
    </div>
  );
}
