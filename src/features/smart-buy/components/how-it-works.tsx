import {
  BanIcon,
  BoxesIcon,
  BuildingIcon,
  ChevronDownIcon,
  CoinsIcon,
  FlagIcon,
  LayersIcon,
  ListChecksIcon,
  PiggyBankIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SplitIcon,
  TargetIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { RISK_CAPS } from "../domain/risk";
import { STOCK_LEFTOVER_CAP } from "../domain/stock-buy";

const pct = (value: number) => formatPercent(value, 0);

const TILES = {
  blue: "[--tile:var(--tile-blue)]",
  green: "[--tile:var(--tile-green)]",
  teal: "[--tile:var(--tile-teal)]",
  orange: "[--tile:var(--tile-orange)]",
  purple: "[--tile:var(--tile-purple)]",
  indigo: "[--tile:var(--tile-indigo)]",
  pink: "[--tile:var(--tile-pink)]",
} as const;
type Tile = keyof typeof TILES;

function TileIcon({
  icon: Icon,
  tile,
  size = "md",
}: {
  icon: LucideIcon;
  tile: Tile;
  size?: "sm" | "md";
}) {
  return (
    <span className={cn("tile rounded-sm", TILES[tile], size === "md" ? "size-8" : "size-6")}>
      <Icon className={size === "md" ? "size-4" : "size-3.5"} aria-hidden="true" />
    </span>
  );
}

/** As quatro regras que valem para tudo, em destaque, antes da conta. */
const HIGHLIGHTS: readonly { icon: LucideIcon; tile: Tile; title: string; text: string }[] = [
  {
    icon: ShieldCheckIcon,
    tile: "green",
    title: "Só abaixo do teto",
    text: "Preço no teto ou acima? O ativo não recebe aporte.",
  },
  {
    icon: ScaleIcon,
    tile: "blue",
    title: "Nunca vende",
    text: "A carteira se rebalanceia só com dinheiro novo.",
  },
  {
    icon: LayersIcon,
    tile: "orange",
    title: "Travas de risco",
    text: `${pct(RISK_CAPS.asset)} por FII, ${pct(RISK_CAPS.sector)} por setor e ${pct(RISK_CAPS.macro)} por papel ou tijolo.`,
  },
  {
    icon: BoxesIcon,
    tile: "purple",
    title: "Sem ordens pequenas",
    text: "Mínimo por ordem nos FIIs e lotes de 100 nas ações.",
  },
];

/** Uma fórmula em destaque, para o olho achar a conta antes da explicação. */
function Formula({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 rounded-lg bg-muted/60 px-3 py-2 text-sm font-medium tabular-nums">
      {children}
    </p>
  );
}

/** Um aviso importante dentro de uma etapa. */
function Callout({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-2.5 rounded-lg bg-info/10 px-3 py-2.5 text-sm">
      <FlagIcon className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Pontos de uma etapa: o termo em destaque e a explicação logo depois. */
function Points({ items }: { items: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="grid gap-2.5 text-sm">
      {items.map(([term, text]) => (
        <div
          key={term}
          className="grid gap-0.5 @min-[560px]:grid-cols-[11rem_1fr] @min-[560px]:gap-4"
        >
          <dt className="font-semibold">{term}</dt>
          <dd className="text-muted-foreground">{text}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Uma etapa do cálculo, recolhível: azulejo colorido, título e uma linha de resumo. */
function Step({
  icon,
  tile,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  icon: LucideIcon;
  tile: Tile;
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border-t border-border/60 first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg py-3 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
        <TileIcon icon={icon} tile={tile} />
        <span className="grid min-w-0 flex-1">
          <span className="text-headline">{title}</span>
          <span className="text-footnote text-muted-foreground">{summary}</span>
        </span>
        <ChevronDownIcon
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-420 ease-snappy group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="pt-1 pb-4 @min-[560px]:pl-11">{children}</div>
    </details>
  );
}

/** Título de um grupo de etapas. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-1">
      <h3 className="text-subheadline font-semibold text-muted-foreground">{title}</h3>
      <div>{children}</div>
    </section>
  );
}

/**
 * Como as recomendações são calculadas, em etapas. Texto fixo (não depende dos dados do dono), no
 * fim da página: as regras que valem para tudo vêm em destaque, e quem quer conferir a conta abre
 * a etapa.
 */
export function HowItWorks() {
  return (
    <Card className="@container">
      <CardHeader>
        <CardTitle>Como as recomendações são calculadas</CardTitle>
        <CardDescription>
          O cálculo usa as cotações de agora, a Carteira Alvo e os dados de cada ativo. Toque numa
          etapa para ver a conta.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <ul className="grid gap-3 @min-[520px]:grid-cols-2 @min-[1000px]:grid-cols-4">
          {HIGHLIGHTS.map(({ icon, tile, title, text }) => (
            <li key={title} className="grid content-start gap-2 rounded-xl bg-muted/50 p-4">
              <TileIcon icon={icon} tile={tile} />
              <p className="text-headline">{title}</p>
              <p className="text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>

        <Group title="Antes da conta">
          <Step
            icon={SlidersHorizontalIcon}
            tile="blue"
            title="O que você escolhe"
            summary="O valor do aporte e a divisão entre FIIs e ações"
            defaultOpen
          >
            <Points
              items={[
                ["Valor", "É o único número que você digita. Tudo é recalculado a cada tecla."],
                [
                  "Divisão",
                  "Em FIIs, o aporte inteiro vai para os FIIs; em Ações, para as ações. No Geral, o controle deslizante divide o valor em passos de 5%.",
                ],
                [
                  "Duas sobras",
                  "Cada carteira calcula a sua parte e guarda o seu troco. Nada passa de uma para a outra.",
                ],
              ]}
            />
          </Step>
          <Step
            icon={BanIcon}
            tile="pink"
            title="Quem fica de fora"
            summary="Cada ativo passa por uma fila de condições, na ordem"
          >
            <Points
              items={[
                ["Sem cotação", "Sem preço não há ordem."],
                ["Sem rank", "Só para FIIs: o rank define a fila."],
                ["Sem teto", "O preço teto é o filtro de compra."],
                ["Preço no teto ou acima", "Só se compra abaixo do preço teto."],
                ["Viés Aguardar", "Marcado na Carteira Alvo, tira o ativo do aporte."],
                [
                  "Provento suspenso",
                  "Só FIIs: pagador regular (6 pagamentos ou mais em 12 meses) há mais de 45 dias sem data ex, ou sem pagar há mais de 365 dias.",
                ],
              ]}
            />
            <Callout>
              O primeiro motivo que falha é o que aparece em “Fora deste aporte”. O valor do ativo
              continua na base da carteira, então ele não distorce a meta dos outros.
            </Callout>
          </Step>
          <Step
            icon={TargetIcon}
            tile="teal"
            title="A meta de cada ativo"
            summary="Quanto ele deveria valer depois do aporte"
          >
            <Formula>Meta = peso × (valor da carteira da classe + a parte do aporte)</Formula>
            <Points
              items={[
                [
                  "Peso",
                  "A % sugerida da Carteira Alvo, reescalada para somar 100% em cada classe. % vazia divide o que falta; 0% é quarentena.",
                ],
                ["Falta", "Meta menos o valor atual. Quem já está na meta ou acima não pede nada."],
              ]}
            />
          </Step>
        </Group>

        <Group title="FIIs">
          <Step
            icon={BuildingIcon}
            tile="indigo"
            title="Quanto cada FII pede"
            summary="A falta até a meta × quatro fatores"
          >
            <Formula>Pedido = falta × valuation × proventos × segurança × vacância</Formula>
            <Points
              items={[
                [
                  "Valuation",
                  "1 + (1 − P/VP), nunca abaixo de 0. P/VP de 0,80 dá 1,20: pede 20% a mais.",
                ],
                [
                  "Proventos",
                  "O menor entre 1 e (último provento ÷ média mensal de 12 meses). Se o pagamento caiu, o pedido encolhe na mesma proporção.",
                ],
                [
                  "Segurança",
                  "1 + a margem até o teto. Quanto mais abaixo do teto, mais ele pede.",
                ],
                [
                  "Vacância",
                  "Só tijolo: 1 − a vacância física. Com 5% de vacância, o fator é 0,95.",
                ],
              ]}
            />
            <Callout>
              Sem o dado de um fator, ele vale 1 e não pesa nem para cima nem para baixo.
            </Callout>
          </Step>
          <Step
            icon={ListChecksIcon}
            tile="green"
            title="O primeiro passo, pelo ranking"
            summary="Do 1º ao último, cada um compra o que pede, dentro das travas"
          >
            <Points
              items={[
                [
                  "Quanto compra",
                  "O menor entre o pedido, a folga das travas de risco e o saldo do aporte, em cotas inteiras para baixo.",
                ],
                [
                  "Travas",
                  `Nenhum FII leva mais de ${pct(RISK_CAPS.asset)} do aporte, nenhum setor mais de ${pct(RISK_CAPS.sector)}, e nem papel nem tijolo mais de ${pct(RISK_CAPS.macro)}. “Multicategoria”, “Outros” e “Híbrido” não têm trava de setor.`,
                ],
                [
                  "Papel ou tijolo",
                  "Vem do tipo do fundo; sem o tipo, vale a categoria da Carteira Alvo.",
                ],
                [
                  "Mínimo por ordem",
                  `Aporte ÷ nº de FIIs da estratégia, até ${formatPercent(0.125, 1)} do aporte. Ordem menor é descartada e o dinheiro desce na fila.`,
                ],
              ]}
            />
            <Callout>
              O ranking manda: um FII mais abaixo da meta, mas pior ranqueado, só recebe o que sobra
              dos que vêm antes.
            </Callout>
          </Step>
          <Step
            icon={PiggyBankIcon}
            tile="orange"
            title="A sobra dos FIIs"
            summary="O troco vai, uma cota por vez, para quem está mais abaixo"
          >
            <Points
              items={[
                [
                  "Quem recebe",
                  "A cada cota, o FII mais distante da meta já multiplicada pelos fatores de proventos e vacância. Empate vai para o melhor rank.",
                ],
                ["Pode passar da meta", "A sobra respeita as travas de risco, mas não a meta."],
                [
                  "FII sem ordem",
                  "Só abre uma ordem nova se o mínimo couber de uma vez. Quem já tem ordem segue ganhando uma cota por vez.",
                ],
                [
                  "Fim",
                  "Quando nenhuma cota cabe. O que resta fica em caixa para o próximo aporte.",
                ],
              ]}
            />
          </Step>
        </Group>

        <Group title="Ações">
          <Step
            icon={TrendingUpIcon}
            tile="teal"
            title="A fila pela margem de segurança"
            summary="Sem fatores: quem tem mais folga até o teto compra primeiro"
          >
            <Formula>Margem de segurança = teto ÷ preço − 1</Formula>
            <Points
              items={[
                [
                  "Entra",
                  "Ação com preço e teto, preço no teto ou abaixo, valor abaixo da meta e sem viés Aguardar.",
                ],
                [
                  "Ordem",
                  "A maior margem primeiro. Empate vai para o melhor rank e, depois, o ticker.",
                ],
                ["Sem trava", "Não há limite por ação no primeiro passo."],
                [
                  "Lotes de 100",
                  "Cada ordem é múltiplo de 100: o menor entre os lotes que faltam para a meta e os que o caixa paga.",
                ],
              ]}
            />
            <Callout>
              Faltou menos de um lote para a meta? Aparece “Menos de um lote”. Faltou um lote ou
              mais e o caixa acabou? Aparece “Sem saldo”.
            </Callout>
          </Step>
          <Step
            icon={CoinsIcon}
            tile="orange"
            title="A sobra das ações"
            summary="Um lote por vez para a ação mais abaixo da meta"
          >
            <Points
              items={[
                [
                  "Quem recebe",
                  "A ação com o menor (valor + comprado) ÷ meta, desde que o lote caiba no caixa. Empate vai para o melhor rank.",
                ],
                [
                  "Limite",
                  `Nenhuma ação passa do maior entre ${pct(STOCK_LEFTOVER_CAP)} da parte das ações do aporte e um lote. Só a sobra é limitada.`,
                ],
                [
                  "Pode passar da meta",
                  "E uma ação que ficou em “Na meta” ou “Menos de um lote” no primeiro passo também pode receber aqui.",
                ],
                [
                  "Caixa final",
                  "Fica abaixo do lote da ação mais barata que ainda cabe no limite.",
                ],
              ]}
            />
          </Step>
        </Group>

        <Group title="Resultado">
          <Step
            icon={SplitIcon}
            tile="purple"
            title="O que aparece na tela"
            summary="Ordens, motivos, sobra e avisos"
          >
            <Points
              items={[
                [
                  "Ordens de compra",
                  "Quantidade, preço de referência e total. No Geral, da maior para a menor; em FIIs, pelo ranking; em Ações, pela margem de segurança.",
                ],
                [
                  "Por quê",
                  "Cada ordem mostra o rank, a distância até a meta e o sinal mais forte. A conta completa abre no ⓘ da linha.",
                ],
                [
                  "Fora deste aporte",
                  "Quem não recebeu, agrupado pelo motivo, com a explicação de cada um.",
                ],
                ["Sobra", "O que não coube em nenhuma ordem. Fica com você para o próximo aporte."],
                [
                  "Triângulo no ativo",
                  "O teto digitado diverge mais de 10% do calculado pela NTN-B. É só informativo e não muda nenhuma ordem.",
                ],
              ]}
            />
            <Callout>
              Os preços são de referência, das últimas cotações. Confira na corretora antes de
              enviar a ordem.
            </Callout>
          </Step>
        </Group>
      </CardContent>
    </Card>
  );
}
