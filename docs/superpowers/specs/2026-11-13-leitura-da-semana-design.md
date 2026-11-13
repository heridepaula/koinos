# Leitura da semana: notícias do Bing, preço em 7 dias, lentes do conselho e termômetro

Data: 2026-11-13. Pedido do dono na mesma data, com o TRXF11 de exemplo: "está com um cenário positivo, porém ele caiu bastante essa semana. Precisamos refinar os prompts para que o Gemini classifique corretamente; talvez devemos buscar notícias da semana para complementar as demais, trazendo o cenário correto atual." Depois: o prompt deve parecer a skill `conselho-investidores`; "as notícias estão chamando mais a atenção do que o resumo"; e o card deve mostrar "o calor do ativo naquele momento, como medo extremo, medo, euforia".

Este spec altera o resumo da semana da Carteira Alvo (plano `2026-11-13-resumo-semana-carteira-alvo.md`) e o modo semana do resumo do dia (plano `2026-11-13-resumo-dia-sem-noticia-antiga.md`). Adianta parte da Camada 3 (triagem por ativo) do spec `2026-11-13-noticias-e-cenario-design.md`, dentro do resumo da semana. O que não estiver aqui continua como lá.

## Diagnóstico (produção, 2026-11-13, leitura)

- **Preço:** o TRXF11 foi de R$ 63,50 (06/11) para R$ 55,41 (13/11), −12,7% em 7 dias e −19,7% desde 27/10; no dia, +1,86%.
- **O card:** "O que aconteceu nesta semana" mostrava o chip e a linha do mercado do dia ("acompanhando o mercado"); daí o "cenário positivo".
- **O que o Gemini recebeu:** uma notícia, a manchete do "Bom Dia FIIs" (lista com quatro FIIs), cujo resumo nem cita o TRXF11. Nenhum dado de preço. O texto: "nada mudou na prática, pois a menção serviu apenas para acompanhar o movimento geral".
- **O que existia:** o Bing Notícias tinha 11 notícias da semana com a causa. O resultado recorrente de outubro foi de R$ 0,63 por cota, abaixo dos R$ 0,93 pagos, e a reserva de dividendos caiu 89%. O fundo anunciou recompra de cotas. A gestora diz que o efeito é temporário (13ª emissão) e mantém R$ 0,93 até dezembro.
- **Por que faltou:** o coletor começou em 13/11 e os feeds trazem só os 10 últimos itens. O `news_items` tinha 142 itens, 12 da fiis.com.br e da Suno. O resumo da semana não usava o Bing.
- **O prompt:** "Diga o que mudou para quem tem o ativo" obrigava uma frase de impacto. Os 16 textos tinham "Para quem tem o ativo…" e 6 afirmavam "nada mudou". Listas, simulações ("Quanto investir em HGLG11 para receber R$ 1.000"), rankings e comparativos entravam como notícia e apareciam como fonte. Não havia saída para "não há notícia do ativo", nem classificação validável.
- **Bug:** no resumo do dia, toda notícia do Bing tinha a página lida (`readPage: true`), inclusive as da Suno, cujo `robots.txt` bloqueia robôs de IA.

## Princípios mantidos

- Nenhum dado da carteira vai para a IA. Teto, rank, quantidade, preço médio, peso e meta são do dono. O P/VP também fica de fora do prompt, para o texto não virar "está barato".
- O código decide o sentido dos números: a variação em 7 dias, a leitura contra o índice e o termômetro são do código. A IA classifica as notícias com listas fechadas e escreve. A saída é validada.
- Tudo em segundo plano; a tela só lê. Nenhuma chamada à B3. Fonte citada na tela.
- Não recomenda comprar, vender ou manter.

## 1. Notícias da semana: o Bing por ativo da Carteira Alvo

- **Fonte nova** `BING_SOURCE` (`id: "bing"`, tópico `ativo`) no coletor do `/api/cron/news`. Para cada ticker da Carteira Alvo, a busca do Bing Notícias pelo ticker roda no rodízio dos feeds: a cada 6 h por ticker, até 4 por chamada, as mais antigas primeiro.
  - O rodízio é `feedsDue`, que generaliza `companyFeedsDue` com `everyHours` e `perCall`.
  - O estado fica em `news_feeds`, com `_id` igual à URL da busca.
- **O item do Bing** (`newsItemFromBing`, puro):
  - a URL é a do portal (parâmetro `url=`) e o portal vem de `News:Source`;
  - o resumo é o `<description>`, limpo por `cleanDescription`. `parseBingNews` passa a ler esse campo, que antes era descartado;
  - vale a mesma idade dos feeds (14 dias, 1 h no futuro);
  - os tickers vêm de `matchTickers` no título e no resumo, e o ticker buscado precisa estar entre eles. Senão o item é descartado, por ser um resultado sem relação.
