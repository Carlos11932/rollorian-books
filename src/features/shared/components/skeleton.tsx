import { cn } from "@/lib/cn";

const SKELETON_VARIANT = {
  text: "text",
  card: "card",
  circle: "circle",
} as const;

type SkeletonVariant = (typeof SKELETON_VARIANT)[keyof typeof SKELETON_VARIANT];

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({
  variant = SKELETON_VARIANT.text,
  className,
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse bg-white/8 rounded",
        variant === SKELETON_VARIANT.text && "h-4 w-full rounded",
        variant === SKELETON_VARIANT.card && "h-40 w-full rounded-[var(--radius-md)]",
        variant === SKELETON_VARIANT.circle && "h-10 w-10 rounded-full",
        className,
      )}
    />
  );
}
