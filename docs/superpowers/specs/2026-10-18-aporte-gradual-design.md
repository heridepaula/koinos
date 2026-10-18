# Entrada gradual no aporte: especificação de design

- **Data:** 2026-10-18
- **Status:** decidido na conversa. O usuário pediu para seguir sem novas perguntas, então os padrões abaixo são a recomendação, e o limite pode ser trocado na tela.
- **Ciclo:** muda a cascata Suno das Recomendações (spec do MVP, §9). A fila de prioridade não muda.

## 1. Objetivo

Um FII não pode levar o aporte inteiro do mês.

- **Exemplo do usuário:** 0 cotas de um FII e R$ 15.000 para aplicar. A cascata atual põe tudo nele, porque faltam cerca de R$ 28.600 para a meta.
- **Com a entrada gradual:**
  - ele recebe no máximo metade do aporte (R$ 7.500);
  - o resto segue o ranking;
  - nos meses seguintes ele continua sendo o foco, até chegar à % sugerida.

### Base no método Suno

- **Compra aos poucos:** "investir aos poucos, distribuindo as compras ao longo de alguns meses" e "pulverizar os ativos" (Suno Notícias, coluna de Gustavo Asdourian, 13/05/2022).
- **Regularidade acima do momento:** no Suno Invest 2026, o resultado dos aportes "depende mais da regularidade, da diversificação e da análise dos fundamentos de cada fundo" (FIIs.com.br, 12/09/2026). Tiago Reis: "Tempo no mercado vale mais que o momento de entrada".
- **Regras que continuam:** só comprar abaixo do teto, seguir o ranking até a % sugerida e rebalancear com aportes, sem vender.

### Por que melhora o preço médio

- **Mais cotas no preço baixo:** com valores parecidos todo mês, a compra leva mais cotas quando o preço cai e menos quando ele sobe.
- **Efeito no preço médio:** ele fica igual ou abaixo da média simples dos preços dos meses, porque a média harmônica nunca passa da aritmética.
- **Sem compra única decisiva:** nenhuma compra sozinha define o preço médio da posição.

### Critérios de sucesso

1. Com o limite padrão (50%), nenhum FII recebe mais de 50% do aporte. A exceção é quando uma única cota já passa disso.
2. **Exemplo do usuário** (FII novo no topo do ranking, 0 cotas, R$ 15.000): no máximo R$ 7.500 vão para ele, e o resto vai para os próximos do ranking que estão abaixo da meta.
3. Ele continua em 1º na fila nos meses seguintes, até a meta.
4. Com "Sem limite", as ordens são exatamente as de antes.
5. **Carteira real de hoje** (17 FIIs, pesos iguais, R$ 15.000): saem as mesmas ordens de antes, porque nenhum FII tem mais de R$ 7.500 de diferença para a meta.

## 2. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Regra | Limite por FII, em % do aporte do mês | É a tradução direta do pedido e não depende de histórico de compras |
| Padrão | 50% | Na carteira real (meta de ~R$ 28.600 por FII e aporte de R$ 15.000), um FII novo chega à meta em 4 a 5 aportes: "alguns meses" |
| Opções na tela | 25%, 33%, 50%, 75% e Sem limite | O usuário ajusta o ritmo. "Sem limite" volta ao comportamento de antes |
| Mínimo | 1 cota | Se o limite não paga uma cota, compra 1, desde que caiba no aporte. Senão o FII do topo nunca entraria com aportes pequenos |
| Alcance | Vale para todos os FIIs do aporte, na fila e na sobra | Se valesse só para o 1º, o 2º poderia levar mais que o foco |
| Fila | Não muda | O foco é o 1º do ranking abaixo da meta, mês a mês, até a meta |
| Resto do aporte | Segue o ranking. Se os FIIs abaixo da meta já estiverem no limite, vai para os de menor peso em relação à meta (a regra de sobra de hoje), também com limite | O dinheiro continua investido e diversificado |
| Onde fica a escolha | Na URL (`?limite=50`), como o valor do aporte | Não precisa de modelo novo. Sem o parâmetro, vale 50% |

## 3. Alternativas descartadas

- **Montar em N aportes (parcela = diferença para a meta ÷ N):**
  - a parcela depende da diferença para a meta, não do aporte;
  - no exemplo do usuário, N = 2 dá R$ 14.300, 95% do aporte, então não garante o limite pedido;
  - também exige guardar em qual parcela o FII está, ou converge devagar se for recalculada todo mês.
- **Comprar mais quando o preço está abaixo do preço médio:**
  - é tentar acertar o momento, o oposto de "tempo no mercado vale mais que o momento de entrada";
  - não funciona com 0 cotas, porque ainda não existe preço médio;
  - continua só como desempate da sobra, como hoje.

