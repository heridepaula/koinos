# Taxa real da NTN-B: coleta diária pelo Tesouro Transparente

Data: 2026-11-01. Estado: **aprovada pelo dono em 2026-11-01 (decisões no §7)**; plano em `docs/superpowers/plans/2026-11-01-taxa-ntnb.md`. Origem: o parecer do conselho sobre a fórmula de teto da proposta de 4 regras (`2026-11-01-fruicao-design.md`, §1) e a análise das fontes de dados que se seguiu.

## 1. Objetivo

Guardar a taxa real de mercado da NTN-B 2035, dia a dia, para o Koinos ter a série. Hoje o app não tem nenhuma taxa de juros (só IPCA e Selic estão previstos, pelo SGS do Banco Central). Esta spec **só coleta e guarda o dado**. Nenhum motor passa a usá-lo, e o teto continua o da Suno, digitado pelo dono.

Usos futuros, cada um com sua própria spec e sua própria decisão do dono:

- um alerta de divergência entre o teto da Suno e um teto calculado (P3 do parecer); este é o primeiro uso, só informativo (spec `2026-11-01-divergencia-teto-design.md`);
- um indicador de "DY real" nos FIIs de papel, junto com o IPCA do SGS;
- a retenção da fruição ligada à inflação.

## 2. Fonte e o que foi medido (2026-11-01)

Dataset "Taxas dos Títulos Ofertados pelo Tesouro Direto", do Tesouro Transparente (CKAN), licença ODbL, frequência diária.

- **Catálogo:** `GET /ckan/api/3/action/package_show?id=df56aa42-484a-4a59-8184-7676580c81e3` responde 5 KB em JSON com `resources[].url` e `last_modified`.
- **CSV:** 14,6 MB e 178.072 linhas, baixado em 9,3 s. ASCII, sem BOM, LF, separador `;`, números e datas em pt-BR. Oito colunas, sem células vazias: `Tipo Titulo; Data Vencimento; Data Base; Taxa Compra Manha; Taxa Venda Manha; PU Compra Manha; PU Venda Manha; PU Base Manha`.
- **Cobertura:** de 31/12/2004 a 30/10/2026, com o dia mais novo no começo do arquivo. O catálogo diz "desde janeiro de 2002", mas o arquivo começa em 2004.
- **Defasagem:** o arquivo foi atualizado no sábado 31/10 às 10:21 GMT, com dados até sexta 30/10. O horário nos dias úteis não foi medido.
- **Requisição condicional:** `If-None-Match` e `If-Modified-Since` devolvem 304 em 0,19 s, sem corpo.
- **Leitura parcial (`Range`):** não é confiável. O servidor respondeu 206, mas entregou o arquivo inteiro.
- **Chave:** tipo + vencimento. A NTN-B 2035 com cupom é `Tesouro IPCA+ com Juros Semestrais` com `15/05/2035`: 5.128 dias, de 12/04/2006 a 30/10/2026, com uma lacuna de 7 dias (2011).
- **Saltos de outubro:** +1,28 p.p. em 26/10 e −0,67 p.p. em 05/10 não são erro de dado. Todos os títulos indexados e os prefixados se moveram juntos, o PU acompanha a taxa (duration implícita de 5,8 a 6,4 anos) e as duas datas são as segundas-feiras depois dos dois turnos da eleição de 2026. Não se filtra salto diário.
- **Taxa depende do horário:** só existe a taxa "da manhã". Em dia de choque (26/10, com suspensão de negociações segundo a imprensa) ela pode ser indicativa. Isso não foi confirmado.

## 3. Decisões de desenho

