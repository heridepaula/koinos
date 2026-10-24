# APM na New Relic

O Koinos envia traces OpenTelemetry pelo OTLP/HTTP. Em produção, eles vão para a New Relic. O código está em `src/instrumentation.node.ts`, e as decisões, na [spec do APM](../superpowers/specs/2026-10-23-apm-opentelemetry-design.md).

## Configuração na Vercel

Só em **Production**:

| Variável                          | Valor                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `OTEL_EXPORTER_OTLP_ENDPOINT`     | `https://otlp.nr-data.net:4318` (conta nos EUA; na Europa, `otlp.eu01.nr-data.net`)                          |
| `OTEL_EXPORTER_OTLP_HEADERS`      | `api-key=<chave de ingestão do tipo License>`, marcada como **Sensitive**                                    |
| `OTEL_EXPORTER_OTLP_LOGS_HEADERS` | `api-key=<chave de ingestão só dos logs>`, marcada como **Sensitive**. Sem ela, os logs usam a chave de cima |
| `OTEL_LOG_LEVEL`                  | `warn`: um envio que falhar aparece no log da Vercel. `debug` mostra a configuração (para diagnosticar)      |

- Sem `OTEL_EXPORTER_OTLP_ENDPOINT`, nada sai do servidor. É assim no dev e no CI.
- `OTEL_SDK_DISABLED=true` desliga o SDK inteiro. Como toda variável da Vercel, vale a partir do próximo deploy.
- Com `OTEL_LOG_LEVEL=debug`, o log da Vercel mostra para onde vão os traces (`Configure trace exporter: … otlp.nr-data.net …`) e cada envio aceito (`onSuccess 200 OK`).
- Para testar no computador, aponte o endpoint para um receptor local e use `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`: o corpo chega em JSON legível.

## Cobertura

| Camada           | O que é medido                                                                                                           | Spans                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Navegador        | LCP, INP, CLS, FCP e TTFB de quem usa o app, por página                                                                  | `web-vitals`                                         |
| Requisições      | Rota, método, status e tempo; o prefetch RSC separado; o proxy                                                           | os do Next (`BaseServer.handleRequest`, render, RSC) |
| Telas            | Cada carregador de dados (snapshot, evolução, proventos, reinvestimento, encerradas), com o tamanho do que monta         | `view.*`                                             |
| Server Actions   | Nome, resultado, tipo do erro e os campos liberados (`ticker`, `type`, `month`)                                          | `action <nome>`                                      |
| Atualização B3   | Leitura dos extratos, plano, comparação e gravação, só com contagens                                                     | `b3.*`                                               |
| Banco            | Cada comando do MongoDB (Better Auth e Mongoose), com o formato da query                                                 | `find transactions`…                                 |
| Sessões e travas | Cada comando do Redis; a leitura da sessão no Better Auth; as travas e quando estavam ocupadas                           | `get`, `setex`…, `GET /get-session`, `lock <nome>`   |
| APIs externas    | brapi, Yahoo e Google: host, caminho, status e tempo; qual fonte resolveu as cotações; a cota da brapi                   | `fetch GET …`, `quotes.*`                            |
| Cron             | Cada etapa da rotina diária, com as contagens                                                                            | `cron.*`                                             |
| Erros            | Exceções nos spans e os erros que o Next captura no render, nas rotas, nas actions e no proxy                            | `request.error`                                      |
| Logs             | O que o app, o Next e as bibliotecas escrevem no console (`log`, `info`, `warn`, `error`), ligado ao trace da requisição | `Log` (logger `koinos.console`)                      |
| Plataforma       | Partidas a frio, o commit e a região de cada span, e quanto a conta da New Relic recebeu                                 | `register instrumentation`, `NrConsumption`          |

### O que ainda fica de fora

