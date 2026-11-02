"use client";

import {
  CopyIcon,
  InfoIcon,
  LayersIcon,
  PiggyBankIcon,
  ShoppingCartIcon,
  WalletIcon,
} from "lucide-react";
import { parseAsFloat, parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";
import { InfoSheet } from "@/shared/components/info-sheet";
import { MetricCard, StatList, StatRow } from "@/shared/components/metric";
import { MoneyInput } from "@/shared/components/money-input";
import { Sensitive } from "@/shared/components/sensitive";
import { useTabBarAction } from "@/shared/components/tab-bar-action";
import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Slider } from "@/shared/ui/slider";
import { splitAmount } from "../domain/aporte-split";
import { CURRENT_ENGINE, ENGINE_VERSIONS } from "../domain/engine-options";
import { mergeOrders, type MergedOrder } from "../domain/merge-orders";
import { RISK_CAPS } from "../domain/risk";
import { stockSmartBuy, type StockBuyAsset, type StockBuyOrder } from "../domain/stock-buy";
import { fiiCascade, type CascadeAsset, type CascadeOrder } from "../domain/fii-cascade";
import { ExcludedCard } from "./aporte/excluded-card";
import { groupExcluded, unitOf } from "./aporte/explain";
import { OrdersList, OrdersTable, type AssetMeta } from "./aporte/orders";
import { PRINCIPLES } from "./principles-banner";

export type { AssetMeta };

const RISK_NOTE = `Travas de risco: nenhum FII leva mais de ${formatPercent(RISK_CAPS.asset, 0)} do aporte, nenhum setor mais de ${formatPercent(RISK_CAPS.sector, 0)}, e nem papel nem tijolo mais de ${formatPercent(RISK_CAPS.macro, 0)}.`;

/** Visão da página: FIIs (o padrão, como antes), Ações ou Geral, que divide pelo controle. */
const VIEWS = ["geral", "fiis", "acoes"] as const;
type View = (typeof VIEWS)[number];
/** No Geral, sem `?fiis=`, o controle começa no meio. */
const DEFAULT_GERAL_FIIS = 50;
const FIIS_STEP = 5;

// Fora de 0 a 100 (ou sem valor), o Geral volta ao meio.
const fiisFromUrl = (value: number | null) =>
  value !== null && value >= 0 && value <= 100 ? value : DEFAULT_GERAL_FIIS;

/** A ordem das linhas, dita na descrição do card. */
const ORDER_TEXT: Record<View, string> = {
  geral: "Da maior para a menor ordem.",
  fiis: "Na ordem do ranking.",
  acoes: "Na ordem da margem de segurança.",
};

/** Sem nenhuma ordem, o card manda ver o motivo de cada um no card de baixo. */
const NO_ORDERS_TEXT: Record<View, string> = {
  geral: "Veja abaixo o motivo de cada ativo.",
  fiis: "Veja abaixo o motivo de cada FII.",
  acoes: "Veja abaixo o motivo de cada ação.",
};

/**
 * As linhas da tabela: em Geral, as duas carteiras juntas, da maior para a menor ordem; em FIIs e
 * em Ações, a ordem do motor de cada uma (ranking; margem de segurança).
 */
function orderRows(
  view: View,
  fii: readonly CascadeOrder[],
  stock: readonly StockBuyOrder[],
): MergedOrder[] {
  if (view === "geral") return mergeOrders(fii, stock);
  if (view === "fiis") return fii.map((order) => ({ kind: "FII" as const, order }));
  return stock.map((order) => ({ kind: "ACAO" as const, order }));
}

