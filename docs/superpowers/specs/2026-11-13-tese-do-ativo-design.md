# Tese do ativo: o porquê da recomendação com os fundamentos (2026-11-13)

Pedido do dono (2026-11-13): "o Por quê das recomendações precisa ser gerado pelo Gemini. Precisamos juntar o Radar de fundamentos com a informação do Por quê para mostrar mais credibilidade da recomendação." Entre três opções (tese do conselho, ampliar o prompt do Radar, explicação do aporte sob demanda), escolheu a **tese do ativo no estilo do conselho**, e nas perguntas:

- **Estratégia ao Gemini:** "mesclar 1 e 2": os sinais do método vão com o número **e** com a leitura do código em palavras ("18% abaixo do teto, bem abaixo").
- **Radar:** a tese **substitui** o texto do Radar (uma chamada por ativo); os chips continuam.
- **Tela:** Recomendações (popover ✨ e folha do celular) **e** o `AporteCard` de `/ativos/[ticker]`.

Este spec substitui a geração do texto do spec `2026-11-12-radar-fundamentos-design.md`. Os fatos (`radarFacts`), os chips, o glossário, o cron e as fontes do Radar continuam valendo.

## 1. Princípio

O código decide, a IA explica.

- **O código decide:**
  - os sinais do método e seus números;
  - os fatos de fundamento e o sentido de cada um (`good` / `bad` / `neutral`);
  - o tom de cada lente;
  - se o ativo está na fila ou fora dela.
- **O Gemini faz três coisas:**
  - escolhe quais evidências sustentam cada lente;
  - escreve até 3 frases para leigos;
  - liga o motivo da fila ao fundamento.
- **A validação:** toda frase cita evidências, e o código recusa qualquer número que não esteja na entrada.

**O que nunca vai ao Gemini:**

- quantidade, preço médio, posição, valor investido;
- o que falta para a meta (em R$ ou em %);
- o valor do aporte;
- o pedido em R$ e as travas do aporte.

Esses dados dependem da carteira ou do valor escolhido na tela. Por isso continuam no "Por quê" do código (`shortReason`/`explain`), que é recalculado no navegador a cada valor.

**O que vai, com a decisão do dono acima:**

- o rank;
- a % até o teto (ou a margem de segurança das ações);
- o viés;
- o motivo de estar fora;
- os fatos públicos do Radar;
- o veredito da leitura da semana.

O valor do teto em R$ não vai, só a %.

## 2. Evidências

A entrada é uma lista de evidências, cada uma com `id`, `grupo` (`metodo` | `fundamento` | `semana`), `texto` (com número e leitura em palavras) e `sentido` (`favoravel` | `desfavoravel` | `neutro`), todas decididas pelo código.

### 2.1 Sinais do método (`metodo`)

São calculados por `methodSignals(input)` (novo, `market-data/domain/asset-thesis.ts`, puro) a partir do alvo e do documento do ativo:

| id | FII | Ação | Sentido |
|---|---|---|---|
| `metodo-rank` | "3º do ranking de 24 FIIs (entre os primeiros)" | idem, "de 10 ações" | terço de cima favorável, de baixo neutro |
| `metodo-teto` | "preço 18% abaixo do teto (bem abaixo)": faixas acima do teto / até 5% (perto) / 5–15% (abaixo) / 15%+ (bem abaixo) | `metodo-margem`: "margem de segurança de 22% (alta)", mesmas faixas sobre teto ÷ preço − 1 | acima: desfavorável; perto: neutro; abaixo / bem abaixo: favorável |
| `metodo-vies` | só com viés: "viés Aguardar no método" ou "viés Comprar" | idem | Aguardar desfavorável, Comprar favorável |
| `metodo-fora` | só fora da fila, pelo motivo de elegibilidade (`SEM_TETO`, `ACIMA_DO_TETO`, `AGUARDAR`, `PROVENTO_SUSPENSO`), em palavras, como `reasonHelp` | idem (sem `PROVENTO_SUSPENSO`) | desfavorável |

Regras de cálculo:

- **Elegibilidade:** usa as funções do motor (`isDividendSuspended` com `ENGINE_VERSIONS[CURRENT_ENGINE]`). `NA_META`, `PEDIDO_PEQUENO`, `MENOS_DE_UM_LOTE` e as travas dependem da posição ou do aporte, então não entram.
- **Ranking:** o "de N" conta os ativos da mesma classe com rank na Carteira Alvo.
- **Faixas:** os limites ficam em `THESIS` (constantes), e `RADAR.marginLow/High` não são reutilizados.

### 2.2 Fatos de fundamento (`fundamento`)

