import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — Rollorian",
};

interface LoginLayoutProps {
  children: React.ReactNode;
}

export default function LoginLayout({ children }: LoginLayoutProps) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      {children}
    </div>
  );
}
