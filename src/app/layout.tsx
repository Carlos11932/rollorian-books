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
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- Material Symbols is not available via next/font; app-router layout applies globally */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="min-h-full bg-surface text-on-surface font-body">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
