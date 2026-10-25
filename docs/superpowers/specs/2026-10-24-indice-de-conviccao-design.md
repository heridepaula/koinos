# Índice de Convicção na cascata: especificação de design

- **Data:** 2026-10-24
- **Status:** aplicado a pedido do usuário ("Aplique as regras abaixo", com o documento "Como o Koinos escolhe onde aportar" reescrito por ele). Substitui, antes de chegar à produção, a proposta do mesmo dia de fila pela distância da meta, base no patrimônio todo e sobra contínua.
- **Ciclo:** muda a cascata das Recomendações (spec do MVP, §9, e a da entrada gradual, de 2026-10-18).

## 1. Regras

1. **Quem participa:** só os FIIs na estratégia. Fora dela, o FII nunca recebe aporte, e o valor dele não entra na meta, com qualquer % (0% marca a quarentena).
2. **Meta:** peso × (valor da estratégia + aporte). **Gap base** = meta − valor atual. Com gap base ≤ 0, o FII está na meta e não pede nada.
3. **Multiplicadores** (só com gap base > 0):
   - margem até o teto, (teto − preço) ÷ teto: acima de 5%, ×1,2; até 5%, ×1,0;
   - P/VP: abaixo de 0,95, ×1,2; de 0,95 a 1,00 (pontas inclusas), ×1,0; acima de 1,00, ×0,5.
4. **Gap ajustado** = gap base × os dois multiplicadores. **Cotas desejadas** = gap ajustado ÷ preço, arredondado para a cota mais próxima: só compra com meia cota ou mais.
5. **Passo 1:** pelo ranking, cada FII compra o menor entre as cotas desejadas, o limite por FII e o que o saldo paga. Se o saldo não paga um FII, a cascata segue para os próximos.
6. **Passo 2 (sobra):** só roda quando todo FII elegível comprou as cotas desejadas (ou chegou ao limite). Então compra uma cota por vez do de menor valor ÷ meta; no empate, o mais abaixo do preço médio; depois, o melhor ranking. Senão, a sobra fica para o próximo aporte.
7. **Filtros e motivos:** os de antes (sem cotação, sem ranking, sem teto, acima do teto, já na meta, faltou saldo).

## 2. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Limite por FII | **Mantido** (padrão 50%, "Sem limite" na tela) | O documento o tirou ("eliminar travas manuais"), mas o exemplo dele precisa do limite. Um FII novo com P/VP 1,05 e margem acima de 5% pede 0,6 do gap base, e com gap grande isso ainda passa do aporte: sem limite, ele leva o aporte inteiro, e não a metade. "Sem limite" dá exatamente a fórmula do documento |
| P/VP | Entrada `priceToBook` na cascata, **nula por enquanto**: multiplicador ×1,0 | Não há fonte gratuita confiável. A brapi gratuita não tem o valor patrimonial; a brapi Pro tem (R$ 139,99/mês, spec do P/VP de 2026-10-18). O Yahoo tem para 2 dos 17 FIIs, e com valor diferente da CVM no MXRF11. A CVM só chegava ao ticker com a lista de fundos da B3, que não pode ser chamada |
| Fora da estratégia | Fica fora da cascata e da base, com qualquer % | Regra 2 do documento |
| 0% | Só fora da estratégia; quem entra na estratégia com 0% volta a ficar sem % | Pedido do usuário. Na estratégia, a % vazia divide o que falta |
| Multiplicadores > 1 | O FII pode passar da meta | É o que a regra faz: o descontado pede mais que o gap. No aporte seguinte, ele aparece "na meta" |

## 3. O que observar

- **A margem de 5% separa pouco:** na carteira real, 15 dos 17 FIIs têm mais de 5% de margem, então quase todos pedem 1,2 vez o gap. O efeito é que os primeiros do ranking passam da meta, e o dinheiro acaba antes nos últimos da fila.
- **O P/VP tem um degrau em 1,00:** de 0,999 para 1,001, o pedido cai pela metade. Uma oscilação de 1% no preço troca a recomendação de um dia para o outro.
- **O P/VP diz mais em papel e FoF:** pela Suno, em tijolo o valor patrimonial depende de laudos. A regra vale igual para todos.
- **Base da estratégia:** um FII com valor grande dentro da estratégia e acima da meta empurra todas as outras metas para cima. Com os três fundos da Suno marcados na estratégia, o 1º e o 2º do ranking levam 99,5% de um aporte típico (os dois no limite de 50%). Fora da estratégia, a fila volta a se espalhar.
- **A sobra quase nunca é redistribuída:** de R$ 100 a R$ 20.000, em nenhum aporte com limite de 50% o passo 2 rodou na carteira real, antes ou depois dos multiplicadores.

## 4. Arquitetura

| Peça | Arquivo | Mudança |
| --- | --- | --- |
| Multiplicadores (puro) | `src/features/smart-buy/domain/conviction.ts` | `marginMultiplier`, `priceToBookMultiplier` |
| Cascata (puro) | `src/features/smart-buy/domain/suno-cascade.ts` | `CascadeAsset.priceToBook`; cotas desejadas pelo gap ajustado; a trava da sobra usa as cotas desejadas. `CascadeOrder` ganha `priceToBook`, `marginMultiplier`, `priceToBookMultiplier`, `adjustedGap` e `desired` |
| Entrada | `src/features/portfolio/domain/snapshot.ts` | `priceToBook: null` até haver fonte |
| Tela | `smart-buy/components` | "Por quê" com a margem, o P/VP (quando houver) e "convicção ×1,44: pediu R$ …"; princípio "Compre mais do que está descontado"; nota da calculadora |
| 0% fora da estratégia | `strategy/domain/quarantine.ts`, `schemas.ts`, `actions.ts`, `server/target-asset.model.ts`, `server/target-asset-repo.ts`, `components/table/number-field.tsx` | Aceita 0. 0% na estratégia é recusado no campo (o aviso aparece e o campo volta ao valor salvo) e na action; quem entra na estratégia com 0% volta a ficar sem % |
| Testes | `*.test.ts` em `smart-buy/domain`, `strategy/domain` e `portfolio/domain` | Vitest 5 (`npm test`, também no CI) |

## 5. Fonte do P/VP: opções para o usuário

1. **brapi Pro** (R$ 139,99/mês): o mesmo número da CVM, automático.
2. **CVM com o CNPJ de cada FII digitado uma vez na Carteira Alvo:** grátis e oficial, VP mensal. Dispensa a lista da B3, que era o que falhava.
3. **VP por cota digitado na Carteira Alvo**, a partir do relatório da Suno: simples, mas manual e mensal.

## 6. Verificação

- `npm test`: 32 testes, incluindo invariantes em 500 carteiras aleatórias com semente fixa. Dois mutantes (margem sempre ×1 e sobra sem a trava) derrubam 5 e 2 testes.
- Script descartável, só de leitura, com a carteira real: sem P/VP e com o limite de 50%, as ordens só mudam pelo multiplicador da margem.
- `format:check`, `lint`, `typecheck` e `build`. O pacote das páginas não mudou (Recomendações 356 KB, Carteira Alvo 364 KB, gzip).
- Prévia isolada (`koinos_preview`, cópia da carteira): Recomendações na mesa e no iPhone, claro e escuro, sem erros no console; 0% salvo num FII fora da estratégia e recusado num da estratégia.
