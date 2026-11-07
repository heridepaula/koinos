# Detalhes do ativo (`/ativos`)

Data: 2026-11-07. Decisão do dono: a página de um ativo fora da carteira mostra só o que o catálogo e o app já guardam (opção 1). Nada de busca sob demanda no Yahoo, Fundamentus ou brapi ao abrir a página.

**Redesign do mesmo dia** (pedido do dono: "análise de um UX especialista em Apple, iPhone e macOS", com o máximo de atratividade, simplicidade e eficácia). Esta spec já descreve a versão redesenhada; a primeira versão (abas `?aba=`, card de mercado, busca num popover) foi substituída. O que mudou e por quê está em "Análise e decisões", no fim.

## Objetivo

Uma página por ticker que junta, numa visão só, o que o app sabe do ativo (mercado), a decisão de aporte (Carteira Alvo) e a posição do dono (ordens, proventos, resultado). A pergunta da página: "como está este ativo, para mim, agora, e vale aportar?". A lista de `/ativos` leva até ela.

## Rotas e navegação

- `/ativos`: a tela de busca, como a do app Bolsa. O campo no topo e, embaixo, os ativos do dono: "Na carteira" (as posições abertas, da maior para a menor) e "Na Carteira Alvo, sem posição" (na ordem do ranking), FIIs e ações juntos.
- `/ativos/[ticker]`: o ticker é normalizado para maiúsculas. Fora de `[A-Z0-9]{4,12}`, ou fora do catálogo e do ledger, dá `notFound()`. O ledger entra na checagem porque um FII deslistado (MALL11, IRDM11) pode ter saído do catálogo e ainda ter histórico.
  - O título da aba do navegador é o ticker (`generateMetadata`: "HGLG11 · Koinos").
  - `generateStaticParams` devolve um ticker de exemplo (HGLG11): sem um parâmetro conhecido, o `usePathname` do menu (no layout) não resolve no prerender e o build falha. O exemplo só gera o shell; os outros tickers renderizam sob demanda.
- `proxy.ts`: o matcher tem `"/ativos/:path*"`.
- `nav-items.ts`: "Ativos" (ícone `ChartLineIcon`, tile índigo) depois de "Dashboard", sem `tab`. No iPhone, fica na folha "Mais".
- **Voltar no iPhone:** `parentOf` também reconhece as páginas de detalhe fora do menu (`/ativos/HGLG11` → Ativos), então a barra do iPhone mostra o botão voltar. Ele faz `router.back()` quando se chegou navegando pelo app (como no iOS: volta à tela anterior, com a rolagem); aberto de fora ou depois de recarregar, vai para a página-mãe. O rastreio fica em `shared/lib/in-app-navigation.ts`, registrado pela `MobileNavBar`.
- **Título compacto das barras:** `usePageTitleUnderBar` espera o `h1[data-page-title]` chegar por streaming (um `MutationObserver` até ele aparecer), porque o título do ativo vem dentro do `<Suspense>`.
- **Busca no iPhone:** o botão redondo ao lado da tab bar é a lupa (`useTabBarAction`). Na página do ativo, ele abre `/ativos`; em `/ativos`, põe o cursor no campo.

## A lista e a busca (`AssetFinder`)

- O termo fica na URL (`?q=`, nuqs, `history: "replace"`): voltar de um ativo devolve a busca como estava.
- Ao digitar, a lista vira o resultado. Primeiro "Seus ativos": os do dono que batem com o termo, filtrados na hora, sem rede, com o ticker que começa com o termo na frente. Um ativo do dono que só o catálogo achou (pelo nome) entra nesse grupo, com a cotação. Depois, "Catálogo da B3": `useTickerSearch` (`market-data/ui`) consulta `/api/tickers` 300 ms depois da última tecla, a partir de 2 letras. A rota devolve `{ ticker, name, subType, logoUrl }`.
- Cada linha, como no app Bolsa: o logo, o ticker e o nome; o minigráfico (`Sparkline`) dos fechamentos diários recentes terminando no preço atual, em cinza, porque é de outro período que a variação do dia; e o preço com a variação do dia numa cápsula (`DeltaChip`). Sem dados, um traço. Um resultado do catálogo mostra só "FII" ou "Ação": não há cotação guardada.
- Uma coluna no iPhone, duas a partir de 720 px de conteúdo e três a partir de 1.180 px.
- Teclado (mesa): o campo abre focado (só com ponteiro fino; no iPhone, o teclado cobriria a lista); a seta para baixo desce para a lista; as setas andam entre as linhas; Enter no campo abre o primeiro resultado. Uma região `aria-live` diz quantos ativos foram achados.
- Estados: lista vazia (carteira e Carteira Alvo vazias), "Digite mais uma letra…", "Buscando no catálogo da B3…" e "Nenhum ativo encontrado para …". Sem "mais acessados" nem "maiores altas e baixas": o app não tem esses dados.
- Dados: `getAssetWatchlist()` (`portfolio/server/asset-watchlist-view.ts`, span `view.asset-watchlist`), do snapshot (posições), de `getMyTargetAssets` (estratégia) e de `getAssetSnapshots` (cotação e minigráfico).

