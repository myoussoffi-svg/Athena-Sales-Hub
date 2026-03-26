"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number | null;
  onChange?: (rating: number | null) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}

export function StarRating({ value, onChange, readonly = false, size = "sm" }: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null);

  const starSize = size === "sm" ? "h-3.5 w-3.5" : "h-4.5 w-4.5";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = hover !== null ? star <= hover : star <= (value || 0);
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={cn(
              "p-0 border-0 bg-transparent transition-colors",
              readonly ? "cursor-default" : "cursor-pointer hover:scale-110"
            )}
            onMouseEnter={() => !readonly && setHover(star)}
            onMouseLeave={() => !readonly && setHover(null)}
            onClick={() => {
              if (readonly || !onChange) return;
              // Click same star again to clear rating
              onChange(star === value ? null : star);
            }}
          >
            <Star
              className={cn(
                starSize,
                "transition-colors",
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
