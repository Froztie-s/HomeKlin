export type NavMatch = {
  href: string;
  /** Section roots ("/", "/agency") match only their own path, so one item is current at a time. */
  exact?: boolean;
};

function trimTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** Whether a navigation item is the current page (or the section the current page belongs to). */
export function isActivePath(pathname: string, item: NavMatch): boolean {
  const path = trimTrailingSlash(pathname);
  if (item.exact) return path === item.href;
  return path === item.href || path.startsWith(`${item.href}/`);
}
