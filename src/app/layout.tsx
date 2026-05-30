import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Integrations",
  description: "Meta and Google integrations for multi-tenant CRM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
