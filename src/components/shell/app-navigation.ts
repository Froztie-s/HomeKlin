import {
  BrushCleaning,
  CircleQuestionMark,
  ClipboardCheck,
  ClipboardList,
  House,
  UserRound,
} from "lucide-react";
import type { AppNavKey, MessageKeyIn, Navigation } from "./navigation";

// Customer and cleaner menus. Kept apart from the back-office menus so the pages customers
// download never carry agency menu labels or routes (markdown/PRODUCT.md principle 6).
// The first item of each list is its home: the wordmark links there.
// Labels: the AppNavigation namespace of src/messages/*.json, which the app shells send to the browser.
export const appNavigation = {
  customer: {
    labelKey: "customer.label",
    items: [
      { href: "/home", exact: true, labelKey: "customer.home", icon: House },
      { href: "/services", labelKey: "customer.services", icon: BrushCleaning },
      { href: "/orders", labelKey: "customer.orders", icon: ClipboardList },
      { href: "/support", labelKey: "customer.support", icon: CircleQuestionMark },
      { href: "/account", labelKey: "customer.account", icon: UserRound },
    ],
  },
  cleaner: {
    labelKey: "cleaner.label",
    items: [
      { href: "/cleaner", exact: true, labelKey: "cleaner.jobs", icon: ClipboardCheck },
      { href: "/cleaner/account", labelKey: "cleaner.account", icon: UserRound },
    ],
  },
} satisfies Record<AppNavKey, Navigation<MessageKeyIn<"AppNavigation">>>;
