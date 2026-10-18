import { MobileShell } from "@/components/shell/mobile-shell";

const copy = { role: "Petugas" };

// Cleaner pages: mobile-first, a minimal bottom navigation.
export default function CleanerLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileShell nav="cleaner" roleLabel={copy.role}>
      {children}
    </MobileShell>
  );
}
