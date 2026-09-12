import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adweso Zonal Council — Temporal Structures Register",
  description: "Fee register for temporal structures, Adweso Zonal Council",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}