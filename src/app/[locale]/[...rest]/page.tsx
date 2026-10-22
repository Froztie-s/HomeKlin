import { notFound } from "next/navigation";

// Any address inside a language that has no page (/agencies, /en/agencies) shows the localized 404
// page next to it (not-found.tsx), with a 404 status.
// Source: https://next-intl.dev/docs/environments/error-files
export default function UnknownPage() {
  notFound();
}
