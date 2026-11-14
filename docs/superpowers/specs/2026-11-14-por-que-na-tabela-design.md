# "Por quê" único na tabela de ordens

Data: 2026-11-14. Pedido do dono, com dois prints de `/recomendacoes`: a coluna "Por quê" da tabela e o popover ✨ "Por que este ativo" repetem a mesma informação. A tela deve juntar as duas num lugar só, na tabela, com o conteúdo mais completo, que é o do popover. Status: implementado em 2026-11-14 (plano `2026-11-14-por-que-na-tabela.md`).

## 1. Diagnóstico (como está hoje)

Hoje a explicação de cada ordem está espalhada em três lugares:

| Onde | O que mostra | Origem |
| --- | --- | --- |
| Coluna "Por quê" (Caption, cinza) | "6º do ranking · 5% abaixo da meta · provento caiu" | código, `shortReason` |
| Dica nativa da célula (`title`) | a conta inteira: cada tensor, o pedido, a trava e o impacto | código, `explain` + `impactText` |
| Popover ✨ ao lado do nome | "Neste aporte" (**a mesma linha da coluna**), a tese da IA, os chips e a nota | código + IA (`RadarPopover`) |

Os problemas, do mais grave para o menos grave:

1. **Hierarquia invertida.** O que está à vista é o mais pobre: uma linha de 12 px em cinza. O mais rico (a tese, os indicadores e as lentes) fica escondido atrás de um ícone de 16 px.
2. **Redundância.** "Neste aporte" repete a coluna palavra por palavra. Quem abre o popover lê a mesma linha duas vezes.
3. **Descoberta ruim.**
   - O ✨ não tem rótulo e é cinza claro.
   - A posição dele muda com o tamanho do nome do fundo: no GARE11 ele cai no meio da tabela, no RECR11 no fim da linha.
   - Nada indica que a linha tem mais informação.
4. **Dica nativa.**
   - Só aparece com o mouse parado, então não funciona no toque nem no teclado.
   - O texto vem sem formatação.
   - É a terceira versão da mesma explicação.
5. **IA e cálculo misturados.** No popover, "Neste aporte" (fato do código) e o parágrafo da IA têm o mesmo peso visual. O leitor não sabe em que confiar mais: só a nota no rodapé diz que parte do conteúdo é IA.
6. **O nome jurídico ocupa a tabela.** "FUNDO DE INVESTIMENTO IMOBILIÁRIO PATRIA CRÉDITO IMOBILIÁRIO ESTRUTURADO RESPONSABILIDADE LIMITADA" toma metade da largura. A coluna "Por quê" fica espremida no fim e quebra linha.
7. **Bloco de negrito.** No popover, a tese inteira (4 ou 5 linhas) está em Headline, que é negrito. Um parágrafo todo em negrito cansa e perde o destaque.
8. **Celular.** A folha tem dois grupos, "Por quê" e "Por que este ativo", com a mesma redundância. Os indicadores e as lentes ficam no fim, depois do impacto.

## 2. Proposta

Princípio: **um lugar só, em duas camadas.** A linha da tabela mostra a resposta curta. Ao expandir a linha, aparece tudo, separado entre "Leitura da IA" e "Cálculo do Koinos". Sem popover, sem dica nativa e sem ✨.

### 2.1 Linha da tabela (fechada)

```
Ativo                     Cotas  Preço     Total        % antes→depois  % meta  Por quê
───────────────────────────────────────────────────────────────────────────────────────────────────────────
[◉] RECR11                  26   R$ 68,70  R$ 1.786,20   5,7% → 6,0%     5,9%   P/VP baixo, mas o último          ⌄
    FII REC Recebíveis Im…                 +R$ 19,85/mês                         pagamento foi menor que o de
                                                                                 costume.
                                                                                 6º no ranking · 5% abaixo da meta
```

- **Ativo:** o ticker e o nome numa linha só, cortado com reticências (o nome inteiro fica no `title` e na página do ativo). O ⚠ da divergência do teto continua ao lado do ticker, numa posição fixa.
- **Por quê** (a coluna ganha a largura que o nome perdeu):
  - linha 1: o **veredito da tese**, em Subheadline com a cor do texto, até 2 linhas;
  - linha 2: os sinais do cálculo em Caption cinza, sem mudar o texto atual (`shortReason`).
  - Sem tese, a linha 1 é o `shortReason` na cor do texto e a linha 2 some.
