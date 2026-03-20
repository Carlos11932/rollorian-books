import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/features/shared/ui/app-shell";

export const metadata: Metadata = {
  title: "Rollorian",
  description: "Your personal book archive",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-surface text-on-surface font-body">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
