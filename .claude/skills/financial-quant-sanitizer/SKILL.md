---
name: financial-quant-sanitizer
description: Audita o rigor numérico dos módulos financeiros e dos leitores de dados externos do Koinos (Fundamentus, brapi, Yahoo, usebolsai, Tesouro, extratos da B3): conversão de números e moedas em pt-BR, valores fora do normal, desdobramentos e agrupamentos, janela de 12 meses do DY, Yield on Cost, Preço Teto, e testes adversariais (nulo, campo faltando, HTML quebrado). Use sempre que o dono pedir para auditar, sanitizar, validar ou blindar um parser, um adaptador de mercado ou uma fórmula de DY, YoC, teto ou proventos; ao mexer em `market-data/domain`, `market-data/adapters`, `strategy/domain/ceiling.ts` ou `transactions/import/b3`; ou quando um número da tela parecer errado (preço 100 vezes maior, DY absurdo, provento duplicado), mesmo que ele não diga "sanitizar".
---

# Auditoria quantitativa dos dados financeiros

Os números do Koinos decidem aportes reais. Um parser que lê "1.500" como 1,5, ou um DY que soma 13 pagamentos, muda a recomendação sem dar erro nenhum. Esta skill procura esse tipo de falha com evidência (um caso de entrada e a saída errada), não por opinião.

**Ela audita e protege; não muda regra do dono.** Pode escrever testes e corrigir um parser que erra de forma clara. Uma mudança de fórmula (teto, DY, retenção) é decisão do dono: aponte o achado, mostre o impacto e pare aí. A skill `conselho-investidores` avalia a estratégia; esta avalia a conta e o dado.

## Antes de começar: o que o código já faz

Leia o que existe antes de propor qualquer coisa. O projeto tem escolhas deliberadas que um checklist genérico quebraria:

- **Não há Cheerio.** Os leitores de HTML são funções puras em `domain/` com regex sobre a tabela (`fundamentus.ts`, `fundamentus-indicators.ts`); só as notícias usam Readability + linkedom. Audite esses leitores, não introduza uma biblioteca nova.
- **Não há `decimal.js`; o dinheiro é `number` do JS** (Mongo guarda double), com `round2` em `shared/lib/money.ts`. Trocar para centavos inteiros ou `decimal.js` é uma migração dos dados de produção e dos DTOs: só proponha com o custo explicado, como decisão do dono. Onde a soma precisa fechar no centavo, o código já usa inteiros (`splitIncome` na fruição, o arredondamento para cima da retenção); siga esse padrão.
- **A `MONGODB_URI` do `.env.local` é o banco de produção.** Scripts de verificação só leem, ou usam outro nome de banco.
- **Dados da B3 entram só por extrato enviado.** Nunca chame sistemas da B3.
- **Desdobro, bonificação e grupamento** são tratados no livro de transações (`kind`: desdobro é compra a preço 0, bonificação é compra ao custo informado, grupamento deixa a ação em FORA). Não existe ajuste automático do histórico de cotações por fator.
- **O teto não é Barsi nem Graham.** O teto vem do ranking do dono; o código só avisa quando ele diverge mais de 10% do teto calculado (NTN-B real + 1,0 p.p.; papel: IPCA de 4,0% + 1,0 p.p.), em `strategy/domain/ceiling.ts` (spec `2026-11-01-divergencia-teto-design.md`).
- **O DY de 12 meses** soma os 12 meses de calendário que terminam no mês do último provento (`dividendWindow`), com Fundamentus preenchendo as lacunas do Yahoo (`dividend-merge.ts`). Leia os testes de `dividend-window.test.ts` antes de achar que a janela está errada.

## 1. Entrada de dados (leitores e adaptadores)

Para cada leitor, escreva a entrada ruim e veja o que sai. O que procurar:

