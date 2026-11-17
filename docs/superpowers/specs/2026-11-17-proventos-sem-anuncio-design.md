# Proventos: FIIs sem anúncio e ações fora da previsão do mês

Data: 2026-11-17. Estado: implementada na branch `feat/proventos-sem-anuncio`. Código afetado: `portfolio/domain/dividends.ts`
(`undisclosedDividends`, `monthSummary`), `portfolio/server/dividends-view.ts`, os cards do mês e a
lista "A receber" de `/proventos`. Spec de origem: `2026-10-18-proventos-design.md` (§4).

## 1. O problema

O dono reparou que a tela de proventos não lista todos os ativos que pagaram no mês passado e que o
total do mês parece muito menor do que o normal. Ele também pediu que as ações sejam tratadas de um
modo em que a previsão não afete o mês corrente, porque ação não paga todo mês como FII.

### O que foi medido (carteira real, leitura apenas, 2026-11-17)

25 ativos em carteira (20 FIIs, 5 ações). Todos os 20 FIIs pagaram em 11 ou 12 dos últimos 12 meses.
O que a tela mostra hoje para novembro:

| Situação em 17/11 | FIIs |
| --- | --- |
| Já recebido | GARE11, KNUQ11, PVBI11, TRXF11, VRTA11 (5) |
| "A receber" por estimativa do Yahoo | BRCO11, BTLG11, FATN11, HGRU11, MCCI11, PMLL11, RBRY11, RECR11, SNCI11, VGIP11, VISC11, XPLG11 (12) |
| "Não divulgado" (selo, sem valor nos totais) | SNAG11, XPML11 (2) |
| **Não aparece em lugar nenhum** | **SNFF11** (1) |

Ou seja: 17 dos 20 FIIs têm dinheiro no total, 2 aparecem só como selo e 1 some. Os 2 do selo valem
dinheiro de verdade e ficam fora do "Total do mês", que é a impressão de "vou receber menos".

### Causas no código

1. **Regra frágil de elegibilidade** (`undisclosedDividends`, `dividends.ts:356`): o FII só entra se
   pagou nos **dois** meses anteriores. O SNFF11 pagou em 11 dos 12 meses, mas pulou outubro, então
   não passa e some. Um mês de atraso de crédito ou de extrato incompleto basta para o FII sumir.
2. **O selo não tem valor no total**: "Nunca entra nos totais" (spec original). O dono não tem como
   ver quanto falta divulgar, e o card "Total do mês" fica abaixo do que o histórico indica.
3. **`listed` olha qualquer item do "a receber"** (`dividends.ts:357`), mesmo um que paga em outro
   mês. Um FII com item para o mês seguinte deixa de ser "não divulgado" neste.
4. **O que já está certo**: ação nunca entra no "não divulgado" (o filtro `isFiiLike` da view) nem na
   estimativa do Yahoo, e o total só soma item da B3 ou do Fundamentus com pagamento dentro do mês.
   Falta tornar isso uma regra escrita e testada, porque a correção de FIIs abaixo é justamente o tipo
   de regra que, estendida às ações por engano, as distorceria (ver §3).

## 2. Proposta para os FIIs

### 2.1 Quem é "pagador mensal"

Em vez de "pagou nos dois meses anteriores", a regra passa a olhar a janela de 12 meses fechados:

- O FII é **pagador mensal** se recebeu **Rendimento ou Reembolso** (nunca Aluguel) em **pelo menos 9**
  dos 12 meses fechados anteriores ao atual. Tolera até 3 meses sem crédito; FII trimestral ou
  semestral (4 ou 2 pagamentos por ano) não passa.
- Continua exigindo cotas na carteira hoje, nenhum crédito neste mês e nenhum item do "a receber"
  **que pague neste mês** (corrige a causa 3: item de outro mês não cobre este).
- Continua sem entrar quando o Yahoo já tem data ex neste mês.
- Constante `MONTHLY_PAYER_MIN_MONTHS = 9` ao lado de `PAY_WINDOW_DAYS`, sem tela de ajuste.

Com isso o SNFF11 entra (11 de 12) e os outros 19 FIIs seguem iguais.

### 2.2 Valor de referência

`lastAmount` passa a ser o **último crédito** do FII (como hoje) mais o mês dele (`lastMonth`), para o
caso de o último não ter sido o mês passado. A tela mostra "ref. out/26" quando for o mês passado e
"ref. set/26" quando for outro, para o dono saber de onde vem o número. Sem mediana: um pagamento
extraordinário num mês inflaria a mediana de poucos pontos tanto quanto o último, e o último é o que o
dono já conhece.

### 2.3 Entrar na conta sem misturar com o confirmado

O valor de referência **não entra** em "A receber" nem na barra de progresso, que continuam sendo só
dinheiro anunciado ou estimado por dado de mercado. Em vez disso:

- `DividendMonthSummary` ganha `undisclosed: number` (soma das referências) e `undisclosedAssets`.
- O card "Total do mês" ganha duas linhas abaixo dos tipos: **"Sem anúncio · ref."** (o valor, só dos
  FIIs) e **"Se repetirem o último pagamento"** (total + referência). A segunda é a resposta direta à
  impressão de receber menos. No celular, as mesmas duas linhas no card único.