## Página do ticker

Cabeçalho e conteúdo chegam juntos, por streaming, no lugar de um esqueleto com a mesma geometria (`AssetPageSkeleton`): o título é o ticker, que só se sabe na requisição.

1. **Cabeçalho** (`AssetHeader`): o logo (48 px no iPhone, 56 na mesa, cantos de ícone), o ticker como título grande (`h1[data-page-title]`), o nome e "FII · Logística" ou "Ação". Na mesa, "Buscar ativo" à direita.
2. **Cotação** (`AssetHero`), o maior bloco da página:
   - o preço em Large Title, a variação do dia em cápsula ("+0,82% hoje") e "Cotação de 07/11/2026, 11:32";
   - o gráfico (`PriceChart`): períodos 1M (fechamentos diários), 6M, 1A, 5A e Tudo (mensais), só os que têm o que mostrar (`pricePeriods`), abrindo em 1A quando há (`?periodo=`); a linha é verde quando o período subiu e vermelha quando caiu, como no app Bolsa, com a variação escrita ao lado ("+4,19% desde nov. de 25"), em segmentos retos e com um esmaecido da mesma cor; o eixo usa passos redondos (`niceScale`); o preço médio da posição é uma linha tracejada, com a legenda "Seu preço médio"; perto da faixa do período (até 15% fora), o eixo se abre para ele, com meio passo de folga; longe, a legenda diz "(abaixo do gráfico)" ou "(acima do gráfico)";
   - sem histórico guardado (um ativo só do catálogo), uma frase no lugar do gráfico;
   - embaixo, os números de mercado: DY 12 meses, proventos em 12 meses por cota (ou por ação), último provento com a data ex e P/VP. Uma ação não mostra P/VP: a usebolsai só cobre FIIs.
3. **Minha posição** (`PositionCard`, só com posição aberta): o valor de hoje em destaque; resultado (R$ e %), quantidade, preço médio, investido, proventos recebidos, resultado com proventos e yield on cost de 12 meses. Uma posição zerada mostra, no lugar, o resultado (vendas + proventos), o dia em que zerou e o atalho para `/encerradas`.
4. **Aporte** (`AporteCard`, só para ativos na Carteira Alvo da classe): a resposta em destaque, com um ponto de cor:
   - "3º na fila" (verde), o motivo de ficar fora (`EXCLUSION_LABELS`; vermelho só para "Acima do teto") ou "Fora da estratégia";
   - embaixo, a explicação (`reasonHelp`, a mesma ajuda de "Fora deste aporte" em Recomendações);
   - a barra do preço contra o teto: cheia até o preço, verde abaixo do teto e vermelha (cheia) acima, com "Margem de 7,3%" (ou "R$ 0,42 acima do teto") e o teto, com o triângulo de divergência quando houver;
   - ranking, viés e peso na estratégia ("4,8% de 5,0%");
   - e o atalho para a Carteira Alvo. A edição continua lá.
5. **Proventos** (`DividendsCard`, só quando há recebidos ou a receber):
   - "A receber" em destaque, numa faixa tingida: a data de pagamento, o tipo e a fonte (B3, anunciado ou estimado, as mesmas de `/proventos`), o valor e o por cota;
   - os 12 meses fechados: o total e a média por mês e as barras (`DividendBars`, colunas de no máximo 24 px, meses em "nov/25", com a média tracejada);
   - os 5 recebidos mais recentes e "Mostrar mais N" (`Disclosure`).
6. **Ordens** (`OrdersCard`, só com lançamentos): as 5 mais recentes ("Compra · Subscrição", a data, o total e "20 × R$ 151,30"), "Mostrar mais N" e "Ver em Transações" (`/transacoes?ativo=TICKER`). Só leitura.

**A grade** (`AssetDetail`, pela largura do conteúdo, `@container`):

- até 720 px, uma coluna, na ordem de leitura: cotação, posição, aporte, proventos e ordens;
- de 720 a 1.000 px, posição e aporte lado a lado (só com os dois; um card sozinho ocupa a largura);
- a partir de 1.000 px, como o inspetor do macOS: a coluna principal (cotação, proventos, ordens) e uma coluna de 360 px à direita com a posição e o aporte. Ela ocupa as três linhas da grade sem esticar as da esquerda e, em telas de 880 px de altura ou mais, acompanha a rolagem (`sticky`). Em telas mais baixas fica parada, senão a parte de baixo ficaria fora de alcance.

Listas no lugar de tabelas, em todas as larguras: data e tipo à esquerda, valor à direita, com a segunda linha em cinza. Os atalhos no pé dos cards (`CardLink`) são células do iOS: texto na cor do texto (o azul do link fica abaixo de 4,5:1 sobre o card) e chevron cinza, 44 px.