- **Dado global, não por carteira.** Como `assets`, as taxas valem para todos; não levam `portfolioId` nem passam pela `Tenant`.
- **Título acompanhado:** configuração fixa `TRACKED_TITLES` (tipo + vencimento). Começa com a NTN-B 2035. Guarda só essas linhas, não os 178 mil registros.
- **O que se guarda por título e dia:** `baseDate` (data-base, UTC meia-noite), `buyRate`, `sellRate`, `buyPrice`, `sellPrice`; a data da coleta é o `updatedAt` do documento. O `_id` composto (`tipo|vencimento|data-base`) garante a unicidade, e há um índice (tipo, vencimento, data-base decrescente) para a consulta; a escrita é um upsert, então repetir a coleta não duplica nada.
- **Taxa de referência:** a média de compra e venda (`midRate`), calculada na leitura. As duas taxas ficam guardadas. A diferença entre elas é a ponta do Tesouro (cerca de 0,12 p.p.).
- **Não se filtra outlier e não se corrige dado.** O que está no arquivo é gravado como veio. Só se rejeita o que é inválido (§5).
- **Mediana (60 pregões) e valor atual juntos.** A resposta da DAL traz o último ponto, a mediana dos últimos N pregões e a diferença entre os dois. Escolher só a mediana esconderia a quebra de regime: em 01/11 a mediana dos últimos 20 pregões é 6,90% e a média 7,17%, contra 7,92% do último dia, porque cinco pregões pós-choque pesam pouco contra quinze anteriores. O valor de N é 60 (§7).
- **Defasagem de dado:** a taxa é considerada velha se o último `baseDate` tiver mais de 10 dias (regra no mesmo espírito dos 60 dias do P/VP, em escala de dias). A DAL devolve `stale: true` e não esconde o número.

## 4. Coleta

- **Onde:** um passo novo, `cron.treasury`, dentro de `runDailyMarketJob` (`market-data/server/daily-job.ts`), que o `/api/cron/daily` já chama (22:00 UTC, dias úteis, `maxDuration = 300`). Cabem os 9 s do download.
  - O horário do cron cai depois da atualização do arquivo (10:21 GMT), então cada execução vê os dados do pregão anterior.
  - Uma falha **não** pode quebrar os outros passos do job: o erro é registrado (`recordError`) e a coleta de cotações, proventos e catálogo segue.
- **Detecção de mudança:** o passo chama `package_show`, lê `last_modified` e a URL do recurso, e compara com o que está gravado em `treasury_sync` (um documento com `lastModified`, `etag`, `lastBaseDate` e `checkedAt`). Sem mudança, termina sem baixar. Com mudança, faz um GET condicional pelo ETag e, em caso de 200, processa o arquivo.
  - Usar a URL devolvida pelo catálogo, e não a fixa, protege contra a troca do identificador do recurso. O catálogo é a única URL fixa.
- **Trava:** a coleta roda dentro de `withLock("treasury", 120_000)`; com a trava ocupada o status é `busy` (não é erro) e o job segue.
- **Mudança da lista:** `titlesKey` identifica `TRACKED_TITLES`. Se mudou (título novo), a coleta ignora o atalho do `last_modified`, o ETag e o filtro por data, e regrava o histórico completo dos títulos acompanhados.
- **Primeira execução (backfill):** processa o arquivo inteiro e grava todo o histórico dos títulos acompanhados (cerca de 5 mil linhas para a NTN-B 2035).
- **Execuções seguintes:** o passo grava as linhas com `baseDate` maior ou igual à `lastBaseDate` gravada (o dia repetido é um upsert inofensivo, que ainda corrige uma republicação). Na primeira entrega o passo lê o arquivo todo e filtra pelas datas novas (9 s, dentro do `maxDuration`); o streaming com parada antecipada fica como otimização futura, se o arquivo crescer.
- **Atribuição (ODbL):** onde a taxa aparecer em tela, a fonte é citada ("Fonte: Tesouro Transparente"). A licença permite uso interno; o dono confirma o texto antes de qualquer redistribuição.

## 5. Validação

O arquivo é rejeitado inteiro, sem escrever nada, quando:

