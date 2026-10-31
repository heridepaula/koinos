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
import { RISK_CAPS } from "../domain/risk";
import { stockSmartBuy, type StockBuyAsset, type StockBuyResult } from "../domain/stock-buy";
import {
  sunoCascade,
  type CascadeAsset,
  type CascadeResult,
  type ExclusionReason,
} from "../domain/suno-cascade";
import { ExcludedCard } from "./aporte/excluded-card";
import { OrdersList, OrdersTable, type AssetMeta } from "./aporte/orders";
import { StockExcludedCard } from "./aporte/stock-excluded-card";
import { StockOrdersList, StockOrdersTable } from "./aporte/stock-orders";
import { PRINCIPLES } from "./principles-banner";

export type { AssetMeta };

const CALCULATION_NOTE =
  "O cálculo usa as cotações atuais, a Carteira Alvo e os dados de cada ativo. Você escolhe quanto do aporte vai para FIIs e quanto vai para ações. Entre os FIIs, cada um pede o que falta para a meta, mais quando está descontado (P/VP e margem até o teto) e menos quando o provento caiu ou o imóvel está vago; a cascata segue o ranking, e o que sobra vai para o mais abaixo da meta. Nas ações, só entram as abaixo do teto e da meta, e a maior margem de segurança é atendida primeiro.";

const RISK_NOTE = `Travas de risco: nenhum FII leva mais de ${formatPercent(RISK_CAPS.asset, 0)} do aporte, nenhum setor mais de ${formatPercent(RISK_CAPS.sector, 0)}, e nem papel nem tijolo mais de ${formatPercent(RISK_CAPS.macro, 0)}.`;

function groupExcluded(result: CascadeResult) {
  const byReason = new Map<ExclusionReason, string[]>();
  for (const item of result.excluded) {
    byReason.set(item.reason, [...(byReason.get(item.reason) ?? []), item.ticker]);
  }
  return byReason;
}

function groupStockExcluded(result: StockBuyResult) {
  const byReason = new Map<StockBuyResult["excluded"][number]["reason"], string[]>();
  for (const item of result.excluded) {
    byReason.set(item.reason, [...(byReason.get(item.reason) ?? []), item.ticker]);
  }
  return byReason;
}

/** Visão da página: FIIs (o padrão, como antes), Ações ou Geral, que divide pelo controle. */
const VIEWS = ["geral", "fiis", "acoes"] as const;
/** No Geral, sem `?fiis=`, o controle começa no meio. */
const DEFAULT_GERAL_FIIS = 50;
const FIIS_STEP = 5;

// Fora de 0 a 100 (ou sem valor), o Geral volta ao meio.
const fiisFromUrl = (value: number | null) =>
  value !== null && value >= 0 && value <= 100 ? value : DEFAULT_GERAL_FIIS;

const ORDERS_DESCRIPTION = (
  <>
    <span className="max-md:hidden">Na ordem do ranking. </span>Os preços são de referência: confira
    na corretora.
  </>
);