São os `radarFacts` de hoje, sem mudança (`radar.ts` e seus testes ficam intactos). O `tone` do fato vira o `sentido`. A tese junta o número ao texto quando a fonte tem um, por `factNumber(fact, input)` em `asset-thesis.ts` (pelo id do fato: "P/VP de 0,82", "vacância de 12,0%", "DY de 10,2% em 12 meses"…). O `id` do fato fica igual.

### 2.3 Leitura da semana (`semana`)

`semana` entra só quando o ativo tem leitura `ok` da versão atual, com texto, gerada nos últimos 7 dias:

- o texto é a primeira frase (o veredito);
- o sentido vem do `sentido_da_semana` guardado.

A semana nunca é a única evidência do veredito (ver §4).

## 3. Prompt (estilo `conselho-investidores`)

O prompt é montado por `buildThesisPrompt(input)` e segue a mesma forma de `buildWeekSummaryPrompt`:

1. **Objeto:** "Explique para um leigo por que o método do investidor coloca (ou não) este ativo na fila de compra, e o que os fundamentos dizem sobre essa escolha." Vai junto a descrição do ativo (`describeAsset`, sem ticker nem nome).
2. **Dados:** o bloco de dados com as evidências numeradas por id, em três seções (Sinais do método, Fundamentos, Semana).
3. **Lentes da classe:** reaproveita os ids e rótulos de `WEEK_LENSES`, com perguntas novas de tese.
   - FII:
     - `renda` (Baroni): os rendimentos são sustentáveis?
     - `imoveis` (Baroni): qualidade dos imóveis ou do crédito;
     - `risco` (Buffett): o que pode dar errado;
     - `metodo` (Tiago Reis): o método está sendo seguido?
   - Ação:
     - `dividendos` (Barsi);
     - `negocio` (Buffett);
     - `risco` (Buffett);
     - `metodo` (Tiago Reis).

   Para cada lente, o modelo escolhe as evidências e escreve uma observação curta. Uma lente sem evidência fica de fora.
4. **Síntese:**
   - `motivo_da_fila`: ids do grupo `metodo`;
   - `ponto_de_atencao`: ids de evidências desfavoráveis, ou vazio.
5. **Frases:** até 3. A primeira é o veredito: liga o motivo da fila a pelo menos um fundamento. A segunda, se houver, é o ponto de atenção.
6. **Regras:**
   - números só da entrada;
   - 1 ou 2 termos do glossário (`promptTerms`, variando como hoje);
   - sem "compre", "venda", "oportunidade", "nada mudou", nomes de investidores ou recomendação própria;
   - português com acentos.
7. **Exemplos:** 2, um FII e uma ação, no lugar dos 4 do Radar.

**Chamada ao Gemini:**

- JSON por `responseJsonSchema` (`thesisSchema`), na ordem `lentes` → `sintese` → `frases`;
- temperatura 0,2;
- a cadeia `GEMINI_MODELS`, com timeout de 8 s por chamada (o mesmo do Radar).

## 4. Validação (`parseThesis`)

Uma resposta que falhe em qualquer item abaixo é recusada e tenta uma vez o próximo modelo da cadeia (o padrão de `generateWeekReading`):

- **Forma:**
  - JSON inteiro e conforme o schema;
  - de 1 a 3 frases, até 520 caracteres no total.
- **Evidências:**
  - cada frase e cada lente cita pelo menos 1 id válido;
  - o veredito (frase 1) cita pelo menos 1 id `metodo` **e** 1 `fundamento`. Assim a tese nunca se apoia só no método nem só na notícia. Um ativo sem alvo (só em posição) não tem sinais do método, então basta 1 `fundamento`;
  - se houver evidência desfavorável na entrada, alguma frase cita uma. Para dar credibilidade, a tese não pode esconder o risco.
- **Números:** só os que aparecem na entrada, com a mesma checagem da leitura da semana. Datas, "12 meses" e "7 dias" valem.
- **Texto:**
  - a lista `BANNED` da leitura da semana;
  - nenhum nome de investidor;
  - acentos obrigatórios;
  - `checkJargon` da classe, no máximo 3 termos não comuns.
- **Repetição:** um texto igual ao de outro ativo ganha uma nova chamada (`koinos.radar.duplicates_retried`, como hoje).

**Tom das lentes:** é decidido pelo código, pelas evidências citadas, nunca pelo modelo:

- todas favoráveis: favorável;
- só desfavoráveis e neutras: desfavorável;
- mistura: misto;
- só neutras: neutro.

A lente `metodo` usa só os sinais do método: na fila e sem `metodo-vies` Aguardar, favorável; com `metodo-fora`, desfavorável.

## 5. Geração e armazenamento

