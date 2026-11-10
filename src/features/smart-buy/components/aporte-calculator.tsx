"use client";

import { LayersIcon, PiggyBankIcon, ShoppingCartIcon, WalletIcon } from "lucide-react";
import { parseAsFloat, parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs";
import { MetricCard, StatList, StatRow } from "@/shared/components/metric";
import { MoneyInput } from "@/shared/components/money-input";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatCompactBRL, formatPercent } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { orderImpact, portfolioImpact, type OrderImpact } from "../domain/aporte-impact";
import { splitAmount } from "../domain/aporte-split";
import { CURRENT_ENGINE, ENGINE_VERSIONS } from "../domain/engine-options";
import { mergeOrders, type MergedOrder } from "../domain/merge-orders";
import { RISK_CAPS } from "../domain/risk";
import { stockSmartBuy, type StockBuyAsset, type StockBuyOrder } from "../domain/stock-buy";
import { fiiCascade, type CascadeAsset, type CascadeOrder } from "../domain/fii-cascade";
import { SplitControl } from "./split-control";
import { ExcludedCard } from "./aporte/excluded-card";
import { groupExcluded } from "./aporte/explain";
import { impactKey } from "./aporte/impact";
import { OrdersList, OrdersTable, type AssetMeta } from "./aporte/orders";

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
  impacts,
}: {
  view: View;
  rows: readonly MergedOrder[];
  impacts: ReadonlyMap<string, OrderImpact>;
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
              <OrdersList rows={rows} meta={metaByTicker} showClass={showClass} impacts={impacts} />
            </div>
            <div className="hidden @min-[760px]:block">
              <OrdersTable
                rows={rows}
                meta={metaByTicker}
                showClass={showClass}
                impacts={impacts}
              />
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
  // Alguma trava de risco cortou o pedido de um FII (o saldo acabar não conta).
  const riskLimited = (fiiResult?.orders ?? []).some(
    (order) => order.limitedBy !== null && order.limitedBy !== "saldo",
  );

  // O impacto das ordens (spec impacto-do-aporte): por papel e o geral das classes da visão.
  const fiiByTicker = new Map(fiiAssets.map((asset) => [asset.ticker, asset]));
  const stockByTicker = new Map(stockAssets.map((asset) => [asset.ticker, asset]));
  const impactItems = rows.flatMap((row) => {
    const asset =
      row.kind === "FII" ? fiiByTicker.get(row.order.ticker) : stockByTicker.get(row.order.ticker);
    return asset
      ? [{ row, order: row.order, impact: orderImpact(row.kind, row.order, asset) }]
      : [];
  });
  const impacts = new Map(
    impactItems.map((item) => [impactKey(item.row.kind, item.order.ticker), item.impact]),
  );
  const viewValue =
    view === "fiis" ? values.FII : view === "acoes" ? values.ACAO : values.FII + values.ACAO;
  const overall = portfolioImpact(impactItems, viewValue);
  const incomeText = (
    <>
      +<Sensitive>{formatBRL(overall.monthlyIncome)}</Sensitive>
      {overall.incomeMissing > 0 ? ` (sem dado de ${overall.incomeMissing})` : null}
    </>
  );
  const patrimonyText = (
    <>
      <Sensitive>{formatCompactBRL(overall.valueBefore)}</Sensitive> ➔{" "}
      <Sensitive>{formatCompactBRL(overall.valueAfter)}</Sensitive>
    </>
  );

  const totalValue = values.FII + values.ACAO;
  const todayFii = totalValue > 0 ? values.FII / totalValue : 0;

  // O campo do aporte mora no card "Aporte"; no Geral, o controle da divisão fica logo abaixo.
  const amountField = (
    <div className="grid gap-3">
      <MoneyInput
        aria-label="Valor do aporte em reais"
        size="lg"
        className="w-full"
        defaultValue={amount > 0 ? amount : null}
        onValueChange={(value) => void setAmount(value !== null && value > 0 ? value : null)}
      />
      {view === "geral" ? (
        <SplitControl
          fiis={fiis}
          onChange={(next) => void setFiis(next)}
          step={FIIS_STEP}
          fiiAmount={amount > 0 ? fiiPart : null}
          stockAmount={amount > 0 ? stockPart : null}
          todayFiis={todayFii}
        />
      ) : null}
    </div>
  );

  return (
    <div className="grid gap-4 md:gap-6">
      {/* Os três números do aporte. O primeiro é o campo onde se digita o valor. No celular são um
          card só, para as ordens, que são o que importa, não descerem da dobra. */}
      <div className="@container">
        <Card size="sm" className="@min-[720px]:hidden">
          <CardContent className="grid gap-3">
            <div className="flex items-center gap-2 text-subheadline text-muted-foreground">
              <span className="tile size-6 rounded-sm [--tile:var(--tile-blue)]">
                <WalletIcon className="size-3.5" aria-hidden="true" />
              </span>
              Aporte
            </div>
            {amountField}
            <StatList>
              <StatRow label="Ordens" value={<Sensitive>{formatBRL(spent)}</Sensitive>} />
              <StatRow
                label="Sobra para o próximo aporte"
                value={<Sensitive>{formatBRL(leftover)}</Sensitive>}
              />
              {hasResult ? (
                <>
                  <StatRow label="Patrimônio" value={patrimonyText} />
                  <StatRow label="Renda/mês a mais" value={incomeText} />
                </>
              ) : null}
            </StatList>
          </CardContent>
        </Card>
        <div className="hidden gap-4 md:gap-6 @min-[720px]:grid @min-[720px]:grid-cols-3">
          <Card className="card-lift">
            <CardHeader className="gap-3">
              <div className="flex items-center gap-2 text-subheadline text-muted-foreground">
                <span className="tile size-6 rounded-sm [--tile:var(--tile-blue)]">
                  <WalletIcon className="size-3.5" aria-hidden="true" />
                </span>
                Aporte
              </div>
              {amountField}
            </CardHeader>
          </Card>
          <MetricCard
            icon={ShoppingCartIcon}
            tile="[--tile:var(--tile-green)]"
            label="Ordens"
            value={<Sensitive>{formatBRL(spent)}</Sensitive>}
          >
            {hasResult ? (
              <StatList>
                <StatRow label="Patrimônio" value={patrimonyText} />
              </StatList>
            ) : null}
          </MetricCard>
          <MetricCard
            icon={PiggyBankIcon}
            tile="[--tile:var(--tile-orange)]"
            label="Sobra para o próximo aporte"
            value={<Sensitive>{formatBRL(leftover)}</Sensitive>}
          >
            {hasResult ? (
              <StatList>
                <StatRow label="Renda/mês a mais" value={incomeText} />
              </StatList>
            ) : null}
          </MetricCard>
        </div>
      </div>

      {hasResult ? (
        <>
          <OrdersCard
            view={view}
            rows={rows}
            riskLimited={riskLimited}
            metaByTicker={metaByTicker}
            fiiMinimum={fiiResult?.minimum ?? 0}
            fiiCount={fiiAssets.length}
            fiiAmount={fiiPart}
            stockLot={showStock ? engine.stockLot : null}
            impacts={impacts}
          />
          <ExcludedCard
            byReason={groupExcluded(fiiResult?.excluded ?? [], stockResult?.excluded ?? [])}
          />
        </>
      ) : null}
    </div>
  );
}