- **Ler a página ou não:** `canReadPage(url)` é falso para os hosts das fontes com `readPage: false` (a Suno, com subdomínios) e verdadeiro para os demais. Vale para o item do Bing guardado e para `mergeSessionNews`, o que corrige o bug acima.
- **Custo:** ~37 tickers a cada 6 h, das 07:00 às 22:30, dá ~100 buscas por dia, gratuitas.

## 2. Preço em 7 dias (código, `domain/week-move.ts`)

- **A série:** `closesWithQuote(closes, quote)` é a lista de fechamentos diários (`recentCloses`, data de negócio à meia-noite UTC) anteriores ao pregão da cotação, mais o preço atual no pregão da cotação (`quoteSessionDate`).
- **A variação:** `changeOverDays(series, days)` é o último ponto ÷ o último fechamento até a data do último ponto − 7 dias, − 1. Sem esse fechamento, null. A janela é a mesma das notícias, 7 dias corridos. No sábado, a referência é a sexta anterior.
- **O índice:** `market_indices` passa a guardar `closes` (até 40 pregões, `nextIndexCloses`, puro): a cada leitura, o preço do índice vira o fechamento do seu pregão.
  - O Yahoo não tem histórico do `IFIX.SA`, só o preço do dia, então a comparação da semana aparece quando houver um pregão de 7 dias atrás guardado.
  - Até lá, só o ativo.
- **A faixa** (`moveBucket`): `queda-forte`, `queda`, `estavel`, `alta` ou `alta-forte`.

  | Classe | Estável abaixo de | Forte a partir de |
  |---|---|---|
  | FII | 1,5% | 5% |
  | Ação | 2,5% | 8% |

- **A leitura contra o índice:** `marketReading` ganha o piso como parâmetro (1 p.p. no dia, 2 p.p. na semana).
- **A chave do movimento:** `weekMoveKey` = faixa + leitura (`acompanhou`, `descolou` ou `sem-indice`). O texto da IA não leva números de preço, então só é refeito quando a faixa ou a leitura mudam.
- **Texto do código** (`weekMoveText`):
  - com índice: "Em 7 dias, o IFIX caiu 1,40% e o TRXF11 caiu 12,70%, bem diferente do mercado.";
  - sem índice: "Em 7 dias, o TRXF11 caiu 12,70%.".

## 3. Termômetro: medo extremo a euforia (código, `domain/asset-heat.ts`)

Um índice de 0 a 100, só para o ativo, calculado na leitura (preço de agora). É uma média ponderada dos componentes que existirem; com menos de dois componentes de preço, não aparece.

| Componente | Peso | Nota de 0 a 100 |
|---|---|---|
| `semana`: variação em 7 dias menos a do índice (sem índice, a do ativo) | 0,30 | 50 + 50 × r ÷ faixa, limitada a 0–100; faixa de 6% (FII) ou 10% (ação) |
| `ifr`: Índice de Força Relativa de 14 pregões (Wilder), com pelo menos 15 pontos | 0,30 | o próprio IFR |
| `media`: preço ÷ média dos últimos 20 pontos − 1 (pelo menos 10 pontos) | 0,25 | 50 + 50 × d ÷ faixa, limitada; faixa de 6% (FII) ou 10% (ação) |
| `noticias`: o sentido da semana dado pela leitura da IA | 0,15 | favorável 80, misto ou neutro 50, desfavorável 20; sem fato fica de fora |

**Níveis:**

| Nota | Nível |
|---|---|
| abaixo de 20 | Medo extremo |
| abaixo de 40 | Medo |
| até 60 | Neutro |
| até 80 | Otimismo |
| acima de 80 | Euforia |

Cada componente traz a sua explicação em texto, que a tela mostra em "Como medimos". O termômetro é um retrato do momento, não um sinal: a tela diz que não é recomendação.

## 4. O prompt da leitura (`buildWeekSummaryPrompt`, versão 2)

Segue a ordem da skill `conselho-investidores`: o objeto, os fatos (a verificação técnica), a triagem, as lentes, a síntese e o veredito.

- **Os dados:** ficam entre `<dados>` e `</dados>`, marcados como material, não instrução.
- **OBJETO:** o ticker, a descrição pública (`describeAsset`), o período (dd/mm a dd/mm), o dia de hoje e a pergunta da semana.
- **FATOS DO PAINEL** (P1, P2), descritos como "valem mais que as notícias":
  - a faixa do preço em 7 dias e a do índice, sem números;
  - o último provento e a tendência dos proventos em 12 meses (`dividendTrend` do Radar: subindo, estáveis, caindo).