- **Chevron ⌄** no fim da linha. A linha inteira é um botão (`aria-expanded`, teclado: Enter e Espaço). O chevron gira ao abrir, com `ease-snappy`.

### 2.2 Linha expandida (desktop)

Uma linha de detalhe logo abaixo, ocupando a largura da tabela (`colSpan`). Tem duas colunas a partir de ~1.000 px de card; abaixo disso, uma embaixo da outra.

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ✦ LEITURA DA IA                                        │ ▦ CÁLCULO DO KOINOS                          │
│                                                        │                                              │
│ O preço da cota está abaixo do valor dos títulos       │ Ranking               6º                     │
│ (P/VP baixo), mas o último pagamento foi menor que     │ Faltava para a meta   R$ 1.421,08 (5%)       │
│ o de costume.                         ← Headline       │ Desconto (P/VP 0,77)  ×1,23                  │
│ Mesmo assim, paga mais que a maioria dos fundos        │ Margem até o teto     24% ×1,24              │
│ parecidos que você acompanha.         ← Subheadline    │ Último provento       86% da média ×0,86     │
│                                                        │ Pediu                 R$ 1.850,97            │
│ Pelas lentes do conselho                               │ Comprou               26 cotas · R$ 1.786,20 │
│  Renda  ● Desfavorável  O último pagamento caiu.       │                                              │
│  Risco  ● Favorável     Paga mais que os pares.        │ Depois desta ordem                           │
│                                                        │ Preço médio  R$ 70,12 → R$ 69,80            │
│ [P/VP 0,77] [DY 15,9%] [FFO Yield 15,5%]               │ Renda/mês    +R$ 19,85                       │
│                                                        │ Peso         5,7% → 6,0% (meta 5,9%)         │
│ Gerada por IA (Gemini) em 14/11/2026 com os sinais     │                                              │
│ do método e indicadores públicos. Pode conter erros    │ ⚠ Aviso do teto (quando houver)              │
│ e não é recomendação. Fonte: Fundamentus.              │                                              │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

(Os números da coluna da direita são os do `lab recomendar --valor 10000` de 2026-11-14 para o RECR11. O preço médio é ilustrativo. As lentes são ilustrativas, porque a tese do RECR11 ainda é v1, só com o veredito.)

- **À esquerda, "Leitura da IA":**
  - o veredito em Headline e as outras frases em Subheadline (só a primeira frase em negrito, o que resolve o problema 7);
  - as lentes já abertas, cada uma com `NewsToneChip`, porque agora há espaço;
  - os chips dos indicadores, com a explicação no hover e no toque;
  - a nota com a data.
- **À direita, "Cálculo do Koinos":**
  - `explain()` virou uma lista rótulo → valor, que é a dica nativa de hoje formatada;
  - o impacto da ordem (`ImpactGroup`);
  - o aviso do teto (`CeilingCheckBody`).
- **Os títulos diferenciam a confiança:** "Leitura da IA" com ✦ e "Cálculo do Koinos" com o ícone da calculadora. Assim o leitor sabe o que é fato e o que é interpretação.
- **Sem tese:** só a coluna do cálculo, ocupando a largura toda, com a frase "A leitura da IA deste ativo ainda não foi gerada."
- Várias linhas podem ficar abertas ao mesmo tempo. Nenhuma abre sozinha, porque a tabela tem de 6 a 10 ordens e a tela deve continuar escaneável.

### 2.3 Celular (lista + folha)

- **Célula da lista:** a terceira linha passa a ser o veredito (Caption, até 2 linhas) no lugar do `shortReason`; sem tese, continua o `shortReason`. O "+R$ X/mês" desce para a segunda linha, ao lado do peso.
- **Folha, em nova ordem:**
  1. "Comprar R$ X" (como hoje);
  2. **"Por que este ativo"**, a Leitura da IA (veredito, frases, lentes, indicadores, nota);
  3. **"Por que esta quantidade"**, o Cálculo do Koinos: junta o grupo "Por quê" de hoje (`explain`) com "Peso na carteira" (antes, depois, meta);
  4. "Depois desta ordem" (impacto);
  5. "Aviso" (teto);
  6. "Termos deste texto".

  O grupo "Por quê" de hoje deixa de existir como grupo separado, e assim some a redundância.

