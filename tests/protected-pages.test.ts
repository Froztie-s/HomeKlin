import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { rolesFor } from "@/lib/auth/roles";

// The role check on every protected page (T5). A check in a layout does not protect the pages under
// it: Next.js renders route segments itself, so a layout "does not stop them from running or from
// appearing in the RSC Payload" (node_modules/next/dist/docs/01-app/02-guides/authentication.md,
// "Layouts and auth checks"). So every page of a protected section renders its own
// <Suspense><RoleGate roles={[...]}> with exactly the roles src/lib/auth/roles.ts gives its address,
// and nothing but page chrome outside it.
// The pages are read as source code (the TypeScript parser), so a new page that forgets the gate,
// names the wrong role, or renders data beside the gate fails here before it ships. The check fails
// closed: a new page that is neither in a protected section nor on the public list below fails too,
// until someone decides which it is.

const appDir = join("src", "app", "[locale]");

/** The pages anyone may open. Every other page must belong to a protected section (roles.ts). */
const publicPaths = ["/", "/home", "/services", "/pesan", "/support", "/login", "/signup", "/[...rest]"];

/** What a protected page may render outside its RoleGate: page chrome only, never data. */
const chromeOutsideGate = new Set(["PageContainer", "PageHeader", "Suspense", "GateFallback", "RoleGate"]);

/** Every file under `dir` whose name matches, as paths relative to the repository root. */
function filesNamed(dir: string, name: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesNamed(path, name);
    return name.test(entry.name) ? [path] : [];
  });
}

/** The address a page answers at, without the language: "(admin)/admin/tickets/page.tsx" -> "/admin/tickets". */
function urlPath(file: string): string {
  const segments = relative(appDir, file).split(sep).slice(0, -1);
  // Route groups such as (customer) are folders only; they never appear in the address.
  const visible = segments.filter((segment) => !/^\(.+\)$/.test(segment));
  return `/${visible.join("/")}`;
}

type Gate = { roles: string[] | null; insideSuspense: boolean; insideDefaultExport: boolean };

function tagName(node: ts.JsxOpeningLikeElement): string {
  return node.tagName.getText();
}

function isJsxTag(node: ts.Node): node is ts.JsxOpeningElement | ts.JsxSelfClosingElement {
  return ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node);
}

/** The roles={["..."]} of a RoleGate element, or null when it is not a plain list of strings. */
function rolesAttribute(node: ts.JsxOpeningLikeElement): string[] | null {
  for (const property of node.attributes.properties) {
    if (!ts.isJsxAttribute(property) || property.name.getText() !== "roles") continue;
    const value = property.initializer;
    if (!value || !ts.isJsxExpression(value) || !value.expression) return null;
    const list = value.expression;
    if (!ts.isArrayLiteralExpression(list)) return null;
    const roles = list.elements.map((element) => (ts.isStringLiteral(element) ? element.text : null));
    return roles.every((role): role is string => role !== null) ? roles : null;
  }
  return null;
}

function isDefaultExport(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : [];
  const kinds = modifiers.map((modifier) => modifier.kind);
  return kinds.includes(ts.SyntaxKind.ExportKeyword) && kinds.includes(ts.SyntaxKind.DefaultKeyword);
}

/** Whether a JSX tag sits inside an element named `name` (not counting itself). */
function insideElement(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string): boolean {
  // An opening tag's parent is its own element, so the search starts one level higher; a
  // self-closing tag's parent is already the element around it.
  const start = ts.isJsxOpeningElement(node) ? node.parent.parent : node.parent;
  for (let parent: ts.Node | undefined = start; parent; parent = parent.parent) {
    if (ts.isJsxElement(parent) && tagName(parent.openingElement) === name) return true;
  }
  return false;
}

function insideDefaultExport(node: ts.Node): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionDeclaration(parent) && isDefaultExport(parent)) return true;
  }
  return false;
}

type PageSource = { gates: Gate[]; importsRoleGate: boolean; outsideGate: string[] };

/** A page's source code: its <RoleGate>s, and every element its component renders outside a gate. */
function readPage(code: string): PageSource {
  const source = ts.createSourceFile("page.tsx", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const gates: Gate[] = [];
  const outsideGate: string[] = [];

  function visit(node: ts.Node) {
    if (isJsxTag(node)) {
      const name = tagName(node);
      if (name === "RoleGate") {
        gates.push({
          roles: rolesAttribute(node),
          insideSuspense: insideElement(node, "Suspense"),
          insideDefaultExport: insideDefaultExport(node),
        });
      }
      if (insideDefaultExport(node) && !insideElement(node, "RoleGate")) outsideGate.push(name);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  const importsRoleGate = source.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "@/components/auth/role-gate" &&
      /\bRoleGate\b/.test(statement.importClause?.getText() ?? ""),
  );
  return { gates, importsRoleGate, outsideGate };
}

const pages = filesNamed(appDir, /^page\.(tsx|ts|jsx|js|mdx)$/).map((file) => ({ file, path: urlPath(file) }));
const protectedPages = pages.flatMap(({ file, path }) => {
  const roles = rolesFor(path);
  return roles ? [{ file, path, roles: [...roles] }] : [];
});
const routeHandlers = filesNamed(appDir, /^route\.(tsx|ts|jsx|js)$/).map((file) => ({ file, path: urlPath(file) }));

describe("the page finder (the test's own helpers)", () => {
  it("turns page files into addresses without the language or the route groups", () => {
    expect(urlPath(join(appDir, "(admin)", "admin", "tickets", "page.tsx"))).toBe("/admin/tickets");
    expect(urlPath(join(appDir, "(customer)", "orders", "page.tsx"))).toBe("/orders");
    expect(urlPath(join(appDir, "(marketing)", "page.tsx"))).toBe("/");
  });

  it("finds the protected pages of every section, and the public pages beside them", () => {
    const paths = protectedPages.map(({ path }) => path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/orders",
        "/account",
        "/cleaner",
        "/cleaner/account",
        "/agency",
        "/agency/schedule",
        "/agency/cleaners",
        "/agency/orders",
        "/agency/recordings",
        "/admin",
        "/admin/monitor",
        "/admin/tickets",
        "/admin/recordings",
        "/admin/services",
        "/admin/faq",
      ]),
    );
    expect(pages.map(({ path }) => path)).toEqual(expect.arrayContaining(publicPaths));
  });
});

