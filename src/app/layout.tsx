import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// One family for the whole product; hierarchy comes from weight and size (docs/design.md).
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Home is "HomeKlin"; other pages read "Pesanan · HomeKlin" in the browser tab.
  title: { default: "HomeKlin", template: "%s · HomeKlin" },
  description: "Layanan kebersihan rumah tepercaya, dari agensi pilihan.",
};

// viewport-fit=cover lets the bottom navigation pad itself for the phone's home indicator.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
