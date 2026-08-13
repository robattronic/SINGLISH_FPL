import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "FPL League Tracker",
  description: "Private mini-league dashboard: standings, MOTW, chips, head-to-head.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