describe("the page reader (the test's own helpers)", () => {
  const importLine = 'import { RoleGate } from "@/components/auth/role-gate";\n';

  it("reads the roles of a gate inside Suspense in the page component", () => {
    const code = `${importLine}export default function Page() {
      return <Suspense fallback={<GateFallback />}><RoleGate roles={["admin"]}><Secret /></RoleGate></Suspense>;
    }`;
    expect(readPage(code)).toEqual({
      importsRoleGate: true,
      gates: [{ roles: ["admin"], insideSuspense: true, insideDefaultExport: true }],
      outsideGate: ["Suspense", "GateFallback", "RoleGate"],
    });
  });

  it("notices a gate outside Suspense, a gate only in a helper, and roles that are not a plain list", () => {
    const outside = `${importLine}export default function Page() { return <RoleGate roles={["admin"]}>x</RoleGate>; }`;
    expect(readPage(outside).gates[0].insideSuspense).toBe(false);

    const helperOnly = `${importLine}function Helper() { return <Suspense><RoleGate roles={["admin"]}>x</RoleGate></Suspense>; }
      export default function Page() { return <p>x</p>; }`;
    expect(readPage(helperOnly).gates[0].insideDefaultExport).toBe(false);

    const computed = `${importLine}export default function Page() { return <Suspense><RoleGate roles={allRoles}>x</RoleGate></Suspense>; }`;
    expect(readPage(computed).gates[0].roles).toBeNull();
  });

  it("lists data rendered beside the gate, even inside its own Suspense", () => {
    const code = `${importLine}export default function Page() {
      return <PageContainer><PageHeader title="x" /><Suspense><Secret /></Suspense>
        <Suspense fallback={<GateFallback />}><RoleGate roles={["admin"]}><Content /></RoleGate></Suspense></PageContainer>;
    }`;
    const outside = readPage(code).outsideGate.filter((name) => !chromeOutsideGate.has(name));
    expect(outside).toEqual(["Secret"]);
  });

  it("finds no gate and no import in a page without one", () => {
    expect(readPage("export default function Page() { return <p>x</p>; }")).toEqual({
      importsRoleGate: false,
      gates: [],
      outsideGate: ["p"],
    });
  });
});

describe("every page is either public or protected (fails closed)", () => {
  it("has no page outside the public list that lacks a protected section", () => {
    const unclassified = pages
      .filter(({ path }) => !publicPaths.includes(path) && rolesFor(path) === null)
      .map(({ file }) => file);
    expect(
      unclassified,
      "add each page either to publicPaths above or to a protected section in src/lib/auth/roles.ts",
    ).toEqual([]);
  });

  it("keeps the public list public", () => {
    for (const path of publicPaths) expect(rolesFor(path), path).toBeNull();
  });

  it("has no route handler inside a protected section (they need their own access check)", () => {
    const unguarded = routeHandlers.filter(({ path }) => rolesFor(path) !== null).map(({ file }) => file);
    expect(unguarded).toEqual([]);
  });
});

describe("protected pages", () => {
  for (const { file, path, roles } of protectedPages) {
    it(`${path} renders its content inside <Suspense><RoleGate roles={${JSON.stringify(roles)}}>`, () => {
      expect(file.endsWith(".tsx"), `${file}: a protected page is a .tsx file, so this test can read it`).toBe(true);
      const { gates: found, importsRoleGate, outsideGate } = readPage(readFileSync(file, "utf8"));

      expect(importsRoleGate, `${file} imports RoleGate from @/components/auth/role-gate`).toBe(true);
      expect(found.length, `${file} renders a RoleGate`).toBeGreaterThan(0);
      for (const gate of found) {
        expect(gate.roles, `${file}: roles as a plain list`).not.toBeNull();
        expect([...(gate.roles ?? [])].sort(), `${file}: the roles of ${path}`).toEqual([...roles].sort());
        // RoleGate reads the session, which with Cache Components must sit behind a Suspense boundary
        // (the page's static shell stays prerendered); and it must be part of what the page renders.
        expect(gate.insideSuspense, `${file}: RoleGate inside <Suspense>`).toBe(true);
        expect(gate.insideDefaultExport, `${file}: RoleGate in the page component`).toBe(true);
      }
      // Anything else beside the gate would reach every signed-in visitor, whatever their role.
      const beside = outsideGate.filter((name) => !chromeOutsideGate.has(name));
      expect(beside, `${file}: only page chrome outside the RoleGate`).toEqual([]);
    });
  }
});
