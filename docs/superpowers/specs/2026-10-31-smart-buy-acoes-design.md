# Smart Buy de ações e divisão escolhida no aporte: especificação de design

- **Data:** 2026-10-31
- **Status:** aprovado, a implementar (branch feat/smart-buy-acoes)
- **Origem:** documento do dono `algoritmo_smart_buy_a_es_reuni_o_e_especifica_o.md` ("Smart Buy Ações (Dividendos)") e o pedido: "na tela de recomendações o usuário seleciona a % de quanto aplicar do montante em cada carteira. Remova as % da carteira recomendada, ficará centralizado nas recomendações."
- **Substitui** parte de `2026-10-31-aporte-por-classe-design.md`: a meta por classe (`class_targets`), `splitByClassTarget`, `classAporte`, o troco cruzado e o `STOCK_CAPS` saem.

## 1. Objetivo

- Recomendar ações pelo algoritmo do documento: filtro de teto, meta e viés; ordem pela margem de segurança; cada ação até a meta.
- A divisão do aporte entre FIIs e ações é escolhida na tela de Recomendações, a cada aporte.
- A cascata de FIIs (motor 3.0) volta a ser exatamente a de antes da Fase 3.

### Critérios de sucesso

1. Com a tabela do documento e os preços dela: UNIP6 (margem 37%) é atendida antes de VALE3 (25%); BBSE3, PETR4, AXIA7 e ITSA4 não recebem (acima do teto ou viés Aguardar).
2. Nenhuma ação passa da sua meta em R$; gasto + troco = a parte das ações.
3. Sem `?fiis=`, 100% vai para FIIs, com as mesmas ordens de antes da Fase 3.
4. O painel "Meta entre classes" e o código de `class_targets` não existem mais.
5. Os testes novos (§7) passam, e os de hoje (menos os da divisão por meta, que saem) continuam passando.

## 2. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Divisão do aporte | Campo "% para FIIs" na tela de Recomendações, em `?fiis=` (0 a 100); ações = o resto; sem parâmetro, 100 | Escolha do dono |
| As % da Carteira Alvo | Sai o painel da meta entre classes. A % de cada ativo fica | Escolha do dono. O algoritmo usa o déficit até a % de cada ação |
| Motor de ações | O do documento, sem limite por ação | Escolha do dono. A meta já limita cada ação |
| Troco | Cada carteira guarda o seu; sem troco cruzado | Escolha do dono. A divisão é dele |
| Viés | Campo novo, só "Aguardar" bloqueia | O documento usa o viés como trava |
| % das ações | Usada como está (sem reescalar para 100%) | A tabela da Suno soma 81,5%: o resto é caixa, como no documento (`newTotalEquity * targetWeight / 100`) |

## 3. Motor de ações (`smart-buy/domain/stock-buy.ts`, puro)

### 3.1 Entrada

`StockBuyAsset`: `ticker`, `rank` (number | null), `ceiling` (number | null), `price` (number | null), `quantity`, `targetPercent` (a % sugerida, number | null), `bias` (`"COMPRAR" | "AGUARDAR" | null`).

### 3.2 Regras

- **Base:** soma de `quantity × price` das ações da entrada (preço médio não entra: sem preço, a ação vale 0 na base e fica de fora) + a parte do aporte.
- **Meta em R$:** `base × targetPercent / 100`. Sem `targetPercent` (ou 0), meta 0.
- **Elegível:** tem preço e teto, `price ≤ ceiling`, valor atual < meta, `bias !== "AGUARDAR"`.
- **Déficit:** `meta − valor atual`.
- **Margem de segurança:** `ceiling / price − 1`.
- **Ordem:** margem de segurança decrescente; no empate, o menor rank (sem rank por último); depois o ticker.
- **Cascata:** em ordem, cada ação compra `floor(min(déficit, caixa) / price)` ações; o caixa diminui; segue até a lista acabar.
- **Troco:** o caixa que sobrou.

### 3.3 Saída

`StockBuyResult`: `amount`, `spent`, `leftover`, `base`, `orders` (na ordem da margem: `ticker`, `rank`, `quantity`, `price`, `total`, `marginOfSafety`, `deficitBefore`, `targetValue`, `weightBefore`, `weightAfter`, `targetPercent`) e `excluded` (`ticker`, `rank`, `reason`).

Motivos de fora (`StockExclusionReason`):

| Motivo | Quando |
| --- | --- |
| `SEM_COTACAO` | Sem preço |
| `SEM_TETO` | Sem teto |
| `ACIMA_DO_TETO` | `price > ceiling` |
| `AGUARDAR` | Viés Aguardar |
| `NA_META` | Valor atual ≥ meta (ou sem %) |
| `PEDIDO_PEQUENO` | Déficit menor que uma ação |
| `SEM_SALDO` | Elegível, mas o caixa acabou antes |

Precedência quando há mais de um: a ordem da tabela.

## 4. Divisão do aporte

- `?fiis=` inteiro de 0 a 100 (fora disso ou ausente: 100). Parte dos FIIs = `floor(aporte × fiis) / 100` em centavos; ações = aporte − FIIs.
- FIIs: `sunoCascade(parteFIIs, cascadeInput)`, a de antes da Fase 3 (sem `caps`).
- Ações: `stockSmartBuy(parteAções, stockBuyInput)`.
- Cada carteira tem o seu troco; o resumo mostra o total das ordens e o troco somado.

