# Atualização automática das cotações (design)

Data: 2026-11-16. Status: implementado na branch `feat/cotacoes-automaticas` (sem avançar a `main`). Decisões e medições na seção 10.

## 1. Pedido do dono

Com a tela aberta, a cotação deve se atualizar sozinha a cada _x_ minutos, no ritmo que a API de cotações (brapi) permite, e o navegador deve mostrar o valor novo **sem recarregar a página inteira**: só os componentes que dependem da cotação mudam.

## 2. Como é hoje

- `QuoteRefresher` (`portfolio/components/quote-refresher.tsx`) só dispara `refreshMyQuotesAction` **ao montar**, se `staleCount > 0`, ou no botão manual. Não há relógio: uma aba aberta o dia todo fica parada.
- Ele está só em `/dashboard`, `/carteira-alvo` e `/recomendacoes`. Em `/ativos/[ticker]` e nas outras telas com preço não há atualizador.
- `refreshQuotes` (`market-data/server/quote-service.ts`) já faz o trabalho certo: trava Redis `quotes` (60 s), separa as vencidas por `isQuoteStale`, brapi (lote) com Yahoo de reserva, grava `quoteFetchedAt`. A action chama `refresh()` (Next) só quando `updated > 0`, e isso re-renderiza as rotas do cliente sem recarregar o documento.
- Todo número derivado (patrimônio, L/P, DY, cascata, ordens, "Prioridade") sai de `buildSnapshot`, no servidor. **Não existe store de cotações no cliente, e não deve existir**: duplicaria a regra.

## 3. Fatos da API (brapi, plano gratuito)

