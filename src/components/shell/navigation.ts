import type { LucideIcon } from "lucide-react";
import { appNavigation } from "./app-navigation";
import { backOfficeNavigation } from "./back-office-navigation";
import type { NavMatch } from "./is-active-path";

export type NavItem = NavMatch & { label: string; icon: LucideIcon };
export type Navigation = { label: string; items: readonly NavItem[] };
export type AppNavKey = "customer" | "cleaner";
export type BackOfficeNavKey = "agency" | "admin";
export type NavKey = AppNavKey | BackOfficeNavKey;

// Every shell's navigation in one place, for server code and tests. Client components import
// app-navigation.ts or back-office-navigation.ts directly, so each bundle carries only its own menus.
// The labels move to next-intl messages in T4.
export const navigation: Record<NavKey, Navigation> = { ...appNavigation, ...backOfficeNavigation };