### 2.4 O que sai

- `RadarPopover`, o botão ✨ e o `title` da célula "Por quê".
- A linha "Neste aporte" (o `shortReason` agora está na própria linha da tabela).

### 2.5 Acessibilidade e tokens

- O botão da linha tem o nome "Detalhes de RECR11". A linha de detalhe é a região que ele controla, com `aria-controls`.
- 44 px de toque em `pointer-coarse:`.
- O veredito usa `text-foreground` e o cálculo `text-muted-foreground` (AA, Caption ≥ 4,5:1 no card, como hoje).
- O movimento de abrir é a altura com `ease-snappy`, desligado com `prefers-reduced-motion`.

## 3. Fora do escopo

- O texto da tese (prompt, validação): não muda.
- A conta do aporte: não muda.
- A tese no `AporteCard` de `/ativos/[ticker]`: continua igual.

## 4. Validações

Ver §5 (conselho) e §6 (leitor leigo).

## 5. Conselho

**Veredito:** o desenho aprova nas quatro lentes. Ele põe à vista o ponto contra (o provento que caiu) e separa o cálculo da opinião. O risco principal é a ordem visual: a leitura da IA vem antes da conta do método, e com isso o dono pode passar a pular ordens por causa de um texto. A recomendação nº 1 é que a linha fechada mostre sempre o sinal do método junto com o veredito. Isso já é verdade para as teses v2: `parseThesis` exige um sinal do método no veredito, quando há sinais.

As lentes são inspiradas no que cada investidor defende publicamente; não são falas deles.

### Verificação técnica

| # | Tipo | Severidade | Onde | O que acontece | Cenário | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Efeito de projeto | média | linha fechada | A IA vem antes do cálculo. Uma tese v1 (só fundamento, sem método) vira o "porquê" de uma compra que o método decidiu por rank e meta. | RECR11 hoje: o veredito v1 fala de P/VP e de provento; o motivo da compra (6º, 5% abaixo da meta) fica na linha 2. | Confirmado (banco, 2026-11-14: 26 de 36 ainda v1) |
| 2 | Fragilidade | média | tese × cálculo | A tese tem até 20 h e a ordem é de agora. Os números do método na tese (ex.: "18% abaixo do teto") podem divergir dos da coluna do cálculo (24%) na mesma tela. | Preço que se move entre o cron e o aporte. | Provável |
| 3 | Efeito de projeto | baixa | "Fora deste aporte" | Quem ficou fora (VISC11, FATN11, HGRU11 por `ABAIXO_DO_MINIMO`) tem tese, mas a tabela não dá acesso a ela. | `lab recomendar --valor 10000` | Confirmado |
| 4 | Fragilidade | baixa | coluna do cálculo | "×1,23" é o tensor cru: certo para o dono, opaco para leigos. | — | Provável (ver §6) |

Testes: nenhuma regra de motor muda, então não há teste de motor a rodar. A proposta só reorganiza a exibição de `explain`, `shortReason` e `thesisView`.

### Professor Baroni (renda mensal, previsibilidade)

- **Aprova:** o provento que caiu aparece na linha fechada e na lente Renda com tom desfavorável. "+R$ 19,85/mês" fica junto do total, a medida da bola de neve.
- **Critica:** a renda da ordem fica espalhada (no total, em "Depois desta ordem" e nos chips de DY).
- **Recomenda:** na coluna do cálculo, "Renda/mês" em primeiro lugar em "Depois desta ordem".

### Tiago Reis (fidelidade ao método, preço médio)

- **Aprova:** "Cálculo do Koinos" com o pedido, os tensores e a quantidade deixa claro que quem decide é o método. Ele não esconde mais a conta numa dica nativa.
- **Critica:** com a IA primeiro, o dono pode passar a "vetar" ordens pelo texto. Isso quebra a disciplina do aporte constante (achado 1).
- **Recomenda:**
  - (P1) linha fechada = veredito + `shortReason`, sempre as duas;
  - sem tese v2, o `shortReason` sobe para a linha 1 (a tese v1 vai só para a linha aberta);
  - nunca botões de "ignorar ordem" a partir da tese.

### Warren Buffett (margem de segurança, círculo de competência)