- **NOTÍCIAS** (N1…N10): as de `selectWeekNews` (agora até 10), com data, portal, título e resumo.
- **Passo 1, triagem.** Cada notícia ganha:
  - `sobre`: ativo, lista, mercado ou outro;
  - `natureza`: fato, gestão, analista ou manchete (o "Confirmado × Provável" da skill);
  - `tipo`;
  - `sentido` para quem já tem o ativo: favorável, desfavorável, neutro ou misto;
  - `relevancia`: alta, média ou baixa;
  - `fato`: até 20 palavras, sem os adjetivos da manchete.

  A lista "parece ruim, mas é normal" cobre a cota que cai depois da data com, a citação em lista e o mesmo rendimento repetido.
- **Passo 2, lentes:** cada uma com princípio e perguntas tiradas de `references/personas.md`, ou "sem_fato".
  - **FII:**
    - renda (Baroni): renda mensal previsível; resultado × distribuição, reserva, previsão;
    - imóveis e crédito (Baroni);
    - risco (Buffett): dívidas, obras e aquisições a pagar, gestão, justiça;
    - fundamento ou ruído (Tiago Reis): julgar a semana, não o dia.
  - **Ação:**
    - dividendos (Barsi);
    - negócio (Buffett);
    - risco (Buffett);
    - fundamento ou ruído (Tiago Reis); rebaixamento e preço-alvo de corretora são opinião.
- **Passo 3, síntese:** `explica_movimento` (sim, parcial ou não) e `sentido_da_semana`. Lentes em direções opostas dão "misto".
- **Passo 4, texto:** até 3 frases. A primeira é o veredito. Cada frase cita os ids que a sustentam.
  - **Quando as notícias não explicam:** se `explica_movimento` for "nao", o texto diz que as notícias não explicam o movimento.
  - **Proibido:**
    - frase que serviria para qualquer ativo ("nada mudou", "isso significa que");
    - números que não estejam nas notícias e variação de preço;
    - nomes de investidores;
    - recomendação.
- **Saída:** JSON pelo `responseJsonSchema` com `responseMimeType: application/json` (confirmado na documentação do Gemini em 2026-11-13; a ordem das chaves do esquema é a ordem da resposta). A ordem itens → lentes → síntese → frases faz o modelo classificar antes de escrever. Temperatura 0,2 e `maxOutputTokens` 2048.

## 5. Validação (`parseWeekReading`, puro)

A resposta inteira é recusada (falha) com:
- `finishReason` diferente de `STOP`;
- JSON inválido;
- uma frase sem evidência válida, isto é, sem um item "ativo" nem um fato do painel;
- uma frase com número que não está na entrada;
- uma frase com "nada mudou", "isso significa", nome de investidor ou recomendação ("recomend…", "hora de comprar", "vale a pena", "oportunidade de compra", "bom momento para");
- mais de 3 frases, frase sem pontuação final, ou mais de 600 caracteres.

**O que é descartado sem recusar a resposta:**
- um item com id fora da lista, repetido ou com categoria inválida;
- uma lente fora da classe, repetida, sem evidência ou que quebra as regras do texto. Essa lente vira "sem_fato" e não aparece.

**Sem nenhuma notícia sobre o ativo:**
- a leitura vale, com texto null, sem fontes, sem lentes e sentido "sem_fato";
- o card diz "Nenhuma notícia específica do ativo nesta semana.";
- o modelo não decide esse texto.

**O que o card mostra:**
- **Fontes:** só os itens "ativo", por relevância e depois do mais novo, até 5, cada um com o seu sentido.
- **Referências das lentes:** apontam para essas fontes.
- **Movimento sem explicação:** com `explica_movimento` "nao" e faixa forte, se o texto não disser que as notícias não explicam, o código acrescenta "As notícias encontradas não explicam o movimento."

## 6. Quando refazer (`needsWeekSummary`)

As regras de antes continuam: chave das notícias, falha, 47 h e 6 h entre tentativas. São acrescentadas:

- **Versão:** um resumo `ok` ou `failed` de versão anterior é refeito com a última tentativa há 60 min ou mais (`upgradeRetryMinutes`). O `no-news` sem notícias não muda.
- **Movimento:** um `ok` cuja `moveKey` mudou é refeito, respeitando as 6 h.

O documento `Asset.weekSummary` ganha `version`, `moveKey`, `tone`, `explainsMove`, `lenses` e o `tone` de cada fonte.

