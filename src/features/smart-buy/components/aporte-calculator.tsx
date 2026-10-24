"use client";

import { CopyIcon, LayersIcon, PiggyBankIcon, ShoppingCartIcon, WalletIcon } from "lucide-react";
import { parseAsFloat, parseAsNumberLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";
import { InfoSheet } from "@/shared/components/info-sheet";
import { MetricCard, StatList, StatRow } from "@/shared/components/metric";
import { MoneyInput } from "@/shared/components/money-input";
import { useTabBarAction } from "@/shared/components/tab-bar-action";
import { formatBRL, formatQuantity } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { NativeSelect } from "@/shared/ui/native-select";
import {
  DEFAULT_MAX_SHARE_PERCENT,
  MAX_SHARE_PERCENTS,
  sunoCascade,
  type CascadeAsset,
  type ExclusionReason,
  type MaxSharePercent,
} from "../domain/suno-cascade";
import { ExcludedCard } from "./aporte/excluded-card";
import { limitLabel } from "./aporte/explain";
import { PRINCIPLES } from "./principles-banner";
import { OrdersList, OrdersTable, type AssetMeta } from "./aporte/orders";

export type { AssetMeta };

const CALCULATION_NOTE =
  "O cálculo usa as cotações atuais e a configuração da Carteira Alvo. O máximo por FII monta cada posição aos poucos: o preço médio se forma em várias compras.";

/**
 * Calculadora de aporte pelo método Suno. O valor é a ação principal da página: entra num campo
 * grande, como o do Apple Pay, e a cascata roda no navegador a cada tecla (valor e limite na URL).
 * Embaixo, o resumo em cards de número, as ordens (tabela ou, no celular, lista) e quem ficou fora.
 */
export function AporteCalculator({ assets, meta }: { assets: CascadeAsset[]; meta: AssetMeta[] }) {
  const [amount, setAmount] = useQueryState(
    "valor",
    parseAsFloat.withDefault(0).withOptions({ history: "replace" }),
  );
  const [maxShare, setMaxShare] = useQueryState(
    "limite",
    parseAsNumberLiteral(MAX_SHARE_PERCENTS)
      .withDefault(DEFAULT_MAX_SHARE_PERCENT)
      .withOptions({ history: "replace" }),
  );
  const metaByTicker = new Map(meta.map((item) => [item.ticker, item]));

  const result = amount > 0 ? sunoCascade(amount, assets, { maxSharePercent: maxShare }) : null;
  const limitedAny = result?.orders.some((order) => order.limited) ?? false;
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
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Máximo por FII
              <NativeSelect
                value={maxShare}
                onChange={(event) =>
                  void setMaxShare(Number(event.target.value) as MaxSharePercent)
                }
              >
                {MAX_SHARE_PERCENTS.map((percent) => (
                  <option key={percent} value={percent}>
                    {limitLabel(percent)}
                  </option>
                ))}
              </NativeSelect>
            </label>
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
                  Entrada aos poucos: nenhum FII leva mais de {result.maxSharePercent}% do aporte, e
                  o resto vai para os outros FIIs. Quem parou no limite volta a receber no próximo
                  aporte, até chegar à meta.
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
                    <OrdersList
                      orders={result.orders}
                      meta={metaByTicker}
                      maxSharePercent={result.maxSharePercent}
                    />
                  </div>
                  <div className="hidden @min-[760px]:block">
                    <OrdersTable
                      orders={result.orders}
                      meta={metaByTicker}
                      maxSharePercent={result.maxSharePercent}
                    />
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
