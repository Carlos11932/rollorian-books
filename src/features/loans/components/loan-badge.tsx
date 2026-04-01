import Link from "next/link";
import { useTranslations } from "next-intl";

interface LoanBadgeProps {
  type: "lent" | "borrowed";
  personName: string | null;
  personId: string;
}

export function LoanBadge({ type, personName, personId }: LoanBadgeProps) {
  const t = useTranslations("loans");

  const label = type === "lent"
    ? t("lentTo", { name: personName ?? "?" })
    : t("borrowedFrom", { name: personName ?? "?" });

  return (
    <Link
      href={`/users/${personId}`}
      className={[
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors",
        type === "lent"
          ? "bg-orange-500/15 text-orange-400 border border-orange-500/25 hover:bg-orange-500/25"
          : "bg-sky-500/15 text-sky-400 border border-sky-500/25 hover:bg-sky-500/25",
      ].join(" ")}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: "12px", fontVariationSettings: "'FILL' 1" }}
      >
        {type === "lent" ? "call_made" : "call_received"}
      </span>
      {label}
    </Link>
  );
}
