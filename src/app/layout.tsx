import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adweso Zonal Council — Temporal Structures Register",
  description: "Fee register for temporal structures, Adweso Zonal Council",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}