/** O card de ordens dos FIIs, com a lista de quem ficou fora logo abaixo. */
function FiiOrdersCard({
  title,
  result,
  metaByTicker,
}: {
  title: string;
  result: CascadeResult;
  metaByTicker: ReadonlyMap<string, AssetMeta>;
}) {
  // Alguma trava de risco cortou um pedido (o saldo acabar não conta).
  const limitedAny = result.orders.some(
    (order) => order.limitedBy !== null && order.limitedBy !== "saldo",
  );
  return (
    <>
      <Card className="@container">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{ORDERS_DESCRIPTION}</CardDescription>
          {limitedAny ? (
            <p className="mt-2 flex items-start gap-3 text-sm">
              <LayersIcon className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
              {RISK_NOTE}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="px-0">
          {result.orders.length === 0 ? (
            <p className="px-(--card-spacing) text-sm text-muted-foreground">
              Nenhuma compra atende às regras com esse valor. Veja abaixo o motivo de cada FII.
            </p>
          ) : (
            <>
              <div className="@min-[760px]:hidden">
                <OrdersList orders={result.orders} meta={metaByTicker} />
              </div>
              <div className="hidden @min-[760px]:block">
                <OrdersTable orders={result.orders} meta={metaByTicker} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <ExcludedCard byReason={groupExcluded(result)} />
    </>
  );
}

/** O card de ordens das ações, na ordem da margem de segurança. */
function StockOrdersCard({
  result,
  metaByTicker,
}: {
  result: StockBuyResult;
  metaByTicker: ReadonlyMap<string, AssetMeta>;
}) {
  return (
    <>
      <Card className="@container">
        <CardHeader>
          <CardTitle>Ações</CardTitle>
          <CardDescription>
            <span className="max-md:hidden">Na ordem da margem de segurança. </span>Os preços são de
            referência: confira na corretora.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {result.orders.length === 0 ? (
            <p className="px-(--card-spacing) text-sm text-muted-foreground">
              Nenhuma compra atende às regras com esse valor. Veja abaixo o motivo de cada ação.
            </p>
          ) : (
            <>
              <div className="@min-[760px]:hidden">
                <StockOrdersList orders={result.orders} meta={metaByTicker} />
              </div>
              <div className="hidden @min-[760px]:block">
                <StockOrdersTable orders={result.orders} meta={metaByTicker} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <StockExcludedCard byReason={groupStockExcluded(result)} />
    </>
  );
}

/**
 * Calculadora de aporte. O valor é a ação principal da página: entra num campo grande, como o do
 * Apple Pay, e os motores rodam no navegador a cada tecla (o valor e a divisão ficam na URL).
 * A visão (`?classe=`) escolhe a carteira: FIIs (o padrão), Ações ou Geral, em que um controle
 * deslizante divide o aporte (`?fiis=`). Os FIIs vão pela cascata Suno e as ações pela margem de
 * segurança. Embaixo, o resumo em cards de número, as ordens de cada carteira e quem ficou fora.
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
  const fiiResult = showFii ? sunoCascade(fiiPart, fiiAssets) : null;
  const stockResult = showStock ? stockSmartBuy(stockPart, stockAssets) : null;

  const spent = (fiiResult?.spent ?? 0) + (stockResult?.spent ?? 0);
  const leftover = (fiiResult?.leftover ?? 0) + (stockResult?.leftover ?? 0);
  const hasResult = fiiResult !== null || stockResult !== null;
  const hasOrders = (fiiResult?.orders.length ?? 0) + (stockResult?.orders.length ?? 0) > 0;

  const totalValue = values.FII + values.ACAO;
  const todayFii = totalValue > 0 ? values.FII / totalValue : 0;
  const todayStock = totalValue > 0 ? values.ACAO / totalValue : 0;

  async function copyOrders() {
    if (!fiiResult && !stockResult) return;
    const line =
      (unit: string) =>
      (order: { ticker: string; quantity: number; price: number; total: number }) =>
        `${order.ticker}: comprar ${formatQuantity(order.quantity)} ${unit} a ~${formatBRL(order.price)} = ${formatBRL(order.total)}`;
    const lines: string[] = [];
    if (fiiResult && stockResult) {
      lines.push("FIIs:", ...fiiResult.orders.map(line("cotas")));
      lines.push("", "Ações:", ...stockResult.orders.map(line("ações")), "");
    } else if (stockResult) {
      lines.push(...stockResult.orders.map(line("ações")));
    } else if (fiiResult) {
      lines.push(...fiiResult.orders.map(line("cotas")));
    }
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
          <CardDescription className="max-md:hidden">{CALCULATION_NOTE}</CardDescription>
          {/* No iPhone, a explicação e os princípios ficam na folha ⓘ: o valor é o que importa. */}
          <CardAction className="md:hidden">
            <InfoSheet title="Como o aporte é calculado" label="Como o aporte é calculado">
              <p>{CALCULATION_NOTE}</p>
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

          {fiiResult ? (
            <FiiOrdersCard
              title={view === "geral" && showStock ? "FIIs" : "Ordens de compra"}
              result={fiiResult}
              metaByTicker={metaByTicker}
            />
          ) : null}
          {stockResult ? (
            <StockOrdersCard result={stockResult} metaByTicker={metaByTicker} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
