# Resumo do dia: só notícia do pregão, "nesta semana" e o mercado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development or superpowers-extended-cc:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** O resumo do dia (página do ativo) deixa de explicar o movimento de hoje com notícia de outro dia, some quando o movimento muda e, sem notícia do pregão, vira "O que aconteceu nesta semana" com a comparação com o IFIX/Ibovespa calculada pelo código.

**Origem:** relato do dono, 2026-11-13: "TRXF11 está positivo hoje, porém ontem ele caiu; nos detalhes do FII fala que teve queda 'hoje', porém as notícias são de ontem. Se não houver justificativa para a alta ou baixa no dia, talvez não devêssemos mostrar nada, ou mudar para resumo da semana." Confirmado nos dados: KNRI11 (+2,43% em 13/11) explicado com 3 notícias de 12/11; SNEL11 (+2,21%) com uma de 06/11; o TRXF11 manteve "caiu forte" depois de virar para +1,73%.

**Architecture:** Adianta parte da Camada 6 do spec `docs/superpowers/specs/2026-11-13-noticias-e-cenario-design.md` (a leitura contra o índice e as notícias guardadas da etapa 2). Regras puras em `market-data/domain/day-insight.ts`; o serviço `server/day-insight-service.ts` passa a ler também `news_items` e `market_indices`; a leitura `server/day-insight-read.ts` invalida o resumo quando o movimento muda; o card `portfolio/components/asset/day-insight-card.tsx` mostra os dois modos.

**Tech Stack:** TypeScript, Vitest, Mongoose, Next 16.

**Antes:** `git switch main && git pull --ff-only && git switch -c fix/resumo-dia-noticias`. Comentários pt-BR; commits em inglês com `-m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`. Nunca rodar script contra o banco (produção) nem chamar o Gemini de verdade.

---

## Regras (o contrato)

### R1. Notícia do pregão

`isSessionNews(publishedAt, session)`: a notícia foi publicada a partir do fechamento do pregão anterior (18:00 de São Paulo do dia útil anterior a `session`) e até o fim do dia do pregão (23:59:59 de São Paulo). Segunda-feira: desde sexta 18:00. Substitui `isSameDay` como critério de "explica o movimento" em todo o serviço (o `isSameDay` pode continuar exportado se algo mais usar; senão, removê-lo com seus testes).

### R2. Nada antes das 10:30

`nextInsightAttempt` devolve `false` quando `now` está no dia do pregão e antes das 10:30 de São Paulo (`DAY_INSIGHT.settleMinutes = 10 * 60 + 30`), também para a primeira tentativa: nos primeiros minutos o brapi (15–30 min de atraso) ainda traz a variação do pregão anterior. O resto da regra atual fica (manhã até 12:00, 18:00–20:00, 30 min entre tentativas, `sameDay` encerra).

### R3. O resumo pertence a um movimento

No serviço, o resumo guardado só conta como "deste movimento" quando é do mesmo pregão **e** tem o mesmo sinal da variação atual (`Math.sign`). Sinal trocado = como se não houvesse resumo: gera de novo (se a variação atual passar do gatilho). Na leitura (`getDayInsight`), o resumo some (null) quando o sinal da variação atual difere do guardado ou quando a variação atual não passa mais do gatilho da classe (`crossesThreshold`). `getDayInsight(ticker, assetClass)` recebe a classe (o `asset-overview-view.ts` já a conhece; conferir e passar).

### R4. Dois modos: `kind: "day" | "week"`

`DayInsight` ganha `kind` (documentos antigos sem o campo leem como `"day"`) e `market` (abaixo). A escolha é pura: `insightPlan(previous, sessionNews, weekNews)`:

- Há notícia do pregão (R1) e (não há resumo deste movimento, ou o resumo é `week`, ou há notícia do pregão que não está entre as fontes) → `{ mode: "day", news: sessionNews }`.
- Não há notícia do pregão e não há resumo deste movimento → `{ mode: "week", news: weekNews }` (com lista vazia, grava sem chamar o Gemini: status `"no-news"`, `kind: "week"`).
- Senão → `{ mode: "none" }` (só `touchAttempt`).

`sameDay` passa a significar "o resumo é `day`" (o `nextInsightAttempt` já encerra com ele).

### R5. As notícias

- **Do pregão (`day`):** os itens de `news_items` do ticker que passam em R1, mais os do Bing (`searchNews`) que passam em R1, sem URL repetida, do mais novo ao mais velho; lê até 3 páginas (`readFirstArticles`), pulando as fontes com `readPage: false` (Suno), que entram só com título e resumo (`description`) como texto do artigo. Se o Bing falhar, segue só com `news_items` (não é mais motivo de `failed`).
- **Da semana (`week`):** os itens de `news_items` do ticker com tópico `ativo` dos últimos 7 dias, até 5, do mais novo ao mais velho, só título e resumo (sem ler páginas). O Bing não entra no modo semana.

### R6. O mercado (sem IA)

`marketReading(assetChange, indexChange)`: `"acompanhou"` quando o sinal é o mesmo e |ativo − índice| < max(0,01, 0,5 × |índice|); senão `"descolou"`. O índice é o IFIX para FII e o Ibovespa para ação, lido de `market_indices` e usado só se `session` for igual à do resumo. Guardado em `DayInsight.market: { index: "IFIX" | "IBOV"; indexChange: number; reading: "acompanhou" | "descolou" } | null`, nos dois modos (inclusive `no-news`).

