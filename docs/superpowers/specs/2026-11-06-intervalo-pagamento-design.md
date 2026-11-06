# "A receber" estimado: o intervalo habitual de cada FII

Data: 2026-11-06. Estado: implementada. Origem: o dono notou que os proventos só apareciam com o extrato da B3. A busca de uma API com a data de pagamento não deu certo no plano gratuito (brapi: FIIs exigem o Pro, ações o Startup, e só PETR4, HGLG11 e MXRF11 respondem; usebolsai: `/dividends` e `/fiis/{ticker}/distributions` exigem o Pro), então o dono pediu para melhorar a estimativa do Yahoo.

## Regra

O Yahoo informa a data ex e o valor, não a data de pagamento. O "a receber" estimado usava data ex + 15 dias para todos. Agora usa o **intervalo habitual de cada FII** (`payLagDays`, `portfolio/domain/dividends.ts`, pura):

- cada Rendimento já creditado pela B3 é casado com o anúncio de data ex mais próxima antes do crédito, até 45 dias (um anúncio casa uma vez só);
- o intervalo do fundo é a mediana dos dias entre os pares, arredondada, no mínimo 1;
- só vale com 2 ou mais pares; sem isso, o padrão de 15 dias;
- só Rendimento de FII (a estimativa do Yahoo é só disso); o filtro `?tipo=` não muda o cálculo.

`upcomingDividends` recebe `payLag` (opcional) e calcula `payBy = data ex + intervalo`. Nada mais muda: a B3 continua mandando, e o item some quando a B3 credita.

## Anúncios guardados

`dividendAnnouncements` passou de 90 para 400 dias (`ANNOUNCEMENT_WINDOW_MS`), para o intervalo ter uns 12 pares. Nada mais lê essa janela como limite: o "a receber" e o "não divulgado" filtram por mês. O cron diário preenche os 400 dias; até lá valem os 90 já guardados.

## Medido (2026-11-06, só leitura, produção)

Com os 90 dias guardados, 20 dos 42 FIIs com anúncio já têm intervalo próprio, de 4 a 14 dias (14 dias em 7 deles), contra os 15 fixos de antes.

## Limites

- Continua sendo estimativa: o Yahoo não dá a data oficial, e o pagamento cai em dia útil. A etiqueta "estimado" e a ajuda da tela dizem isso.
- Fundo com menos de 2 pagamentos casados usa os 15 dias.
