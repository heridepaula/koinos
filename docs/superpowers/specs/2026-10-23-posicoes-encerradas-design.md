# Posições encerradas e IR estimado: especificação de design

- **Data:** 2026-10-23
- **Status:** implementado em 2026-10-23 (branch feat/posicoes-encerradas). O plano veio pronto do usuário (domínio, view, tela) e foi adaptado ao código existente:
  - o tipo `ClosedPosition` e o card "Posições encerradas" do Dashboard já existiam; o tipo ganhou os campos novos, em inglês como o resto do código, e o do card virou `ClosedPositionRow`;
  - não existe `/carteira`: a página fica em `/dashboard/encerradas`, como `/proventos/reinvestimento`, e o `proxy.ts` já cobre a rota por `/dashboard/:path*`;
  - o `replayLedger` passou a devolver cada venda, para o custo das encerradas sair do mesmo cálculo do preço médio.
- **Atualização (2026-10-23):** a pedido do usuário, a tela saiu do Dashboard e ganhou menu próprio. `/encerradas` mostra custo, vendido e resultado; o IR estimado foi para o subitem `/encerradas/ir` (cards de IR, lucro tributável e prejuízo, e a tabela FII | data | resultado | IR). `/dashboard/encerradas` redireciona para `/encerradas`. As seções abaixo descrevem a primeira versão, com o IR na mesma página.

## 1. Objetivo

Uma página com os FIIs que já estiveram na carteira e hoje têm posição zerada. Para cada um, ela mostra o resultado das vendas e, havendo lucro, a estimativa do IR sobre o ganho de capital.

### Critérios de sucesso

1. A página lista só os FIIs com lançamento e quantidade zero hoje. Nos dados reais, são 13.
2. Cada linha traz a data de encerramento, o custo das cotas vendidas pelo preço médio, o vendido, o resultado (R$ e %) e o IR estimado.
3. O IR é 20% do lucro de cada posição, sem isenção, e zero no prejuízo. Nos dados reais, MALL11 paga R$ 44,94, RBRR11 paga R$ 50,15 e o total é R$ 95,09.
4. Incorporação não é venda. O IRDM11, incorporado ao IRIM11, aparece como "incorporado", sem venda. O MALL11 mostra as vendas de 2021 e a incorporação ao PMLL11.
5. As posições com preço de compra estimado ficam marcadas. Nos dados reais, são ALZR11, GGRC11, HGCR11, KISU11, MALL11 e RBRP11.
6. Nenhum outro número do app muda. O snapshot do Dashboard sai igual ao da `main`; só o campo de data das encerradas troca de nome.
7. A página não rola para o lado entre 360 e 1440 px, e os textos passam no contraste AA nos dois temas.

## 2. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Alíquota | 20% do lucro, sem isenção | Regra do usuário: a venda de cotas de FII não tem a isenção de R$ 20 mil das ações |
| Escopo do IR | Por posição, sem compensar prejuízos entre FIIs ou meses | Pedido do usuário, para dar a estimativa na tela |
| Custo | Cotas vendidas × preço médio do dia de cada venda, com as taxas de compra | O método da Receita, o mesmo do `replayLedger` |
| Vendido | Valor das vendas menos as taxas de venda | As taxas reduzem o ganho |
| Data de encerramento | O dia em que a posição zerou: a última venda ou, quando foi ela que zerou, a incorporação | No MALL11, a última venda (2021) não é o fim da posição (2025) |
| Incorporação | Não entra no custo nem no vendido | O custo segue para o FII de destino, sem resultado nem IR |
| Leilão de fração | É venda | É dinheiro recebido pelas cotas |
| Vários ciclos | Somados na mesma linha | A linha é o FII; o resultado é o de todas as vendas dele |
| Preço estimado | Marca por FII, herdada pelo destino da incorporação | Nunca falta. Pode sobrar num ciclo sem estimativa, o que é o lado seguro |
| Sobra de ponto flutuante | Resultado abaixo de meio centavo vale zero | Evita o "−0,00%" no HGCR11, que tem resultado zero |
| Proventos | Ficam fora da página; continuam no card do Dashboard | O IR de ganho de capital é só sobre as vendas |
| Nomes | `closedAt`, `costBasis`, `proceeds`, `realizedPnL`, `estimatedTax` | Correspondem a `dataEncerramento`, `valorTotalComprado`, `valorTotalVendido`, `lucroRealizado` e `impostoEstimado` do plano, no padrão do código |

## 3. Regras (puras)

### 3.1 Vendas no `replayLedger`

`transactions/domain/positions.ts` devolve também `sales`: cada venda, na ordem do processamento, com as cotas baixadas, o valor (`proceeds`, quantidade × preço − taxas proporcionais), o custo pelo preço médio vigente (`cost`) e o `kind`. As pernas de saída das incorporações vêm junto. As contas das posições não mudam: o resultado de cada venda é `proceeds − cost`, a mesma expressão de antes.

