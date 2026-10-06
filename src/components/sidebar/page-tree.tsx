"use client";

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageIcon } from "@/components/page/page-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createPageUnder, movePage, patchPage } from "@/lib/pages/actions";
import type { Page } from "@/lib/pages/model";
import { usePagesStore } from "@/lib/pages/store";
import {
  canMoveUnder,
  dropPlacement,
  type DropZone,
  type TreeNode,
} from "@/lib/pages/tree";
import { MoveDialog } from "./move-dialog";
import { PageMenu } from "./page-menu";

type Props = {
  activeId: string | null;
  expanded: Set<string>;
  onToggle: (id: string, open?: boolean) => void;
  onNavigate?: () => void;
};

type Hover = { id: string; zone: DropZone } | null;

/** Top 25% of a row drops before it, bottom 25% after it, the middle inside. */
function zoneFor(y: number, rect: { top: number; height: number }): DropZone {
  const ratio = (y - rect.top) / rect.height;
  return ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
}

export function PageTree({ activeId, expanded, onToggle, onNavigate }: Props) {
  const t = useTranslations("Sidebar");
  const { tree, all, byId } = usePagesStore();
  const [hover, setHover] = useState<Hover>(null);
  const [moving, setMoving] = useState<Page | null>(null);
  // A small distance keeps plain clicks on rows working.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const pointerY = (e: DragMoveEvent | DragEndEvent) =>
    (e.activatorEvent as PointerEvent).clientY + e.delta.y;

  const onDragMove = (e: DragMoveEvent) => {
    const overId = e.over?.id as string | undefined;
    if (!overId || overId === e.active.id || !e.over) return setHover(null);
    const zone = zoneFor(pointerY(e), e.over.rect);
    const target = byId.get(overId);
    const newParent = zone === "inside" ? overId : (target?.parentId ?? null);
    setHover(
      canMoveUnder(all, e.active.id as string, newParent)
        ? { id: overId, zone }
        : null,
    );
  };

  const onDragEnd = (e: DragEndEvent) => {
    const drop = hover;
    setHover(null);
    const target = drop && byId.get(drop.id);
    if (!target) return;
    const { parentId, position } = dropPlacement(
      all,
      target,
      drop.zone,
      e.active.id as string,
    );
    if (drop.zone === "inside") onToggle(target.id, true);
    void movePage(e.active.id as string, parentId, position);
  };

  if (!tree.length) {
    return (
      <p className="px-3 py-1 text-sm text-muted-foreground">{t("noPages")}</p>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={() => setHover(null)}
      >
        <ul role="tree" className="flex flex-col">
          {tree.map((node) => (
            <TreeRow
              key={node.page.id}
              node={node}
              depth={0}
              activeId={activeId}
              expanded={expanded}
              onToggle={onToggle}
              onNavigate={onNavigate}
              hover={hover}
              onMove={setMoving}
            />
          ))}
        </ul>
      </DndContext>
      <MoveDialog page={moving} onClose={() => setMoving(null)} />
    </>
  );
}

type RowProps = Omit<Props, "activeId"> & {
  node: TreeNode;
  depth: number;
  activeId: string | null;
  hover: Hover;
  onMove: (page: Page) => void;
};

function TreeRow({
  node,
  depth,
  activeId,
  expanded,
  onToggle,
  onNavigate,
  hover,
  onMove,
}: RowProps) {
  const t = useTranslations("Sidebar");
  const tApp = useTranslations("App");
  const router = useRouter();
  const { all } = usePagesStore();
  const { page } = node;
  // Database rows are listed in the database itself, not in the sidebar.
  const children = page.type === "database" ? [] : node.children;
  const open = expanded.has(page.id);
  const [renaming, setRenaming] = useState(false);

  const drag = useDraggable({ id: page.id });
  const drop = useDroppable({ id: page.id });
  const zone = hover?.id === page.id ? hover.zone : null;

  const addChild = async () => {
    const id = await createPageUnder(all, page.id);
    onToggle(page.id, true);
    router.push(`/p/${id}`);
    onNavigate?.();
  };

  return (
    <li
      role="treeitem"
      aria-expanded={children.length ? open : undefined}
      aria-selected={page.id === activeId}
    >
      <div
        ref={(el) => {
          drag.setNodeRef(el);
          drop.setNodeRef(el);
        }}
        {...drag.attributes}
        {...drag.listeners}
        className={cn(
          "group/row relative flex h-8 items-center gap-1 rounded-md pe-1 text-sm",
          page.id === activeId ? "bg-muted font-medium" : "hover:bg-muted/60",
          drag.isDragging && "opacity-40",
          zone === "inside" && "bg-primary/10 ring-1 ring-primary/40",
          zone === "before" &&
            "before:absolute before:inset-x-1 before:-top-px before:h-0.5 before:bg-primary",
          zone === "after" &&
            "after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:bg-primary",
        )}
        style={{ paddingInlineStart: 4 + depth * 14 }}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={open ? t("collapse") : t("expand")}
          className={cn(!children.length && "invisible")}
          onClick={() => onToggle(page.id)}
        >
          {open ? <ChevronDown /> : <ChevronRight className="rtl:rotate-180" />}
        </Button>

        {renaming ? (
          <input
            autoFocus
            dir="auto"
            defaultValue={page.title}
            aria-label={t("rename")}
            className="h-6 min-w-0 flex-1 rounded border bg-background px-1 outline-none"
            onBlur={(e) => {
              setRenaming(false);
              if (e.target.value !== page.title) {
                void patchPage(page.id, {
                  title: e.target.value.slice(0, 500),
                });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <Link
            href={`/p/${page.id}`}
            onClick={onNavigate}
            className="flex min-w-0 flex-1 items-center gap-1.5"
            draggable={false}
          >
            <span className="w-4 shrink-0 text-center" aria-hidden>
              <PageIcon page={page} className="size-3.5" />
            </span>
            <bdi className="truncate">{page.title || tApp("untitled")}</bdi>
          </Link>
        )}

        <PageMenu
          page={page}
          onRename={() => setRenaming(true)}
          onMove={() => onMove(page)}
        />
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("addChild")}
          className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
          onClick={addChild}
        >
          <Plus />
        </Button>
      </div>

      {open && children.length > 0 && (
        <ul role="group">
          {children.map((child) => (
            <TreeRow
              key={child.page.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              expanded={expanded}
              onToggle={onToggle}
              onNavigate={onNavigate}
              hover={hover}
              onMove={onMove}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
