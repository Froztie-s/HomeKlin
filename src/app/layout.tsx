import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";

// Two families (markdown/design.md section 3). Both are variable fonts, so no weights are listed.
// Bricolage Grotesque also loads its optical-size axis: large headings get the display cut.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  // The landing page sets no title, so its tab reads "HomeKlin"; other pages read "Layanan · HomeKlin".
  title: { default: "HomeKlin", template: "%s · HomeKlin" },
  description: "Jasa kebersihan rumah yang bisa Anda tonton langsung.",
};

// viewport-fit=cover lets the bottom navigation pad itself for the phone's home indicator.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${bricolage.variable} ${figtree.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink">{children}</body>
    </html>
  );
}
