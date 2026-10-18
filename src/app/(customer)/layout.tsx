import { MobileShell } from "@/components/shell/mobile-shell";

// Customer pages: mobile-first, bottom navigation on phones.
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <MobileShell nav="customer">{children}</MobileShell>;
}
