"use client";

import { CopyIcon, LayersIcon, PiggyBankIcon, ShoppingCartIcon, WalletIcon } from "lucide-react";
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
import { RISK_CAPS } from "../domain/risk";
import { sunoCascade, type CascadeAsset, type ExclusionReason } from "../domain/suno-cascade";
import { ExcludedCard } from "./aporte/excluded-card";
import { PRINCIPLES } from "./principles-banner";
import { OrdersList, OrdersTable, type AssetMeta } from "./aporte/orders";

export type { AssetMeta };

const CALCULATION_NOTE =
  "O cálculo usa as cotações atuais, a Carteira Alvo e os dados de cada FII. Cada um pede o que falta para a meta, mais quando está descontado (P/VP e margem até o teto) e menos quando o provento caiu ou o imóvel está vago. A cascata segue o ranking, e o que sobra vai para o mais abaixo da meta.";

const RISK_NOTE = `Travas de risco: nenhum FII leva mais de ${formatPercent(RISK_CAPS.asset, 0)} do aporte, nenhum setor mais de ${formatPercent(RISK_CAPS.sector, 0)}, e nem papel nem tijolo mais de ${formatPercent(RISK_CAPS.macro, 0)}.`;

/**
 * Calculadora de aporte pelo método Suno. O valor é a ação principal da página: entra num campo
 * grande, como o do Apple Pay, e a cascata roda no navegador a cada tecla (o valor fica na URL).
 * Embaixo, o resumo em cards de número, as ordens (tabela ou, no celular, lista) e quem ficou fora.
 */
export function AporteCalculator({ assets, meta }: { assets: CascadeAsset[]; meta: AssetMeta[] }) {
  const [amount, setAmount] = useQueryState(
    "valor",
    parseAsFloat.withDefault(0).withOptions({ history: "replace" }),
  );
  const metaByTicker = new Map(meta.map((item) => [item.ticker, item]));

  const result = amount > 0 ? sunoCascade(amount, assets) : null;
  // Alguma trava de risco cortou um pedido (o saldo acabar não conta).
  const limitedAny =
    result?.orders.some((order) => order.limitedBy !== null && order.limitedBy !== "saldo") ??
    false;
  const excludedByReason = new Map<ExclusionReason, string[]>();
  for (const item of result?.excluded ?? []) {
    excludedByReason.set(item.reason, [...(excludedByReason.get(item.reason) ?? []), item.ticker]);
  }

  async function copyOrders() {
    if (!result) return;
    const lines = result.orders.map(
      (order) =>
        `${order.ticker}: comprar ${formatQuantity(order.quantity)} cotas a ~${formatBRL(order.price)} = ${formatBRL(order.total)}`,
    );
    lines.push(`Total: ${formatBRL(result.spent)} · Sobra: ${formatBRL(result.leftover)}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Ordens copiadas.");
  }

  // No iPhone, copiar as ordens é a ação principal depois do cálculo: fica ao lado da tab bar.
  const hasOrders = (result?.orders.length ?? 0) > 0;
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
        <CardContent>
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
                  <StatRow label="Aporte" value={formatBRL(result.amount)} />
                  <StatRow label="Ordens" value={formatBRL(result.spent)} />
                  <StatRow label="Sobra para o próximo aporte" value={formatBRL(result.leftover)} />
                </StatList>
              </CardContent>
            </Card>
            <div className="hidden gap-4 md:gap-6 @min-[720px]:grid @min-[720px]:grid-cols-3">
              <MetricCard
                icon={WalletIcon}
                tile="[--tile:var(--tile-blue)]"
                label="Aporte"
                value={formatBRL(result.amount)}
              />
              <MetricCard
                icon={ShoppingCartIcon}
                tile="[--tile:var(--tile-green)]"
                label="Ordens"
                value={formatBRL(result.spent)}
              />
              <MetricCard
                icon={PiggyBankIcon}
                tile="[--tile:var(--tile-orange)]"
                label="Sobra para o próximo aporte"
                value={formatBRL(result.leftover)}
              />
            </div>
          </div>

          <Card className="@container">
            <CardHeader>
              <CardTitle>Ordens de compra</CardTitle>
              <CardDescription>
                <span className="max-md:hidden">Na ordem do ranking. </span>Os preços são de
                referência: confira na corretora.
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
                  Nenhuma compra atende às regras com esse valor. Veja abaixo o motivo de cada
                  ativo.
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

          <ExcludedCard byReason={excludedByReason} />
        </>
      ) : null}
    </div>
  );
}
