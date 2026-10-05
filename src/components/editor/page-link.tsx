"use client";

import { createReactInlineContentSpec } from "@blocknote/react";
import { FileText } from "lucide-react";
import Link from "next/link";
import { createContext, useContext } from "react";

export type PageSummary = { id: string; title: string; icon: string | null };

/** Live titles, so a link shows the page's current name even after a rename. */
export const PagesContext = createContext<Map<string, PageSummary>>(new Map());

function PageLinkView({ pageId, title }: { pageId: string; title: string }) {
  const live = useContext(PagesContext).get(pageId);
  const name = live?.title || title || "…";
  return (
    <Link
      href={`/p/${pageId}`}
      contentEditable={false}
      className="inline-flex items-baseline gap-1 rounded px-0.5 font-medium underline decoration-muted-foreground/40 underline-offset-4 hover:bg-muted"
    >
      {live?.icon ? (
        <span aria-hidden>{live.icon}</span>
      ) : (
        <FileText aria-hidden className="size-3.5 self-center opacity-60" />
      )}
      <bdi>{name}</bdi>
    </Link>
  );
}

/** Inline link to another page, inserted with "@". */
export const PageLink = createReactInlineContentSpec(
  {
    type: "pageLink",
    propSchema: {
      pageId: { default: "" },
      title: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ inlineContent }) => (
      <PageLinkView
        pageId={inlineContent.props.pageId}
        title={inlineContent.props.title}
      />
    ),
  },
);
