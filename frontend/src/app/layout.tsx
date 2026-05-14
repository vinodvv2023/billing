import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/ui/toast";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "Unified Auth & RBAC",
  description: "Modern OAuth + RBAC experience",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <AppProviders>{children}</AppProviders>
        </ToastProvider>
      </body>
    </html>
  );
}
