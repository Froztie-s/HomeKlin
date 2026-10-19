import {
  BrushCleaning,
  CircleQuestionMark,
  ClipboardCheck,
  ClipboardList,
  House,
  UserRound,
} from "lucide-react";
import type { AppNavKey, Navigation } from "./navigation";

// Customer and cleaner menus. Kept apart from the back-office menus so the pages customers
// download never carry agency menu labels or routes (markdown/PRODUCT.md principle 6).
// The first item of each list is its home: the desktop wordmark links there.
export const appNavigation: Record<AppNavKey, Navigation> = {
  customer: {
    label: "Navigasi utama",
    items: [
      { href: "/home", exact: true, label: "Beranda", icon: House },
      { href: "/services", label: "Layanan", icon: BrushCleaning },
      { href: "/orders", label: "Pesanan", icon: ClipboardList },
      { href: "/support", label: "Bantuan", icon: CircleQuestionMark },
      { href: "/account", label: "Akun", icon: UserRound },
    ],
  },
  cleaner: {
    label: "Navigasi petugas",
    items: [
      { href: "/cleaner", exact: true, label: "Pekerjaan", icon: ClipboardCheck },
      { href: "/cleaner/account", label: "Akun", icon: UserRound },
    ],
  },
};
