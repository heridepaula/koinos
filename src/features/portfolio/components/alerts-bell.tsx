"use client";

import { useMutation } from "@tanstack/react-query";
import {
  BellIcon,
  CheckIcon,
  HandCoinsIcon,
  InfoIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { dismissAlertsAction, markAlertsReadAction } from "../actions";
import type { AlertNotification } from "../domain/types";

const keyOf = (alert: AlertNotification) => `${alert.id}:${alert.fingerprint}`;

/** Marcar como lido ou excluir: a mesma impressão vai para o servidor. */
type Change = { targets: AlertNotification[]; dismiss: boolean };

/**
 * O sino dos alertas da carteira (proventos anunciados e pagos, concentração, cotação faltando,
 * estratégia…), no canto de cima à direita. O selo conta os não lidos; cada alerta se marca como
 * lido (e todos de uma vez) ou se exclui (e os lidos de uma vez): o excluído some até mudar. Na
 * mesa abre um popover sob o sino; no iPhone (`sheet`), uma folha de baixo.
 */
export function AlertsBell({
  alerts,
  sheet = false,
  className,
}: {
  alerts: readonly AlertNotification[];
  sheet?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Marcados e excluídos nesta tela, antes do servidor responder: o selo e a lista mudam no clique.
  const [marked, setMarked] = useState<ReadonlySet<string>>(new Set());
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const items = alerts
    .filter((alert) => !removed.has(keyOf(alert)))
    .map((alert) => ({ ...alert, read: alert.read || marked.has(keyOf(alert)) }));
  const unread = items.filter((item) => !item.read);

  const { mutate } = useMutation({
    mutationFn: async ({ targets, dismiss }: Change) => {
      const input = { alerts: targets.map(({ id, fingerprint }) => ({ id, fingerprint })) };
      const result = await (dismiss ? dismissAlertsAction(input) : markAlertsReadAction(input));
      if (result?.serverError) throw new Error(result.serverError);
      if (result?.validationErrors) {
        throw new Error(dismiss ? "Não deu para excluir." : "Não deu para marcar os alertas.");
      }
    },
    onMutate: ({ targets, dismiss }) =>
      (dismiss ? setRemoved : setMarked)((current) => new Set([...current, ...targets.map(keyOf)])),
    onError: (error, { targets, dismiss }) => {
      (dismiss ? setRemoved : setMarked)((current) => {
        const next = new Set(current);
        for (const target of targets) next.delete(keyOf(target));
        return next;
      });
      toast.error(error.message);
    },
  });

  const label =
    unread.length > 0
      ? `Alertas, ${unread.length} não ${unread.length === 1 ? "lido" : "lidos"}`
      : "Alertas";
  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      className={cn("relative", className)}
      onClick={sheet ? () => setOpen(true) : undefined}
    >
      <BellIcon />
      {unread.length > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-loss px-1 text-[0.625rem] leading-none font-semibold text-white tabular-nums"
        >
          {unread.length}
        </span>
      ) : null}
    </Button>
  );
  const list = (
    <AlertList
      items={items}
      onMark={(targets) => mutate({ targets, dismiss: false })}
      onDismiss={(targets) => mutate({ targets, dismiss: true })}
    />
  );

  if (sheet) {
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Alertas</DrawerTitle>
            </DrawerHeader>
            <DrawerBody className="px-4 pb-4">{list}</DrawerBody>
          </DrawerContent>
        </Drawer>
      </>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="end" sideOffset={8} className="w-96 max-w-[calc(100vw-2rem)] p-3">
        <p className="px-1 text-headline">Alertas</p>
        {list}
      </PopoverContent>
    </Popover>
  );
}

function AlertList({
  items,
  onMark,
  onDismiss,
}: {
  items: AlertNotification[];
  onMark: (targets: AlertNotification[]) => void;
  onDismiss: (targets: AlertNotification[]) => void;
}) {
  if (items.length === 0) {
    return <p className="px-1 py-2 text-subheadline text-muted-foreground">Nenhum alerta.</p>;
  }
  const unread = items.filter((item) => !item.read);
  const read = items.filter((item) => item.read);
  return (
    <div className="grid max-h-[min(70vh,32rem)] gap-3 overflow-y-auto">
      {unread.length > 1 ? (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => onMark(unread)}
        >
          <CheckIcon data-icon="inline-start" />
          Marcar todos como lidos
        </Button>
      ) : null}
      {unread.length > 0 ? (
        <ul className="grid gap-2">
          {unread.map((item) => (
            <AlertItem
              key={item.id}
              item={item}
              onMark={() => onMark([item])}
              onDismiss={() => onDismiss([item])}
            />
          ))}
        </ul>
      ) : (
        <p className="px-1 text-subheadline text-muted-foreground">Tudo lido.</p>
      )}
      {read.length > 0 ? (
        <section className="grid gap-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <h3 className="text-footnote font-semibold text-muted-foreground">Lidos</h3>
            {read.length > 1 ? (
              <Button variant="ghost" size="xs" onClick={() => onDismiss(read)}>
                <Trash2Icon data-icon="inline-start" />
                Excluir lidos
              </Button>
            ) : null}
          </div>
          <ul className="grid gap-2">
            {read.map((item) => (
              <AlertItem key={item.id} item={item} onDismiss={() => onDismiss([item])} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const LEVELS = {
  warning: { icon: TriangleAlertIcon, tile: "[--tile:var(--tile-orange)]", label: "Atenção: " },
  info: { icon: InfoIcon, tile: "[--tile:var(--tile-blue)]", label: "Informação: " },
  dividend: { icon: HandCoinsIcon, tile: "[--tile:var(--tile-teal)]", label: "Provento: " },
} as const;

function AlertItem({
  item,
  onMark,
  onDismiss,
}: {
  item: AlertNotification;
  onMark?: () => void;
  onDismiss: () => void;
}) {
  const { icon: Icon, tile, label } = LEVELS[item.level];
  return (
    <li className={cn("flex items-start gap-3 rounded-xl p-3", !item.read && "bg-muted/60")}>
      <span
        className={cn(
          "tile size-7 shrink-0 rounded-sm",
          item.read ? "[--tile:var(--muted-foreground)]" : tile,
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="text-subheadline font-semibold">
          <span className="sr-only">
            {item.read ? "Lido. " : "Não lido. "}
            {label}
          </span>
          {item.title}
        </p>
        {item.amount !== undefined ? (
          <p className="text-subheadline tabular-nums">
            <Sensitive>{formatBRL(item.amount)}</Sensitive>
          </p>
        ) : null}
        <p className="text-footnote text-muted-foreground">{item.detail}</p>
        {onMark ? (
          <Button variant="ghost" size="xs" className="-ml-2 justify-self-start" onClick={onMark}>
            <CheckIcon data-icon="inline-start" />
            Marcar como lido
          </Button>
        ) : null}
      </div>
      {/* Some do sino até o alerta mudar (um ativo novo, um valor ou uma data nova). */}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Excluir o alerta: ${item.title}`}
        className="-mt-1 -mr-1 shrink-0 text-muted-foreground"
        onClick={onDismiss}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}
