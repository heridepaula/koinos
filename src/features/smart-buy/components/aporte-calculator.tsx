"use client";

import {
  CopyIcon,
  InfoIcon,
  LayersIcon,
  PiggyBankIcon,
  ShoppingCartIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { parseAsFloat, useQueryState } from "nuqs";
import { toast } from "sonner";
import { InfoSheet } from "@/shared/components/info-sheet";
import { MetricCard, StatList, StatRow } from "@/shared/components/metric";
import { MoneyInput } from "@/shared/components/money-input";
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
import { classAporte } from "../domain/class-aporte";
import { DEFAULT_CLASS_TARGET, type ClassKey, type ClassTarget } from "../domain/class-split";
import { RISK_CAPS, STOCK_CAPS } from "../domain/risk";
import type { CascadeAsset, CascadeResult, ExclusionReason } from "../domain/suno-cascade";
import { ExcludedCard } from "./aporte/excluded-card";
import type { OrderClass } from "./aporte/explain";
import { PRINCIPLES } from "./principles-banner";
import { OrdersList, OrdersTable, type AssetMeta } from "./aporte/orders";
import { Sensitive } from "@/shared/components/sensitive";

export type { AssetMeta };

const CALCULATION_NOTE =
  "O cálculo usa as cotações atuais, a Carteira Alvo e os dados de cada ativo. A meta entre FIIs e ações divide o aporte; em cada carteira, cada ativo pede o que falta para a meta, mais quando está descontado (P/VP e margem até o teto) e menos quando o provento caiu ou o imóvel está vago. Nas ações só agem o teto e os proventos. A cascata segue o ranking, e o que sobra vai para o mais abaixo da meta.";

const RISK_NOTE = `Travas de risco: nenhum FII leva mais de ${formatPercent(RISK_CAPS.asset, 0)} do aporte, nenhum setor mais de ${formatPercent(RISK_CAPS.sector, 0)}, e nem papel nem tijolo mais de ${formatPercent(RISK_CAPS.macro, 0)}. Nas ações, nenhuma leva mais de ${formatPercent(STOCK_CAPS.asset, 0)} da parte das ações.`;

function groupExcluded(result: CascadeResult) {
  const byReason = new Map<ExclusionReason, string[]>();
  for (const item of result.excluded) {
    byReason.set(item.reason, [...(byReason.get(item.reason) ?? []), item.ticker]);
  }
  return byReason;
}

/** O card de ordens de uma carteira, com a lista de quem ficou fora logo abaixo. */
function OrdersCard({
  title,
  result,
  kind,
  metaByTicker,
}: {
  title: string;
  result: CascadeResult;
  kind: OrderClass;
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
          <CardDescription>
            <span className="max-md:hidden">Na ordem do ranking. </span>Os preços são de referência:
            confira na corretora.
          </CardDescription>
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
              Nenhuma compra atende às regras com esse valor. Veja abaixo o motivo de cada ativo.
            </p>
          ) : (
            <>
              <div className="@min-[760px]:hidden">
                <OrdersList orders={result.orders} meta={metaByTicker} kind={kind} />
              </div>
              <div className="hidden @min-[760px]:block">
                <OrdersTable orders={result.orders} meta={metaByTicker} kind={kind} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <ExcludedCard byReason={groupExcluded(result)} kind={kind} />
    </>
  );
}

/**
 * Calculadora de aporte pelo método Suno. O valor é a ação principal da página: entra num campo
 * grande, como o do Apple Pay, e a cascata roda no navegador a cada tecla (o valor fica na URL).
 * A meta entre FIIs e ações divide o aporte; embaixo, o resumo em cards de número, as ordens de
 * cada carteira (tabela ou, no celular, lista) e quem ficou fora.
 */
export function AporteCalculator({
  fiiAssets,
  stockAssets,
  target,
  values,
  meta,
}: {
  fiiAssets: CascadeAsset[];
  stockAssets: CascadeAsset[];
  target: ClassTarget | null;
  values: Record<ClassKey, number>;
  meta: AssetMeta[];
}) {
  const [amount, setAmount] = useQueryState(
    "valor",
    parseAsFloat.withDefault(0).withOptions({ history: "replace" }),
  );
  const metaByTicker = new Map(meta.map((item) => [item.ticker, item]));
  const effectiveTarget = target ?? DEFAULT_CLASS_TARGET;

  const result =
    amount > 0
      ? classAporte({
          amount,
          target: effectiveTarget,
          values,
          fii: fiiAssets,
          stock: stockAssets,
        })
      : null;
  const spent = result ? result.fii.spent + result.stock.spent : 0;
  // O card de ações só aparece quando a carteira tem parte do aporte ou ordens.
  const showStock = result ? result.split.ACAO.share > 0 || result.stock.orders.length > 0 : false;
  const totalValue = values.FII + values.ACAO;
  const currentStockPercent = totalValue > 0 ? values.ACAO / totalValue : 0;

  async function copyOrders() {
    if (!result) return;
    const line = (order: CascadeResult["orders"][number]) =>
      `${order.ticker}: comprar ${formatQuantity(order.quantity)} cotas a ~${formatBRL(order.price)} = ${formatBRL(order.total)}`;
    const lines: string[] = [];
    if (showStock) {
      lines.push("FIIs:", ...result.fii.orders.map(line));
      lines.push("", "Ações:", ...result.stock.orders.map(line), "");
    } else {
      lines.push(...result.fii.orders.map(line));
    }
    lines.push(`Total: ${formatBRL(spent)} · Sobra: ${formatBRL(result.leftover)}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Ordens copiadas.");
  }

  // No iPhone, copiar as ordens é a ação principal depois do cálculo: fica ao lado da tab bar.
  const hasOrders = result ? result.fii.orders.length + result.stock.orders.length > 0 : false;
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
            className="flex flex-wrap items-center gap-x-4 gap-y-3"
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
          {target === null ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <InfoIcon className="size-4 shrink-0 text-info" aria-hidden="true" />
                Defina a meta entre FIIs e ações na Carteira Alvo.
              </p>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/carteira-alvo" />}
              >
                Abrir a Carteira Alvo
              </Button>
            </div>
          ) : null}
          {result && showStock ? (
            <div className="grid gap-1 text-sm">
              <p className="font-medium">
                FIIs <Sensitive>{formatBRL(result.split.FII.share)}</Sensitive> · Ações{" "}
                <Sensitive>{formatBRL(result.split.ACAO.share)}</Sensitive>
              </p>
              <p className="text-muted-foreground">
                Ações em {formatPercent(currentStockPercent, 0)} contra a meta de{" "}
                {formatPercent(1 - effectiveTarget.fiiPercent / 100, 0)}.
              </p>
              {result.transfers.stockToFii > 0 ? (
                <p className="text-muted-foreground">
                  <Sensitive>{formatBRL(result.transfers.stockToFii)}</Sensitive> do troco das ações
                  foi para FIIs.
                </p>
              ) : null}
              {result.transfers.fiiToStock > 0 ? (
                <p className="text-muted-foreground">
                  <Sensitive>{formatBRL(result.transfers.fiiToStock)}</Sensitive> do troco dos FIIs
                  foi para ações.
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {result ? (
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
                    value={<Sensitive>{formatBRL(result.leftover)}</Sensitive>}
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
                value={<Sensitive>{formatBRL(result.leftover)}</Sensitive>}
              />
            </div>
          </div>

          <OrdersCard
            title={showStock ? "FIIs" : "Ordens de compra"}
            result={result.fii}
            kind="FII"
            metaByTicker={metaByTicker}
          />
          {showStock ? (
            <OrdersCard
              title="Ações"
              result={result.stock}
              kind="ACAO"
              metaByTicker={metaByTicker}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