/** O card das ordens das carteiras da visão, numa tabela só (no celular, uma lista). */
function OrdersCard({
  view,
  rows,
  riskLimited,
  metaByTicker,
  fiiMinimum,
  fiiCount,
  fiiAmount,
  stockLot,
}: {
  view: View;
  rows: readonly MergedOrder[];
  /** Alguma trava de risco cortou o pedido de um FII. */
  riskLimited: boolean;
  metaByTicker: ReadonlyMap<string, AssetMeta>;
  /** O mínimo por ordem de FII, em R$ (0 sem parte de FIIs ou na 3.0). */
  fiiMinimum: number;
  /** Quantos FIIs a estratégia tem: o divisor do mínimo. */
  fiiCount: number;
  /** A parte do aporte que vai para os FIIs. */
  fiiAmount: number;
  /** O lote das ações, quando há parte de ações (null sem ela). */
  stockLot: number | null;
}) {
  // O selo da classe só ajuda quando a tabela mistura FIIs e ações.
  const showClass =
    rows.some((row) => row.kind === "FII") && rows.some((row) => row.kind === "ACAO");
  // As regras da 3.1 que mudam o tamanho das ordens, ditas junto com a ordem das linhas.
  // Com poucos FIIs, a fatia justa passa de 12,5% do aporte e o teto da regra é que vale.
  const capBinds = fiiCount > 0 && fiiMinimum > 0 && fiiMinimum * fiiCount < fiiAmount - 0.005;
  const orderText = [
    ORDER_TEXT[view],
    fiiMinimum > 0
      ? `Nenhuma ordem de FII abaixo de ${formatBRL(fiiMinimum)} (${
          capBinds ? "12,5% do aporte" : `aporte ÷ ${fiiCount} FIIs`
        }).`
      : null,
    stockLot !== null && stockLot > 1 ? `Ações em lotes de ${stockLot}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Card className="@container">
      <CardHeader>
        <CardTitle>Ordens de compra</CardTitle>
        <CardDescription>
          <span className="max-md:hidden">{orderText} </span>Os preços são de referência: confira na
          corretora.
        </CardDescription>
        {riskLimited ? (
          <p className="mt-2 flex items-start gap-3 text-sm">
            <LayersIcon className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
            {RISK_NOTE}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <p className="px-(--card-spacing) text-sm text-muted-foreground">
            Nenhuma compra atende às regras com esse valor. {NO_ORDERS_TEXT[view]}
          </p>
        ) : (
          <>
            <div className="@min-[760px]:hidden">
              <OrdersList rows={rows} meta={metaByTicker} showClass={showClass} />
            </div>
            <div className="hidden @min-[760px]:block">
              <OrdersTable rows={rows} meta={metaByTicker} showClass={showClass} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Calculadora de aporte. O valor é a ação principal da página: entra num campo grande, como o do
 * Apple Pay, e os motores rodam no navegador a cada tecla (o valor e a divisão ficam na URL).
 * A visão (`?classe=`) escolhe a carteira: FIIs (o padrão), Ações ou Geral, em que um controle
 * deslizante divide o aporte (`?fiis=`). Os FIIs vão pela cascata e as ações pela margem de
 * segurança. Embaixo, o resumo em cards de número, as ordens das carteiras numa tabela só e quem
 * ficou fora.
 */
export function AporteCalculator({
  fiiAssets,
  stockAssets,
  values,
  meta,
}: {
  fiiAssets: CascadeAsset[];
  stockAssets: StockBuyAsset[];
  values: { FII: number; ACAO: number };
  meta: AssetMeta[];
}) {
  const [amount, setAmount] = useQueryState(
    "valor",
    parseAsFloat.withDefault(0).withOptions({ history: "replace" }),
  );
  // O seletor de classe (AssetClassControl, na página) escreve `?classe=`; aqui só se lê.
  const [view] = useQueryState("classe", parseAsStringLiteral(VIEWS).withDefault("fiis"));
  const [rawFiis, setFiis] = useQueryState(
    "fiis",
    parseAsInteger.withOptions({ history: "replace", throttleMs: 150 }),
  );
  const fiis = view === "fiis" ? 100 : view === "acoes" ? 0 : fiisFromUrl(rawFiis);
  const metaByTicker = new Map(meta.map((item) => [item.ticker, item]));

  // Em centavos para baixo; as ações levam o resto.
  const { fii: fiiPart, stock: stockPart } = splitAmount(amount, fiis);
  const showFii = amount > 0 && fiiPart > 0;
  const showStock = amount > 0 && stockPart > 0;
  const engine = ENGINE_VERSIONS[CURRENT_ENGINE];
  const fiiResult = showFii ? fiiCascade(fiiPart, fiiAssets, engine) : null;
  const stockResult = showStock ? stockSmartBuy(stockPart, stockAssets, engine) : null;

  const spent = (fiiResult?.spent ?? 0) + (stockResult?.spent ?? 0);
  const leftover = (fiiResult?.leftover ?? 0) + (stockResult?.leftover ?? 0);
  const hasResult = fiiResult !== null || stockResult !== null;
  const rows = orderRows(view, fiiResult?.orders ?? [], stockResult?.orders ?? []);
  const hasOrders = rows.length > 0;
  // Alguma trava de risco cortou o pedido de um FII (o saldo acabar não conta).
  const riskLimited = (fiiResult?.orders ?? []).some(
    (order) => order.limitedBy !== null && order.limitedBy !== "saldo",
  );

  const totalValue = values.FII + values.ACAO;
  const todayFii = totalValue > 0 ? values.FII / totalValue : 0;
  const todayStock = totalValue > 0 ? values.ACAO / totalValue : 0;

  async function copyOrders() {
    if (rows.length === 0) return;
    // Na ordem da tabela, cada linha com a sua unidade (cotas ou ações).
    const lines = rows.map(
      ({ kind, order }) =>
        `${order.ticker}: comprar ${formatQuantity(order.quantity)} ${unitOf(kind, order.quantity)} a ~${formatBRL(order.price)} = ${formatBRL(order.total)}`,
    );
    lines.push(`Total: ${formatBRL(spent)} · Sobra: ${formatBRL(leftover)}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Ordens copiadas.");
  }

  // No iPhone, copiar as ordens é a ação principal depois do cálculo: fica ao lado da tab bar.
  useTabBarAction(
    hasOrders ? { label: "Copiar ordens", icon: CopyIcon, onPress: () => void copyOrders() } : null,
  );

  return (
    <div className="grid gap-4 md:gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Quanto vou aportar hoje?</CardTitle>
          {/* No iPhone, a explicação e os princípios ficam na folha ⓘ: o valor é o que importa. */}
          <CardAction className="md:hidden">
            <InfoSheet title="Como o aporte é calculado" label="Como o aporte é calculado">
              <ul className="grid gap-3 text-foreground">
                {PRINCIPLES.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3">
                    <Icon className="size-5 text-info" aria-hidden="true" />
                    {text}
                  </li>
                ))}
              </ul>
            </InfoSheet>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form
            className="flex flex-wrap items-end gap-x-4 gap-y-3"
            onSubmit={(event) => event.preventDefault()}
          >
            <MoneyInput
              aria-label="Valor do aporte em reais"
              size="lg"
              className="w-full sm:w-72"
              defaultValue={amount > 0 ? amount : null}
              onValueChange={(value) => void setAmount(value !== null && value > 0 ? value : null)}
            />
            {hasOrders ? (
              <Button
                type="button"
                variant="outline"
                onClick={copyOrders}
                className="max-md:hidden"
              >
                <CopyIcon />
                Copiar ordens
              </Button>
            ) : null}
          </form>
          {view === "geral" ? (
            <div className="grid gap-3">
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span>
                  <span className="font-medium">FIIs {fiis}%</span>
                  {amount > 0 ? (
                    <span className="text-muted-foreground tabular-nums">
                      {" "}
                      · <Sensitive>{formatBRL(fiiPart)}</Sensitive>
                    </span>
                  ) : null}
                </span>
                <span className="text-right">
                  <span className="font-medium">Ações {100 - fiis}%</span>
                  {amount > 0 ? (
                    <span className="text-muted-foreground tabular-nums">
                      {" "}
                      · <Sensitive>{formatBRL(stockPart)}</Sensitive>
                    </span>
                  ) : null}
                </span>
              </div>
              {/* O trecho à esquerda do polegar é a parte dos FIIs; o resto, a das ações. Passos de 5%. */}
              <Slider
                label="Parte do aporte para FIIs"
                value={fiis}
                step={FIIS_STEP}
                onValueChange={(next) => void setFiis(next)}
                valueText={(current) => `${current}% para FIIs, ${100 - current}% para ações`}
              />
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <InfoIcon className="size-4 shrink-0 text-info" aria-hidden="true" />
                Hoje: FIIs {formatPercent(todayFii, 0)} · Ações {formatPercent(todayStock, 0)}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {hasResult ? (
        <>
          {/* No celular, o resumo é um card só, com três linhas: os três cards de número
              empurravam as ordens, que são o que importa, para baixo da dobra. */}
          <div className="@container">
            <Card size="sm" className="@min-[720px]:hidden">
              <CardContent>
                <StatList className="border-t-0 pt-0">
                  <StatRow label="Aporte" value={<Sensitive>{formatBRL(amount)}</Sensitive>} />
                  <StatRow label="Ordens" value={<Sensitive>{formatBRL(spent)}</Sensitive>} />
                  <StatRow
                    label="Sobra para o próximo aporte"
                    value={<Sensitive>{formatBRL(leftover)}</Sensitive>}
                  />
                </StatList>
              </CardContent>
            </Card>
            <div className="hidden gap-4 md:gap-6 @min-[720px]:grid @min-[720px]:grid-cols-3">
              <MetricCard
                icon={WalletIcon}
                tile="[--tile:var(--tile-blue)]"
                label="Aporte"
                value={<Sensitive>{formatBRL(amount)}</Sensitive>}
              />
              <MetricCard
                icon={ShoppingCartIcon}
                tile="[--tile:var(--tile-green)]"
                label="Ordens"
                value={<Sensitive>{formatBRL(spent)}</Sensitive>}
              />
              <MetricCard
                icon={PiggyBankIcon}
                tile="[--tile:var(--tile-orange)]"
                label="Sobra para o próximo aporte"
                value={<Sensitive>{formatBRL(leftover)}</Sensitive>}
              />
            </div>
          </div>

          <OrdersCard
            view={view}
            rows={rows}
            riskLimited={riskLimited}
            metaByTicker={metaByTicker}
            fiiMinimum={fiiResult?.minimum ?? 0}
            fiiCount={fiiAssets.length}
            fiiAmount={fiiPart}
            stockLot={showStock ? engine.stockLot : null}
          />
          <ExcludedCard
            byReason={groupExcluded(fiiResult?.excluded ?? [], stockResult?.excluded ?? [])}
          />
        </>
      ) : null}
    </div>
  );
}