- **Aprova:** a tese é o primeiro registro de *por que* cada ativo está na carteira, algo que o Koinos não guardava. A margem até o teto fica explícita no cálculo.
- **Critica:** dois números de margem na mesma tela (achado 2) minam a confiança no teto.
- **Recomenda:** os números do método mostrados vêm só do cálculo de agora. Na leitura da IA, o método aparece em palavras ("bem abaixo do teto"), como as faixas da chave (`thesisKey`). Mudança no prompt: P2, fora deste desenho.

### Luiz Barsi (dividendos, longo prazo)

- **Aprova:** a regra de que a evidência desfavorável tem de ser citada chega à tela: o leitor vê o corte de provento sem precisar abrir nada.
- **Critica:** o contraponto de sempre (Barsi prefere ações a FIIs) não muda com a tela.
- **Recomenda:** nada específico desta tela.

### Recomendações

| Prioridade | Recomendação | Quem defende | Conflita com decisão do dono? | Esforço |
| --- | --- | --- | --- | --- |
| P1 | Linha fechada sempre com o sinal do método: veredito v2 + `shortReason`; com tese v1, o `shortReason` na linha 1 | Tiago Reis, Buffett | Não (o dono pediu a tese em destaque; ela continua na linha aberta e na linha 1 com v2) | P |
| P2 | Prompt da tese: método em palavras, sem o % até o teto | Buffett | Sim: 2026-11-13, o dono decidiu mandar o % até o teto | P |
| P2 | Renda/mês primeiro em "Depois desta ordem" | Baroni | Não | P |
| P3 | Tese acessível também em "Fora deste aporte" | Buffett, Tiago Reis | Não | M |

## 6. Leitor leigo

O leitor foi simulado com uma persona: 38 anos, investe em FIIs há 1 ano, sabe o que é cota e rendimento, e não conhece P/VP, DY, ranking, teto nem meta. Ele leu só o esboço da §2, com os textos que a tela mostraria.

**Notas:** linha fechada 5/10, linha aberta 4/10.

- **O que funcionou:**
  - a separação entre IA e conta ficou clara pelos títulos;
  - "Comprou 26 cotas", "Depois desta ordem" e "+R$/mês" foram entendidos e são o que ele usaria.
- **Inverteu a decisão.** O veredito termina no ponto negativo ("…mas o último pagamento foi menor"). A sensação final foi "não compra", e ele disse que pularia o fundo. É o mesmo risco do achado 1 do conselho, agora visto pelo leitor.
- **Não entendeu:**
  - os multiplicadores "×1,23 / ×0,86" ("planilha de contador");
  - "Faltava R$ 1.421" × "Pediu R$ 1.851" ("por que pediu mais?");
  - "meta" ("quem definiu?");
  - "6º no ranking" ("de quem?");
  - "teto";
  - "FFO Yield";
  - "lentes do conselho";
  - "Risco: Favorável" ("pagar mais não é risco maior?");
  - "fundos parecidos que você acompanha".
- **Confiança:** confia mais na conta, porque a IA avisa que pode errar, mas "no escuro", porque não a entende.

## 7. Revisão do desenho (depois do conselho e do leitor)

O que muda em relação à §2:

1. **A linha fechada começa pela decisão** (conselho P1 e leitor):
   - linha 1, do código, em palavras: **"6º na lista do método · faltam 5% para a meta"** (`shortReason` reescrito sem siglas);
   - linha 2: o veredito da IA, em Subheadline na cor do texto, até 2 linhas.

   O "porquê comprar" vem primeiro e a ressalva da IA depois. A tese continua à vista sem abrir a linha. Com tese v1 vale o mesmo, porque o código abre a linha.
   - Na implementação, a linha 1 mantém o terceiro sinal de `shortReason` em palavras ("rendimento caiu", "desconto no preço", "bem abaixo do teto"), para não perder o sinal quando não há tese.
   - Achado da revisão: os verbetes do método ("meta", "teto", "lista do método", apelidos "ranking"/"metas") têm escopo `metodo` e só valem nos rótulos do cálculo (`glossarySegments(…, { method: true })`, `<GlossaryText methodTerms>`), nunca nos textos da IA ou das notícias.
   - O cálculo mascara no modo de privacidade os valores da carteira (R$ e quantidades), com `Sensitive` em `CalcSentence` e `CalcStep.sensitive`.
