import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
}

export default function StarRating({ value, onChange, size = 32 }: StarRatingProps) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="transition-colors hover:scale-110 active:scale-95"
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          <Star
            size={size}
            className={
              star <= value
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground/40 hover:text-yellow-300'
            }
          />
        </button>
      ))}
    </div>
  );
}
