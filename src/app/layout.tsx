import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Purple House Sport Day Check-in",
  description: "LINE LIFF check-in for Purple House sports week",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