## 7. Modo semana do resumo do dia

- Continua reaproveitando o `weekSummary` `ok` com texto e a mesma chave (`selectWeekNews`, agora até 10 nos dois).
- Sem ele, chama a mesma leitura (`generateWeekReading`, `server/week-reading.ts`, compartilhada) e guarda o texto e as fontes.
- Sem notícia sobre o ativo, grava `no-news`.
- `buildWeekPrompt` sai.

## 8. Tela

Pedido: o resumo é o que mais chama a atenção; as notícias ficam em segundo plano.

`AssetOverview.pulse` (`getAssetPulse`) traz o movimento em 7 dias e o termômetro de qualquer ativo com fechamentos, e os dois cards o usam.

**Ordem do card "O que aconteceu nesta semana":**
1. **Título e atualização.** O chip passa a ser a variação em 7 dias ("em 7 dias"), não a do dia.
2. **Termômetro** (`AssetHeatMeter`, `role="meter"`):
   - o nível em Headline com a cor fria ou quente: azul de informação para medo, cinza para neutro, âmbar para otimismo e euforia;
   - a nota "de 100";
   - a barra em degradê frio→quente com o marcador e as pontas "Medo extremo" e "Euforia";
   - "Como medimos" recolhido, com a explicação de cada componente.
3. **O veredito:** a primeira frase em Headline e o resto em texto normal, com `GlossaryText`.
4. **A linha do mercado da semana:** Subheadline, só com índice.
5. **"Pelas lentes do conselho"** recolhido: cada lente com o rótulo, o investidor que a inspira, o sentido em cápsula e a observação. Uma linha avisa: "Lentes inspiradas no que cada investidor defende publicamente; não são falas deles."
6. **"Fontes (N)"** recolhido: lista compacta em Footnote, sem fundo, com o portal, a data e o sentido.
7. **A nota da IA.**

**`DayInsightCard`:**
- ganha o termômetro;
- as fontes também ficam recolhidas e compactas, porque `NewsSources` é compartilhado;
- o texto continua com o efeito de digitação.

## 9. Testes (puros)

- `news.test.ts`: `canReadPage`, `newsItemFromBing` (ticker exigido, idade, host, portal) e `feedsDue`.
- `day-insight.test.ts`: o resumo em `parseBingNews`, `mergeSessionNews` sem ler a Suno vinda do Bing e o piso de `marketReading`. Saem os testes de `buildWeekPrompt`.
- `week-move.test.ts`: a série com a cotação, a referência de 7 dias (sexta anterior, sem referência), as faixas nas bordas por classe, a leitura com piso de 2 p.p., o texto com e sem índice e a chave.
- `asset-heat.test.ts`:
  - o IFR em séries que só sobem, só caem e alternam;
  - a média de 20 pontos e o mínimo de 10;
  - a semana com e sem índice e o sentido das notícias;
  - os pesos sem um componente e null com menos de dois de preço;
  - as bordas dos níveis;
  - o caso TRXF11 em medo extremo.
- `week-summary.test.ts`:
  - o prompt: blocos, ids, lentes por classe, sem número de preço, sem dado da carteira;
  - o esquema por classe;
  - cada recusa e cada descarte de `parseWeekReading`;
  - a leitura sem notícia do ativo;
  - a ordem e o limite das fontes;
  - a frase acrescentada;
  - `needsWeekSummary` com versão e `moveKey`.
- `market-indices.test.ts`: `nextIndexCloses` (acrescenta, troca o mesmo pregão, ordena, corta em 40).

## Fora do escopo

- O Radar (Camada 5) e o cenário (Camada 4). A triagem fica guardada no resumo da semana; um uso no Radar depois vale outro spec.
- Ler páginas na leitura da semana (só título e resumo).
- Histórico do IFIX de outra fonte.
- Alertas ou notas de notícia.

## Ordem de entrega

1. Notícias: `canReadPage`, Bing com resumo, `newsItemFromBing`, `feedsDue`, coletor e rota.
2. Fechamentos do índice: `nextIndexCloses` e o serviço.
3. `week-move.ts` e `asset-heat.ts`.
4. `week-summary.ts` v2, o adaptador do Gemini com JSON, `week-reading.ts`, o serviço da semana e o modo semana do resumo do dia.
5. Leitura (`getWeekSummary`, `getAssetPulse`, `AssetOverview.pulse`) e tela.
6. CLAUDE.md, `format:check`, `lint`, `typecheck`, `test` e `build`. Por fim, uma leitura real do TRXF11 com o Gemini por script descartável, sem gravar.
