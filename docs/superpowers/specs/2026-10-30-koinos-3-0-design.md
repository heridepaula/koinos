# Motor de aporte Koinos 3.0: especificação de design

- **Data:** 2026-10-30
- **Status:** aplicado a pedido do usuário ("reestruture o algoritmo de recomendações, conforme md"), a partir do documento dele "Especificação Técnica: Algoritmo de Aporte Inteligente Koinos 3.0". Substitui o Índice de Convicção de 2026-10-24 e o limite por FII da entrada gradual.
- **Pedido junto:** um comentário curto e discreto do porquê de cada recomendação.

## 1. Regras

1. **Elegível:** na estratégia, com ranking, teto, cotação e preço abaixo do teto. Nunca vende.
2. **Meta e gap:** meta = peso × (valor da estratégia + aporte); gap = meta − valor atual. Com gap ≤ 0, o FII não pede nada.
3. **Tensores** (só com gap > 0), em `smart-buy/domain/conviction.ts`:
   - valuation: 1 + (1 − P/VP); P/VP 0,90 dá 1,10. Sem P/VP, 1; nunca negativo (P/VP ≥ 2 dá 0);
   - proventos (freio de corte): mín(1, último provento ÷ média mensal de 12 meses). Sem histórico, 1;
   - segurança: 1 + (teto − preço) ÷ teto;
   - vacância: 1 − vacância física, só em tijolo. Sem dado, 1.
4. **Necessidade bruta** = gap × os quatro tensores.
5. **Travas** (`smart-buy/domain/risk.ts`), em % do aporte: 25% por FII (o documento diz 20%; o usuário pediu 25% no mesmo dia), 35% por setor e 60% por macro (papel ou tijolo).
6. **Passo 1, a cascata:** do 1º ao último do ranking, cada FII gasta o menor entre a necessidade e o espaço que sobra no FII, no setor, na macro e no saldo, em cotas inteiras (arredonda para baixo).
7. **Passo 2, a sobra:** sem trava de entrada. Uma cota por vez para o FII mais abaixo da meta, ignorando o ranking (no empate, o melhor ranking), dentro das três travas, até nenhuma cota caber. O troco fica no caixa.

## 2. Decisões onde o documento deixava espaço

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Setor | Segmento da usebolsai, só quando é específico (Shoppings, Logística, Escritórios…) e o FII é tijolo. "Multicategoria", "Outros", "Híbrido" e vazio não formam setor | Metade dos FIIs da carteira vem com segmento genérico, inclusive todos os de papel e o BTLG11 (logística). Num balde só, a trava de 35% juntaria fundos sem relação. Em papel, o segmento da CVM não diz nada (o MXRF11 vem como "Logística"). É o que o Cenário B do documento pressupõe: três FIIs de papel com 20% cada até a macro chegar a 60% |
| Macro | `fund_type` da usebolsai: Papel e Fiagro → papel; Tijolo → tijolo; Híbrido pela composição (recebíveis × imóveis); Fundo de Fundos → "Outros". Sem o tipo, a categoria da Carteira Alvo | O documento lista papel e tijolo, mas não FoF. "Outros" tem a mesma trava de 60% |
| Provento | Último provento e soma de 12 meses do Yahoo (`lastDividend`, `dividends12m`) | O extrato da B3 tem pagamentos *pro rata* de subscrição que inflam a média (BTLG11 daria 83% e frearia à toa). O Yahoo bateu com a B3 no último provento dos 20 FIIs; quando falta um mês, o freio só fica mais brando, nunca dispara à toa |
| P/VP | O do cron das 2h: fechamento anterior ÷ VP (usebolsai) | Fixo durante o dia, como o usuário pediu |
| Sobra × freios | Na sobra, a distância é medida contra a meta × freio de proventos × freio de vacância | Sem isso, o FII freado (que costuma ser o mais abaixo da meta) voltaria a receber pela sobra, o contrário do Cenário C |
| Trava macro na sobra | Mantida | O documento cita as travas por FII e por setor "para evitar violações finais"; a macro é do mesmo tipo |
| Limite por FII | 25%, fixo. Sai o seletor "Máximo por FII" (`?limite=`), que estava em 33% | O documento diz 20%; o usuário pediu 25% no mesmo dia. As travas são parte do método, não um ajuste da tela |
| Cota mínima | Sem a exceção de "pelo menos 1 cota" | O documento arredonda para baixo. Com aportes pequenos, um FII cuja cota passa de 25% do aporte não entra (motivo "Cota acima do limite") |

## 3. Novos motivos de exclusão

- **Pede menos de 1 cota** (`PEDIDO_PEQUENO`): falta pouco, ou os freios cortaram o pedido.
- **Cota acima do limite** (`LIMITE_ATIVO`), **Limite do setor** (`LIMITE_SETOR`) e **Limite de papel ou tijolo** (`LIMITE_MACRO`).

A coluna Prioridade (aporte zero) põe na fila, pelo ranking, quem pede ao menos uma cota.

## 4. O porquê de cada ordem

- **Comentário curto e discreto** (`shortReason`, em letra pequena e cinza na tabela e na lista do celular):
  - o ranking, a distância da meta e o sinal que mais pesou;
  - a prioridade do sinal é: uma trava de setor ou macro, um freio ("provento caiu", "vacância de 9%") e só então um desconto ("P/VP 0,84", "18% abaixo do teto");
  - se o FII só recebeu sobra: "Sobra do aporte · já na meta".
- **Conta completa** (`explain`): cada tensor com o multiplicador, o pedido, a trava e as cotas da sobra. Vai na folha do celular e na dica da tabela.

## 5. Dados

| Dado | Fonte | Onde |
| --- | --- | --- |
| VP e P/VP | usebolsai `/fiis/{ticker}` (cron das 2h) | `bookValuePerShare`, `priceToBook` |
| Vacância, segmento, tipo, composição | a mesma chamada, sem gastar cota a mais | `vacancyPct`, `segment`, `fundType`, `paperPct`, `realEstatePct` |
| Último provento e soma de 12 meses | Yahoo (`refreshDividends`) | `lastDividend`, `dividends12m` |

Ao abrir o app, quem não tem o perfil novo é buscado (`refreshMissingFundamentals` trata `fundType` ausente como faltando).

## 6. Verificação

- `npm test`: 47 testes, incluindo os cenários A, B e C do documento, as travas e invariantes em 500 carteiras aleatórias. Os mutantes "sem freio na sobra" e "sem trava macro" derrubam testes.
- **Carteira real, só leitura, com um aporte típico:**
  - 8 FIIs, nenhum acima do limite por FII, e sobra de poucos reais (rodada com 20%);
  - os freios aparecem onde se espera: PVBI11 (último provento em 89% da média e vacância de 9,3%) e RBRY11.
- **Prévia isolada:** Recomendações na mesa e no iPhone, sem erros no console.
- `format:check`, `lint`, `typecheck` e `build` passam.
