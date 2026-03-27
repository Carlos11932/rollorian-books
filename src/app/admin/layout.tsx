import { requireSuperAdmin, ForbiddenError } from "@/lib/auth/require-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-8">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-error text-[32px]">block</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface">403 — Forbidden</h1>
          <p className="text-sm text-tertiary text-center max-w-sm">
            You do not have permission to access this page. This area is restricted to administrators only.
          </p>
        </div>
      );
    }
    // UnauthorizedError: middleware should have caught this, but rethrow so Next.js handles it
    throw error;
  }

  return <>{children}</>;
}
