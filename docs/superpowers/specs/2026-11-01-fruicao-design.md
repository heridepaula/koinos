# Fruição: fase da carteira e retenção de proventos

Data: 2026-11-01. Origem: parecer do conselho sobre a proposta de 4 regras (preço-teto, estados, desempate por DY, fruição com retenção de 24%), pedido "Implemente" do dono no mesmo dia.

## 1. O que a proposta pedia e o que já existia

| Regra da proposta | Situação no Koinos 3.1 | Decisão |
| --- | --- | --- |
| 1. Bloquear a compra acima do preço-teto | Já existe: `ACIMA_DO_TETO` na elegibilidade da cascata; o valor do FII fica na base, então as metas dos outros não mudam | Nada a fazer. O teto continua o do ranking |
| 2. Estados COMPRAR / AGUARDAR / VENDER | Aguardar já tira FIIs e ações do aporte (`BIASES = ["COMPRAR","AGUARDAR"]`). A meta não é redistribuída; só o dinheiro do aporte escoa para os outros pela fila e pela sobra | Nada a fazer. VENDER contraria "nunca vender"; o equivalente é a quarentena (0% fora da estratégia) |
| 3. Desempate por DY projetado | A cascata não escolhe um vencedor: ordena pelo rank e multiplica o gap pelos tensores | Recusado: DY nominal puxa para papel (o DY embute o IPCA) e para o FII que cortou provento. Um tensor de yield real fica para depois da spec do SGS |
| 4. Fruição com retenção | Não existia | **Esta spec** |

### Nota sobre a fórmula de teto proposta

"Renda anual ÷ (Cupom NTN-B 2035 + spread)" tem dois erros de unidade, registrados para quando houver um teto calculado:

- o cupom da NTN-B é fixo (6% a.a.); o que varia é a **taxa** de mercado;
- a taxa da NTN-B é **real** e o DY do papel é **nominal**; dividir um pelo outro infla o teto do papel. Use yield nominal contra taxa nominal, ou renda deflacionada contra taxa real.

## 2. Regra

- **Fase** (`smart-buy/domain/income-phase.ts`, pura): `IncomePhase = { kind: "ACUMULACAO" } | { kind: "FRUICAO"; retention }`.
  - Acumulação: todo provento volta para a carteira.
  - Fruição: a fração `retention` volta para a carteira como aporte, pelos mesmos motores (teto, Aguardar, suspensão, travas, mínimo por ordem); o resto é o que o dono pode gastar.
- **Retenção:** padrão 25% (`DEFAULT_RETENTION`, o estudo debatido na live de Baroni; a proposta dizia 24%, sem fonte). Aceita de 20% (`MIN_RETENTION`, o piso da live) a 100%: abaixo disso, `fruition()` lança `RangeError`, porque o saque total fica barrado.
- **`splitIncome(income, phase)`:** divide em centavos inteiros, com a retenção arredondada para cima (nunca reter menos que a fração); as partes somam o provento. Provento ≤ 0 ou inválido dá zero nas duas.
- **A fase não entra nos motores.** Ela só decide o valor do aporte; a cascata e o smart buy de ações continuam recebendo um valor em R$.

## 3. Simulação e laboratório

- `simulateAportes` ganha `phase`, `stockDividends` e `otherIncome` (opcionais). Sem `phase`, nada muda (os testes e as notas antigas valem).
  - Com fase, cada período recebe os proventos das cotas do começo do período: FIIs pelo `lastDividend` por cota, ações pelo mapa `stockDividends`, mais `otherIncome` (os ativos fora das estratégias, constante). O valor do período é `amount + reinvest`, dividido pela % dos FIIs.
  - `SimulationPeriod.income` traz `{ gross, reinvest, consume }` (nulo sem fase). `periodIncome` é exportado.
  - O provento por cota não anda com o preço, e a sobra de um período não passa para o seguinte (como nos aportes).
- Laboratório: `fruicao [--periodos 24] [--retencao 25] [--fiis 100] [--ipca 4.5] [--versao]` roda sem aporte externo e mostra, mês a mês, renda, retida, gasta, investido, sobra e ordens; no fim, a renda inicial → final, o valor das estratégias e, com `--ipca`, a renda que manteria o poder de compra.

Primeiro resultado (carteira real, 2026-11-01, motor 3.1, 24 meses, 25%, IPCA 4,5% de hipótese): renda de R$ 8.876 → R$ 9.413 (+6,1%) contra R$ 9.657 para acompanhar o IPCA; estratégias +11,6%. Com provento por cota parado (o pior caso), 25% não repõe 4,5% ao ano; na vida real o papel repassa parte da inflação no próprio provento.

## 4. Fora do escopo

- Uma tela ou configuração da fase no app: hoje o dono está na acumulação, e a % reinvestida por mês (`reinvestments`, padrão 100%) já registra o que acontece. Quando a fruição começar, a fase vira uma configuração do portfólio e a tela de Recomendações pode sugerir o aporte = retenção dos proventos do mês.
- Retenção ligada ao IPCA (≈ %papel × IPCA ÷ DY): depende da spec do SGS.
- Teto calculado como alerta de divergência contra o teto do ranking: depende de uma fonte da taxa da NTN-B (nunca a B3).

## 5. Testes

- `income-phase.test.ts`: padrão 25%, faixa 20–100% com `RangeError`, acumulação 100%, centavos com retenção para cima, soma das partes em uma grade de valores, provento zero/negativo/NaN.
- `simulation.test.ts`: sem fase não há renda; fruição sem aporte investe só a retenção; a trava de 25% por FII barra cota maior que um quarto da retenção; as cotas compradas pagam no período seguinte; acumulação soma aporte + provento; acima do teto a retenção vira sobra; `otherIncome` entra na renda e na retenção; ações pagam pelo mapa.