## Dados

- `getAssetOverview(ticker)` em `portfolio/server/asset-overview-view.ts`, exportada por `portfolio/server.ts` e envolvida em `cache`. Reaproveita o snapshot (posição, encerrada e a `StrategyRow` da classe do ativo, porque em "TODOS" só vêm as dos FIIs), `getDividendsView` (a receber), o ledger, os proventos recebidos, `getAssetSnapshots` e `getMonthlyCloses` (mercado e cotação) e o catálogo (`getCatalogEntry`, nome e logo).
- O DTO não carrega ids internos. Traz `pricePeriods` e `dividendMonths` já calculados.
- O span `view.asset-overview` leva `koinos.view.class_filter` e contagens.
- **Puro** (`portfolio/domain/asset-overview.ts`, testado):
  - `yieldOnCost12m` e `dividendMonths` usam a mesma janela de `dividendPace` (os 12 meses fechados antes do mês atual em São Paulo): as barras somam o mesmo que o card de proventos do dashboard, e o YOC fala do mesmo período;
  - `priceSeries` monta as séries diária e mensal terminando no preço atual, na data da cotação (no fim de semana, a de sexta). Uma cotação mais velha que o último fechamento não mexe na série;
  - `pricePeriods` e `defaultPricePeriod` escolhem os períodos e o de abertura;
  - `dailyChange` dá a variação do dia a partir do `changePercent` guardado.
- `shared/lib/nice-scale.ts` (o eixo redondo) e `shared/lib/sparkline.ts` (o caminho do minigráfico) são puros e testados.
- **1M de verdade:** `RECENT_CLOSES_DAYS` passou de 21 para 31 dias. A semana do card de variação continua igual e ganha folga.

## Erros e estados

- Ticker inválido: `notFound()` antes de qualquer consulta.
- Valor ausente é um traço em cinza; zero é zero.
- Cada card some quando não tem o que mostrar (sem posição, sem estratégia, sem proventos, sem ordens). Um ativo só do catálogo mostra o cabeçalho e a cotação, com a frase sobre o histórico.

## Testes

- `portfolio/domain/asset-overview.test.ts`: YOC (janela, sem posição, custo zero), `dividendMonths` (os 12 meses, dois pagamentos num mês, a soma igual à de `dividendPace`), `dailyChange`, `priceSeries` (ordem, troca e acréscimo pelo preço atual, cotação velha, sem dados) e `pricePeriods`/`defaultPricePeriod` (quais aparecem, recortes, variação, abertura).
- `shared/lib/nice-scale.test.ts` e `shared/lib/sparkline.test.ts`.
- Verificação: `format:check`, `lint`, `typecheck`, `test` e `build`, mais capturas a 1.180 × 900 e a 390 × 844 (iPhone), nos temas claro e escuro, com dados de exemplo: FII com posição e estratégia, ação só na Carteira Alvo e a lista.

## Fora do escopo

Busca de dados sob demanda, liquidez, valor de mercado, gráfico intradiário, edição de estratégia ou de transações na página e ranking de mais acessados.

## Análise e decisões (o redesign)

A primeira versão funcionava, mas falhava em pontos que um usuário de iPhone e Mac sente na hora:

- **O título não dizia nada.** "Ativo" em letras grandes, com o ticker pequeno no meio da página e "Ativo" também no título compacto ao rolar. Agora o ticker é o título, como no app Bolsa.
- **A busca disputava o lugar do preço.** Ela ficava no hero, ao lado da cotação, e no iPhone ocupava uma linha inteira acima de tudo. Busca é navegação: virou a lupa da barra (iPhone) e um botão na barra da página (mesa).
- **O gráfico, a parte mais viva, estava escondido** na terceira aba. Abas escondem conteúdo e quase ninguém as abre. Agora o gráfico fica logo abaixo do preço, com os períodos do app Bolsa, e Proventos e Ordens viraram seções da página.
- **Faltava a resposta.** O card de estratégia listava números, mas não respondia "posso comprar mais?". O card de Aporte responde em uma linha, com a cor certa, a explicação e a barra do preço contra o teto.
- **Cards sem hierarquia.** O valor do card de mercado repetia o DY da primeira linha, e o "valor" do de estratégia era o rank. Agora cada card destaca o número que responde a sua pergunta.
- **Tabelas no iPhone.** Cinco e seis colunas rolavam de lado. Viraram listas de duas linhas, em todas as larguras.
- **O índice era uma página vazia**, com um campo no meio, e digitar é a entrada mais lenta no iPhone. Agora os ativos do dono já aparecem, a um toque, e a busca filtra na hora.
- **Sem voltar no iPhone.** A página de detalhe não tinha botão voltar na barra. Agora tem, e volta para a tela anterior, como no iOS.