- a primeira linha não tem exatamente as oito colunas acima, pelo nome ASCII;
- alguma linha tem largura diferente de 8;
- mais de 1% das linhas dos títulos acompanhados tem número ou data que não converte;
- a maior `baseDate` das linhas dos títulos acompanhados é anterior à `lastBaseDate` gravada (arquivo mais velho que o dado que já temos). A comparação usa só os títulos acompanhados, e não o arquivo todo, porque são eles que se gravam.

Linhas isoladas inválidas dos títulos acompanhados são ignoradas e contadas. Taxa fora de −10% a 30% é rejeitada como inválida (não como outlier).

## 6. Telemetria, camadas e testes

- **Spans:** `cron.treasury` com `koinos.treasury.status` (`not-modified`, `updated`, `busy` ou `error`), `koinos.treasury.rows_upserted` e `koinos.treasury.base_date_age_days`. Só contagens, nenhum valor de taxa.
- **Domínio puro** (`market-data/domain/treasury-rates.ts`): `parseTreasuryCsv`, `selectTracked`, `midRate`, `medianRate(rates, n)` e `summarizeRate(rows, now)`. Nada de Next, banco ou I/O.
- **Servidor:** adaptador `adapters/tesouro-transparente.ts` (catálogo e download, com timeout), modelo e serviço em `market-data/server/`, e `getRealRate()` em `market-data/server.ts`, que devolve `{ last, median, divergence, baseDate, stale }`.
- **Laboratório:** comando `taxa-real` na skill `conselho-investidores`, só leitura, com a série e o resumo.
- **Testes** (`treasury-rates.test.ts`):
  - parse do formato real: vírgula decimal, datas pt-BR, linhas curtas, cabeçalho errado;
  - seleção por tipo + vencimento: o "IPCA+ 2035" Principal não se confunde com o "com Juros Semestrais";
  - `midRate`;
  - mediana com número par e ímpar de pontos, janela maior que a série e série vazia;
  - `stale` a partir de 11 dias;
  - a validação do §5, caso a caso;
  - o salto de outubro entra como dado válido (fixture com 02/10, 05/10, 23/10 e 26/10).

## 7. Decisões do dono (2026-11-01)

1. **A regra "sem B3" não alcança o Tesouro Transparente:** a fonte é permitida.
2. **Taxa:** a média de compra e venda.
3. **Título:** a NTN-B 2035 com cupom (`Tesouro IPCA+ com Juros Semestrais`, 15/05/2035). A resposta do dono foi "sim" a uma pergunta de duas opções; foi lida como a proposta, e `TRACKED_TITLES` aceita mais títulos depois, sem mudar o resto. Combinar o que fazer perto do vencimento (2035) fica para quando ele se aproximar.
4. **Janela da mediana:** 60 pregões. Em 30/10 a mediana de 60 é 7,675% contra 7,92% do último dia (média de compra e venda), uma diferença de 0,245 p.p.: a janela longa amortece a quebra de regime de outubro, e a DAL mostra o último ponto junto para ela não ficar escondida.
5. **Onde aparece:** só no laboratório e na camada de dados; nenhum cartão no Dashboard.
6. **Onde roda:** como passo `cron.treasury` do cron diário.

## 8. Fora do escopo

- Qualquer uso da taxa pelos motores, pelo teto ou pela fruição.
- IPCA, Selic e CDI (spec do SGS) e a expectativa de inflação, necessária para converter taxa real em nominal.
- Os outros títulos do arquivo e as taxas de venda ao longo do dia.
- Uma segunda fonte para conferir a série. O CSV do portal do Tesouro Direto serve para checar o dia, mas não tem data nem histórico.

## 9. Ordem de trabalho

1. Domínio puro, com os testes do §6.
2. Adaptador, modelo e serviço de coleta, com o backfill.
3. Passo no cron diário e telemetria.
4. `getRealRate()` e o comando `taxa-real` do laboratório.
5. Verificação: `format:check`, `lint`, `typecheck`, `test` e `build`; rodar o backfill com um banco de experimento (nunca o de produção) e comparar com os números do §2.
