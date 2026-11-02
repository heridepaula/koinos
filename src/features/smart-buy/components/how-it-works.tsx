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
 * Como as recomendações são calculadas, em linguagem simples. Texto fixo (não depende dos dados
 * do dono), no fim da página: quem quer conferir abre a etapa. As regras exatas estão em `domain/`.
 */
export function HowItWorks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Como as recomendações são calculadas</CardTitle>
        <CardDescription>
          Em resumo: o app olha para a sua Carteira Alvo, descarta o que está caro e divide o
          dinheiro entre os ativos que mais precisam de reforço. Nada é vendido.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Step
          number={1}
          title="Você diz quanto vai investir"
          summary="E quanto vai para FIIs e quanto vai para ações"
        >
          <Points
            items={[
              ["O valor:", "é a única coisa que você digita. As ordens se atualizam a cada tecla."],
              [
                "A divisão:",
                "em FIIs, o dinheiro todo vai para FIIs; em Ações, para ações. No Geral, você move o controle deslizante para dividir.",
              ],
              [
                "O troco:",
                "cada carteira calcula a sua parte e guarda o que sobrar. Um troco não passa para a outra.",
              ],
            ]}
          />
        </Step>

        <Step
          number={2}
          title="O app tira o que não deve comprar"
          summary="Está caro, está pausado ou faltam dados"
        >
          <Points
            items={[
              ["Preço no teto ou acima:", "só se compra abaixo do preço teto que você definiu."],
              ["Marcado como Aguardar:", "você pediu para esperar, então fica de fora."],
              ["Sem cotação, teto ou rank:", "faltam informações para decidir."],
              [
                "FII que parou de pagar:",
                "se um FII que pagava todo mês ficou mais de 45 dias sem pagar, ou passou um ano sem pagar, ele espera.",
              ],
              [
                "Onde ver:",
                "quem ficou de fora aparece em “Fora deste aporte”, com o motivo de cada um.",
              ],
            ]}
          />
        </Step>

        <Step
          number={3}
          title="Cada ativo tem uma meta"
          summary="Quanto ele deveria valer na carteira"
        >
          <Points
            items={[
              [
                "A meta:",
                "é a % sugerida do ativo na Carteira Alvo, aplicada sobre o total da classe já com o dinheiro novo.",
              ],
              [
                "O que falta:",
                "a meta menos o que você já tem. Quem já está na meta, ou acima, não recebe.",
              ],
              [
                "As porcentagens:",
                "são ajustadas para somar 100% em cada classe, mesmo que o total digitado seja outro.",
              ],
            ]}
          />
        </Step>

        <Step
          number={4}
          title="FIIs: quem compra primeiro e quanto"
          summary="Segue o ranking, com ajustes e limites de segurança"
        >
          <Points
            items={[
              [
                "A ordem:",
                "os FIIs são atendidos na ordem do seu ranking. Cada um pede o que falta para a meta.",
              ],
              [
                "Ajustes no pedido:",
                "pede mais se está barato (preço abaixo do valor do patrimônio e longe do teto) e menos se o último rendimento caiu ou se há muito imóvel vago.",
              ],
              [
                "Limites:",
                `nenhum FII recebe mais de ${pct(RISK_CAPS.asset)} do aporte, nenhum segmento mais de ${pct(RISK_CAPS.sector)}, e nem papel nem tijolo mais de ${pct(RISK_CAPS.macro)}. Isso evita concentrar demais.`,
              ],
              [
                "Sem compras pequenas:",
                "cada ordem de FII tem um valor mínimo (o aporte dividido pelo número de FIIs, até 12,5% do aporte). Ordem menor que isso é descartada.",
              ],
              ["Cotas:", "só se compram cotas inteiras."],
            ]}
          />
        </Step>

        <Step
          number={5}
          title="Ações: quem compra primeiro e quanto"
          summary="Primeiro as que estão mais abaixo do teto, em lotes de 100"
        >
          <Points
            items={[
              [
                "A ordem:",
                "as ações são atendidas pela margem de segurança, ou seja, pela folga entre o preço de hoje e o teto. Maior folga, primeiro.",
              ],
              [
                "Lotes de 100:",
                "as ações são compradas de 100 em 100, como no mercado. Se faltar menos de um lote para a meta, ela fica de fora.",
              ],
              ["Sem limite por ação:", "no primeiro passo, só vale a meta de cada uma."],
            ]}
          />
        </Step>

        <Step
          number={6}
          title="O que sobra é redistribuído"
          summary="Uma cota ou um lote por vez, para quem está mais longe da meta"
        >
          <Points
            items={[
              [
                "Por quê:",
                "depois do primeiro passo costuma sobrar um troco que não paga a compra de quem ficou na fila.",
              ],
              [
                "FIIs:",
                "o troco compra uma cota por vez do FII mais distante da meta, respeitando os mesmos limites de segurança.",
              ],
              [
                "Ações:",
                `o troco compra um lote por vez da ação mais distante da meta. Nenhuma passa de ${pct(STOCK_LEFTOVER_CAP)} da parte das ações, ou de um lote.`,
              ],
              ["O resto:", "o que ainda não couber fica com você, para somar ao próximo aporte."],
            ]}
          />
        </Step>

        <Step number={7} title="O que você vê na tela" summary="Ordens, motivos e avisos">
          <Points
            items={[
              [
                "Ordens de compra:",
                "quanto comprar de cada ativo, com o preço de referência e o total.",
              ],
              ["Por quê:", "cada ordem tem um resumo do motivo, e o ⓘ mostra a conta completa."],
              [
                "Triângulo ao lado do ativo:",
                "o teto que você digitou está muito diferente do teto calculado pelos juros do Tesouro. É só um aviso e não muda a ordem.",
              ],
              ["Preços:", "são os das últimas cotações. Confira na corretora antes de comprar."],
            ]}
          />
        </Step>
      </CardContent>
    </Card>
  );
}
