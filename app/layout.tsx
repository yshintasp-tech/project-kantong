import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kantong | Tracker Keuangan",
  description: "Lacak uang, tabungan, dan target kamu.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
