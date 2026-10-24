# APM com OpenTelemetry e New Relic: especificação de design

- **Data:** 2026-10-23
- **Status:** implementado em 2026-10-23. O usuário mandou o pedido pronto, aprovou o plano adaptado ("Sim para as duas": só `ticker`, `type` e `month` das entradas, e o Redis incluído) e pediu o dashboard da New Relic.
- **Adaptações ao pedido**, ditas antes de começar:
  - o `instrumentationHook` não existe mais no Next 16, e o `serverComponentsHmrCache` é um cache de fetch do modo dev: o `next.config.ts` só ganhou o `serverExternalPackages`;
  - o projeto usa `src/`, então o arquivo é `src/instrumentation.ts`;
  - a brapi e o Yahoo (`yahoo-finance2` v4) usam o `fetch` global, já instrumentado: o `instrumentation-http` não entrou;
  - o `mongo.ts` não mudou: a instrumentação altera o driver no `require`;
  - as queries vão com o formato, sem os valores, e as URLs sem query string.

## 1. Objetivo

Ver no APM o tempo e as falhas de cada parte do Koinos: requisições, Server Actions, MongoDB, Redis, brapi, Yahoo, Google e o cron diário. Ser avisado quando a brapi ficar lenta.

## 2. Arquitetura

- **Registro:** `src/instrumentation.ts` importa `src/instrumentation.node.ts` no runtime Node. Ele chama `registerOTel` (`@vercel/otel`) com:
  - `serviceName` `koinos` (ou `OTEL_SERVICE_NAME`);
  - as instrumentações `"fetch"` (fetch global e http/https), `MongoDBInstrumentation` e `IORedisInstrumentation`;
  - `spanProcessors: [RedactionSpanProcessor, "auto"]`. O "auto" monta o exportador OTLP pelas variáveis de ambiente.
- **Envio no serverless:** o `@vercel/otel` espera o span raiz fechar (até 50 ms) e envia no `waitUntil` da requisição. A resposta não espera o envio.
- **Sem endpoint, nada sai:** sem `OTEL_EXPORTER_OTLP_ENDPOINT` (dev, CI), os spans ficam no processo. `OTEL_SDK_DISABLED=true` desliga tudo.
- **Versões:** a linha 0.223 do OpenTelemetry. O `@vercel/otel` 2.1.3 só aceita `@opentelemetry/instrumentation <0.300`; a 0.300 saiu em 20/10/2026 e quebra a instalação. `instrumentation-mongodb` 0.76.0 (driver até a 7) e `instrumentation-ioredis` 0.71.0 são as últimas dessa linha. Uma não sobe sem as outras.
- **`ioredis` fora do bundle** (`serverExternalPackages`): empacotado pelo Turbopack, o módulo não passa pelo `require` e a instrumentação não o alcança. No primeiro ensaio, nenhum span do Redis apareceu. O `mongodb` e o `mongoose` o Next já deixa de fora.

## 3. O que cada parte registra

| Parte | Spans | Atributos do Koinos |
| --- | --- | --- |
| Requisições | os do Next (`BaseServer.handleRequest`, render, RSC, proxy) | — |
| Server Actions | `action <nome>`, primeiro middleware do `next-safe-action` | `koinos.action.name`, `koinos.action.outcome` (`success`, `validation_error`, `server_error`, `navigation`), `koinos.action.error_kind` (`expected`, `unexpected`), `error.type`, `koinos.action.input.{ticker,type,month}` |
| MongoDB | um por comando (`find transactions`…) | — (`db.collection.name`, `db.operation.name`, `db.query.text`) |
| Redis | um por comando (`get`, `setex`, `eval`…) | — (`db.query.text` = o comando) |
| brapi, Yahoo, Google | `fetch GET <url sem query>` | — (`net.peer.name`, `http.url`, `http.status_code`) |
| Cotações | `quotes.brapi`, `quotes.yahoo-fallback` | `koinos.quotes.requested`, `koinos.quotes.resolved`, `koinos.brapi.month_requests`, `koinos.brapi.month_quota`, `koinos.brapi.skipped` |
| Cron | `cron.daily` e as etapas `cron.load-tickers`, `cron.refresh-quotes`, `cron.refresh-dividends`, `cron.ensure-monthly-closes`, `cron.refresh-catalog` | as contagens de cada etapa e o resumo em `cron.daily` |
| Busca de tickers | `tickers.search` | `koinos.tickers.query_length`, `koinos.tickers.results` |

- **Actions:** `defineMetadataSchema` exige `.metadata({ actionName })` em toda action. O middleware de tracing vem antes do `requireTenant`, então cobre a sessão, a validação e a action. O `handleServerError` roda dentro do span e registra a exceção.
- **Falhas:** `ActionError` e `UnauthorizedError` também marcam o span com erro, como o usuário pediu, mas com `error_kind` `expected`. O erro de validação não conta como falha.
- **Entradas:** só os campos de `TRACEABLE_INPUT_FIELDS` (`ticker`, `type`, `month`), cortados em 64 caracteres. A entrada validada só existe quando a action termina bem; numa falha, vale a enviada pelo navegador.

## 4. Privacidade

O `RedactionSpanProcessor` (`shared/lib/telemetry-redaction.ts`) roda antes do exportador:

- tira a query string do nome do span e de `http.target`, `http.url` e `url.full`, e apaga `url.query`;
- nas exceções, troca e-mails por `[e-mail]`, números por `#` e tira a query das URLs, na mensagem e nas linhas de mensagem da pilha.

O `@vercel/otel` traz uma cópia própria do SDK, que não chama o `onEnding`. Por isso a limpeza acontece no `onStart`, no que já nasce com o span, e no `onEnd`, no objeto que o exportador vai enviar.

Além disso:

- **MongoDB:** `enhancedDatabaseReporting: false`, então cada valor vira `?`;
- **Redis:** o `dbStatementSerializer` devolve só o comando;
- **Contexto do trace:** o `traceparent` só vai para o próprio app (padrão do `@vercel/otel`).

## 5. Verificação (2026-10-23)

- **Funções de limpeza:** 10 casos com um script descartável.
- **Ensaio integrado:** build de produção contra uma cópia isolada do banco, com os spans indo em OTLP/JSON para um receptor local. A análise conferiu 37 itens:
  - as árvores de spans;
  - as actions de sucesso e de erro (a mensagem chegou como "Venda de # cotas de BTLG# em #/#/#, mas a posição nessa data é #.");
  - as etapas do cron, os spans do Redis e do Mongo dentro das requisições;
  - a ausência de segredos do `.env`, do token da sessão, do e-mail, do `code` do OAuth e das query strings.
- **Custo medido:** 12 a 17 ms a mais na mediana (`/dashboard` 277 contra 263 ms). Com `OTEL_SDK_DISABLED=true`, nenhum lote saiu.
- **Volume:** cerca de 1.300 spans no ensaio inteiro. O Next gera boa parte, com o prefetch RSC e o carregamento de módulos. Cabe com folga nos 100 GB por mês do plano gratuito da New Relic.

## 6. Dashboard e alertas

- `docs/observability/new-relic-dashboard.json`: 7 páginas e 56 widgets, gerados com os nomes vistos no ensaio. Importação e alertas em `docs/observability/new-relic.md`.
- O JSON não foi testado dentro da New Relic: não há acesso à conta. As consultas usam o Account ID que o usuário passou (`6563675`).

## 7. Fora do escopo

- Logs e métricas pelo OpenTelemetry (só traces).
- Monitoramento do navegador (RUM).
- Amostragem: todo trace é registrado, porque o tráfego é de um usuário.
- O `autoIndex` do Mongoose. O ensaio mostrou que cada partida a frio roda `createIndexes` em todas as coleções e pesa a primeira requisição. Fica como melhoria futura.

## 8. Cobertura ampliada (mesmo dia, segundo pedido)

O usuário pediu de novo o JSON e uma análise do que mais instrumentar ("para ter um dashboard completo e bem monitorado"). A análise apontou o que faltava, e entrou:

- **Web Vitals:**
  - `shared/components/web-vitals.tsx` usa o `useReportWebVitals`, no layout de `(app)`, e envia as medidas em lote, por `sendBeacon`, quando a aba sai de vista;
  - `app/api/vitals/route.ts` grava um span `web-vitals` por medida. Só aceita `Sec-Fetch-Site: same-origin` com cookie de sessão, e a rota fora da lista do app vira `other`;
  - a chave da New Relic nunca vai ao navegador.
- **Telas:** os cinco carregadores (`view.*`) passam pelo `traced`, que guarda só contagens do resultado.
- **Atualização B3:** spans `b3.read-files`, `b3.load-stored`, `b3.plan`, `b3.diff` e `b3.apply`, com contagens: arquivos, linhas, FIIs, pendências, divergências, lançamentos e proventos novos ou substituídos.
- **Travas:** `withLock` abre o span `lock <nome>`, com `koinos.lock.acquired`. O nome vai sem o id da carteira.
- **Erros do Next:** `onRequestError` no `instrumentation.ts` grava um span `request.error` com o tipo e o arquivo da rota. O caminho pedido e os cabeçalhos ficam de fora.
- **Fluxo de controle:** redirect, notFound e o fim de um prerender não marcam erro. O span leva `koinos.control_flow`. No prefetch parcial, o `connection()` rejeita de propósito com `HANGING_PROMISE_REJECTION`; antes disso, quatro views apareciam "com erro" no ensaio.
- **Status:** o Next põe a mensagem inteira do erro na descrição do status do span. O `RedactionSpanProcessor` passou a limpá-la, porque o ensaio mostrou o e-mail e o `token=` de uma mensagem de teste chegando por ali.

Verificação: o segundo ensaio, com páginas, Web Vitals, prévia e importação da B3 numa cópia isolada, uma rota de erro descartável e o cron, passou em 32 de 32 itens. O primeiro ensaio, rodado de novo no mesmo build, passou em 37 de 37.

O dashboard passou a ter 10 páginas e 90 widgets. As consultas usam 70 atributos, todos vistos nos ensaios, menos `vcs.ref.head.revision` e `vercel.region`, que só existem na Vercel.

Continuam de fora, com o caminho em `docs/observability/new-relic.md`: logs pelo OpenTelemetry, um monitor Synthetics, as metas de serviço (SLO), as marcas de deploy (Change tracking) e as métricas de runtime.
