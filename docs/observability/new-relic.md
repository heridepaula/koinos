# APM na New Relic

O Koinos envia traces OpenTelemetry pelo OTLP/HTTP. Em produção, eles vão para a New Relic. O código está em `src/instrumentation.node.ts`, e as decisões, na [spec do APM](../superpowers/specs/2026-10-23-apm-opentelemetry-design.md).

## Configuração na Vercel

Só em **Production**:

| Variável                      | Valor                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `https://otlp.nr-data.net:4318` (conta nos EUA; na Europa, `otlp.eu01.nr-data.net`) |
| `OTEL_EXPORTER_OTLP_HEADERS`  | `api-key=<chave de ingestão do tipo License>`, marcada como **Sensitive**           |

- Sem `OTEL_EXPORTER_OTLP_ENDPOINT`, nada sai do servidor. É assim no dev e no CI.
- `OTEL_SDK_DISABLED=true` desliga o SDK inteiro. Como toda variável da Vercel, vale a partir do próximo deploy.
- Para testar no computador, aponte o endpoint para um receptor local e use `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`: o corpo chega em JSON legível.

## O que chega e o que fica de fora

| Chega                                                                  | Fica de fora                                             |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| Requisições (rota, método, status, tempo) e os spans internos do Next  | Query strings (`?code=` do login, `crumb=`, `?valor=`…)  |
| Server Actions: nome, resultado, tipo do erro, `ticker`/`type`/`month` | Quantidades, preços, notas, ids e arquivos das actions   |
| MongoDB: coleção, operação e o formato da query                        | Os valores da query (cada um vira `?`)                   |
| Redis: o nome do comando                                               | Chaves e valores (sessões, travas)                       |
| brapi, Yahoo e Google: host, caminho, status e tempo                   | Cabeçalhos (o token da brapi, os cookies)                |
| Exceções: tipo, mensagem e pilha                                       | Números e e-mails das mensagens (viram `#` e `[e-mail]`) |

## Importar o dashboard

1. Na New Relic, copie o **Account ID**: menu do usuário → **Administration** → **Access management** → **Accounts**.
2. Em [`new-relic-dashboard.json`](new-relic-dashboard.json), troque todos os `"accountIds": [0]` pelo ID, por exemplo `"accountIds": [1234567]`. No terminal:

   ```bash
   sed 's/"accountIds": \[0\]/"accountIds": [1234567]/g' docs/observability/new-relic-dashboard.json > dashboard.json
   ```

3. **Dashboards** → **Import dashboard** → cole o JSON → **Import dashboard**.

As páginas:

- **Visão geral:** requisições, p95 das páginas, % de 5xx, % de actions com falha, rotas e status.
- **Server Actions:** execuções, falhas inesperadas, erros de regra (`ActionError`), sessão expirada, tempo e últimas falhas.
- **MongoDB:** operações por coleção, as queries mais lentas (só o formato) e os índices criados nas partidas a frio.
- **Redis e sessão:** comandos, a leitura da sessão no Better Auth e os logins pelo Google.
- **APIs externas:** latência e falhas da brapi, do Yahoo e do Google, a cota da brapi no mês e quantas cotações o Yahoo precisou cobrir.
- **Cron diário:** cada execução, o tempo de cada etapa, cotações atualizadas e com falha, e chamadas sem o segredo.
- **Erros e partidas a frio:** spans com erro, exceções e instâncias novas da função.

O tráfego do Koinos é pequeno. Com o seletor de tempo em 60 minutos, a maioria dos gráficos fica vazia: use 1 dia ou 7 dias. Os widgets do cron e o da cota da brapi já têm período próprio e não seguem o seletor.

## Alertas sugeridos

Em **Alerts** → **Alert conditions** → **New alert condition** → **NRQL**. Com pouco tráfego, use a agregação **Event timer**, deixe as lacunas sem preenchimento e desligue o "loss of signal", salvo no do cron.

| Alerta                     | NRQL                                                                                                                                                                                              | Condição                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| brapi lenta                | `SELECT percentile(duration.ms, 95) FROM Span WHERE service.name = 'koinos' AND http.client.name = 'fetch' AND net.peer.name = 'brapi.dev'`                                                       | acima de 3000 por 5 minutos                 |
| brapi falhando             | `SELECT percentage(count(*), WHERE http.status_code >= 400 OR otel.status_code = 'ERROR') FROM Span WHERE service.name = 'koinos' AND http.client.name = 'fetch' AND net.peer.name = 'brapi.dev'` | acima de 20 por 10 minutos                  |
| Cron não rodou             | `SELECT count(*) FROM Span WHERE service.name = 'koinos' AND name = 'cron.daily'`                                                                                                                 | loss of signal de 26 horas abre o incidente |
| Etapa do cron com erro     | `SELECT count(*) FROM Span WHERE service.name = 'koinos' AND name LIKE 'cron.%' AND otel.status_code = 'ERROR'`                                                                                   | acima de 0 pelo menos uma vez em 5 minutos  |
| Falha inesperada em action | `SELECT count(*) FROM Span WHERE service.name = 'koinos' AND koinos.action.error_kind = 'unexpected'`                                                                                             | acima de 0 pelo menos uma vez em 5 minutos  |
| Erros 5xx                  | `SELECT count(*) FROM Span WHERE service.name = 'koinos' AND next.span_type = 'BaseServer.handleRequest' AND http.status_code >= 500`                                                             | acima de 0 pelo menos uma vez em 5 minutos  |

O aviso por e-mail fica em **Alerts** → **Workflows**, com um destino de e-mail.

## Nomes que o dashboard usa

Trocar um destes nomes no código quebra os widgets e os alertas que o usam:

- spans: `action <nome>`, `cron.daily`, `cron.load-tickers`, `cron.refresh-quotes`, `cron.refresh-dividends`, `cron.ensure-monthly-closes`, `cron.refresh-catalog`, `quotes.brapi`, `quotes.yahoo-fallback`, `tickers.search`;
- atributos: `koinos.action.name`, `koinos.action.outcome`, `koinos.action.error_kind`, `koinos.action.input.*`, `error.type`, `koinos.quotes.*`, `koinos.brapi.*`, `koinos.dividends.updated`, `koinos.history.months_fetched`, `koinos.catalog.entries`, `koinos.tickers*`.
