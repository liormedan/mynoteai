"use client";

import {
  Copy,
  FolderInput,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { archivePage, duplicatePage, patchPage } from "@/lib/pages/actions";
import type { Page } from "@/lib/pages/model";
import { usePagesStore } from "@/lib/pages/store";
import { saveAsTemplate } from "@/lib/templates/user";

type Props = {
  page: Page;
  onRename: () => void;
  onMove: () => void;
};

export function PageMenu({ page, onRename, onMove }: Props) {
  const t = useTranslations("Sidebar");
  const router = useRouter();
  const { all } = usePagesStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("more")}
          className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-52"
        // Rename puts focus in the title input; don't hand it back to the trigger.
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuItem onSelect={onRename}>
          <Pencil />
          {t("rename")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            void patchPage(page.id, { isFavorite: !page.isFavorite })
          }
        >
          {page.isFavorite ? <StarOff /> : <Star />}
          {page.isFavorite ? t("removeFavorite") : t("addFavorite")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            const id = await duplicatePage(all, page.id, t("copySuffix"));
            router.push(`/p/${id}`);
          }}
        >
          <Copy />
          {t("duplicate")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onMove}>
          <FolderInput />
          {t("moveTo")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void saveAsTemplate(page)}>
          <LayoutTemplate />
          {t("saveAsTemplate")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => void archivePage(page.id)}
        >
          <Trash2 />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
