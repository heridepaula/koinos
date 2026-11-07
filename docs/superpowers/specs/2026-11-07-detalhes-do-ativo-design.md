# Detalhes do ativo (`/ativos`)

Data: 2026-11-07. Decisão do dono: a página de um ativo fora da carteira mostra só o que o catálogo e o app já guardam (opção 1). Nada de busca sob demanda no Yahoo, Fundamentus ou brapi ao abrir a página.

## Objetivo

Uma página por ticker que junta, numa visão só, o que o app sabe do ativo (mercado), a estratégia (Carteira Alvo) e a posição do dono (ordens, proventos, resultado). Uma busca com prévia leva até ela.

## Rotas

- `/ativos`: cabeçalho estático e a busca (`AssetSearch`) no centro. Sem "mais acessados" nem "maiores altas e baixas": o app não tem esses dados.
- `/ativos/[ticker]`: o ticker é normalizado para maiúsculas. Um ticker que não existe no catálogo nem no ledger dá `notFound()`. O ledger entra na checagem porque um FII deslistado (MALL11, IRDM11) pode ter saído do catálogo e ainda ter histórico.
- `proxy.ts`: o matcher ganha `"/ativos/:path*"`.
- `nav-items.ts`: o item "Ativos" (ícone `SearchIcon`, um tile próprio) entra depois de "Dashboard", sem `tab`. No iPhone, ele aparece na folha "Mais".

## Busca

- `AssetSearch` (client, `market-data/components/`, exportado por `ui.ts`): um `Command` com debounce de 300 ms que consulta `/api/tickers?q=`. A rota já existe, exige sessão e devolve `{ ticker, name, subType }`. Ela não muda.
- Escolher um item, ou dar Enter com um ticker completo, chama `router.push("/ativos/TICKER")`.
- Teclado: setas e Enter (do `Command`), Esc fecha. No celular, o campo usa 16 px para o Safari não dar zoom.
- Mesma busca no hero da página do ticker, para trocar de ativo rápido.

## Página do ticker

O cabeçalho fica estático e cada seção dependente de sessão vai num `<Suspense>` próprio, todas lendo a mesma view (`cache` do React, uma consulta por request).

1. **Hero:** ticker, nome do catálogo, badge FII ou Ação (`assetClassOf`), cotação atual e a variação do dia quando houver fechamento anterior. Sem cotação, mostra "Sem cotação".
2. **Mercado:** P/VP, DY 12m, último provento, segmento (FII) e a data dos dados. Mostra só o que estiver guardado no ativo. P/VP com mais de 60 dias aparece como ausente, a mesma regra do motor. Fica fora do escopo o que o app não coleta: liquidez diária e valor de mercado.
3. **Estratégia** (só para ativos na Carteira Alvo da classe): teto, margem até o teto, viés, rank, % sugerida contra a % atual na classe, Prioridade (a mesma `StrategyRow` do snapshot) e o triângulo de divergência do teto (`CeilingCheckIcon`), quando existir. Um link leva para `/carteira-alvo?classe=…` para editar. A edição não é feita nesta página.
4. **Minha posição** (só com quantidade acima de zero): quantidade, preço médio, investido, saldo, L/P em R$ e %, proventos recebidos, resultado "com proventos" e YOC 12m.
   - Uma posição encerrada mostra, no lugar, o resultado de `/encerradas`, com um link para lá.
5. **Abas** (`?aba=proventos|ordens|cotacao`, via `nuqs`, `proventos` como padrão):
   - **Proventos:** recebidos (B3) e a receber, com as mesmas regras e fontes de `/proventos`, filtrados pelo ticker.
   - **Ordens:** as entradas do ledger desse ticker, mais recentes primeiro, com o tipo (`kind`) e a origem. Só leitura: editar continua em `/transacoes`.
   - **Cotação:** gráfico de linha dos fechamentos mensais já guardados (`getMonthlyCloses`), com o preço médio como linha de referência quando houver posição. O plot é carregado via `next/dynamic` (`ssr: false`), com um `ChartPlaceholder`, como os outros gráficos. Sem histórico, mostra um estado vazio.

Um ativo sem posição, sem estratégia e sem histórico mostra o hero, o card de mercado e as abas vazias, cada uma com uma frase curta.

## Dados

- `getAssetOverview(ticker)` em `portfolio/server/asset-overview-view.ts`, exportada por `portfolio/server.ts` e envolvida em `cache`. Ela reaproveita, sem novas consultas próprias:
  - `getPortfolioSnapshot` (posição, `StrategyRow`, alocação);
  - `getDividendsView` (recebidos e a receber);
  - `getMyTransactions` (o ledger);
  - `getClosedPositionsView` (só quando a posição está encerrada);
  - `getAssetSnapshots` e `getMonthlyCloses` de `market-data/server` (mercado e histórico);
  - o catálogo (`searchTickers` ou a leitura do catálogo) para nome e tipo.
- Passa por `getTenant`, então já chama `connection()`.
- O DTO não carrega ids internos.
- A view abre o span `view.asset-overview`, com `koinos.view.asset_class` (`FII` ou `ACAO`) e contagens. O ticker é um campo permitido.
- **Puro** (`portfolio/domain/asset-overview.ts`, com teste ao lado):
  - `yieldOnCost12m(dividends, averagePrice, quantity, today)`: proventos recebidos nos 12 meses fechados até hoje ÷ (preço médio × quantidade). `null` sem posição ou com custo zero.
  - `dailyChange(price, previousClose)`: em R$ e %, `null` sem um dos dois.
  - A montagem do DTO da página a partir das entradas já filtradas.

## Links de entrada

- `positions-table` do Dashboard: o ticker vira `<Link href="/ativos/TICKER">`, mantendo o destaque de hover da linha.
- As ordens de `/recomendacoes` e as linhas da Carteira Alvo também ganham o link no ticker. Nos campos editáveis, o link fica só no texto do ticker.

## Erros

- Uma falha na leitura de mercado ou de histórico esconde só a seção afetada. A página não quebra, segue a regra do aviso de teto.
- Ticker inválido (fora de `[A-Z0-9]{4,12}`): `notFound()` antes de qualquer consulta.

## Testes

- `portfolio/domain/asset-overview.test.ts`: YOC (sem posição, custo zero, janela de 12 meses e um provento fora dela), variação do dia (sem fechamento anterior) e a montagem do DTO (posição aberta, encerrada, só estratégia, só catálogo).
- Verificação com `format:check`, `lint`, `typecheck`, `test` e `build`, e uma checagem manual no dev de um FII da carteira, uma ação, um ativo encerrado e um ticker fora da carteira.

## Fora do escopo

Busca de dados sob demanda, liquidez, valor de mercado, gráfico diário, edição de estratégia ou de transações na página e ranking de mais acessados.