- **Logs da borda e do build:** os pedidos que a CDN da Vercel responde sozinha e os logs de build só saem da Vercel pelos **Log Drains**, que exigem o plano Pro. Os logs das funções já vão pelo OpenTelemetry.
- **Disponibilidade vista de fora:** um monitor **Synthetics** do tipo ping em `https://koinos-sooty.vercel.app/login` avisa se o site cair. No plano gratuito, um ping a cada 6 horas cabe na franquia mensal.
- **Metas de serviço (SLO):** em **Service levels**, por exemplo 99% das páginas abaixo de 1,5 s e 99,5% sem 5xx, com as consultas da Visão geral.
- **Marcas de deploy:** o dashboard já compara commits (`vcs.ref.head.revision`). Para ver o deploy marcado nos gráficos, falta registrar cada deploy no **Change tracking** da New Relic.
- **Métricas de runtime** (memória, event loop): exigem o exportador de métricas do OpenTelemetry. Numa função serverless de um usuário, dizem pouco.

## O que chega e o que fica de fora

| Chega                                                                  | Fica de fora                                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Requisições (rota, método, status, tempo) e os spans internos do Next  | Query strings (`?code=` do login, `crumb=`, `?valor=`…)                    |
| Web Vitals: a métrica, o valor, a nota e a rota                        | URLs fora das rotas do app (viram `other`), quem é o usuário               |
| Server Actions: nome, resultado, tipo do erro, `ticker`/`type`/`month` | Quantidades, preços, notas, ids e arquivos das actions                     |
| Atualização B3: quantos arquivos, linhas, FIIs e lançamentos           | O conteúdo e o nome dos extratos                                           |
| MongoDB: coleção, operação e o formato da query                        | Os valores da query (cada um vira `?`)                                     |
| Redis: o nome do comando; travas: o nome (`import`, `quotes`)          | Chaves e valores; o id da carteira no nome da trava                        |
| brapi, Yahoo e Google: host, caminho, status e tempo                   | Cabeçalhos (o token da brapi, os cookies)                                  |
| Exceções: tipo, mensagem e pilha; a descrição do status                | Números e e-mails das mensagens (viram `#` e `[e-mail]`; os tickers ficam) |
| Logs: o nível, a mensagem (com os tickers) e o trace                   | Os mesmos números, e-mails e query strings das mensagens                   |

## Importar o dashboard

1. O [`new-relic-dashboard.json`](new-relic-dashboard.json) já vem com o Account ID da conta do Koinos (`6563675`) em todas as consultas.
2. **Dashboards** → **Import dashboard** → cole o JSON → **Import dashboard**. Se já importou a versão anterior, apague a antiga ou importe ao lado.

Para importar em outra conta, troque o ID em todas as consultas (menu do usuário → **Administration** → **Access management** → **Accounts** mostra o seu):

```bash
sed 's/"accountIds": \[6563675\]/"accountIds": [1234567]/g' docs/observability/new-relic-dashboard.json > dashboard.json
```

As páginas:

- **Visão geral:** requisições, p95 das páginas, % de 5xx, LCP, actions com falha, rotas, status e o proxy.
- **Navegador (Web Vitals):** LCP, INP, CLS, FCP e TTFB no p75 (o padrão do Google), por página, as notas e as medidas ruins.
- **Páginas e dados:** o tempo de cada carregador de tela, os prerenders interrompidos pelo prefetch e o tamanho da carteira.
- **Server Actions:** execuções, falhas inesperadas, erros de regra (`ActionError`), sessão expirada, tempo e últimas falhas.
- **Atualização B3:** prévias, importações, falhas, a trava ocupada, o tempo de cada etapa e o que cada envio trouxe.
- **MongoDB:** operações por coleção, as queries mais lentas (só o formato) e os índices criados nas partidas a frio.
- **Redis, sessão e travas:** comandos, a leitura da sessão no Better Auth, as travas e os logins pelo Google.
- **APIs externas:** latência e falhas da brapi, do Yahoo e do Google, a cota da brapi no mês e quantas cotações o Yahoo precisou cobrir.
- **Cron diário:** cada execução, o tempo de cada etapa, cotações atualizadas e com falha, e chamadas sem o segredo.
- **Logs:** erros e avisos ao longo do tempo, as mensagens mais frequentes e as últimas, com o `trace.id` para abrir o trace da requisição.
- **Erros, deploys e plataforma:** erros capturados pelo Next, exceções, a comparação entre commits, a região, as partidas a frio e quantos GB a conta recebeu.

O tráfego do Koinos é pequeno. Com o seletor de tempo em 60 minutos, a maioria dos gráficos fica vazia: use 1 dia ou 7 dias. Os widgets do cron, da cota da brapi e do consumo já têm período próprio e não seguem o seletor.

