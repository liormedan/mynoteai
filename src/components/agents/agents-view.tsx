"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TOKEN = "<MCP_TOKEN>";

function Snippet({ code }: { code: string }) {
  const t = useTranslations("Agents");
  const [copied, setCopied] = useState(false);
  return (
    // Code reads left to right, copy button included, in either UI language.
    <div dir="ltr" className="relative">
      <pre
        dir="ltr"
        className="overflow-x-auto rounded-md border bg-muted/40 p-3 pe-12 text-xs leading-relaxed"
      >
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={copied ? t("copied") : t("copy")}
        className="absolute end-1.5 top-1.5"
        onClick={() => {
          void navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

export function AgentsView({
  url,
  enabled,
  tokenTooShort,
}: {
  url: string;
  enabled: boolean;
  tokenTooShort: boolean;
}) {
  const t = useTranslations("Agents");
  const claudeCode = `claude mcp add --transport http mynoteai ${url} \\\n  --header "Authorization: Bearer ${TOKEN}"`;
  const claudeDesktop = JSON.stringify(
    {
      mcpServers: {
        mynoteai: {
          command: "npx",
          args: [
            "-y",
            "mcp-remote",
            url,
            "--header",
            "Authorization: Bearer ${MCP_TOKEN}",
          ],
          env: { MCP_TOKEN: TOKEN },
        },
      },
    },
    null,
    2,
  );
  const cursor = JSON.stringify(
    {
      mcpServers: {
        mynoteai: { url, headers: { Authorization: `Bearer ${TOKEN}` } },
      },
    },
    null,
    2,
  );
  const generate = `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      <p
        role="status"
        className={cn(
          "rounded-md border px-3 py-2 text-sm",
          enabled
            ? "border-green-600/30 bg-green-500/10"
            : "border-amber-600/30 bg-amber-500/10",
        )}
      >
        {enabled ? t("on") : tokenTooShort ? t("tooShort") : t("off")}
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("urlTitle")}</h2>
        <Snippet code={url} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("tokenTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("tokenText", {
            // Isolated as LTR, so the angle brackets do not flip in Hebrew text.
            placeholder: `⁦${TOKEN}⁩`,
          })}
        </p>
        <Snippet code={generate} />
        <p className="text-sm text-muted-foreground">{t("tokenWarning")}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Claude Code</h2>
        <p className="text-sm text-muted-foreground">{t("claudeCode")}</p>
        <Snippet code={claudeCode} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Claude Desktop</h2>
        <p className="text-sm text-muted-foreground">{t("claudeDesktop")}</p>
        <Snippet code={claudeDesktop} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Cursor</h2>
        <p className="text-sm text-muted-foreground">{t("cursor")}</p>
        <Snippet code={cursor} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("toolsTitle")}</h2>
        <ul className="list-disc ps-5 text-sm leading-7">
          <li>{t("toolsRead")}</li>
          <li>{t("toolsWrite")}</li>
          <li>{t("toolsSafe")}</li>
        </ul>
      </section>
    </main>
  );
}
