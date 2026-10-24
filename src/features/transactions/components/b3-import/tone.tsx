import { cn } from "@/shared/lib/utils";
import { CircleAlertIcon, CircleCheckIcon, CircleXIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/shared/ui/badge";

/**
 * Cor e ícone de cada situação da prévia: verde (certo), amarelo (diverge ou pede resposta) e
 * vermelho (falta ou fica de fora). O ícone repete a cor para quem não distingue as cores.
 */
export type Tone = "ok" | "warn" | "bad";

const TONES: Record<Tone, { icon: LucideIcon; text: string; surface: string }> = {
  ok: {
    icon: CircleCheckIcon,
    text: "text-gain",
    surface: "border-gain/40 bg-gain/10 text-gain",
  },
  warn: {
    icon: CircleAlertIcon,
    text: "text-warn",
    surface: "border-warn/40 bg-warn/10 text-warn",
  },
  bad: {
    icon: CircleXIcon,
    text: "text-loss",
    surface: "border-loss/40 bg-loss/10 text-loss",
  },
};

export function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
  const { icon: Icon, text } = TONES[tone];
  return <Icon aria-hidden className={cn("size-4 shrink-0", text, className)} />;
}

export function ToneBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const { icon: Icon, surface } = TONES[tone];
  return (
    <Badge variant="outline" className={cn("gap-1", surface)}>
      <Icon aria-hidden />
      {children}
    </Badge>
  );
}

/** Faixa de destaque: ícone e texto na cor da situação, sobre um fundo leve da mesma cor. */
export function ToneBanner({
  tone,
  title,
  children,
  role,
}: {
  tone: Tone;
  title: ReactNode;
  children?: ReactNode;
  role?: "alert" | "status";
}) {
  const { icon: Icon, surface } = TONES[tone];
  return (
    <div
      role={role}
      className={cn("flex items-start gap-2 rounded-lg border p-3 text-sm", surface)}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="grid gap-0.5">
        <p className="font-medium">{title}</p>
        {children ? <div className="text-foreground">{children}</div> : null}
      </div>
    </div>
  );
}

/** Título de card com o ícone da situação na frente. */
export function ToneTitle({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <ToneIcon tone={tone} />
      {children}
    </span>
  );
}
