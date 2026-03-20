import { cn } from "@/lib/cn";

const VARIANT = {
  primary: "primary",
  secondary: "secondary",
  ghost: "ghost",
} as const;

type Variant = (typeof VARIANT)[keyof typeof VARIANT];

const SIZE = {
  sm: "sm",
  md: "md",
} as const;

type Size = (typeof SIZE)[keyof typeof SIZE];

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      aria-busy={loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-transform duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent cursor-pointer",
        "hover:-translate-y-px active:translate-y-0",
        "disabled:opacity-70 disabled:cursor-not-allowed disabled:translate-y-0",
        size === "sm" && "px-4 py-2 text-sm",
        size === "md" && "px-5 py-3 text-sm",
        variant === "primary" &&
          "bg-gradient-to-br from-accent to-accent-strong text-white border-0",
        variant === "secondary" &&
          "bg-white/10 text-text border border-line",
        variant === "ghost" &&
          "bg-transparent text-muted border border-transparent hover:border-line hover:text-text",
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
