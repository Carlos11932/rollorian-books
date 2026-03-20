import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/features/shared/ui/app-shell";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

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
    <html lang="es" className={`dark ${manrope.variable}`}>
      <body className="min-h-full bg-surface text-on-surface font-body">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
