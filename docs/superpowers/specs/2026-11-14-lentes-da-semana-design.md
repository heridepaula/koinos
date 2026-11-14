# Lentes da semana: de "Pelas lentes do conselho" para "A favor" e "Atenção"

Data: 2026-11-14. Pedido do dono, com um print do card "O que aconteceu nesta semana" do TRXF11: "Pelas lentes do conselho (3) não está muito de acordo com o restante do layout; analise se podemos remover essa informação ou resumi-la, melhorando a exibição e a disposição".

Altera a parte 8 de `2026-11-13-leitura-da-semana-design.md` (item 5) e o item 3 da tela de `2026-11-13-tese-do-ativo-design.md`. Completa a §7.4 de `2026-11-14-por-que-na-tabela-design.md`, que trocou as lentes por "A favor"/"Atenção" só na tabela de ordens e deixou o `AporteCard` e a semana como estavam.

## 1. Análise

O que há hoje (`CouncilLenses`, `market-data/components/council-lenses.tsx`), usado no `WeekSummaryCard` e no `AporteCard`:

1. **Peso errado na hierarquia.** O resumo do recolhível é Subheadline em negrito na cor do texto. Os outros dois recolhíveis do mesmo card, "Como medimos" e "Fontes (N)", são Footnote na cor apagada. O olho lê "Pelas lentes do conselho (3)" como o título de uma seção, logo depois do veredito, que é o que deveria aparecer mais (pedido de 2026-11-13).
2. **Rótulo de dentro do projeto.** "Conselho" é o nome da skill `conselho-investidores`; o leitor não sabe o que é. O "(3)" conta lentes e não diz nada sobre o conteúdo.
3. **Aberto, é alto e repetitivo.** Cada lente ocupa três linhas: o nome, "lente de Baroni", a cápsula do tom e a observação. Depois vem o aviso "Lentes inspiradas no que cada investidor defende publicamente; não são falas deles.", que só existe porque os nomes aparecem.
4. **"Risco: Favorável".** O leitor leigo leu isso como contradição; a tabela de ordens já resolveu com "A favor"/"Atenção" (`ThesisPoints`). A mesma informação tem hoje dois desenhos.
5. **No `AporteCard`** o recolhível fica dentro de outro ("Lentes e indicadores" → "Pelas lentes do conselho"): dois cliques para ler.

**Remover ou resumir?** Resumir.

- As lentes são a única parte da leitura que separa o que ajuda do que preocupa (renda, imóveis ou negócio, risco, fundamento ou ruído). O veredito tem até 3 frases e não cobre isso sempre.
- Elas já são geradas e validadas (`parseWeekReading`); tirá-las da tela não economiza chamada ao Gemini.
- O problema do print é de apresentação (peso, rótulo, altura), não de conteúdo.

O que sai da tela: o nome do investidor, a cápsula de tom por lente, o aviso sobre os investidores e o título "Pelas lentes do conselho".

## 2. Desenho

### 2.1 Card "O que aconteceu nesta semana"

A ordem do card não muda. O recolhível das lentes passa a ser:

```
Como medimos ⌄

1 a favor · 2 de atenção ⌄
Fontes (5) ⌄

Gerado por IA (Gemini) a partir de notícias públicas. …
```

- **Resumo do recolhível:** a contagem por grupo, em Footnote na cor apagada, igual a "Como medimos" e "Fontes (N)" (`text-footnote font-normal text-muted-foreground`). Fechado, ele já resume a leitura.
  - Textos: "2 a favor · 1 de atenção"; só um grupo: "3 a favor" ou "3 de atenção"; singular e plural iguais ("1 a favor", "1 de atenção").
  - Um ponto colorido antes de cada contagem (`bg-gain` e `bg-loss`, `aria-hidden`), o mesmo de `ThesisPoints`. A cor nunca é o único sinal: o texto diz o grupo.
- **Aberto:** `ThesisPoints`, sem mudança: "A favor" e "Atenção", cada ponto como "Renda · texto", com `GlossaryText`.
- **Agrupamento:** `groupLenses` (favorável → A favor; desfavorável e misto → Atenção; neutro fica de fora). Com todas as lentes neutras, o recolhível não aparece.
- O espaço entre este recolhível e "Fontes" continua 12 px (`gap-3`).

Aberto, no caso do print (3 lentes):

```
1 a favor · 2 de atenção ⌃

● A favor
Imóveis · A expansão aumenta a base de imóveis do fundo.

● Atenção
Renda · O resultado de outubro ficou abaixo da faixa projetada pela gestora.
Risco · A expansão pressiona dividendos e dívidas.
```

(Textos de exemplo; os reais vêm da leitura.)

