"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { useRef, useState, type KeyboardEvent } from "react";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { SegmentedControl } from "@/shared/ui/segmented-control";

/** Atalhos da divisão: a % dos FIIs. "hoje" é a divisão atual da carteira. */
const PRESETS = ["30", "50", "70"] as const;
type Preset = (typeof PRESETS)[number] | "hoje";

// Cores vivas, fundas o bastante para o texto branco por dentro passar de 4,5:1 nos dois temas
// (#0066ff 4,8:1; #cc4400 4,8:1). Não há padrão de mercado para as cores de FIIs e ações.
const FII_FILL = "bg-[#0066ff]";
const STOCK_FILL = "bg-[#cc4400]";

/** Largura de cada ponta da barra, onde ficam o nome e a %. O polegar anda só entre elas. */
const CAP = 72;
/** Largura da área de toque do polegar (o visual é menor). */
const THUMB = 48;

/** O nome e a % de um lado, empilhados numa ponta da barra: sempre à vista. */
function SideLabel({
  label,
  percent,
  align,
}: {
  label: string;
  percent: number;
  align: "left" | "right";
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-y-0 z-10 flex flex-col justify-center leading-none text-white",
        align === "left" ? "left-0 items-start pl-4" : "right-0 items-end pr-4",
      )}
      style={{ width: CAP }}
      aria-hidden="true"
    >
      <span className="text-caption text-white/85">{label}</span>
      {/* A chave troca a cada passo: o número novo entra subindo, na mola. */}
      <span
        key={percent}
        className="mt-0.5 inline-block animate-split-tick text-headline font-semibold tabular-nums motion-reduce:animate-none"
      >
        {percent}%
      </span>
    </span>
  );
}

/**
 * A divisão do aporte entre FIIs e ações (visão Geral), como os controles da Central de Controle
 * do iPhone: a própria barra é o controle. Uma cápsula de 44 px, azul à esquerda (FIIs) e laranja à
 * direita (ações). Cada ponta guarda o nome e a % do seu lado, sempre à vista: o polegar anda só
 * entre as pontas e nunca os cobre. O polegar é o do iOS 26: círculo branco em repouso, que estica
 * na mola numa cápsula de vidro enquanto se arrasta; a % sobe a cada passo, e o aparelho que vibra dá um
 * toque leve. Embaixo, os valores em reais e os atalhos num controle segmentado (30/70, 50/50,
 * 70/30 e Hoje). Setas mudam 5%; Page Up/Down, 10%.
 */
