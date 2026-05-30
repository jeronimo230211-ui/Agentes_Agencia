import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GymBot IA — Tu gimnasio responde solo en WhatsApp",
  description:
    "Automatiza la atención al cliente de tu gimnasio en WhatsApp con IA. Responde 24/7, captura leads y ahorra horas al día.",
  openGraph: {
    title: "GymBot IA — Tu gimnasio responde solo en WhatsApp",
    description:
      "Automatiza la atención al cliente de tu gimnasio con IA. Configurado en 24 horas.",
    type: "website",
    locale: "es_CO",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen bg-[#0D0F0E] text-[#F2F0EB] antialiased">
        {children}
      </body>
    </html>
  );
}
