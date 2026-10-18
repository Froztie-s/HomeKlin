import { appName } from "@/lib/app-name";

// Placeholder home page. The real layout shells arrive in T3, translations in T4.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{appName()}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">Layanan kebersihan rumah tepercaya.</p>
    </main>
  );
}
