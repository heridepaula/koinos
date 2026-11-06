# "A receber" com a data de pagamento do Fundamentus

Data: 2026-11-06. Pedido do dono: trazer os proventos futuros com data de pagamento sem depender
do envio do extrato de Eventos da B3.

## Fonte

- Páginas públicas `fii_proventos.php` e `proventos.php` (`?papel=TICKER&tipo=2`) do Fundamentus:
  tabela `#resultado` com data com, tipo, data de pagamento e valor (ações: valor por lote de
  "por quantas ações"). HTML em ISO-8859-1.
- Medido em 2026-11-06: sem Cloudflare, sem robots.txt, sem termos que proíbam a leitura; 42
  tickers da carteira, 39 com página, nenhuma falha.
- O cliente se identifica como `Koinos/1.0 (painel pessoal de carteira)`. Não se passa por
  navegador: se o site bloquear, a busca falha e o "a receber" volta ao Yahoo.
- Diferenças da proposta colada: sem coleção nova (`dividends` já é o crédito da B3), sem cheerio
  (a tabela é simples; o parser é puro e testado), sem cron de hora em hora (o Hobby só tem cron
  diário): roda no cron diário e ao abrir o app, com 20 h de intervalo por ativo e 2 requisições
  por vez.

## Dados

- `refreshPayDates` (`market-data/server/pay-dates-service.ts`) grava no ativo `payDates`
  (`comDate`, `payDate`, `perShare` bruto, `kind` RENDIMENTO, DIVIDENDO ou JCP) com pagamento de
  62 dias atrás em diante, e `payDatesFetchedAt`. XXXX11 tenta a página de FII e, sem tabela
  (units), a de ações. Ticker sem página grava null; falha de rede não grava nada.
- `getAssetSnapshots` devolve `payDates` null quando a busca tem mais de 10 dias.

## Regras (`upcomingDividends`, `schedules`)

- Entra o anúncio com pagamento a partir do 1º dia do mês atual (o que passou no mês fica como "a
  confirmar"), FIIs e ações.
- Com a foto da B3: só data com depois do `asOf` e que não esteja na foto (mesmo ativo, tipo e
  data de pagamento).
- Pago: um crédito da B3 do mesmo ativo e tipo (ou Reembolso) a até 5 dias da data anunciada;
  cada crédito confirma um anúncio só.
- Cotas no fim da data com. O JCP entra a 85% (o crédito da B3 é líquido).
- O ativo com `payDates` não usa o Yahoo; sem eles, segue a estimativa do Yahoo com `payLagDays`.
- Origem "anunciado" na tela; a coluna passa a ser "Data com" (no Yahoo, a data ex com "(ex)").
