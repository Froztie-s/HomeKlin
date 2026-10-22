import { useTranslations } from "next-intl";
import { MobileShell } from "@/components/shell/mobile-shell";

// Cleaner pages: mobile-first, a minimal bottom navigation.
export default function CleanerLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("AppShell");
  return (
    <MobileShell nav="cleaner" roleLabel={t("cleanerRole")}>
      {children}
    </MobileShell>
  );
}