## 4. Regra

**Limite em reais:** limite = fração × aporte. Com "Sem limite" (fração 1), o limite não existe, e a cascata é a de antes em todos os casos.

**Máximo de cotas por FII:** o maior entre 1 e ⌊limite ÷ preço⌋.

**Passo 1, a fila pelo ranking.** Cada FII elegível compra o menor destes três números:
- as cotas que faltam para a meta, arredondadas como hoje;
- o máximo de cotas menos as que ele já comprou;
- as cotas que cabem no saldo.

**Passo 2, a sobra.** Roda quando todo FII elegível está na meta **ou no limite**.
- Compra 1 cota por vez para o FII de menor peso em relação à meta, entre os que cabem no saldo e não chegaram ao limite.
- Desempate: o mais abaixo do preço médio, depois o ranking.

**Saldo guardado.** Se um FII abaixo da meta ainda não chegou ao limite, mas a próxima cota dele custa mais que o saldo, o saldo fica guardado para o próximo aporte, como hoje.

**Sobra.** O que restar aparece como "Sobra para o próximo aporte".

## 5. Estimativa de aportes até a meta

Vale para uma ordem cortada pelo limite com o FII ainda abaixo da meta.

- **Falta depois:** meta − (valor atual + cotas compradas × preço).
- **Ritmo por aporte:** total da ordem − peso × aporte.
  - Cada aporte igual compra cerca do mesmo total.
  - A meta cresce peso × aporte a cada mês, porque a carteira cresce.
- **Aportes que faltam:** ⌈falta depois ÷ ritmo⌉, se o ritmo for positivo. Senão, sem estimativa.

A estimativa supõe mesmo aporte, mesmo preço e mesmo ranking. Na tela, ela aparece como aproximação ("≈").

## 6. Tela (Recomendações)

- **Card "Quanto vou aportar hoje?":**
  - ao lado do valor, o seletor "Máximo por FII": 25%, 33%, 50% (padrão), 75% do aporte ou Sem limite;
  - texto de apoio: "Para montar cada posição aos poucos e formar o preço médio em várias compras."
- **"Por quê" de uma ordem cortada:** termina com "limite de 50% do aporte · faltam ≈ 3 aportes como este".
- **Ordens de compra:** quando alguma ordem foi cortada, a descrição ganha "Entrada aos poucos: nenhum FII leva mais de 50% do aporte. O que passou do limite seguiu o ranking."
- **Faixa de princípios:** ganha "Monte posições aos poucos".
- **Prioridade (Carteira Alvo e posições):** não muda.

## 7. Arquitetura

| Peça | Arquivo | Mudança |
| --- | --- | --- |
| Regra (puro) | `src/features/smart-buy/domain/suno-cascade.ts` | `sunoCascade(amount, assets, { maxShare })`, `DEFAULT_MAX_SHARE = 0.5` e `MAX_SHARE_OPTIONS`. `CascadeOrder` ganha `limited`, `gapAfter` e `aportesLeft`. `CascadeResult` ganha `maxShare` |
| API da feature | `src/features/smart-buy/index.ts` | Exporta as constantes e os tipos novos |
| Calculadora | `src/features/smart-buy/components/aporte-calculator.tsx` | Seletor "Máximo por FII" (nuqs, `limite`), "Por quê" e o aviso da entrada aos poucos |
| Princípios | `src/features/smart-buy/components/principles-banner.tsx` | Novo item |

`aportePriorities`, que alimenta a coluna Prioridade, chama a cascata com aporte zero e não muda.

## 8. Fora deste ciclo

- Guardar o limite no perfil do usuário (hoje ele fica na URL).
- Plano mês a mês ou histórico de parcelas por FII.
- Limite por categoria (tijolo, papel).

## 9. Verificação

1. **Script descartável com a carteira real:**
   - "Sem limite" dá as ordens de antes;
   - 50% dá as mesmas ordens de hoje;
   - um FII novo simulado no topo recebe 50%, e o resto segue o ranking;
   - uma simulação de 6 meses mostra que ele chega à meta e fica em 1º na fila até lá.
2. **Casos sintéticos:**
   - o limite não paga uma cota;
   - só um FII elegível;
   - todos na meta;
   - "Sem limite" com saldo que sobra para um FII abaixo da meta.
3. **Checagens do projeto:** `npm run format:check`, `lint`, `typecheck` e `build` passam.
4. **Tela:** screenshot das Recomendações com `?valor=15000`, com e sem o FII novo.