2. **"Cálculo do Koinos" em frases, sem tensores crus.** Cada linha diz o efeito em palavras e uma seta:
   - "Desconto no preço (P/VP 0,77) ↑ compra mais";
   - "Último rendimento 14% abaixo da média ↓ compra menos";
   - "Margem até o teto 24% ↑ compra mais".

   Uma frase liga a meta ao pedido: **"Faltavam R$ 1.421 para a meta. Com o desconto e a margem, o método pediu R$ 1.851; comprou R$ 1.786 (26 cotas)."**

   O multiplicador exato (×1,23) fica no `title`/glossário de cada linha, para o dono.
3. **Rótulos explicados uma vez:** "meta", "ranking" e "teto" ganham o tooltip do glossário (`GlossaryText`), como os termos da tese. Faltam verbetes para "meta da carteira" e "teto do método".
4. **Lentes viram "A favor" e "Atenção".** As lentes são agrupadas pelo tom do código: favorável vai para "A favor"; desfavorável e misto vão para "Atenção"; neutro fica de fora da lista. O nome da lente (Renda, Risco…) vira uma etiqueta pequena. Isso acaba com o "Risco: Favorável". O título "Pelas lentes do conselho" sai daqui; o `AporteCard` e a semana não mudam.
5. **"Depois desta ordem" sobe:** é o que o leitor usaria e o que Baroni pede. A ordem fica: Renda/mês, Peso (antes → depois, meta), Preço médio.
6. **Fica para depois (prompt, outro spec):**
   - pedir ao veredito "o motivo a favor primeiro, a ressalva depois";
   - "fundos parecidos que você acompanha" → "fundos parecidos na sua lista";
   - o método em palavras na tese (conselho P2, conflita com a decisão de 2026-11-13).

O esboço final da linha fechada:

```
Ativo                    Cotas  Preço     Total          % antes→depois  % meta  Por quê
[◉] RECR11                 26   R$ 68,70  R$ 1.786,20     5,7% → 6,0%    5,9%    6º na lista do método · faltam 5% para a meta  ⌄
    FII REC Recebíveis…                   +R$ 19,85/mês                          P/VP baixo, mas o último pagamento foi menor
                                                                                 que o de costume.
```

## 8. Revisão de espaço (2026-11-14, depois do deploy)

O dono mandou um print da linha aberta do TRXF11. A leitura da IA ocupava 60% da largura e acabava em ~180 px; o cálculo, nos outros 40%, descia ~760 px. Metade dele repetia informação que já estava na tela.

**O que saiu:**
- **A frase longa do cálculo.** No lugar dela entra um fluxo de três números (`calcFlow`/`stockCalcFlow`): faltava → o método pediu → comprou. A trava e a sobra ficam numa linha embaixo.
- **"Posição na lista do método".** Já está na linha fechada.
- **"Faltava para a meta" como linha à parte.** Agora está no fluxo.
- **"Peso na carteira".** Já está nas colunas "% antes → depois" e "% meta". A folha do celular mantém essa linha, porque a lista não tem essas colunas.
- **O chip de P/VP**, quando o P/VP aparece como fator do cálculo.
- **A nota "Em R$, o resultado…".** Foi para o ⓘ do L/P.
- **O aviso do teto inteiro.** Virou uma linha: ícone, teto calculado e a diferença. O texto completo continua no tooltip do ícone.
- **A nota da IA em duas linhas.** Virou uma faixa de rodapé numa linha só.
- **"↑ compra mais" numa linha própria.** Virou uma seta verde ou vermelha antes do rótulo do fator.
- **O veredito duplicado.** Com a linha aberta, ele sai da célula "Por quê", porque já está logo abaixo.

**O layout:**
- **Três colunas**, a partir de 1.100 px de card: Leitura da IA (`1.4fr`), "Por que esta quantidade" (`1fr`) e "Depois desta ordem" (`1fr`).
- **Duas colunas** abaixo disso.
- **O rodapé da IA** ocupa a largura toda.
- **Os pontos "A favor"/"Atenção"** trazem o nome da lente antes do texto, na mesma linha.
- **A altura** caiu de ~760 px para ~250 px, conferida numa prévia com os números do print.
