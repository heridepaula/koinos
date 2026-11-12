# Resumo da IA para variações fortes do dia

Data: 2026-11-12. Decisões do dono na mesma data.

Quando um ativo varia muito no dia, a página `/ativos/[ticker]` mostra um parágrafo em linguagem simples explicando o que as notícias do dia dizem sobre o movimento. O texto é gerado pelo Gemini (free tier da Gemini Developer API, chave do Google AI Studio) a partir de notícias públicas.

## O que não muda

- `/ativos` e `/ativos/[ticker]` continuam só lendo o que o app guarda: a página nunca busca notícias nem chama o Gemini. O resumo é gerado em segundo plano e salvo no ativo.
- Nenhum dado da carteira sai do app: o Gemini recebe só dados públicos (ticker, classe, variação do dia e o texto das notícias). O free tier pode usar os prompts para treinar modelos, então essa regra não tem exceção.
- Sem `GEMINI_API_KEY`, a feature fica desligada e nada muda.
- Nenhuma chamada à B3.

## Gatilho (`market-data/domain/day-insight.ts`, pura)

- Constantes `DAY_INSIGHT`: FII com |`changePercent`| ≥ 0,02, ação com |`changePercent`| ≥ 0,03 (`changePercent` é fração). O limite exato dispara.
- Entram só as posições abertas e os ativos da Carteira Alvo (FIIs e ações) da carteira.
- A variação é a da sessão da cotação (`quoteSessionDate`). Fim de semana não gera nada novo.

## Notícias

- Busca: Bing Notícias RSS, `https://www.bing.com/news/search?q=<TICKER>&format=rss&setlang=pt-BR&cc=BR`, User-Agent `Koinos/1.0` (nunca de navegador). O Google Notícias foi descartado: o link de cada notícia só abre por JavaScript e decodificá-lo exige um endpoint interno do Google. O Yahoo `search()` trouxe 0 notícias para HGLG11, MXRF11, PETR4, VALE3 e UNIP6 no teste de 2026-11-12.
- `parseBingNews` (pura) lê título, portal, `pubDate` e a URL real (o parâmetro `url=` do link `apiclick.aspx`). Itens sem URL válida (`http`/`https`) ficam de fora.
- Ordem por data de publicação, a mais recente primeiro. O app baixa as páginas nessa ordem até conseguir 3; uma página que falha (rede, status diferente de 200, sem texto extraído) é pulada e entra a próxima. No teste, as duas notícias do opetroleo.com.br falharam e a do fiis.com.br respondeu.
- Extração do texto: `@mozilla/readability` sobre `linkedom`, cortado em 4.000 caracteres por notícia (`DAY_INSIGHT.articleChars`). Timeout de 8 s por página.
- "Notícia do dia": publicada, no horário de São Paulo, no dia da sessão.

## Prompt e Gemini

- API REST (`adapters/gemini.ts`, chave no header `X-goog-api-key`), sem SDK: uma chamada só, já vista no APM pela instrumentação do `fetch`.
- **Cadeia de modelos** (`GEMINI_MODELS`, pedido do dono na mesma data: o mais barato que atende primeiro, os caros guardados para outros usos). A cota gratuita é por modelo, então cada um tem o seu contador. Ordem: `gemini-3.5-flash-lite` (450/dia), `gemini-3.1-flash-lite` (450), e de reserva, com teto 5/dia cada, `gemini-3-flash-preview`, `gemini-3.6-flash`, `gemini-3.7-flash`, `gemini-3.8-flash`.
  - Teste de 2026-11-12 com o prompt real: os Lite fizeram resumos corretos em 1 a 2 s, sem raciocínio; o 3.6 Flash, de qualidade parecida, levou 8 s e 1.305 tokens de raciocínio. Os 2.5 respondem 404 para contas novas e os omni têm cota 0; os apelidos `*-latest` ficam de fora porque dividem a cota de um destes.
  - 429 esgota o modelo no dia (o contador vai ao teto) e a chamada passa ao próximo; 503, 500, 404, timeout ou resposta vazia só passam ao próximo.
- `buildInsightPrompt` (pura) monta o texto em pt-BR com: ticker, "fundo imobiliário" ou "ação", a variação com sinal e as notícias (título, portal, data e texto). Instruções:
  - escrever para quem não entende de mercado, em até 4 frases, sem jargão (ou explicando o termo quando for inevitável);
  - dizer o fato que explica o movimento, se as notícias trouxerem um;
  - se não trouxerem, dizer que as notícias não explicam o movimento e que ele pode refletir o humor do mercado, sem inventar causas;
  - não recomendar comprar, vender ou manter.
- Sem nenhuma notícia baixada, o Gemini não é chamado: o app salva o resumo sem texto (`text: null`), e a tela mostra "Nenhuma notícia recente explica o movimento de hoje."
- Uma falha do Gemini (rede, 429, resposta vazia) não salva nada e conta como tentativa: a próxima segue a regra de horários abaixo.

## Quando gera e atualiza (horário de São Paulo, dias úteis)

`nextInsightAttempt(insight, now)` (pura) decide se o ativo deve ser processado agora:

- Sem resumo da sessão atual: gera assim que o ativo passa do gatilho, com as notícias que houver.
- O resumo marca `sameDay`: alguma das fontes usadas é notícia do dia.
- Sem notícia do dia, até 12:00: nova tentativa 30 min depois da última (`DAY_INSIGHT.retryMinutes`).
- Das 12:00 às 18:00: nenhuma nova tentativa.
- Das 18:00 às 20:00: volta a tentar a cada 30 min.
- Com notícia do dia, ou a partir das 20:00: o resumo é definitivo.
- Um ativo que passa do gatilho entre 12:00 e 18:00 gera na hora e, sem notícia do dia, só tenta de novo a partir das 18:00.

Cada tentativa busca no Bing (grátis). O Gemini só é chamado de novo quando aparece uma notícia do dia que não está entre as fontes salvas; senão, a tentativa só atualiza `attemptedAt`.

## Cota

- Contador `gemini:<modelo>:AAAA-MM-DD` por modelo em `market-data/server/usage.ts`, no dia do Pacífico (a cota do Gemini zera à meia-noite de lá). As cotas são relatos de desenvolvedores, com folga, não números oficiais. Com todos os modelos no teto, nada mais chama o Gemini até o dia seguinte; as buscas no Bing também param, para não marcar tentativas inúteis.
- Prioridade: as posições abertas por valor, depois os ativos da Carteira Alvo sem posição, por rank.
- O contador entra no span `api.usage`.

## Dados

No documento do ativo (dado de mercado, sem `portfolioId`):

```
dayInsight: {
  session: Date,          // quoteSessionDate da cotação usada
  changePercent: number,
  status: "ok" | "no-news" | "failed", // "failed" não aparece na tela
  text: string | null,
  sameDay: boolean,
  sources: { title, publisher, url, publishedAt }[],
  model: string | null,
  generatedAt: Date | null,
  attemptedAt: Date,
}
```

Um resumo de outra sessão é ignorado na leitura e sobrescrito na próxima geração.

## Execução

- `market-data/server/day-insight-service.ts`: `refreshDayInsights(tickers, { maxAssets })`, dentro de `withLock("day-insights", 60_000)` (lock tomado: status `busy`, não erro). Processa no máximo `maxAssets` ativos por chamada.
- Chamado por:
  - `refreshMyQuotesAction`, depois das cotações, sem bloquear a resposta, como os proventos;
  - a rota nova `/api/cron/day-insights` (mesmo `cron-auth`, Bearer ou Basic), chamada pelo cron-job.org a cada 30 min, das 10:00 às 20:00, em dias úteis. `maxAssets: 3`, para caber nos 30 s do cron-job.org. O dono cria o job; `docs/operations/cron-job-org.md` ganha a seção.
- A rota não entra no `matcher` do `proxy.ts`, que só lista as páginas do `(app)`.

## Tela (`/ativos/[ticker]`)

- `DayInsightCard` logo abaixo do card de preço, só quando há resumo da sessão da cotação atual.
- Título "Resumo do dia", com o `DeltaChip` da variação e o horário da geração.
- O texto em Body; as fontes (até 3) como links externos (`target="_blank"`, `rel="noopener noreferrer"`), com portal e data.
- Rodapé em Footnote: "Gerado por IA (Gemini) a partir de notícias públicas. Pode conter erros e não é recomendação."
- Sem resumo, o card não aparece e não há skeleton.
- Segue os tokens e componentes do projeto (`Card`, `DeltaChip`, type scale), nos dois temas e no iPhone.

## Observabilidade

- Spans `cron.day-insights` e `insights.generate`, só com contagens (ativos elegíveis, processados, notícias baixadas, páginas que falharam, chamadas ao Gemini) e o status. Nunca o texto gerado nem valores da carteira.
- As chamadas ao Bing, aos portais e ao Gemini já aparecem pela instrumentação do `fetch`. A chave do Gemini vai em header, nunca na URL.
- O nome da integração entra no dashboard de APIs (`docs/observability/new-relic-apis-dashboard.json`).

## Testes (puros)

- `day-insight.test.ts`:
  - gatilho: 1,99% e 2% num FII, 2,99% e 3% numa ação, negativos iguais;
  - `parseBingNews`: a URL do `url=`, a data, itens sem URL fora, ordem por data;
  - escolha das páginas: a próxima entra quando uma falha, no máximo 3;
  - `sameDay` pelo dia de São Paulo (publicada às 02:30 UTC de 12/11, 23:30 de 11/11 em São Paulo, não é do dia 12; às 03:00 UTC de 12/11 é);
  - `nextInsightAttempt`: 11:59 e 12:00, 17:59 e 18:00, 20:00, 29 e 30 min desde a última, fim de semana, resumo de outra sessão, definitivo com notícia do dia;
  - Gemini só quando aparece notícia do dia nova;
  - `buildInsightPrompt` sem nenhum dado da carteira (quantidade, preço médio, valor);
  - prioridade (posições por valor, depois rank) e teto do orçamento.

## Fora do escopo

- Resumo sob demanda, ao abrir a página.
- Resumos para variações dentro do limite, ou fora das posições e da Carteira Alvo.
- Alerta no sino para o resumo.
- Tela de configuração dos limites.
