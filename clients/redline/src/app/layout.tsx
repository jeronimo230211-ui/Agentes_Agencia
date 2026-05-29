import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fijo — Soporte Técnico con IA",
  description: "Sistema de gestión de tickets y citas para RedLine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="h-full bg-slate-50">
        <Sidebar />
        <main className="ml-64 min-h-screen">{children}</main>
      </body>
    </html>
  );
}