### 3.2 Posições encerradas

`portfolio/domain/closed-positions.ts`:

- `closedPositions(transactions)`: as posições com quantidade zero, da encerrada mais recente para a mais antiga. Por FII, soma as vendas que não são incorporação: custo, vendido e quantidade de vendas. O resultado é `vendido − custo`; o percentual é sobre o custo, ou null sem custo. A data e o destino da incorporação vêm da última saída.
- `estimateCapitalGainsTax(resultado)`: zero abaixo de meio centavo; senão 20% do resultado, arredondado ao centavo.
- `summarizeClosedPositions(linhas)`: as somas de custo, vendido, resultado e IR, mais o lucro e o prejuízo somados e quantas posições tiveram cada um.
- **Preço estimado:** um FII é marcado quando uma compra dele tem `priceSource` ESTIMADO, ou quando ele recebeu por incorporação um FII marcado. Sem venda, não há marca, porque não há resultado.

### 3.3 Dashboard

`buildSnapshot` monta o card das encerradas a partir de `closedPositions`, mais os FIIs que só aparecem pelos proventos, como antes. O campo `lastDate` virou `closedAt`, e a coluna "Última venda" virou "Encerrada em".

## 4. Dados

Nada novo é gravado. A view lê os lançamentos pela DAL (`getMyTransactions`, a carteira da sessão por `getTenant`) e o nome e o logo dos ativos. O DTO não tem ids.

## 5. Tela

`/dashboard/encerradas`, com o botão "Dashboard" para voltar. O menu continua com Dashboard ativo.

- **Cards:** o resultado das vendas (com o vendido e o custo), o IR estimado e quantas posições deram lucro ou prejuízo.
- **Tabela "Por FII":** FII, encerrada em, custo (PM), vendido, resultado (R$ e %) e IR estimado, com a linha de total.
  - As colunas saem pela largura do card (container query): até 479 px ficam FII, resultado e IR; o vendido entra em 480, a data em 600 e o custo em 720.
  - Os selos "incorporado ao X" e "preço estimado" encurtam para "incorporado" e "estimado" abaixo de 840 px.
  - A posição sem venda mostra "sem venda" e traços.
- **Notas:** como o IR é estimado, o que são o custo e o vendido e, quando há, o que significam a incorporação e o preço estimado.
- **Vazio:** "Nenhuma posição encerrada".
- **Entrada:** o card do Dashboard, aberto, tem o botão "Custo, vendas e IR estimado".

## 6. Arquitetura

| Arquivo | Papel |
| --- | --- |
| `transactions/domain/positions.ts`, `types.ts` | `sales` e o tipo `RealizedSale` |
| `portfolio/domain/closed-positions.ts` | Regras da seção 3.2 |
| `portfolio/domain/types.ts` | `ClosedPosition`, `ClosedPositionRow`, `ClosedPositionsTotals`, `ClosedPositionsView` |
| `portfolio/domain/snapshot.ts` | O card do Dashboard a partir de `closedPositions` |
| `portfolio/server/closed-positions-view.ts` | `getClosedPositionsView`, exportada em `server.ts` |
| `portfolio/components/closed/` | Cards, tabela e vazio, exportados em `ui.ts` |
| `app/(app)/dashboard/encerradas/page.tsx` | Shell estático com o conteúdo por streaming |

## 7. Fora deste ciclo

- A apuração mensal de verdade: somar as vendas de FII do mês, compensar os prejuízos anteriores e gerar o DARF até o último dia útil do mês seguinte.
- O IR retido na fonte nas vendas (0,005%), que é descontado do devido.
- O resultado realizado das posições ainda abertas (vendas parciais e ciclos anteriores). Ele continua no Dashboard.

## 8. Verificação

- **Regras sem banco:** 12 checagens com carteiras sintéticas, cobrindo:
  - lucro com taxas e prejuízo pelo preço médio;
  - dois ciclos;
  - incorporação em cadeia com a estimativa herdada;
  - leilão de fração;
  - venda maior que a posição;
  - o resto incorporado depois de vendas;
  - os arredondamentos do IR.
  - O `replayLedger` novo deu as mesmas posições que o antigo, bit a bit, em 300 carteiras aleatórias.
- **Dados reais, só leitura:**
  - as 13 encerradas batem com as posições zeradas do `replayLedger`;
  - o resultado de cada uma bate com o `realizedPnL` dele;
  - o total é −R$ 36.771,34 de resultado e R$ 95,09 de IR;
  - o snapshot do Dashboard saiu idêntico ao da `main`, menos o nome do campo de data.
- **Tela, numa cópia isolada da produção:**
  - 51 checagens em 1440 e 390 px, nos dois temas, incluindo a varredura de 360 a 1440 px sem rolagem lateral, o link do Dashboard, a volta e o login sem sessão;
  - 0 falhas de contraste, medidas em janelas de 1440×900 rolando a página.