## Alertas sugeridos

Em **Alerts** → **Alert conditions** → **New alert condition** → **NRQL**. Com pouco tráfego, use a agregação **Event timer**, deixe as lacunas sem preenchimento e desligue o "loss of signal", salvo no do cron.

| Alerta                     | NRQL                                                                                                                                                                                              | Condição                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| brapi lenta                | `SELECT percentile(duration.ms, 95) FROM Span WHERE service.name = 'koinos' AND http.client.name = 'fetch' AND net.peer.name = 'brapi.dev'`                                                       | acima de 3000 por 5 minutos                 |
| brapi falhando             | `SELECT percentage(count(*), WHERE http.status_code >= 400 OR otel.status_code = 'ERROR') FROM Span WHERE service.name = 'koinos' AND http.client.name = 'fetch' AND net.peer.name = 'brapi.dev'` | acima de 20 por 10 minutos                  |
| Cron não rodou             | `SELECT count(*) FROM Span WHERE service.name = 'koinos' AND name = 'cron.daily'`                                                                                                                 | loss of signal de 26 horas abre o incidente |
| Etapa do cron com erro     | `SELECT count(*) FROM Span WHERE service.name = 'koinos' AND name LIKE 'cron.%' AND otel.status_code = 'ERROR'`                                                                                   | acima de 0 pelo menos uma vez em 5 minutos  |
| Falha inesperada em action | `SELECT count(*) FROM Span WHERE service.name = 'koinos' AND koinos.action.error_kind = 'unexpected'`                                                                                             | acima de 0 pelo menos uma vez em 5 minutos  |
| Erro capturado pelo Next   | `SELECT count(*) FROM Span WHERE service.name = 'koinos' AND name = 'request.error'`                                                                                                              | acima de 0 pelo menos uma vez em 5 minutos  |
| Erros 5xx                  | `SELECT count(*) FROM Span WHERE service.name = 'koinos' AND next.span_type = 'BaseServer.handleRequest' AND http.status_code >= 500`                                                             | acima de 0 pelo menos uma vez em 5 minutos  |
| Página lenta para quem usa | `SELECT percentile(koinos.vitals.value, 75) FROM Span WHERE service.name = 'koinos' AND name = 'web-vitals' AND koinos.vitals.name = 'LCP'`                                                       | acima de 4000 por 30 minutos                |
| Atualização B3 falhando    | `SELECT count(*) FROM Span WHERE service.name = 'koinos' AND koinos.action.name IN ('previewB3Import', 'confirmB3Import') AND koinos.action.error_kind = 'unexpected'`                            | acima de 0 pelo menos uma vez em 5 minutos  |
| Erros no log               | `SELECT count(*) FROM Log WHERE service.name = 'koinos' AND severity.text = 'ERROR'`                                                                                                              | acima de 0 pelo menos uma vez em 5 minutos  |
| Franquia da New Relic      | `SELECT sum(GigabytesIngested) FROM NrConsumption WHERE productLine = 'DataPlatform' SINCE 30 days ago`                                                                                           | acima de 80 (GB; a franquia grátis é 100)   |

O aviso por e-mail fica em **Alerts** → **Workflows**, com um destino de e-mail.

## Nomes que o dashboard usa

Trocar um destes nomes no código quebra os widgets e os alertas que o usam:

- spans: `action <nome>`, `view.*`, `b3.*`, `lock <nome>`, `web-vitals`, `request.error`, `cron.daily`, `cron.load-tickers`, `cron.refresh-quotes`, `cron.refresh-dividends`, `cron.ensure-monthly-closes`, `cron.refresh-catalog`, `quotes.brapi`, `quotes.yahoo-fallback`, `tickers.search`;
- logs: o evento `Log` com `service.name`, `severity.text`, `message`, `trace.id` e `log.source`;
- atributos: `koinos.action.*`, `koinos.view.*`, `koinos.control_flow`, `koinos.b3.*`, `koinos.lock.name`, `koinos.lock.acquired`, `koinos.vitals.*`, `next.error.*`, `error.type`, `koinos.quotes.*`, `koinos.brapi.*`, `koinos.dividends.updated`, `koinos.history.months_fetched`, `koinos.catalog.entries`, `koinos.tickers*`.