A geração continua no cron do Radar (`/api/cron/radar`, mesmo horário e orçamento), e os nomes `cron.radar`, `refreshRadars` e `koinos.radar.*` se mantêm, porque o dashboard depende deles.

- **Entrada da rota:**
  - a rota passa a buscar os alvos com rank, `ceilingPrice`, viés e classe, por uma função nova `listAllTargetSignals()` no `strategy/server`, só para o cron e sem usuário;
  - por ticker, vale o alvo de menor rank;
  - as posições continuam entrando só como ticker: um ativo só em posição, fora da Carteira Alvo, não tem sinais do método e mantém o Radar de hoje (só fatos, com o veredito sem `metodo`).
- **Armazenamento:** no mesmo subdocumento `asset.radar`, com `version: 2`, guardando:
  - `sentences: { text, evidence[] }[]`;
  - `lenses: { id, tone, text, evidence[] }[]`;
  - `evidence: { id, group, text, tone }[]`, o que foi mandado, para a tela mostrar as fontes de cada frase.

  `text` continua sendo as frases juntas, para quem já lê o campo.
- **Quando refazer** (`needsThesis(stored, key, now)`):
  - quando muda a chave, que junta `factsKey`, os ids de método com a faixa (sem o número) e o sentido da semana;
  - após uma falha;
  - para uma versão antiga, a v1 é refeita em até 60 min de cron (o upgrade da semana);
  - e, como o texto agora tem números, no máximo a cada 20 h mesmo sem mudança de chave, para não ficar com um % de dias atrás. Isso dá cerca de 1 chamada por ativo por noite, perto de 45 chamadas nas 16 rodadas de 6.
- **Leitura da tela:** `getRadarViews` passa a devolver `thesis` (veredito, demais frases, lentes com tom, evidências) além dos chips. Uma v1 sem tese mostra o texto antigo até ser refeita, e o texto some após 10 dias, como hoje.

## 6. Tela

**Hierarquia:** primeiro o porquê do código, depois a tese e por fim os dados.

### 6.1 `/recomendacoes`, desktop (popover ✨, agora "Por que este ativo")

1. A linha do código deste aporte (`shortReason` / `shortStockReason`), em Subheadline, com o rótulo "Neste aporte". Ela muda com o valor.
2. O veredito em Headline e as outras frases em Subheadline, com `GlossaryText`.
3. "Pelas lentes do conselho": cada lente com o chip de tom (`NewsToneChip`) e a observação.
4. Os chips de indicadores (os de hoje).
5. A nota: "Texto gerado por IA (Gemini) a partir dos sinais do método da sua Carteira Alvo e dos indicadores públicos, em dd/mm. Pode conter erros e não é recomendação. Fonte: Fundamentus."

### 6.2 Folha do celular

`InsetGroup` "Por que este ativo" no lugar de "Radar de fundamentos", na mesma ordem, com "Termos deste texto" no fim.

### 6.3 `/ativos/[ticker]`

No `AporteCard`, abaixo do lugar na fila ou do motivo de estar fora:

- o veredito, em Subheadline;
- um `Disclosure` "Lentes e indicadores" com as lentes, os chips e a nota.

Sem tese, nada muda.

### 6.4 Componentes compartilhados

`NewsToneChip` e a lista de lentes saem de `portfolio/components/asset` para `market-data/components`, exportados por `market-data/ui.ts`. São usados pela semana e pela tese, e `smart-buy` não pode importar de `portfolio`. O tom "misto" já existe em `NewsTone`.

## 7. Testes

- **`asset-thesis.test.ts`:**
  - `methodSignals`: cada faixa nas bordas, o terço do ranking, o viés, cada motivo de fora, o ativo sem alvo;
  - o prompt: evidências com id, nada de posição, quantidade, preço médio ou aporte;
  - `thesisSchema` na ordem;
  - cada recusa de `parseThesis`:
    - veredito sem método ou sem fundamento;
    - risco escondido;
    - número fora da entrada;
    - frase sem id;
    - mais de 3 frases;
    - banidas;
    - sem acento;
    - jargão;
  - o tom das lentes pelo código, incluindo `metodo`;
  - cada ramo de `needsThesis`: chave, falha, v1, 20 h.
- **`asset-thesis.test.ts` (números):** `factNumber` de cada fato com número.
- **`radar-read`:** v1 e v2 e o prazo de 10 dias, pela função pura que monta a view.

## 8. Fora do escopo

- **Texto sob demanda por valor de aporte:** era a opção C, recusada.
- **Tese no card "Fora deste aporte":** fica só no `AporteCard` do ativo.
- **Mudar o motor ou o "Por quê" do código.**
