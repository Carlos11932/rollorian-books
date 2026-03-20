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
    <html lang="es" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
      </head>
      <body className="min-h-full bg-surface text-on-surface font-body">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
