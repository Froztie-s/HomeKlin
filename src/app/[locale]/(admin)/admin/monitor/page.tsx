import type { Metadata } from "next";
import { MonitorPlay, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Notice } from "@/components/admin/notice";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { FeedTile } from "@/components/back-office/feed-tile";
import { getSlotLabels } from "@/components/customer/slot-labels";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ClientMessages } from "@/i18n/client-messages";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import { listLiveStreams, StreamError, type LiveStream } from "@/lib/stream/streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminMonitorPage");
  return { title: t("title") };
}

// Admins only (T5). The live monitor (T25): every live feed at once, in a grid of two to four columns
// at desktop widths (one on a phone). live_streams() answers admins (all streams) and agencies (their
// own); this page's own role check keeps agencies out, and each video link is made for this admin by
// stream_for_viewer() (src/components/back-office/feed-tile.tsx). The list is read when the page
// opens; "Perbarui daftar" reads it again, while each tile keeps its status current on its own.
// The title is prerendered; the rest renders inside the role check (a layout's check would not protect it).
export default function AdminMonitorPage() {
  const t = useTranslations("AdminMonitorPage");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["admin"]}>
          <LiveFeeds />
        </RoleGate>
      </Suspense>
    </>
  );
}

async function LiveFeeds() {
  const [t, locale] = await Promise.all([getTranslations("AdminMonitorPage"), getLocale()]);

  let streams: LiveStream[];
  try {
    streams = await listLiveStreams(await createSupabaseServerClient({ writeCookies: false }));
  } catch (error) {
    if (!(error instanceof StreamError)) throw error;
    console.error(error);
    return (
      <Notice tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  }

  if (streams.length === 0) {
    return (
      <EmptyState icon={MonitorPlay} title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    );
  }

  const [services, areas, labels] = await Promise.all([getCatalogServices(), getServiceAreas(), getSlotLabels(locale)]);

  return (
    <ClientMessages namespaces={["AdminMonitorPage"]}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-ink-muted tabular-nums">
          {t("summary", { count: streams.length, time: labels.time(new Date().toISOString()) })}
        </p>
        {/* A plain link on purpose: a full page load reads the list again and makes fresh links. */}
        <a
          href=""
          className="inline-flex min-h-touch items-center gap-2 rounded-full border border-border-control bg-surface px-4 text-sm font-semibold text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50"
        >
          <RefreshCw className="size-4 shrink-0" aria-hidden="true" />
          {t("refresh")}
        </a>
      </div>
      <ul aria-label={t("gridLabel")} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {streams.map((stream) => (
          <FeedTile
            key={stream.sessionId}
            stream={stream}
            serviceName={services.find((service) => service.id === stream.serviceId)?.name[locale]}
            areaName={areas.find((area) => area.id === stream.areaId)?.name[locale]}
            startedAt={labels.time(stream.startedAt)}
          />
        ))}
      </ul>
    </ClientMessages>
  );
}