Fontes: [frequência](https://brapi.dev/faq/qual-a-frequencia), [delay por plano](https://brapi.dev/faq/qual-a-diferenca-real-no-atraso-delay-dos-dados-entre-os-planos), [limites](https://brapi.dev/faq/quais-as-limitacoes), [plano gratuito](https://brapi.dev/faq/o-plano-gratuito-tem-limitacoes-importantes). Conferidas em 2026-11-16.

- Ações e FIIs atualizam **a cada 30 min** (delay de ~30 min no gratuito; 15 min no Startup, 5 min no Pro).
- 15.000 requisições/mês (`BRAPI_MONTHLY_QUOTA`), 1 ticker por requisição na rota individual, sem requisições simultâneas.

**Decisão: _x_ = 30 minutos**, que é `QUOTE_MAX_AGE_MS`. Buscar antes disso devolve o mesmo dado e gasta cota. Não criar configuração nova; se o dono assinar um plano melhor, muda-se a constante (e o delay de `isTradingWindow`).

## 4. Desenho

Reaproveitar o caminho que já existe (relógio → `refreshMyQuotesAction` → `refresh()`). O que muda é **quem dispara e quando**.

### 4.1 Regra do relógio (pura, testada)

Em `market-data/domain/market-hours.ts`, exportada por `market-data/index.ts`:

```ts
nextQuoteRefreshAt(fetchedAt: Date | null, now: Date): Date | null
```

- Dentro da janela (`isTradingWindow`): `fetchedAt + QUOTE_MAX_AGE_MS + 1 s` (a regra é `> 30 min`; disparar em 30:00 exato é rodada perdida, como `market-indices.ts:60` já registra). Sem `fetchedAt`, ou já vencida: `now`.
- Fora da janela: o próximo evento é a abertura (10:00 do próximo dia útil) se a cotação for anterior ao último fechamento; senão `null` (nada a fazer, não gasta cota).
- Sem tratar feriado (igual ao resto).
- Teste em `market-hours.test.ts`: **para todo resultado `t` não nulo, `isQuoteStale(fetchedAt, t)` é verdadeiro**; casos: 10:00, 17:59, 18:29, 18:30, sexta à noite, sábado, domingo, `fetchedAt` nulo.

### 4.2 O atualizador (cliente)

Evoluir `QuoteRefresher` (não criar outro):

- Agenda **um** `setTimeout` para `nextQuoteRefreshAt(lastFetchedAt, Date.now())`, recalculado a cada nova `lastFetchedAt` recebida do servidor. Nada de `setInterval` fixo.
- **Sem laço de repetição.** Hoje o efeito depende de `staleCount`; um ticker que nunca ganha cotação mantém `staleCount > 0` e uma trava ocupada (`skipped`) não muda props. Regra: após cada tentativa, se `lastFetchedAt` não avançou, a próxima é em **5 min** (recuo; dobra até 30 min, volta ao normal no sucesso). Nunca "venceu → chama de novo" direto.
- **Aba oculta:** pausar (`document.visibilityState === "hidden"`) e reavaliar em `visibilitychange`; ao voltar, se venceu, atualiza na hora. Timers de aba em segundo plano são estrangulados pelo navegador; não confiar neles.
- **Falha automática é silenciosa:** o toast de erro vale só para o botão manual. Na automática, registrar (`console.warn`), recuar, e se a sessão expirou (erro de não autenticado) **parar o relógio** sem toast.
- O botão manual segue como está (força a tentativa, ignora o recuo).

### 4.3 Escopo: um só atualizador

Hoje são 3 páginas com `QuoteRefresher`. Para cobrir todas as telas com preço (`/ativos/[ticker]`, `/proventos`, `/encerradas` etc.) sem repetir:

- Mover o **relógio** para o layout `(app)` (componente cliente, dentro de `<Suspense fallback={null}>`, como `SessionKeepAlive`), alimentado por um DTO pequeno `{ lastFetchedAt, staleCount }` vindo de uma leitura barata do layout (`getQuoteStatus`, em `portfolio/server`, `cache` do React).
- O **selo visual** ("Mercado aberto · Cotações de …" + botão) continua em `QuoteRefresher` nas 3 páginas e só exibe; o estado `isPending` passa por um contexto pequeno compartilhado com o relógio.
- Se mover para o layout se mostrar caro demais, fallback aceito: manter por página, adicionando o atualizador em `/ativos/[ticker]`. Decidir pelo custo medido, e registrar na seção 8 do próprio spec.

### 4.4 Outra aba ou o cron escreveu primeiro

`refreshQuotes` pula o que não está vencido, e a action só chama `refresh()` quando `updated > 0`. Se outra aba, o `after()` de outra chamada ou o cron do dia atualizou antes, esta aba **não re-renderiza e fica com valor velho**. Correção:

- A action devolve também `lastFetchedAt` (o máximo de `quoteFetchedAt` dos tickers do usuário depois da tentativa).
- O cliente compara com a `lastFetchedAt` que renderizou. Se o banco está mais novo e a tela não, chama `router.refresh()` (cliente; `refresh()` do servidor só vale dentro da action). Se a action já chamou `refresh()`, não repetir.
- Teste (vitest, função pura): `needsRerender(renderedAt, latestAt)`.

### 4.5 "Só os componentes que dependem do valor"

`refresh()` re-busca o RSC da rota atual e o React reconcilia: o documento não recarrega, estado de cliente (scroll, sheets abertos, campos digitados, filtros do `nuqs`) permanece e só mudam os nós cujos dados mudaram. O gargalo é o que cada rota faz ao re-renderizar:

- **Verificar com o Chrome DevTools antes de dar por pronto** (a doc do `refresh()` do Next 16 não descreve o comportamento com `cacheComponents`): na aba de rede só aparece a requisição RSC; **nenhum fallback de `<Suspense>` volta a aparecer** (sem flash de skeleton); `card-appear` e `card-scroll-rise` **não reexecutam**; o scroll fica onde estava.
- Se algum `<Suspense>` mostrar o fallback na atualização, corrigir a causa (ex.: `key` instável, leitura sem `cache`) em vez de aceitar o piscar. Última opção: `startTransition` no disparo, para manter a UI anterior até o dado novo chegar.
- Os valores que mudam não devem animar a página inteira. Opcional e barato: o número que mudou ganha um destaque curto (1 s) com `prefers-reduced-motion` respeitado. **Fora do escopo se complicar.**

### 4.6 Efeito colateral aceito e dito ao dono

Em `/recomendacoes` as ordens de compra são calculadas no navegador (`AporteCalculator`) a partir do snapshot. Com a cotação mudando de 30 em 30 min, **as ordens e quantidades podem mudar com o dono olhando a tela**. Decisão: aceitar (é o dado mais novo e o valor digitado em `?valor=` e o % de `?fiis=` ficam), e mostrar no selo o horário da cotação usada (já existe). Não congelar.

## 5. Orçamento da brapi

Medir antes de fechar, não presumir: `koinos.brapi.requests` por lote (span `quotes.brapi`) e o contador `brapi:AAAA-MM` (`api_usage`).

- Caminho comum: `listAll("fund")` e, se faltar ação, `listAll("stock")` = **1 a 2 requisições** por rodada. Cada ticker que a listagem não trouxe custa +1 (rota individual).
- Estimativa: 16 rodadas por pregão (10:00–18:30) × ~21 dias úteis × (2 + faltantes) ≈ 700–1.800/mês por **uma** aba com o app aberto o dia todo. A trava Redis `quotes` e o `isQuoteStale` fazem várias abas dividirem a mesma rodada, então abas extras **não** multiplicam.
- Somar o que já existe: cron diário (`force`) e o botão manual. O teto de 90% de `BRAPI_MONTHLY_QUOTA` (troca para o Yahoo) continua valendo e não muda.
- Critério: com o pior caso medido, ficar **abaixo de 50%** da cota. Se passar, subir o recuo, não reduzir o intervalo.
- `refreshMyQuotesAction` roda `after()` → `refreshDayInsights` (máx. 2 ativos) e `refreshDividends`/`refreshPayDates`/`refreshMissingFundamentals`. A cada 30 min isso é novo. Conferir que (a) todos pulam o que já foi buscado (20 h, 6 h) e (b) o resumo do dia só chama Gemini/Bing quando há variação nova (`needsDayInsight`). Se gerar chamada extra mensurável, criar uma action **leve** (`refreshQuotesOnlyAction`: só `refreshQuotes` + `refresh()`) para o relógio, deixando a completa para a abertura da tela e o botão.

## 6. Sessão

`SessionKeepAlive` renova a sessão só com interação real (pointer, tecla, scroll) para uma aba esquecida **expirar em 1 h**. A action passa por `authActionClient`; com `cookieCache` de 5 min ela **não** deve empurrar o prazo, mas conferir lendo `auth/server/session.ts`. Se empurrar, o relógio mantém uma aba abandonada logada para sempre: nesse caso o relógio **só dispara se houve interação nos últimos 60 min** (reaproveitar o contador do `SessionKeepAlive`). Expirada a sessão, parar (4.2) e deixar o próximo clique redirecionar ao login.

## 7. Critérios de aceite

1. Dashboard aberto durante o pregão: a cotação e tudo que depende dela mudam sozinhos em até ~31 min da anterior, sem clicar.
2. Nenhuma requisição de documento (só RSC), nenhum skeleton, scroll/sheet/campo preservados, sem repetir animação de entrada.
3. Duas abas abertas: a segunda mostra o valor novo mesmo quando foi a primeira que buscou (4.4).
4. Aba oculta não dispara; ao voltar, atualiza se venceu.
5. Fora do pregão e no fim de semana: nenhuma chamada (`nextQuoteRefreshAt` nulo ou abertura).
6. Falha de rede ou brapi no automático: sem toast, recuo de 5 min; sucesso volta ao ritmo de 30.
7. Cota mensal medida abaixo de 50%.
8. `format:check`, `lint`, `typecheck`, `test`, `build` verdes.

## 8. Ordem de implementação (Sonnet)

1. `nextQuoteRefreshAt` + testes (puro). Exportar em `market-data/index.ts`.
2. `needsRerender` + a action devolvendo `lastFetchedAt` (4.4); testes.
3. `QuoteRefresher`: relógio, recuo, visibilidade, falha silenciosa (4.2). Decidir 4.3 pelo custo e anotar a decisão aqui.
4. Verificar 4.5 no Chrome DevTools (rede, Suspense, scroll, animações) e a medição da seção 5; anotar os números aqui.
5. Docs: `2026-10-17-koinos-design.md` §6.5 (gatilhos: ganhou o relógio), `CLAUDE.md` (parágrafo "Quotes come from brapi first…" em Market data e a lista de testes) e este spec.
6. Commit em inglês, Conventional Commits (`feat(market-data): refresh quotes on a 30-minute clock`), em branch; avançar `main` só quando o dono pedir.

## 9. Fora de escopo

WebSocket/SSE (a fonte só muda a cada 30 min; empurrar não ganha nada), store de cotações no cliente, intervalo menor que 30 min no plano gratuito, tratamento de feriados, mudança de provedor ou de plano.

## 10. Registro da implementação (2026-11-16)

**4.3, o relógio no layout.** Decidido por custo: o layout monta `QuoteClock` dentro de `<Suspense fallback={null}>`, alimentado por `getQuoteStatus` (`portfolio/server/quote-status.ts`, `cache` do React). Ele só lê `getMyTransactions` e `getMyTargetAssets` (já em `cache`, então no dashboard, na Carteira Alvo e nas Recomendações são reaproveitados do snapshot) e faz **uma** consulta com projeção `{ quoteFetchedAt }` em `assets`. Não monta o snapshot. Custo extra por render do layout: 1 consulta pequena nas telas com snapshot e 3 (ledger, Carteira Alvo e a projeção) nas outras. O layout só re-renderiza na navegação inicial e a cada `refresh()`. O fallback por página não foi preciso. O selo continua em `QuoteRefresher`, nas 3 páginas; o estado `isPending` e o pedido manual passam por um módulo `quote-refresh-store.ts` (não um contexto, porque o relógio e o selo nascem em `<Suspense>` diferentes e não se aninham).

**4.1, o que `nextQuoteRefreshAt` devolve.** Nunca `null`: a spec dizia "abertura ou null" fora do pregão, mas uma aba aberta de sexta a segunda precisa acordar sozinha. Então: vencida agora (ou sem cotação) devolve `now`, inclusive fora do pregão (uma busca só, para fechar o dia, igual ao que a tela já fazia ao abrir); em dia fora do pregão, a próxima abertura (10:00 de dia útil); no pregão, `fetchedAt + 30 min + 1 s`, limitado a 18:30 (a janela fecha e a cotação anterior ao fechamento vence pela outra regra). O teste checa, para todo resultado, `isQuoteStale(fetchedAt, resultado)`. O fim de semana não faz chamada: o relógio dorme até segunda 10:00 (o `setTimeout` de ~2 dias cabe nos 24,8 dias do limite).

**4.2, recuo e laço.** `QuoteClock` guarda a cotação mais nova conhecida (a da tela ou a devolvida pela action). Sem isso, entre a resposta da action e o novo RSC o relógio veria "vencida" outra vez e dispararia em laço.

**4.4.** A action devolve `{ ...result, lastFetchedAt, rerendered }`. O cliente chama `router.refresh()` só se `!rerendered && needsRerender(renderedAt, latestAt)`.

**5, o `after()` e os outros passos da action.** Lidos no código, não medidos: `refreshDividends` e `refreshPayDates` pulam o que foi buscado nas últimas 20 h, `refreshMissingFundamentals` só pega o que falta (6 h), e `refreshDayInsights` só chama Bing/Gemini quando há variação nova (2 ativos no máximo). Por isso **não** foi criada a action leve (`refreshQuotesOnlyAction`); fica como passo seguinte se o APM (`koinos.insights.*`, spans `quotes.brapi`) mostrar chamada extra. **Orçamento da brapi: estimado, não medido** (sem acesso ao APM nem ao contador `brapi:AAAA-MM`): 16 rodadas por pregão × 21 dias × (1 a 2 listagens + os faltantes) ≈ 350 a 1.800 por mês com uma aba aberta o dia todo, abaixo dos 50% (7.500) da cota. Conferir `api_usage` depois de uma semana em produção.

**6, a sessão.** Lido `auth/server/session.ts` e `auth.ts`: `expiresIn` 1 h, `updateAge` 5 min, `cookieCache` 5 min, plugin `nextCookies`. Como a action chama `auth.api.getSession` e o cookie em cache vence em 5 min, a chamada a cada 30 min lê o armazenamento e **empurra o prazo e regrava o cookie**. A salvaguarda foi aplicada: o relógio só dispara se houve `pointerdown`, `keydown` ou `scroll` nos últimos 60 min (`isIdle`, `IDLE_LIMIT_MS`); a próxima interação retoma. Os mesmos eventos do `SessionKeepAlive`, em listeners próprios do relógio (não há contador compartilhado).

**4.5, verificação no navegador: não feita.** O servidor local usa `.env.local` com o banco de produção e exige login Google, e o MCP do chrome-devtools não conectou nesta sessão. Ficaram **sem verificar**: (a) que nenhum fallback de `<Suspense>` volta a aparecer no `refresh()`, (b) que `card-appear`/`card-scroll-rise` não reexecutam, (c) que o scroll é preservado, (d) que a rede mostra só a requisição RSC. Fazer isso na primeira abertura em produção; se um skeleton piscar, aplicar o plano do 4.5 (causa do `<Suspense>`, depois `startTransition`). O destaque de 1 s no número que mudou (opcional) não foi feito.
