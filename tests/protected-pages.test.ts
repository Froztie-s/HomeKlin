import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { rolesFor } from "@/lib/auth/roles";

// The role check on every protected page (T5). A check in a layout does not protect the pages under
// it: Next.js renders route segments itself, so a layout "does not stop them from running or from
// appearing in the RSC Payload" (node_modules/next/dist/docs/01-app/02-guides/authentication.md,
// "Layouts and auth checks"). So every page of a protected section renders its own
// <Suspense><RoleGate roles={[...]}> with exactly the roles src/lib/auth/roles.ts gives its address.
// The pages are read as source code (the TypeScript parser), so a new page that forgets the gate, or
// names the wrong role, fails here before it ships.

const appDir = join("src", "app", "[locale]");

/** Every page.tsx under src/app/[locale], as paths relative to the repository root. */
function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pageFiles(path);
    return entry.name === "page.tsx" ? [path] : [];
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

/** Every <RoleGate> in a page's source code, with its roles and what it sits inside. */
function gates(code: string): { gates: Gate[]; importsRoleGate: boolean } {
  const source = ts.createSourceFile("page.tsx", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: Gate[] = [];

  function visit(node: ts.Node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && tagName(node) === "RoleGate") {
      let insideSuspense = false;
      let insideDefaultExport = false;
      for (let parent = node.parent.parent; parent; parent = parent.parent) {
        if (ts.isJsxElement(parent) && tagName(parent.openingElement) === "Suspense") insideSuspense = true;
        if (ts.isFunctionDeclaration(parent) && isDefaultExport(parent)) insideDefaultExport = true;
      }
      found.push({ roles: rolesAttribute(node), insideSuspense, insideDefaultExport });
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
  return { gates: found, importsRoleGate };
}

const pages = pageFiles(appDir).map((file) => ({ file, path: urlPath(file) }));
const protectedPages = pages.flatMap(({ file, path }) => {
  const roles = rolesFor(path);
  return roles ? [{ file, path, roles: [...roles] }] : [];
});

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
    expect(pages.map(({ path }) => path)).toEqual(expect.arrayContaining(["/", "/home", "/services", "/support"]));
  });
});

describe("the gate reader (the test's own helpers)", () => {
  const importLine = 'import { RoleGate } from "@/components/auth/role-gate";\n';

  it("reads the roles of a gate inside Suspense in the page component", () => {
    const code = `${importLine}export default function Page() {
      return <Suspense fallback={null}><RoleGate roles={["admin"]}><p>x</p></RoleGate></Suspense>;
    }`;
    expect(gates(code)).toEqual({
      importsRoleGate: true,
      gates: [{ roles: ["admin"], insideSuspense: true, insideDefaultExport: true }],
    });
  });

  it("notices a gate outside Suspense, a gate only in a helper, and roles that are not a plain list", () => {
    const outside = `${importLine}export default function Page() { return <RoleGate roles={["admin"]}>x</RoleGate>; }`;
    expect(gates(outside).gates[0].insideSuspense).toBe(false);

    const helperOnly = `${importLine}function Helper() { return <Suspense><RoleGate roles={["admin"]}>x</RoleGate></Suspense>; }
      export default function Page() { return <p>x</p>; }`;
    expect(gates(helperOnly).gates[0].insideDefaultExport).toBe(false);

    const computed = `${importLine}export default function Page() { return <Suspense><RoleGate roles={allRoles}>x</RoleGate></Suspense>; }`;
    expect(gates(computed).gates[0].roles).toBeNull();
  });

  it("finds no gate and no import in a page without one", () => {
    expect(gates("export default function Page() { return <p>x</p>; }")).toEqual({ importsRoleGate: false, gates: [] });
  });
});

describe("protected pages", () => {
  for (const { file, path, roles } of protectedPages) {
    it(`${path} renders its content inside <Suspense><RoleGate roles={${JSON.stringify(roles)}}>`, () => {
      const { gates: found, importsRoleGate } = gates(readFileSync(file, "utf8"));

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
    });
  }
});
