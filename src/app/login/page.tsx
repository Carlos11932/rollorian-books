import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

const isPreviewEnv = process.env.VERCEL_ENV === "preview";

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    redirect("/");
  }

  return (
    <div className="w-full max-w-sm px-4">
      {/* Backdrop grid overlay */}
      <div className="fixed inset-0 backdrop-grid pointer-events-none" aria-hidden="true" />

      {/* Glass card */}
      <div className="relative z-10 bg-surface-container border border-outline-variant/20 rounded-xl p-8 shadow-[0_24px_64px_rgba(0,0,0,0.4)] backdrop-blur-sm">
        {/* Branding */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-12 h-12 bg-primary-container rounded-xl flex items-center justify-center mb-2">
            <span className="material-symbols-outlined text-primary text-[28px]">auto_stories</span>
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-primary font-headline">
            Rollorian Books
          </h1>
          <p className="text-sm text-tertiary text-center">
            Tu biblioteca personal
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-outline-variant/20 mb-6" />

        {/* Google Sign in — always available */}
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 hover:border-outline-variant/60 text-on-surface font-medium text-sm py-3 px-4 rounded-lg transition-all duration-200"
          >
            {/* Google icon SVG */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.258c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
        </form>

        {/* Preview auth — email login for Vercel preview deployments */}
        {isPreviewEnv && (
          <>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 border-t border-outline-variant/20" />
              <span className="text-xs text-tertiary/60">Preview mode</span>
              <div className="flex-1 border-t border-outline-variant/20" />
            </div>

            <form
              action={async (formData: FormData) => {
                "use server";
                const email = formData.get("email") as string;
                await signIn("preview", { email, redirectTo: "/" });
              }}
              className="flex flex-col gap-2"
            >
              <input
                name="email"
                type="email"
                required
                placeholder="tu@email.com"
                className="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm py-2.5 px-3 rounded-lg placeholder:text-tertiary/40 focus:outline-none focus:border-primary/60 transition-colors"
              />
              <button
                type="submit"
                className="w-full bg-tertiary-container hover:bg-tertiary-container/80 text-on-tertiary-container font-medium text-sm py-2.5 px-4 rounded-lg transition-colors"
              >
                Sign in with email
              </button>
            </form>
          </>
        )}

        {/* Footer note */}
        <p className="text-xs text-tertiary/60 text-center mt-6">
          {isPreviewEnv
            ? "Preview deployment — email login available"
            : "Colección privada — solo por invitación"}
        </p>
      </div>
    </div>
  );
}
