import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";

export const metadata: Metadata = {
  title: "substuff — Your writing, continued.",
  description:
    "Turn published Substack posts into Notes. Edit, approve, and schedule.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