export function SplitControl({
  fiis,
  onChange,
  step,
  fiiAmount,
  stockAmount,
  todayFiis,
}: {
  /** A % do aporte para os FIIs (0 a 100). */
  fiis: number;
  onChange: (value: number) => void;
  step: number;
  /** As partes em reais; null enquanto não há valor digitado. */
  fiiAmount: number | null;
  stockAmount: number | null;
  /** A fatia dos FIIs hoje no patrimônio, de 0 a 1. */
  todayFiis: number;
}) {
  // O atalho "Hoje" cai no passo mais perto, que é onde o polegar pode parar.
  const todayPercent = Math.round((todayFiis * 100) / step) * step;
  const hasToday = todayFiis > 0 && todayFiis < 1;
  const stocks = 100 - fiis;
  // Enquanto se arrasta, o polegar segue o dedo sem degraus (`drag`); a % e o cálculo mudam de
  // passo em passo. Ao soltar, o polegar assenta no passo mais perto, na mola.
  const [drag, setDrag] = useState<number | null>(null);
  const pressing = useRef(false);
  // Ao soltar, depois do último valor do arraste: o polegar volta a seguir a % e assenta no passo.
  function release() {
    pressing.current = false;
    requestAnimationFrame(() => setDrag(null));
  }
  const position = drag ?? fiis;
  const snap = (value: number) => Math.min(100, Math.max(0, Math.round(value / step) * step));
  // A divisa das cores segue o centro do polegar, que anda (edge) entre as pontas.
  const divide = `calc(${CAP + THUMB / 2}px + (100% - ${2 * CAP + THUMB}px) * ${position / 100})`;
  const presetValue: Preset | null =
    hasToday && fiis === todayPercent
      ? "hoje"
      : (PRESETS.find((preset) => Number(preset) === fiis) ?? null);

  // Um toque leve a cada passo, onde o navegador deixa vibrar (o iPhone não deixa).
  function change(next: number) {
    if (next === fiis) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(6);
    onChange(next);
  }

  // O slider anda em décimos para o arraste ser contínuo; o teclado continua de 5 em 5%.
  function onKeyDown(event: KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      PageDown: -2 * step,
      PageUp: 2 * step,
      Home: -100,
      End: 100,
    };
    const move = moves[event.key];
    if (move === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    change(snap(fiis + move));
  }

  return (
    <div className="grid gap-2.5">
      <span className="text-footnote text-muted-foreground">Divisão do aporte</span>
      <SliderPrimitive.Root
        value={position}
        onValueChange={(next) => {
          if (pressing.current) setDrag(next);
          change(snap(next));
        }}
        onPointerDown={() => {
          pressing.current = true;
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyDownCapture={onKeyDown}
        min={0}
        max={100}
        step={0.1}
        thumbAlignment="edge"
        className="group/split w-full touch-none select-none"
      >
        <div
          className={cn(
            "relative h-11 w-full overflow-hidden rounded-full transition-[scale] duration-420 ease-bouncy motion-reduce:transition-none",
            "group-has-data-[dragging]/split:scale-[1.035]",
            STOCK_FILL,
          )}
        >
          <div
            className={cn(
              "absolute inset-y-0 left-0",
              drag === null &&
                "transition-[width] duration-420 ease-bouncy motion-reduce:transition-none",
              FII_FILL,
            )}
            style={{ width: divide }}
            aria-hidden="true"
          />
          <SideLabel label="FIIs" percent={fiis} align="left" />
          <SideLabel label="Ações" percent={stocks} align="right" />
          {/* O controle de verdade é só o trecho entre as pontas: o toque ali move o polegar. */}
          <SliderPrimitive.Control
            className="absolute inset-y-0 flex items-center"
            style={{ left: CAP, right: CAP }}
          >
            <SliderPrimitive.Track className="relative h-full w-full">
              <SliderPrimitive.Thumb
                aria-label="Parte do aporte para FIIs"
                getAriaValueText={(_text, current) =>
                  `${snap(current)}% para FIIs, ${100 - snap(current)}% para ações`
                }
                className={cn(
                  "flex h-full items-center justify-center rounded-full outline-none has-focus-visible:[&>span]:ring-3 has-focus-visible:[&>span]:ring-white/70",
                  drag === null &&
                    "transition-[inset-inline-start] duration-420 ease-bouncy motion-reduce:transition-none",
                )}

                style={{ width: THUMB }}
              >
                {/* O polegar do iOS 26: círculo branco em repouso; ao arrastar estica numa cápsula de vidro,
                    e a divisa das cores aparece por baixo dele. */}
                <span className="size-8 rounded-full bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.05),0_1px_3px_rgb(0_0_0/0.18)] transition-[height,width,background-color,box-shadow] duration-420 ease-bouncy group-has-data-[dragging]/split:h-9 group-has-data-[dragging]/split:w-12 group-has-data-[dragging]/split:bg-white/25 group-has-data-[dragging]/split:shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.75),inset_0_1px_6px_rgb(255_255_255/0.5),0_4px_14px_rgb(0_0_0/0.3)] group-has-data-[dragging]/split:backdrop-blur-[3px] group-has-data-[dragging]/split:backdrop-saturate-150 motion-reduce:transition-none" />
              </SliderPrimitive.Thumb>
            </SliderPrimitive.Track>
          </SliderPrimitive.Control>
        </div>
      </SliderPrimitive.Root>
      <div className="flex items-center justify-between gap-3 text-footnote text-muted-foreground tabular-nums">
        <span>{fiiAmount !== null ? <Sensitive>{formatBRL(fiiAmount)}</Sensitive> : "—"}</span>
        <span>{stockAmount !== null ? <Sensitive>{formatBRL(stockAmount)}</Sensitive> : "—"}</span>
      </div>
      <SegmentedControl<Preset>
        label="Atalhos da divisão"
        size="sm"
        className="w-full"
        value={presetValue}
        onChange={(preset) => change(preset === "hoje" ? todayPercent : Number(preset))}
        options={[
          ...PRESETS.map((preset) => ({
            value: preset,
            label: `${preset}/${100 - Number(preset)}`,
          })),
          ...(hasToday ? [{ value: "hoje" as const, label: "Hoje" }] : []),
        ]}
      />
    </div>
  );
}
