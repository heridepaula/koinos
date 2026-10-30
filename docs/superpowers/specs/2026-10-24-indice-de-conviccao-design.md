# Índice de Convicção na cascata: especificação de design

- **Data:** 2026-10-24
- **Status:** aplicado a pedido do usuário ("Aplique as regras abaixo", com o documento "Como o Koinos escolhe onde aportar" reescrito por ele). Substitui, antes de chegar à produção, a proposta do mesmo dia de fila pela distância da meta, base no patrimônio todo e sobra contínua.
- **Ciclo:** muda a cascata das Recomendações (spec do MVP, §9). A entrada gradual (spec de 2026-10-18) continua, com o limite padrão em 33%.
- **Substituída em 2026-10-30** pelo motor Koinos 3.0 (`2026-10-30-koinos-3-0-design.md`): os multiplicadores em degraus viraram tensores contínuos (valuation, proventos, segurança e vacância), e o limite por FII virou as travas de 33% por FII, 35% por setor e 60% por macro. O que segue é o histórico.

## 1. Regras

1. **Quem participa:** só os FIIs na estratégia. Fora dela, o FII nunca recebe aporte, e o valor dele não entra na meta, com qualquer % (0% marca a quarentena).
2. **Meta:** peso × (valor da estratégia + aporte). **Gap base** = meta − valor atual. Com gap base ≤ 0, o FII está na meta e não pede nada.
3. **Multiplicadores** (só com gap base > 0):
   - margem até o teto, (teto − preço) ÷ teto: acima de 5%, ×1,2; até 5%, ×1,0;
   - P/VP: abaixo de 0,95, ×1,2; de 0,95 a 1,00 (pontas inclusas), ×1,0; acima de 1,00, ×0,5.
4. **Gap ajustado** = gap base × os dois multiplicadores. **Cotas desejadas** = gap ajustado ÷ preço, arredondado para a cota mais próxima: só compra com meia cota ou mais.
5. **Passo 1:** pelo ranking, cada FII compra o menor entre as cotas desejadas, o limite por FII (33% do aporte, por padrão) e o que o saldo paga. Se o saldo não paga um FII, ele compra o que der, e a cascata segue para os próximos.
6. **Passo 2 (sobra):** só roda quando todo FII elegível comprou as cotas desejadas (ou chegou ao limite). Então compra uma cota por vez do de menor valor ÷ meta; no empate, o mais abaixo do preço médio; depois, o melhor ranking. Senão, a sobra fica para o próximo aporte.
7. **Filtros e motivos:** os de antes (sem cotação, sem ranking, sem teto, acima do teto, já na meta, faltou saldo).

## 2. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Limite por FII | **Mantido, com 33% como padrão** | O documento o tirou ("eliminar travas manuais"), mas o exemplo da seção 5 dele não fecha sem limite: um FII novo com P/VP 1,05 e margem acima de 5% pede 0,6 do gap base, e com gap grande isso passa do aporte. O usuário tirou o limite e, no mesmo dia, pediu de volta com 33% |
| P/VP | Entrada `priceToBook` na cascata, **nula por enquanto**: multiplicador ×1,0 | Não há fonte gratuita e permitida para todos os FIIs (§5) |
| Fora da estratégia | Fica fora da cascata e da base, com qualquer % | Regra 2 do documento |
| 0% | Só fora da estratégia; quem entra na estratégia com 0% volta a ficar sem % | Pedido do usuário. Na estratégia, a % vazia divide o que falta |
| Multiplicadores > 1 | O FII pode passar da meta | É o que a regra faz: o descontado pede mais que o gap. No aporte seguinte, ele aparece "na meta" |

## 3. O que observar

- **Concentração:** com os três fundos da Suno marcados na estratégia, todas as outras metas sobem, e os primeiros do ranking batem no limite. Sem limite, um só FII levava de 72% a 99% de um aporte típico na carteira real.
- **A margem de 5% separa pouco:** na carteira real, 15 dos 17 FIIs têm mais de 5% de margem, então quase todos pedem 1,2 vez o gap. Os primeiros do ranking passam da meta, e o dinheiro acaba antes nos últimos da fila.
- **O P/VP tem um degrau em 1,00:** de 0,999 para 1,001, o pedido cai pela metade. Uma oscilação de 1% no preço troca a recomendação de um dia para o outro.
- **O P/VP diz mais em papel e FoF:** pela Suno, em tijolo o valor patrimonial depende de laudos. A regra vale igual para todos.
- **A sobra quase nunca é redistribuída:** de R$ 100 a R$ 20.000, em nenhum aporte o passo 2 rodou na carteira real.

