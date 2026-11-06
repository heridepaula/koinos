# Histórico de proventos dos FIIs: Yahoo completado pelo Fundamentus

Data: 2026-11-06. Pedido do dono, depois da comparação das fontes (itens 1 e 2 do relatório).

## Medição (2026-11-06, 24 FIIs, contra os créditos da B3)

- O Yahoo perdeu a data ex de dezembro de 2025 de GARE11, HGRU11 e TRXF11: 11 pagamentos na
  janela de 12 meses, soma uns 8% abaixo. Deu 0,95 no XPML11 de setembro (B3 e Fundamentus: 0,92).
- O Fundamentus tem todos os meses, mas arredonda o rendimento de FII para 2 casas (GARE11: 0,08
  contra 0,083 da B3 e do Yahoo).

## Regra (`mergeDividendHistory`, `market-data/domain/dividend-merge.ts`)

- O Yahoo é a base. Cada rendimento do Fundamentus com data com desde o início da busca (760
  dias) casa com o primeiro evento livre do Yahoo com data ex até 10 dias depois da data com.
- Casou e a diferença cabe no arredondamento (até 0,0051): fica o valor do Yahoo. Diferença maior:
  fica o do Fundamentus.
- Não casou: entra o do Fundamentus, com a data ex no dia útil seguinte à data com (sem feriados).
- Evento do Yahoo sem par continua. Sem a página do Fundamentus (units, falha), fica só o Yahoo.
- `refreshDividends` busca a página de FII só para XXXX11. Os campos derivados (`dividends12m`,
  `dividendPayments12m`, `lastDividend`, `dy12m`, `dividendAnnouncements`) saem da lista junta.
- Efeito medido na janela: GARE11, HGRU11 e TRXF11 passam a 12 pagamentos; XPML11 corrige o valor.

## "A receber" (`upcomingDividends`)

- O item do Fundamentus de rendimento de FII leva o valor do anúncio do Yahoo do mesmo evento
  (data ex até 10 dias depois da data com) quando a diferença cabe no arredondamento.
