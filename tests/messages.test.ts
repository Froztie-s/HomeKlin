import { createTranslator, type IntlError } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import id from "@/messages/id.json";

// The two message files (T4). Indonesian (id.json) is the source of truth and types every key in the
// code (src/i18n/global.ts), so a key that is missing in English, empty, or that drops an ICU argument
// would only show up as a broken English page. These tests stop that before the build ships.

type MessageTree = { [key: string]: string | MessageTree };

/** Every message as "Namespace.key.subkey" -> text. */
function flatten(tree: MessageTree, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      result[path] = value;
    } else {
      Object.assign(result, flatten(value, path));
    }
  }
  return result;
}

type IcuName = { name: string; kind: "argument" | "number" | "tag" };

/**
 * The argument and tag names an ICU message uses, e.g. "{hours, plural, other {# jam}}" -> hours.
 * A small reader for the subset next-intl supports: {arg}, {arg, number|date|time, style},
 * {arg, plural|select|selectordinal, ...} with nested messages, <tag>...</tag>, and apostrophe quoting.
 */
function icuNames(message: string): IcuName[] {
  const names = new Map<string, IcuName>();
  let index = 0;

  function fail(reason: string): never {
    throw new Error(`${reason} at ${index} in "${message}"`);
  }

  function readText(insideBraces: boolean, inPlural: boolean) {
    while (index < message.length) {
      const char = message[index];
      if (char === "'") {
        const next = message[index + 1];
        if (next === "'") {
          index += 2;
        } else if (next === "{" || next === "}" || next === "<" || (inPlural && next === "#")) {
          const close = message.indexOf("'", index + 1);
          index = close === -1 ? message.length : close + 1;
        } else {
          index += 1;
        }
      } else if (char === "{") {
        index += 1;
        readArgument();
      } else if (char === "}") {
        if (!insideBraces) fail("Unexpected }");
        index += 1;
        return;
      } else if (char === "<") {
        const tag = /^<\/?([A-Za-z][\w-]*)>/.exec(message.slice(index));
        if (tag) {
          names.set(`<${tag[1]}>`, { name: tag[1], kind: "tag" });
          index += tag[0].length;
        } else {
          index += 1;
        }
      } else {
        index += 1;
      }
    }
    if (insideBraces) fail("Missing }");
  }

  function readArgument() {
    const head = /^\s*([^\s,{}]+)\s*/.exec(message.slice(index)) ?? fail("Missing argument name");
    const name = head[1];
    index += head[0].length;
    if (message[index] === "}") {
      index += 1;
      if (!names.has(name)) names.set(name, { name, kind: "argument" });
      return;
    }
    if (message[index] !== ",") fail("Expected , or }");
    index += 1;
    const typeMatch = /^\s*(\w+)\s*/.exec(message.slice(index)) ?? fail("Missing argument type");
    const type = typeMatch[1];
    index += typeMatch[0].length;

    if (type === "plural" || type === "selectordinal" || type === "select") {
      names.set(name, { name, kind: type === "select" ? "argument" : "number" });
      if (message[index] !== ",") fail("Expected , after the argument type");
      index += 1;
      for (;;) {
        const option = /^\s*(offset:\d+\s+)?(=?[\w-]+)\s*/.exec(message.slice(index));
        if (!option || message[index + option[0].length] !== "{") break;
        index += option[0].length + 1;
        readText(true, type !== "select");
      }
      const close = /^\s*\}/.exec(message.slice(index)) ?? fail("Missing } after the options");
      index += close[0].length;
    } else {
      // number, date or time with an optional style, e.g. {price, number, ::currency/IDR}
      names.set(name, { name, kind: type === "number" ? "number" : "argument" });
      const close = message.indexOf("}", index);
      if (close === -1) fail("Missing } after the argument style");
      index = close + 1;
    }
  }

  readText(false, false);
  return [...names.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const locales = { id: flatten(id), en: flatten(en) };

type MarkupValues = Record<string, string | number | ((chunks: string) => string)>;
type Markup = (key: string, values: MarkupValues) => string;

// next-intl's translator only accepts the literal keys of the file it was given; this test walks
// every key as a plain string, so it uses the same function through a looser signature.
function markupFor(locale: "id" | "en", onError: (error: IntlError) => void): Markup {
  const t = createTranslator({ locale, messages: locale === "id" ? id : en, onError });
  return t.markup as unknown as Markup;
}

describe("icuNames (the test's own ICU reader)", () => {
  it("reads simple arguments, plurals with nested messages and rich-text tags", () => {
    expect(icuNames("Halo {name}")).toEqual([{ name: "name", kind: "argument" }]);
    expect(icuNames("About {hours, plural, one {# hour} other {# hours}}")).toEqual([
      { name: "hours", kind: "number" },
    ]);
    expect(icuNames("Next free slot: <nowrap>{slot}</nowrap>")).toEqual([
      { name: "nowrap", kind: "tag" },
      { name: "slot", kind: "argument" },
    ]);
  });

  it("ignores quoted braces and plain apostrophes", () => {
    expect(icuNames("Today’s jobs and Anda's '{literal}'")).toEqual([]);
  });

  it("rejects a message with an unclosed argument", () => {
    expect(() => icuNames("Halo {name")).toThrow();
  });
});

describe("messages", () => {
  it("has exactly the same keys in Indonesian and English", () => {
    const idKeys = Object.keys(locales.id);
    const enKeys = Object.keys(locales.en);
    expect(idKeys.length).toBeGreaterThan(100);
    expect({
      missingInEnglish: idKeys.filter((key) => !(key in locales.en)),
      onlyInEnglish: enKeys.filter((key) => !(key in locales.id)),
    }).toEqual({ missingInEnglish: [], onlyInEnglish: [] });
  });

  it("has no empty messages", () => {
    for (const [locale, messages] of Object.entries(locales)) {
      for (const [key, text] of Object.entries(messages)) {
        expect(text.trim(), `${locale}: ${key}`).not.toBe("");
      }
    }
  });

  it("uses the same ICU arguments and tags in both languages", () => {
    for (const [key, text] of Object.entries(locales.id)) {
      expect(icuNames(locales.en[key] ?? ""), key).toEqual(icuNames(text));
    }
  });

  it("formats every message in both languages without an error", () => {
    for (const locale of ["id", "en"] as const) {
      const errors: string[] = [];
      const markup = markupFor(locale, (error) => errors.push(error.message));
      for (const [key, text] of Object.entries(locales[locale])) {
        const values: MarkupValues = {};
        for (const { name, kind } of icuNames(text)) {
          values[name] = kind === "number" ? 2 : kind === "tag" ? (chunks: string) => chunks : "x";
        }
        // A message that cannot be resolved comes back as its own key.
        expect(markup(key, values), `${locale}: ${key}`).not.toBe(key);
      }
      expect(errors, locale).toEqual([]);
    }
  });

  it("uses no em dash or en dash (markdown/design.md, Do and Don't)", () => {
    for (const [locale, messages] of Object.entries(locales)) {
      for (const [key, text] of Object.entries(messages)) {
        expect(text, `${locale}: ${key}`).not.toMatch(/[–—]/);
      }
    }
  });

  it("speaks to the customer in formal Indonesian (Anda), never the informal kamu", () => {
    for (const [key, text] of Object.entries(locales.id)) {
      expect(text, key).not.toMatch(/\b(kamu|kau|engkau)\b/i);
    }
  });
});
