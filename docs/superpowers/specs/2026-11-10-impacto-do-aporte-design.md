# Impacto do aporte: antes ➔ depois, por papel e geral

Data: 2026-11-10. Estado: aprovada, a implementar. Origem: o dono pediu que `/recomendacoes` mostre o efeito das ordens antes de enviá-las (preço médio, proventos, yield on cost e patrimônio), "por papel e geral". Escolhas do dono no mesmo dia: FIIs e ações; por papel, um selo de renda na linha e o resto no "Por quê"; o geral nos cards de números do topo, sem barra fixa nova.

## O que não muda

Os motores (`fiiCascade`, `stockSmartBuy`), suas opções e seus testes. O impacto é uma conta sobre as ordens que eles já devolvem e nunca volta a eles. `simulation.ts` (o simulador de N aportes do lab) também fica como está.

## Regras (`smart-buy/domain/aporte-impact.ts`, pura)

Notação: Q e PM são a quantidade e o preço médio de hoje, q e P a quantidade e o preço da ordem (o preço da tela), Q' = Q + q.

### Por papel: `orderImpact(kind, order, asset)` → `OrderImpact`

- **Quantidade:** Q antes, Q' depois.
- **Preço médio:** antes PM (null sem posição ou sem PM), depois (Q·PM + q·P) ÷ Q'. Sem posição (Q = 0) ou sem PM, o depois é P.
- **L/P %:** P ÷ PM − 1, antes e depois (antes null sem PM). Em R$ o resultado não muda, porque (P − PM')·Q' = Q·(P − PM): comprar ao preço atual só dilui o %. O "Por quê" diz isso em uma linha, e a tela não mostra um "novo L/P" em R$.
- **Renda por mês a mais:** FII, q × último provento (`lastDividend`, o FII paga por mês); ação, q × proventos de 12 meses ÷ 12 (`dividends12m`), porque o provento de uma ação é irregular e um JCP isolado inventaria uma renda mensal. Null sem o dado.
- **YOC:** proventos de 12 meses por cota ÷ PM, antes e depois (o mesmo `dividends12m` por cota, que não muda com a compra). Null sem `dividends12m` ou com PM antes nulo (no depois, sem PM antes, usa P).

### Geral: `portfolioImpact(impacts, values)` → `PortfolioImpact`

- **Patrimônio:** antes = o valor das classes da visão (`classValues`: FIIs, ações ou as duas no Geral), depois = antes + o gasto das ordens.
- **Renda por mês a mais:** soma dos papéis com dado, e quantos papéis ficaram sem dado (`incomeMissing`), para a tela dizer "sem dado de N".
- **YOC da carteira comprada:** não entra. Ele pediria os proventos de todas as posições, não só das que recebem ordem; fica fora (YAGNI).

## Dados

- FIIs: `CascadeAsset` já traz `quantity`, `averagePrice`, `lastDividend` e `dividends12m`.
- Ações: `StockBuyAsset` ganha `averagePrice`, `lastDividend` e `dividends12m`, opcionais (ausente ou null é "sem dado"), preenchidos em `buildSnapshot` (`stockBuyInput`) como os dos FIIs. `stockSmartBuy` não os lê, então as duas versões do motor dão o mesmo resultado (os testes atuais continuam valendo).

## Tela

- **Linha da ordem** (tabela e lista do celular): o selo "+R$ X/mês estim." ao lado do total, sob `Sensitive` como os outros valores da carteira. Sem dado, sem selo.
- **"Por quê"** (tooltip na tabela, sheet no celular): um bloco "Depois desta ordem" com PM, YOC e L/P %, cada um "antes ➔ depois". Verde (`text-gain`) quando o PM cai, o YOC sobe ou o L/P % sobe; vermelho (`text-loss`) no contrário; sem cor quando igual. A linha "Em R$, o resultado da posição não muda: a compra ao preço atual só dilui o %." Sem posição, "Posição nova" no lugar do antes.
- **Cards do topo:** "Ordens" ganha a linha "Patrimônio" com "R$ A ➔ R$ B"; "Sobra para o próximo aporte" ganha "Renda/mês" com "+R$ X" (e "sem dado de N" quando houver). No celular, as mesmas duas linhas entram no card único, no `StatList` que já existe.
- **`HowItWorks`:** o último passo ganha um parágrafo com as contas acima em linguagem simples, o L/P em R$ que não muda incluído.

## Testes (`smart-buy/domain/aporte-impact.test.ts`)

- PM com posição, sem posição e sem PM;
- o L/P em R$ igual antes e depois em 500 casos sorteados com semente;
- renda: FII pelo último provento, ação por 12 meses ÷ 12, null sem dado;
- YOC antes e depois, null sem dado;
- geral: patrimônio depois = antes + gasto, renda somada, `incomeMissing`;
- `snapshot.test.ts`: o `stockBuyInput` leva `averagePrice`, `lastDividend` e `dividends12m`.