## 4. Arquitetura

| Peça | Arquivo | Mudança |
| --- | --- | --- |
| Multiplicadores (puro) | `src/features/smart-buy/domain/conviction.ts` | `marginMultiplier`, `priceToBookMultiplier` |
| Cascata (puro) | `src/features/smart-buy/domain/suno-cascade.ts` | `CascadeAsset.priceToBook`; cotas desejadas pelo gap ajustado; a trava da sobra usa as cotas desejadas. `CascadeOrder` ganha `priceToBook`, `marginMultiplier`, `priceToBookMultiplier`, `adjustedGap` e `desired`. O limite padrão (`DEFAULT_MAX_SHARE_PERCENT`) passa de 50% para 33% |
| Entrada | `src/features/portfolio/domain/snapshot.ts` | `priceToBook: null` até haver fonte |
| Tela | `smart-buy/components` | "Por quê" com a margem, o P/VP (quando houver) e "convicção ×1,44: pediu R$ …"; princípio "Compre mais do que está descontado" |
| 0% fora da estratégia | `strategy/domain/quarantine.ts`, `schemas.ts`, `actions.ts`, `server/target-asset.model.ts`, `server/target-asset-repo.ts`, `components/table/number-field.tsx` | Aceita 0. 0% na estratégia é recusado no campo (o aviso aparece e o campo volta ao valor salvo) e na action; quem entra na estratégia com 0% volta a ficar sem % |
| Testes | `*.test.ts` em `smart-buy/domain`, `strategy/domain` e `portfolio/domain` | Vitest 5 (`npm test`, também no CI) |

## 5. Fonte do P/VP

- **Descartados:**
  - brapi gratuita: não tem o valor patrimonial;
  - Yahoo: tem para 2 dos 17 FIIs, e no MXRF11 com valor diferente da CVM;
  - lista de fundos da B3 (para ligar a CVM ao ticker): a B3 não pode ser chamada;
  - API interna de busca do StatusInvest: tem o P/VP, mas os termos de uso (`/condicoes-de-uso`) proíbem copiar os dados para um banco e criar programas que os copiem, e o site bloqueia clientes que não são navegadores. Pedido do usuário em 2026-10-24, recusado por isso.
- **Opções para o usuário:**
  1. **CVM com o CNPJ de cada FII digitado uma vez na Carteira Alvo:** grátis e oficial, VP mensal (é de onde vem o VP dos sites de FIIs). Dispensa a lista da B3, que era o que falhava. O código do adaptador da CVM está na tag local `arquivo/pvp`.
  2. **brapi Pro** (R$ 139,99/mês): o mesmo número da CVM, automático.
  3. **VP por cota digitado na Carteira Alvo**, a partir do relatório da Suno: simples, mas manual e mensal.

## 5.1 Fonte escolhida em 2026-10-30

Depois de comparar as duas APIs nos planos gratuitos, com chamadas reais, ficou a **usebolsai gratuita** para o VP e a **brapi gratuita** para as cotações:

- a brapi gratuita não tem dados de FII (P/VP, DY e proventos são do Pro, R$ 139,99/mês);
- a usebolsai gratuita tem o VP da CVM para os 20 FIIs da carteira, inclusive os renomeados e o Fiagro, com 200 chamadas por dia;
- o `pvp` dela vem com 2 casas, então o Koinos calcula fechamento ÷ VP;
- o DY 12 meses dela erra para cima em 11 de 20 FIIs; DY e último provento seguem no Yahoo, que bate melhor com os extratos da B3.

O cron `/api/cron/fundamentals` roda às 2h de Brasília. O StatusInvest não foi usado.

## 6. Verificação

- `npm test`: 33 testes, incluindo invariantes em 500 carteiras aleatórias com semente fixa. Os mutantes "margem sempre ×1" e "sobra sem a trava" derrubam testes.
- Script descartável, só de leitura, com a carteira real.
- `format:check`, `lint`, `typecheck` e `build`. O pacote das páginas não mudou (Recomendações 356 KB, Carteira Alvo 364 KB, gzip).
- Prévia isolada (`koinos_preview`, cópia da carteira): Recomendações na mesa e no iPhone, claro e escuro, sem erros no console; 0% salvo num FII fora da estratégia e recusado num da estratégia.