## 5. Dados

### 5.1 Viés

- `target_assets` ganha `bias: "COMPRAR" | "AGUARDAR" | null` (padrão null). O tipo vai em `strategy/domain` (`BIASES`, `BIAS_LABELS`).
- `targetPatchSchema` ganha `bias` opcional. `updateTargetAssetAction` só aceita `bias` em ações (`ActionError` "O viés é só para ações.").
- `TargetConfig` e `StrategyRow` ganham `bias`.

### 5.2 O que sai

- `class_targets`: modelo, repositório, `getMyClassTarget`, `setClassTargetAction`, `classTargetSchema`, `ClassTargetPanel`. A coleção no banco fica como está (sem documentos do dono; nenhuma migração).
- `splitByClassTarget`, `classAporte`, `DEFAULT_CLASS_TARGET`, `STOCK_CAPS`, `RiskCaps` e o parâmetro de limites da `sunoCascade`, com os seus testes.
- `stockCascadeInput` e `stockStrategyMeta` do snapshot dão lugar a `stockBuyInput: StockBuyAsset[]` e `stockMeta` (nome e logo das ações da estratégia). `classValues` fica (a tela mostra a alocação atual ao lado do campo).

### 5.3 Snapshot

`stockBuyInput`: uma entrada por ação na estratégia de ações, com `targetPercent` = a % sugerida gravada (sem reescalar), `price` do `PriceInfo`, `quantity` da posição, `ceiling`, `rank`, `bias`.

## 6. Telas

### 6.1 Carteira Alvo, aba Ações

- Coluna "Viés" (tabela, lista e folha do celular): `NativeSelect` com "—", "Comprar", "Aguardar"; salva ao mudar.
- Sem o painel de ajuste para 100% e sem o aviso das %: a soma das ações pode ficar abaixo de 100% de propósito. O rodapé mostra a soma.
- Sem o painel "Meta entre classes" nas duas abas.
- A aba FIIs não muda.

### 6.2 Recomendações

- Ao lado do valor, o campo "% para FIIs" (0 a 100, `?fiis=`), com "Ações: X%" calculado e a alocação atual ("Hoje: FIIs 97% · Ações 3%", de `classValues`).
- A divisão em R$ ("FIIs R$ X · Ações R$ Y").
- Card "FIIs": as ordens e as exclusões da cascata de sempre. Aparece quando a parte dos FIIs é maior que zero.
- Card "Ações": as ordens na ordem da margem, e as exclusões com os motivos de §3.3. Aparece quando a parte das ações é maior que zero.
- "Por quê" da ação: "Margem de segurança de 37% (teto R$ 70,00, preço R$ 51,00) · faltavam R$ X para a meta de Y%". Linha curta: "37% abaixo do teto · faltavam R$ X".
- "Copiar ordens": "FIIs:" e "Ações:" (com "ações" em vez de "cotas"), o total e o troco.
- Os textos de cálculo e de risco explicam os dois motores.

## 7. Testes

Vitest, só no código puro:

- `smart-buy/domain/stock-buy.test.ts`:
  - a lista do documento (preços da tabela, carteira vazia, R$ 5.000): UNIP6 vem antes de VALE3; BBSE3, PETR4, AXIA7 e ITSA4 ficam de fora com o motivo certo;
  - nenhuma ordem passa do déficit; gasto + troco = parte;
  - viés null não bloqueia; `AGUARDAR` bloqueia;
  - empate de margem desempata pelo rank;
  - déficit menor que uma ação → `PEDIDO_PEQUENO`; caixa acabou → `SEM_SALDO`;
  - invariantes em 300 carteiras aleatórias com semente.
- `smart-buy/components/aporte/explain.test.ts`: o "Por quê" da ação pela margem.
- `portfolio/domain/snapshot.test.ts`: `stockBuyInput` com a % gravada sem reescalar e o viés.
- Os testes de `class-split`, `class-aporte` e dos limites de ações saem com o código.

Verificação: `format:check`, `lint`, `typecheck`, `test` e `build`. Depois, um script só de leitura com os dados reais imprime as ordens de ações para R$ 5.000 com `?fiis=0`.

## 8. Depois do deploy

Com o ok do dono já dado ao pedir a carteira atualizada, gravar o viés das 12 ações da tabela dele: Aguardar em BBSE3, PETR4, AXIA7 e ITSA4; Comprar nas outras 8. Backup antes, como na gravação dos alvos.

## 9. Documentação

- **CLAUDE.md:** Domain flow item 3 (dois motores, divisão na tela), Pages (`/recomendacoes?valor=&fiis=`, `/carteira-alvo` sem a meta, coluna Viés), Product rules (aporte), Data layer (sai `class_targets`), Tests.
- **Spec do aporte por classe:** nota "Substituído em parte por `2026-10-31-smart-buy-acoes-design.md`".

## 10. Fora do escopo

- Filtro Buffett (ROE, P/L) e a fórmula de Graham, citados como opcionais no documento.
- Cotação buscada no clique: as cotações continuam as do app (atualizadas a cada 30 min no pregão).
- DY esperado e o "Yield on Cost" projetado.