### 2.2 `AporteCard` (`/ativos/[ticker]`)

Dentro de "Lentes e indicadores", `CouncilLenses` dá lugar a `ThesisPoints`, direto, sem o segundo recolhível. A ordem fica: as frases da tese, "A favor"/"Atenção", os chips, a nota da IA. O rótulo do recolhível passa a "Pontos e indicadores", já que a palavra "lentes" sai da tela.

### 2.3 Celular

Nada próprio: os dois cards já são os mesmos no celular. O resumo do recolhível mantém os 44 px de toque do `Disclosure`.

## 3. Código

- **`market-data/domain/asset-thesis.ts`:** nova função pura `lensCounts(lenses)`, ao lado de `groupLenses`, que devolve `{ favor: number; attention: number }`. O texto do resumo é montado no componente, porque cada grupo leva o seu ponto colorido.
- **`market-data/components/thesis-points.tsx`:**
  - recebe o tipo `CouncilLens` (movido de `council-lenses.tsx`, mesmo nome, para não mexer nos DTOs);
  - novo componente `LensPointsDisclosure({ lenses, assetClass })`: o `Disclosure` de §2.1 com `ThesisPoints` dentro; devolve `null` sem pontos.
- **`market-data/components/council-lenses.tsx`:** apagado. `ui.ts` deixa de exportar `CouncilLenses` e passa a exportar `LensPointsDisclosure` e o tipo.
- **`portfolio/components/asset/week-summary-card.tsx`:** usa `LensPointsDisclosure`. A condição do bloco continua "há lentes ou fontes".
- **`portfolio/components/asset/aporte-card.tsx`:** usa `ThesisPoints` e o novo rótulo.
- **`NewsToneChip`:** conferir com `rg` se sobra algum uso; sem uso, apagar o componente (as fontes usam `NEWS_TONE_LABELS`, que fica).
- **Domínio e prompt:** nada muda. `persona` continua nos dados (`WEEK_LENSES`, `ThesisLensView`); só deixa de ser exibida. Nenhuma versão de leitura ou de tese sobe, então nada é regerado.

## 4. Fora do escopo

- Mudar o prompt, as lentes por classe ou a validação.
- Juntar "Fontes" no mesmo recolhível (o `NewsSources` é compartilhado com o resumo do dia).
- Mudar a posição do termômetro ou do veredito.

## 5. Testes

Puro, em `market-data/domain/asset-thesis.test.ts`:

- `lensCounts`: favorável conta em `favor`; desfavorável e misto em `attention`; neutro em nenhum; lista vazia dá zero nos dois.

## 6. Verificação

- `npm run format:check`, `lint`, `typecheck`, `test` e `build`.
- Na tela, com o dev server, em `/ativos/TRXF11` (claro e escuro, desktop e 390 px):
  - o resumo do recolhível tem o mesmo tamanho e cor de "Como medimos" e "Fontes (N)";
  - aberto, mostra "A favor" e "Atenção" sem nome de investidor e sem cápsula;
  - o `AporteCard` abre "Pontos e indicadores" com os pontos à vista, sem segundo clique;
  - contraste do resumo ≥ 4,5:1 (é `text-muted-foreground`, já medido).
- `rg "lentes do conselho|lente de " src` não devolve nada.

## 7. Documentação

- `CLAUDE.md`: no parágrafo do card da semana, trocar `"Pelas lentes do conselho" (WeekLenses, with NewsToneChip)` pelo recolhível com a contagem e `ThesisPoints`; no `AporteCard`, "Lentes e indicadores" → "Pontos e indicadores"; na lista de testes, `lensCounts`.
- Uma linha em `2026-11-13-leitura-da-semana-design.md` (parte 8, item 5) e em `2026-11-13-tese-do-ativo-design.md` apontando para este spec.

## 8. Revisão (2026-11-14, depois do deploy)

O dono pediu: "Deixe os 3 pontos de atenção abertos, passe o como medimos para baixo dos 3 pontos de atenção". Isso substitui o recolhível com contagem da §2.1 e o que a §3 e a §5 dizem dele.

- **Os pontos ficam sempre à vista** no card da semana: `ThesisPoints` direto, sem recolhível e sem contagem. Saem `LensPointsDisclosure` e `lensCounts` (e o teste dele).
- **Nova ordem do card:** veredito, linha do índice, termômetro (a barra), "A favor" e "Atenção", "Como medimos", "Fontes (N)", nota da IA.
- **`AssetHeatMeter`** ganha `withMethod` (padrão `true`, então o resumo do dia não muda) e o "Como medimos" passa a ser o componente `HeatMethod`, que o card da semana põe depois dos pontos.
- O `AporteCard` fica como na §2.2.
