import { getLocale } from "next-intl/server";
import { PageView } from "@/components/page/page-view";
import type { Locale } from "@/i18n/config";

export default async function NotePage({ params }: PageProps<"/p/[pageId]">) {
  const { pageId } = await params;
  const locale = (await getLocale()) as Locale;
  return <PageView pageId={pageId} locale={locale} />;
}
