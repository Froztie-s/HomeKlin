import { NextIntlClientProvider, type Messages } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

type Namespace = keyof Messages;

/** Used by a client component on every page: the language switch. */
const everyPage = ["LanguageSwitch"] as const satisfies readonly Namespace[];

type ClientMessagesProps = {
  /** The namespaces the client components below use, on top of the language switch's. */
  namespaces?: readonly Namespace[];
  children: ReactNode;
};

// Gives client components their messages, and nothing more: the rest of the text is rendered on the
// server, so it never ships as JSON. This also keeps the back office's labels (which name agencies)
// out of the pages customers download (markdown/PRODUCT.md principle 6). A nested provider replaces
// the messages of the one above it (use-intl's IntlProvider), so each one lists everything below it.
// Source: https://next-intl.dev/docs/environments/server-client-components
export async function ClientMessages({ namespaces = [], children }: ClientMessagesProps) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={pick(messages, [...everyPage, ...namespaces])}>
      {children}
    </NextIntlClientProvider>
  );
}

function pick<Key extends Namespace>(messages: Messages, keys: readonly Key[]): Pick<Messages, Key> {
  const picked = {} as Pick<Messages, Key>;
  for (const key of keys) picked[key] = messages[key];
  return picked;
}