`marketReadingText(ticker, assetChange, market)` (puro, no domínio): por exemplo "O IFIX subiu 0,82% neste pregão e o TRXF11 subiu 1,73%, acompanhando o mercado." / "…o TRXF11 caiu 2,40%, bem diferente do mercado." Números com vírgula e duas casas, "subiu"/"caiu"/"ficou estável" (|x| < 0,005%).

### R7. Prompts

- `buildInsightPrompt` (modo `day`) ganha a linha do mercado (o texto de R6, quando houver) e a regra: "Use só as notícias abaixo, todas publicadas desde o fechamento do pregão anterior. Se elas não explicarem o movimento, diga isso; não invente causas." O resto fica.
- `buildWeekPrompt({ ticker, assetClass, changePercent, session, items, market })` (novo): "Escreva um parágrafo de até 4 frases curtas, para leigos, resumindo o que aconteceu com {ticker} nesta semana segundo as notícias abaixo (cada uma com a data). **Não diga que essas notícias explicam a variação de hoje**: nenhuma é do pregão de hoje. Não recomende comprar, vender ou manter. Responda só com o parágrafo." Cada item: `"título" (portal, dd/mm) — resumo`. Sem dados da carteira.

### R8. Tela (`DayInsightCard`)

- `kind: "day"`: título "Resumo do dia" (como hoje).
- `kind: "week"`: título "O que aconteceu nesta semana"; descrição: "Nenhuma notícia do pregão explica o movimento."
- Nos dois, antes do texto, a linha do mercado (`marketReadingText`) em Subheadline, quando houver `market`.
- `no-news` sem texto: só a linha do mercado, mais "Sem notícias do ativo nesta semana." (modo `week`) ou o texto atual (modo `day` legado).
- As fontes continuam abaixo; no modo semana cada uma mostra a data (já mostra).

---

## Tasks

### Task 1: Regras puras (`domain/day-insight.ts`) com testes

**Files:** Modify `src/features/market-data/domain/day-insight.ts`, `src/features/market-data/domain/day-insight.test.ts`.

**Acceptance Criteria:**
- [ ] `isSessionNews`: sexta 18:00 conta para segunda; sexta 17:59 não; o próprio dia até 23:59 conta; dia seguinte não; quarta conta desde terça 18:00 (horário de São Paulo, testes com instantes UTC explícitos).
- [ ] `nextInsightAttempt`: `false` às 10:29 do dia do pregão mesmo sem resumo; `true` às 10:30 sem resumo; o resto dos testes atuais passa.
- [ ] `insightPlan`: os três ramos de R4, incluindo `week` → `day` quando aparece notícia do pregão e notícia nova fora das fontes.
- [ ] `marketReading`: limites de 1 p.p. e de 0,5 × índice nos dois lados, sinais opostos = `descolou`, índice 0.
- [ ] `marketReadingText`: subiu/caiu/estável, vírgula, IFIX vs Ibovespa.
- [ ] `buildInsightPrompt` com e sem mercado; `buildWeekPrompt` com as datas, a proibição de explicar o movimento de hoje e sem número de carteira.
- [ ] `DayInsight` com `kind` e `market`.

**Verify:** `npx vitest run src/features/market-data/domain/day-insight.test.ts` → PASS.

Commit: `feat(market-data): day summary rules for session news, week mode and market reading`.

### Task 2: Serviço, leitura e modelo

**Files:** Modify `src/features/market-data/server/day-insight-service.ts`, `server/day-insight-read.ts`, `server/models.ts` (schema do `dayInsight`: `kind` String enum `["day","week"]` default `"day"`; `market` subdocumento `{ index, indexChange, reading }` default null; as `sources` ganham `description` opcional? não: o card só mostra título, portal e data), `src/features/portfolio/server/asset-overview-view.ts` (passar a classe para `getDayInsight`).

**Acceptance Criteria:**
- [ ] R3 no serviço (sinal) e na leitura (sinal e gatilho).
- [ ] R4/R5: notícias do pregão de `news_items` + Bing; semana só de `news_items`; Suno sem leitura de página; Bing falhando não impede o modo `day` com `news_items`.
- [ ] R6: `market` lido de `market_indices` com o mesmo pregão; null caso contrário.
- [ ] O span `insights.generate` ganha `koinos.insights.week` (resumos de semana gerados) e `koinos.insights.day` (do dia).
- [ ] Sem dado da carteira no prompt.
- [ ] `npm run typecheck`, `npm run lint`, `npx vitest run src/features/market-data src/features/portfolio` passam.

Commit: `feat(market-data): day summary uses only session news and falls back to the week`.

### Task 3: Card e documentação

**Files:** Modify `src/features/portfolio/components/asset/day-insight-card.tsx`, `CLAUDE.md` (item "AI day summary" de `/ativos/[ticker]` e a lista de testes de `day-insight.test.ts`), `docs/superpowers/specs/2026-11-13-noticias-e-cenario-design.md` (seção "Decisões da implementação (resumo do dia, 2026-11-13)" com R1–R8 resumidas e o relato do dono), `docs/superpowers/specs/2026-11-12-resumo-ia-variacao-design.md` (nota no topo apontando para a mudança).

**Acceptance Criteria:**
- [ ] R8 no card, com `GlossaryText` mantido (via `TypedText glossaryClass`).
- [ ] `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` passam.

Commit: `feat(portfolio): week mode and market line in the day summary card`.

**Depois do deploy:** os resumos guardados de hoje (KNRI11, SNEL11) continuam com `kind` ausente (= `day`) até o próximo pregão; para limpá-los já, o dono pode pedir (gravação em produção).
