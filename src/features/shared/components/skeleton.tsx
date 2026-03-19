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
  variant = "text",
  className,
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse bg-white/8 rounded",
        variant === "text" && "h-4 w-full rounded",
        variant === "card" && "h-40 w-full rounded-[var(--radius-md)]",
        variant === "circle" && "h-10 w-10 rounded-full",
        className,
      )}
    />
  );
}
