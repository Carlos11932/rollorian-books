import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">
          404
        </p>
        <h1 className="text-5xl font-bold text-text" style={{ fontFamily: "var(--font-headline)" }}>
          Page not found
        </h1>
        <p className="text-muted text-base max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or was moved.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-accent text-white font-bold text-sm transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Back to Home
      </Link>
    </div>
  );
}