- **Separadores.** `parseFinancialAmount` (`shared/lib/financial-amount.ts`) é o leitor de valores externos: `parseBrNumber` (Fundamentus) já delega a ele, e recusa em vez de chutar. `parseB3Number` e `parseNumberInput` ainda só tiram os pontos se houver vírgula, então "14.000" sem vírgula vira 14 (o CLAUDE.md já avisa para dinheiro digitado); confira de que formato vem o dado de cada leitor. "R$ 1.500,00" e "R$ 1,50" precisam dar 1500 e 1,5; "1.500" sem vírgula é ambíguo, e a origem decide (`dotOnly`).
- **Valores fora do normal.** Compare com o valor anterior guardado, não com um limite fixo. Uma variação acima de 500% em preço, DY ou provento por cota deve ser sinalizada e, havendo evento corporativo no livro (desdobro, grupamento), explicada por ele. Sinalize em vez de descartar em silêncio: um desdobro 1:10 é uma queda real de 90% no preço cru. `detectScaleAnomaly` (`market-data/domain/scale-anomaly.ts`) compara com a mediana do histórico do ativo e só registra no log. Padrões que já existem e servem de modelo: `isSuspiciousCeiling`, a recusa do CSV do Tesouro com mais de 1% de linhas inválidas e a regra de "margem acima de 100% é ausente" nos indicadores.
- **Zero não é ausente.** O Fundamentus devolve 0 para o que um banco não tem; o código trata como ausente (`fundamentus-indicators`). Procure o mesmo erro nos outros leitores: P/VP 0, vacância 0, DY 0 por falta de dado.
- **Escala e unidade.** Fração × percentual (`changePercent` é fração; DY em %), por ação × por lote (a página de ações do Fundamentus traz o valor "por N ações"), cotas × R$.
- **Frescor.** Dado velho que parece atual: `dividendsFetchedAt`, `payDatesFetchedAt`, P/VP com mais de 60 dias.

## 2. Contas e eventos corporativos

- **Desdobro e agrupamento.** Verifique, com um caso real ou sintético, se o provento por cota e o preço médio ficam coerentes depois do evento. Não presuma que o Yahoo devolve proventos já ajustados: confirme com um ativo que teve evento (leitura de dados, sem escrever) e registre o resultado.
- **Janela do DY e do YoC.** DY = soma por cota dos 12 meses ÷ preço; `yieldOnCost` = estimativa anual ÷ investido. Teste os limites: 11, 12 e 13 pagamentos, mês faltando, dois pagamentos no mesmo mês, último provento com mais de 365 dias, ativo recém-listado com menos de 12 meses.
- **Proventos extraordinários.** Hoje um rendimento extra entra na soma dos 12 meses e infla o DY e o teto calculado naquele período. É uma limitação conhecida, não um erro de código: descreva o efeito com números do ativo e deixe o tratamento (separar, normalizar) para o dono decidir.
- **Teto calculado.** Confira a fórmula contra a spec (renda por cota ÷ taxa exigida), a taxa por classe (tijolo, papel, ações), o limite exato de 10% nos dois sentidos e os casos sem dado.
- **Arredondamento.** Onde as partes precisam somar o todo (retenção e reinvestimento, impostos, aportes por ordem), a soma dos arredondados deve dar o total. Teste com valores que dão dízima.

## 3. Testes adversariais

Os testes do projeto são unitários e puros, ao lado do código (`*.test.ts`, `domain/`), importam de `vitest` e não usam banco. Siga isso e o estilo dos testes vizinhos (por exemplo `fundamentus.test.ts`, `dividend-window.test.ts`).

Para cada leitor ou conta auditada, cubra:

1. **Nulo e vazio**: `""`, `"-"`, `null`, `undefined`, espaços, `NaN`, `Infinity`.
2. **Campo faltando**: linha de tabela com menos colunas, objeto da API sem o campo, coluna que mudou de ordem.
3. **HTML quebrado**: tabela sem `</table>`, tag aberta no meio da célula, `&nbsp;` e entidades, página de "ticker não encontrado", HTML vazio, a mesma tabela duplicada.
4. **Formato**: `1.234,56`, `1234,56`, `1,234.56`, `R$ 1,50`, negativo entre parênteses, percentual com `%`.
5. **Limites numéricos**: o valor logo abaixo e logo acima de cada limite do código (500%, 10%, 365 dias, 12 meses).

Um teste que falha é um achado: mostre a entrada e a saída. Corrija o parser só quando o certo é inequívoco e não muda o resultado de nenhuma entrada válida (o teste do caso bom continua passando). Se a correção mudaria um número que o dono vê, relate e peça decisão.

Verifique com `npm run format:check`, `lint`, `typecheck`, `test` e `build` (ver CLAUDE.md).

## 4. Relatório

Entregue em português, curto:

- **Achados**, do mais grave ao menos: onde (`arquivo:linha`), a entrada que prova, a saída errada e a consequência para o aporte (por exemplo "DY de HGLG11 sobe de 8,1% para 9,3%").
- **O que já estava correto**, em uma linha por área, para o dono saber o que foi realmente conferido.
- **Decisões do dono**, separadas: mudança de fórmula, migração de armazenamento, tratamento de extraordinários.
- Não cole blocos de código inteiros; mostre só as linhas alteradas, com `arquivo:linha`.
