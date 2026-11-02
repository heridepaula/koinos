import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatPercent } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { RISK_CAPS } from "../domain/risk";
import { STOCK_LEFTOVER_CAP } from "../domain/stock-buy";

const pct = (value: number) => formatPercent(value, 0);

/** Uma etapa do cálculo: título numerado e os pontos, num recolhível que não pesa na página. */
function Step({
  number,
  title,
  summary,
  children,
}: {
  number: number;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="group border-t border-border/60 first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-sm py-3 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-footnote font-semibold text-primary tabular-nums">
          {number}
        </span>
        <span className="grid min-w-0 flex-1">
          <span className="text-headline">{title}</span>
          <span className="text-footnote text-muted-foreground">{summary}</span>
        </span>
        <ChevronDownIcon
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-420 ease-snappy group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="pb-4 pl-10">{children}</div>
    </details>
  );
}

/** Lista de pontos com o rótulo em destaque. */
function Points({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <ul className="grid gap-2 text-sm">
      {items.map(([label, text]) => (
        <li key={label} className="flex gap-2.5">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
          <span>
            <span className="font-medium">{label}</span>
            <span className="text-muted-foreground"> {text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Como as recomendações são calculadas, etapa por etapa. Texto fixo (não depende dos dados do
 * dono), no fim da página: quem quer conferir a conta abre a etapa.
 */
export function HowItWorks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Como as recomendações são calculadas</CardTitle>
        <CardDescription>
          Toque numa etapa para ver a conta. Nada é vendido: a carteira só é rebalanceada com
          dinheiro novo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Step
          number={1}
          title="O que você escolhe"
          summary="O valor e quanto vai para FIIs e para ações"
        >
          <Points
            items={[
              ["Valor do aporte:", "é o único número digitado. Tudo é recalculado a cada tecla."],
              [
                "FIIs, Ações ou Geral:",
                "em FIIs, o aporte inteiro vai para os FIIs; em Ações, para as ações. No Geral, o controle deslizante (passos de 5%) divide o valor.",
              ],
              [
                "Duas carteiras, duas sobras:",
                "cada carteira roda o seu cálculo com a sua parte e guarda a sua sobra. Nenhum troco passa de uma para a outra.",
              ],
              [
                "Centavos:",
                "a parte dos FIIs é arredondada para baixo em centavos, e as ações levam o resto.",
              ],
            ]}
          />
        </Step>

        <Step
          number={2}
          title="Quem pode receber"
          summary="Cada ativo passa por uma fila de condições, na ordem"
        >
          <Points
            items={[
              ["Sem cotação:", "sem preço não há ordem."],
              ["Sem rank (FIIs):", "o ranking define a prioridade da fila."],
              ["Sem teto:", "o preço teto é o filtro de compra."],
              ["Preço no teto ou acima:", "só se compra abaixo do preço teto."],
              ["Viés Aguardar:", "marcado na Carteira Alvo, o ativo fica fora do aporte."],
              [
                "Provento suspenso (FIIs):",
                "pagador regular (6 ou mais pagamentos em 12 meses) há mais de 45 dias sem data ex, ou sem pagar há mais de 365 dias. Só vale com proventos atualizados nos últimos 10 dias.",
              ],
              [
                "O primeiro motivo que falha é o que aparece em “Fora deste aporte”.",
                "O valor do ativo que ficou de fora continua na base da carteira, então não distorce as metas dos outros.",
              ],
            ]}
          />
        </Step>

        <Step number={3} title="A meta de cada ativo" summary="Peso × (valor da carteira + aporte)">
          <Points
            items={[
              [
                "Peso:",
                "a % sugerida da Carteira Alvo, reescalada para somar 100% em cada classe. % vazia divide igualmente o que falta; 0% é quarentena (fora da estratégia).",
              ],
              [
                "Meta:",
                "peso × (valor atual da carteira da classe + a parte do aporte dela). Somar o aporte à base evita que a meta fique desatualizada.",
              ],
              [
                "Falta:",
                "meta − valor atual. Quem já está na meta ou acima não pede nada (“Na meta”).",
              ],
            ]}
          />
        </Step>

        <Step
          number={4}
          title="FIIs: quanto cada um pede"
          summary="A falta até a meta × quatro fatores"
        >
          <p className="mb-3 text-sm text-muted-foreground">
            O pedido é a falta até a meta multiplicada por quatro fatores. Cada um vale 1 quando
            falta o dado, e assim não pesa nem para cima nem para baixo.
          </p>
          <Points
            items={[
              [
                "Valuation:",
                "1 + (1 − P/VP), nunca abaixo de 0. P/VP de 0,80 dá 1,20: pede 20% a mais. P/VP de 1,10 dá 0,90.",
              ],
              [
                "Proventos:",
                "o menor entre 1 e (último provento ÷ média mensal de 12 meses). Se o último pagamento caiu, o pedido encolhe na mesma proporção.",
              ],
              [
                "Segurança:",
                "1 + a margem até o teto, (teto − preço) ÷ teto. Quanto mais abaixo do teto, mais pede.",
              ],
              [
                "Vacância (só tijolo):",
                "1 − a vacância física. Com 5% de vacância, o fator é 0,95.",
              ],
            ]}
          />
        </Step>

        <Step
          number={5}
          title="FIIs: o primeiro passo, pelo ranking"
          summary="Do 1º ao último, cada um compra o que pede, respeitando as travas"
        >
          <Points
            items={[
              [
                "Quanto compra:",
                "o menor entre o pedido, a folga que sobra nas travas de risco e o saldo do aporte, em cotas inteiras arredondadas para baixo.",
              ],
              [
                "Travas de risco:",
                `nenhum FII leva mais de ${pct(RISK_CAPS.asset)} do aporte, nenhum setor mais de ${pct(RISK_CAPS.sector)}, e nem papel nem tijolo mais de ${pct(RISK_CAPS.macro)}. “Multicategoria”, “Outros” e “Híbrido” não têm trava de setor.`,
              ],
              [
                "Classe de risco:",
                "vem do tipo do fundo (papel, tijolo, híbrido, FoF); sem o tipo, vale a categoria da Carteira Alvo.",
              ],
              [
                "Mínimo por ordem:",
                `aporte ÷ nº de FIIs da estratégia, no máximo ${formatPercent(0.125, 1)} do aporte. Ordem abaixo disso é descartada e o dinheiro desce na fila. Se a própria trava cortou abaixo do mínimo, o motivo da trava é o que aparece.`,
              ],
              [
                "Ranking manda:",
                "um FII mais abaixo da meta, mas pior ranqueado, só recebe o que sobra dos que vêm antes.",
              ],
            ]}
          />
        </Step>

        <Step
          number={6}
          title="FIIs: a sobra"
          summary="O troco do primeiro passo vai, uma cota por vez, para quem está mais abaixo"
        >
          <Points
            items={[
              [
                "Quem recebe:",
                "a cada cota, o FII mais distante da meta já multiplicada pelos fatores de proventos e vacância. Empate vai para o melhor rank.",
              ],
              ["Pode passar da meta:", "a sobra respeita as travas de risco, mas não a meta."],
              [
                "FII sem ordem:",
                "só abre uma ordem nova se couber o mínimo de uma vez, dentro das travas e do saldo. Quem já tem ordem segue ganhando uma cota por vez.",
              ],
              [
                "Fim:",
                "quando nenhuma cota cabe. O que resta fica em caixa para o próximo aporte.",
              ],
            ]}
          />
        </Step>

        <Step
          number={7}
          title="Ações: a fila pela margem de segurança"
          summary="Sem fatores: quem tem mais folga até o teto compra primeiro"
        >
          <Points
            items={[
              [
                "Entra:",
                "ação com preço e teto, preço no teto ou abaixo, valor abaixo da meta e sem viés Aguardar.",
              ],
              [
                "Meta:",
                "(valor das ações + a parte do aporte) × o peso da ação. Não há trava por ação.",
              ],
              [
                "Ordem:",
                "margem de segurança = teto ÷ preço − 1, a maior primeiro. Empate vai para o melhor rank e, depois, para o ticker.",
              ],
              [
                "Lotes de 100:",
                "cada ordem é múltiplo de 100: o menor entre os lotes que faltam para a meta e os que o caixa paga. Falta menos de um lote: “Menos de um lote”. Falta um lote ou mais e acabou o caixa: “Sem saldo”.",
              ],
            ]}
          />
        </Step>

        <Step
          number={8}
          title="Ações: a sobra, em lotes"
          summary="Um lote por vez para a ação mais abaixo da meta"
        >
          <Points
            items={[
              [
                "Quem recebe:",
                "entre as ações que podem comprar, a de menor (valor + comprado) ÷ meta, desde que o lote caiba no caixa. Empate vai para o melhor rank.",
              ],
              [
                "Limite:",
                `a ação não passa do maior entre ${pct(STOCK_LEFTOVER_CAP)} da parte das ações do aporte e um lote. Só a sobra é limitada: o que o primeiro passo comprou fica como está.`,
              ],
              [
                "Pode passar da meta,",
                "e uma ação que ficou em “Na meta” ou “Menos de um lote” no primeiro passo também pode receber aqui.",
              ],
              ["Caixa final:", "fica abaixo do lote da ação mais barata que ainda cabe no limite."],
            ]}
          />
        </Step>

        <Step number={9} title="O que sai na tela" summary="Ordens, motivos, sobra e avisos">
          <Points
            items={[
              [
                "Ordens de compra:",
                "quantidade, preço de referência e total. No Geral, da maior para a menor; em FIIs, na ordem do ranking; em Ações, pela margem de segurança.",
              ],
              [
                "Por quê:",
                "cada ordem mostra o rank, a distância até a meta e o sinal mais forte. A conta completa abre no ⓘ da linha.",
              ],
              [
                "Fora deste aporte:",
                "quem não recebeu, agrupado pelo motivo, com a explicação de cada um.",
              ],
              ["Sobra:", "o que não coube em nenhuma ordem. Fica com você para o próximo aporte."],
              [
                "Triângulo ao lado do ativo:",
                "o teto digitado diverge mais de 10% do teto calculado pela NTN-B. É só informativo e não muda nenhuma ordem.",
              ],
              [
                "Preços:",
                "são de referência (últimas cotações). Confira na corretora antes de enviar a ordem.",
              ],
            ]}
          />
        </Step>
      </CardContent>
    </Card>
  );
}