- O texto do card diz em uma linha: "Estimativa dos FIIs mensais que ainda não anunciaram. Ações ficam
  de fora." Valores sob `Sensitive`.
- A lista "A receber" mostra o selo "não divulgado" com o valor de referência em cinza e o "ref. mês"
  (hoje o selo aparece sem valor).

### 2.4 O que não muda

O "Total do mês", o card "A receber" e a barra continuam como estão. `dividendPace` (média de 12
meses fechados) e as telas de reinvestimento não leem o "sem anúncio".

## 3. Ações: previsão nunca afeta o mês corrente

Ação paga em trimestres, semestres ou uma vez por ano, e o JCP segue o calendário da empresa. Uma
projeção "se repetir o mês passado" para ação seria quase sempre errada, para mais ou para menos.

Regras (escritas e testadas, em vez de só dependerem do filtro da view):

1. **Nenhuma projeção de ação entra no mês.** O "sem anúncio" (§2) é só de FII. A função recebe a
   classe de cada ativo e ignora `ACAO` por contrato, não pelo que o chamador filtra.
2. **O "a receber" de ação só tem o que foi anunciado**: foto da B3 ou anúncio do Fundamentus, com data
   de pagamento. Conta no mês corrente só se o pagamento cai no mês (já é assim para B3 e Fundamentus;
   o teste fixa).
3. **Ação anunciada para outro mês aparece, mas fora do total do mês.** A lista "A receber" já mostra a
   data de pagamento; o card do mês não soma. Um aviso pequeno no card quando houver: "N ação(ões) com
   pagamento em outro mês, fora deste total".
4. **O histórico de ação não vira padrão.** Na carteira real, BBAS3, BBSE3, VALE3, PETR4 e EGIE3
   mostram créditos em quase todos os meses, o que não é o calendário de dividendos: parte é aluguel de
   ações (`ALUGUEL`, taxa de empréstimo da B3, que cai quase todo mês), a confirmar nos dados. Por isso
   o "pagador mensal" ignora `ALUGUEL` em qualquer classe e nunca é aplicado a ação.
5. **Opcional, fora do escopo desta spec**: um "calendário habitual" informativo das ações (meses em
   que costumam pagar, só de Dividendo e JCP), sem valor e sem entrar em total. Fica para depois se o
   dono quiser.

## 4. Mudanças por arquivo

- `portfolio/domain/dividends.ts`: `undisclosedDividends` (§2.1, §2.2; recebe `classes`, ignora
  `ACAO` e `ALUGUEL`, `listed` só com item que paga no mês); `monthSummary` (os dois campos novos,
  sem tocar em `received`, `upcoming` e `total`).
- `portfolio/domain/types.ts`: `UndisclosedDividend.lastMonth`, `DividendMonthSummary.undisclosed` e
  `undisclosedAssets`.
- `portfolio/server/dividends-view.ts`: passa as classes e o que `monthSummary` precisa; os spans
  `koinos.view.undisclosed` seguem.
- `portfolio/components/dividends/month-cards.tsx` e `upcoming-list.tsx`: as linhas do §2.3, o selo
  com valor e o aviso das ações do §3.3. Visão de celular incluída (um card só, `InfoSheet` para o
  texto longo).
- `CLAUDE.md`, seção `/proventos` e item 4 do Domain flow: trocar a descrição do "não divulgado" e
  registrar as regras das ações. Spec `2026-10-18-proventos-design.md` §4: nota apontando para esta.

## 5. Testes (`portfolio/domain/dividends.test.ts`)

- O pagador de 11 de 12 meses que pulou o mês passado entra (o caso do SNFF11); 9 de 12 entra e 8 de 12
  não; trimestral não entra; sem cotas hoje não entra.
- Item do "a receber" que paga no mês seguinte não esconde o FII; o que paga neste mês, sim.
- `ALUGUEL` não conta como mês pago; uma ação com crédito todo mês (só aluguel) não gera referência.
- Ação nunca gera "sem anúncio", mesmo com o histórico que passaria na regra do FII.
- `monthSummary`: o `total` não muda com a referência; `undisclosed` soma só FIIs; ação anunciada para
  outro mês fica fora do total.
- Invariante: `received + upcoming + undisclosed` = o "Se repetirem o último pagamento" mostrado.

## 6. Decisões (tomadas pelo advisor a pedido do dono, 2026-11-17)

1. **Limite de 9 de 12 meses.** Tolera 3 falhas: traz o SNFF11 sem trazer FII irregular.
2. **Referência = último crédito**, com o mês dele. O dono já conhece o número, e a mediana de poucos
   pontos não protege melhor de um pagamento extraordinário.
3. **Yahoo com pagamento no mês seguinte fica fora desta spec.** `monthSummary` soma todo item
   `YAHOO` sem olhar o mês de `payBy`. Corrigir muda o "A receber" e merece spec e teste próprios;
   misturar aqui esconderia o efeito de cada mudança. Registrar como pendência.
4. **Calendário habitual das ações: não agora.** Sem valor e sem total, o ganho é pequeno, e
   o aluguel precisa ser separado do dividendo nos dados antes (§3.4). Reavaliar depois.
