# Importação dos extratos da B3: especificação de design

- **Data:** 2026-10-18
- **Status:** design aprovado na conversa; este documento aguarda revisão
- **Substituído em parte:** a tela (§8 a §11) deu lugar à página `/atualizacao-b3`, com os três extratos (`2026-10-23-atualizacao-b3-design.md`). As regras do plano (§4 a §7) continuam valendo.
- **Ciclo:** importação pela interface, que o spec do MVP (`2026-10-17-koinos-design.md`) deixava fora do escopo

## 1. Objetivo

Carregar e manter o histórico de FIIs pelo upload dos extratos da Área do Investidor da B3, sem rodar script. A planilha `FII's.xlsx` entra só como complemento, para o que a B3 não informa.

### Critérios de sucesso

1. Com os arquivos reais de 17/10/2026 (Negociação, Movimentação e `FII's.xlsx`), o plano chega ao fim com SNCI11 = 1.000, SNFF11 = 2.000 e BRCO11 = 265 cotas.
2. Nesses mesmos arquivos, o KISU11 fecha (subscrição + desdobro) e as 23 subscrições ficam assim: 10 com preço da B3, 10 com preço da planilha e 3 pendentes.
3. Reenviar os mesmos arquivos não muda nada: nenhuma duplicata, e as respostas dadas antes já vêm preenchidas.
4. A importação é tudo ou nada.
5. Nenhum FII fica com venda maior que a posição.
6. A posição reconstruída bate com a quantidade sobre a qual a B3 pagou rendimento, mês a mês (§6.7). As únicas exceções aceitas são as explicadas: aluguel de cotas, recibo pró-rata e fração.

## 2. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Arquivos | Extrato de **Negociação** e de **Movimentação** (os dois obrigatórios), mais a `FII's.xlsx` (opcional) | Só a Negociação não reconstrói a carteira: subscrições, desdobros e incorporações não são negócios em bolsa. No histórico real, só 2 de 20 posições batiam |
| Reenvio | Troca só o período coberto pelos arquivos | Reenviar não duplica, e dá para subir períodos separados |
| Ativos | Só FIIs e Fiagros | O Koinos é um painel de FIIs |
| Lançamentos de FII no período (manuais, da planilha ou da B3) | **A B3 manda:** dão lugar aos do extrato | O extrato é o registro oficial |
| O que a B3 não informa | Vem da planilha; o que faltar, você informa na prévia | Pedido do usuário. A planilha resolve 10 de 13 preços de subscrição |
| Lançamentos B3 | Travados na tela de Transações; corrige-se reenviando | Uma edição manual seria desfeita no próximo upload |
| Livro-razão | Continua só com compra e venda. Desdobro e incorporação viram compras e vendas com custo calculado | Posições, preço médio, evolução e checagem de vendas não mudam |
| Testes | Sem testes automatizados; conferência por script com os arquivos reais e prévia isolada | Decisão do usuário (projeto pessoal) |

## 3. Arquivos de entrada

O app reconhece cada arquivo pelo cabeçalho da primeira linha, não pelo nome. Todos são `.xlsx`, com até 5 MB por arquivo e no máximo 3 arquivos.

| Arquivo | Aba | Cabeçalho (linha 1) |
| --- | --- | --- |
| Negociação | "Negociação" | `Data do Negócio · Tipo de Movimentação · Mercado · Prazo/Vencimento · Instituição · Código de Negociação · Quantidade · Preço · Valor` |
| Movimentação | "Movimentação" | `Entrada/Saída · Data · Movimentação · Produto · Instituição · Quantidade · Preço unitário · Valor da Operação` |
| `FII's.xlsx` | abas lidas pelo `parsePlanilha` atual | as do importador do MVP (§12 do spec do MVP) |

Formatos observados:

- datas em texto `dd/mm/aaaa`;
- quantidades e preços numéricos;
- campos vazios como `"-"`;
- em "Produto", o código vem antes de `" - "` (ex.: `SNCI11 - FII SUNO CRI`).

Na Negociação, "Prazo/Vencimento" é ignorado: em 160 das 162 linhas preenchidas, ele repete a data do negócio.

## 4. Classificação dos ativos

O tipo vem do catálogo da brapi (`type` e `subType`), já guardado no Mongo:

| Catálogo | Resultado |
| --- | --- |
| `type: fund` e `subType` = `fii` ou `fi-agro` | entra |
| `type: fund` sem `subType` e código `XXXX11` | entra, marcado na prévia |
| `type: stock` (inclusive units como `TAEE11`), ETF, BDR, FI-Infra, FIP, FIDC | ignorado |
| fora do catálogo, código `XXXX11` | entra como FII que saiu da bolsa (ex.: MALL11, IRDM11), marcado na prévia |
| fora do catálogo, outro código | ignorado: direitos (`…12`), recibos (`…13`+) e renda fixa |

O mercado fracionário (`…F`) vira o código normal antes de classificar.

## 5. Regras de interpretação

### 5.1 Negociação

Cada linha de FII vira uma compra ou venda na **data do negócio**, com quantidade e preço da linha e taxas 0 (o extrato não traz taxas). `kind: NEGOCIO`. Negócios idênticos no mesmo dia são todos mantidos.

### 5.2 Movimentação

A **família** é o código sem os dois últimos dígitos (`SNCI12` → `SNCI`). O FII da família é `família + "11"`.

| Linha | Tratamento |
| --- | --- |
| `Recibo de Subscrição`, crédito, família com sufixo `13` ou maior | **Subscrição**: compra do FII da família na data do recibo. `kind: SUBSCRICAO`. Preço conforme §5.3 |
| `Recibo de Subscrição - Excluído` | Cancela um recibo de mesmo código e quantidade **creditado antes** dele. Recibo cancelado não entra |
| `Atualização`, crédito em `…11`, igual a um recibo da mesma família ainda não convertido | Conversão do recibo em cotas: **nenhum lançamento** (a compra já entrou no recibo). Marca o recibo como convertido |
| `Atualização`, crédito em `…11`, igual à posição em aberto do próprio FII naquele dia | Atualização de saldo: ignorada |
| `Atualização`, crédito em `…11`, sem recibo correspondente | **Conversão candidata** (incorporação ou troca de ticker), §5.4 |
| `Desdobro`, crédito em `…11` | Compra das cotas creditadas a **preço 0**: o custo total não muda e o preço médio cai na proporção. `kind: DESDOBRO` |
| `Grupamento` | Não suportado: o FII fica pendente e só pode ser deixado de fora |
| `Leilão de Fração`, crédito com valor | Venda da fração no FII da família, ao preço da linha. `kind: FRACAO`. Se a fração veio de uma conversão da mesma família até 60 dias antes, a quantidade convertida inclui a fração (§5.4) |
| `Resgate` | Se o FII é convertido em outro até 30 dias depois: troco da incorporação, só informado na prévia (não entra no custo). Caso contrário: venda das cotas pelo valor recebido (`valor ÷ quantidade`) |
| `Transferência - Liquidação` | Ignorada: liquidação dos negócios, que já vêm da Negociação. Inclui o aluguel de cotas e soma os negócios do dia num preço médio |
| `Transferência` | Ignorada: troca de corretora, que não muda a posição |
| `Rendimento`, `Dividendo`, `Juros Sobre Capital Próprio`, `Rendimento - Transferido`, `Reembolso`, `Empréstimo` | Ignoradas: proventos e aluguel |
| `Direito de Subscrição`, `Direitos de Subscrição - Exercido / Não Exercido`, `Solicitação de Subscrição`, sobras, `Cessão de Direitos`… | Ignoradas como lançamento. O exercício só serve como fonte de preço (§5.3). Venda de direitos não entra, porque a B3 não informa o valor |
| `Fração em Ativos` | Ignorada: a fração vai para o leilão |
| Tesouro, CDB, LCI, LCA, `APLICAÇÃO`, `RESGATE ANTECIPADO`, `VENCIMENTO`, `PAGAMENTO DE JUROS`, `COMPRA / VENDA` | Ignoradas: não são FIIs |
| Qualquer outro tipo | Ignorada; a prévia lista o tipo como "não reconhecido" |

### 5.3 Preço da subscrição (por ordem)

1. **B3**: linha `Direitos de Subscrição - Exercido` (débito) da mesma família e quantidade, com preço, entre 10 dias antes do recibo e o próprio recibo. `priceSource: B3`.
2. **Planilha**: compra do mesmo FII com a mesma quantidade, até 60 dias do recibo, escolhendo a de data mais próxima. Cada compra da planilha só serve uma vez. Também vale o FII de destino de uma conversão confirmada, porque a planilha usa o código novo (ex.: PMLL11 no lugar de MALL11). `priceSource: PLANILHA`.
3. **Você**: pendência na prévia. `priceSource: USUARIO`.
4. **Estimado**: só na carga feita pelo script de operação (§10), quando você não está para responder. `priceSource: ESTIMADO`. A prévia mostra esses valores como pendência a confirmar.

### 5.4 Conversões (incorporação e troca de ticker)

- **Destino:** o FII creditado pela `Atualização` sem recibo, na data dessa linha.
- **Origem sugerida:** um FII da carteira que, naquela data, cumpra estas condições:
  - tem posição em aberto;
  - não tem lançamento depois dela;
  - está fora do catálogo ou tem um `Resgate` em até 30 dias.

  Entre os candidatos, a sugestão é o de mesma quantidade ou, se não houver, o de posição mais próxima.
- **Quantidade de destino:** a creditada, somada às frações da mesma família leiloadas até 60 dias depois.
- **Confirmação:** a prévia **sempre** pede. A resposta guarda a origem, ou "não é conversão": nesse caso, as cotas viram uma pendência de preço, como uma subscrição.
- **Lançamentos:**
  - **venda** de toda a posição da origem pelo preço médio dela naquela data (lucro e prejuízo zero), `kind: INCORPORACAO`, `relatedTicker` = destino;
  - **compra** do destino pelo mesmo custo total, `kind: INCORPORACAO`, `relatedTicker` = origem.

  Os dois lançamentos são calculados pelo plano, e o custo vem do histórico já montado.
- **Grupo:** origem e destino entram ou ficam de fora juntos.

Casos do histórico real:

| Origem | Destino | Data | Quantidades | Valores só informados |
| --- | --- | --- | --- | --- |
| MALL11 | PMLL11 | 23/07/2025 | 197 → 197 | — |
| IRDM11 | IRIM11 | 12/12/2025 | 284 → 251,28; os 0,28 vão a leilão por R$ 19,10 | resgate de R$ 27,09 |

## 6. Período, substituição e aceitação

1. **Período do upload:** é o trecho comum à Negociação e ao Movimentação. Cada arquivo cobre da primeira à última data que contém. O que estiver fora dele fica de fora, e a prévia informa.
2. **FIIs gerenciados:** os classificados como FII (§4) que aparecem nos extratos ou já têm lançamento no período.
3. **Histórico novo de cada FII:**
   - entram os lançamentos atuais **fora** do período (de qualquer origem), os do extrato **dentro** do período e as respostas;
   - a reconstrução roda em ordem de data: compras, depois conversões, depois vendas no mesmo dia;
   - o critério de "fechar" é o do MVP: nenhuma venda maior que a posição (`findOversells`).
4. **Posição anterior ao extrato:**
   - **Quando:** um FII que não fecha porque falta posição recebe uma pendência "posição anterior".
   - **Quantidade:** calculada pelo plano. É o maior déficit acumulado, e não só o da primeira venda.
   - **Preço:** vem da planilha se ela tiver compras do FII antes do buraco; senão, você informa.
   - **Como fica gravada:** uma compra com `kind: POSICAO_ANTERIOR`, datada da **véspera da data mais antiga dos extratos**. O Movimentação começa antes da Negociação, e os rendimentos de nov/2019 já mostram essas cotas. Por estar fora do período, nenhum upload a troca.
5. **Aceitação:**
   - Um FII (ou grupo) entra quando fecha e não tem pendência aberta.
   - Um FII que você marcou para ficar de fora, ou que tem grupamento, **fica como está**: nada dele é apagado nem inserido.
6. **Substituição:**
   - para cada FII aceito, os lançamentos atuais dele **dentro** do período saem (de qualquer origem: B3, manual ou planilha) e os do extrato entram;
   - isso vale também para um FII gerenciado sem nenhuma linha no extrato: os lançamentos dele no período saem, porque a B3 não os confirma, e a prévia lista cada um;
   - ativos ignorados nunca são tocados.
7. **Conferência pelos rendimentos:**
   - **O que compara:** para cada família de FII e mês de pagamento, a quantidade das linhas `Rendimento` + `Reembolso` (créditos) é a posição oficial na data-com. A prévia compara esse número com a posição reconstruída em algum dia entre 45 e 1 dia antes do pagamento, e aceita o piso da quantidade (a fração não recebe).
   - **Divergências explicadas:**
     - **aluguel:** um mês dentro de um intervalo entre uma `Transferência - Liquidação` de saída sem preço e o retorno;
     - **recibo pró-rata:** um único mês perto de uma subscrição.
   - Essas aparecem à parte. As outras viram aviso no FII.

## 7. Pendências e respostas guardadas

| Pendência | Id estável | Resposta |
| --- | --- | --- |
| Preço de subscrição | `sub:<FII>:<aaaa-mm-dd>:<quantidade>` (data do recibo) | preço > 0, ou "deixar FII de fora" |
| Conversão | `conv:<destino>:<aaaa-mm-dd>:<quantidade>` | FII de origem, "não é conversão" ou "deixar de fora" |
| Posição anterior | `prev:<FII>` | preço médio > 0, ou "deixar FII de fora" |

**Onde as respostas ficam guardadas**

- **Preços de subscrição:** no próprio lançamento, com `priceSource: USUARIO`.
- **Conversões:** no par de lançamentos `INCORPORACAO`, pelo `relatedTicker`.
- **Posição anterior:** no lançamento `POSICAO_ANTERIOR`.

**Reaproveitamento no próximo upload**

O serviço lê os lançamentos B3 atuais do período (`SUBSCRICAO` com `priceSource: USUARIO` e `INCORPORACAO`) antes de montar o plano, e as pendências com o mesmo id já vêm respondidas. A prévia lista essas respostas como "informado por você", editáveis.

## 8. Prévia e tela

**Rota e acesso**

A rota é `/transacoes/importar`, no grupo autenticado `(app)`. O acesso é pelo botão **"Importar da B3"** em Transações e pela tela vazia do dashboard.

**Passo 1: arquivos**

- Três campos: Negociação, Movimentação e "Sua planilha (opcional)".
- Também aceita arrastar e soltar os três de uma vez; o app reconhece cada um pelo cabeçalho.
- O botão "Gerar prévia" chama `previewB3ImportAction`.

**Passo 2: prévia**

1. **Cabeçalho:** o período, os arquivos reconhecidos e os totais (negócios, subscrições, desdobros, conversões e leilões).
2. **O que vai ser trocado:** lançamentos atuais que saem, por origem (manual, planilha, B3), e a lista dos que a B3 não confirma.
3. **Pendências:** campos de preço (R$), escolha da origem das conversões (a sugestão vem marcada) e "deixar este FII de fora" em cada uma. A confirmação só libera quando não sobra pendência.
4. **Situação por FII (ou grupo):**
   - cotas no fim e preço médio;
   - origem dos dados (B3, planilha ou você);
   - situação: ok, pendente, ou de fora com o motivo.
5. **Ignorados**, agrupados por motivo, e **avisos**: troco de incorporação, FII fora do catálogo e tipo não reconhecido.

**Passo 3: confirmar**

- O botão "Importar" chama `confirmB3ImportAction` com os mesmos arquivos e as respostas.
- Depois de gravar: aviso de sucesso com as contagens e volta para `/transacoes`.

**Visual**

Segue o tema macOS atual: cards sólidos, cápsulas e tabelas de 13 px.

**Em Transações**

Lançamentos B3 ganham o selo **B3** e o tipo ("Subscrição", "Desdobro", "Incorporação", "Fração", "Posição anterior"), e não mostram editar nem excluir.

## 9. Modelo de dados

Campos novos em `Transaction`:

| Campo | Valores | Padrão |
| --- | --- | --- |
| `source` | passa a aceitar `B3` (além de `MANUAL` e `PLANILHA`) | `MANUAL` |
| `kind` | `NEGOCIO`, `SUBSCRICAO`, `DESDOBRO`, `INCORPORACAO`, `FRACAO`, `POSICAO_ANTERIOR` | `NEGOCIO` (vale para os documentos antigos) |
| `priceSource` | `B3`, `PLANILHA`, `USUARIO`, `ESTIMADO` | `null` |
| `relatedTicker` | código do outro lado de uma incorporação | `null` |

**Efeitos no domínio**

- `LedgerEntry` ganha `kind` opcional.
- `monthlyContributions` ignora compras com `kind: INCORPORACAO`, porque não são aporte. Desdobro já soma 0.
- O resto do domínio (`replayLedger`, `findOversells`, evolução, motor Suno) não muda.

**Efeitos nas actions de lançamento**

- `updateTransaction` e `deleteTransaction` passam a filtrar `{ _id, portfolioId, source: { $ne: "B3" } }`. Um lançamento B3 não é encontrado, então não é alterado.
- A action de criação continua gravando só `MANUAL` + `NEGOCIO`.

## 10. Arquitetura

| Peça | Arquivo | Responsabilidade |
| --- | --- | --- |
| Leitor da Negociação | `src/features/transactions/import/b3/read-negociacao.ts` | `SheetInput[]` → negócios normalizados + ignorados + erros de linha (puro) |
| Leitor do Movimentação | `src/features/transactions/import/b3/read-movimentacao.ts` | `SheetInput[]` → recibos, preços de exercício, conversões candidatas, desdobros, grupamentos, leilões, resgates + ignorados (puro) |
| Reconhecimento | `src/features/transactions/import/b3/detect.ts` | Identifica cada arquivo pelo cabeçalho (puro) |
| Plano | `src/features/transactions/import/b3/plan.ts` | `planB3Import({ negociacao, movimentacao, planilha?, existing, assetTypes, answers })` → `B3ImportPlan` (período, grupos, lançamentos novos, ids a remover, pendências, ignorados, avisos). Puro e determinístico |
| Tipos | `src/features/transactions/import/b3/types.ts` | Tipos do plano e o DTO da prévia (sem `_id`, `userId` nem `portfolioId`) |
| Serviço | `src/features/transactions/server/b3-import.ts` | Lê os arquivos (`read-excel-file/node` aceita o `Blob` do formulário), carrega os lançamentos do tenant e os tipos do catálogo, roda o plano, monta a prévia; na confirmação, aplica numa transação do Mongo (`session.withTransaction`): remove e insere |
| Actions | `src/features/transactions/actions.ts` | `previewB3ImportAction` e `confirmB3ImportAction` (`authActionClient`). As duas recebem os arquivos e recalculam tudo no servidor |
| Trava | `src/shared/db/lock.ts` | `withLock`, que sai de `market-data/server/lock.ts`. A confirmação usa `import:<portfolioId>` |
| Tela | `src/app/(app)/transacoes/importar/page.tsx` + `src/features/transactions/components/b3-import/*` | Upload, prévia, pendências e confirmação |
| Catálogo | `src/features/market-data/server.ts` e `repo.ts` | `getAssetTypes(tickers)` → `Map<ticker, { type, subType } \| null>`. No app, com cache; nos scripts, uma leitura direta (`repo.ts`) |
| Script de operação | `scripts/import-b3.ts` | Mesmo plano, pela linha de comando, com `--dry-run` e um arquivo de respostas. Serve para a carga inicial e para conferir. O usuário final usa a tela |

**Fluxo da confirmação**

1. Recalcula o plano com as respostas.
2. Se surgir pendência que não estava na prévia, recusa com "A prévia mudou; gere de novo".
3. Pega a trava `import:<portfolioId>`.
4. Abre a transação, remove os lançamentos do período dos FIIs aceitos e insere os novos.
5. Fecha a transação, chama `refresh()` e devolve as contagens.

As cotações dos FIIs novos são buscadas pelo `QuoteRefresher` das telas.

## 11. Segurança

- **Tenant:** a carteira vem sempre da sessão (`ctx.tenant`). Nenhum id vem do navegador. As respostas só referenciam ids de pendência, recalculados no servidor.
- **Arquivos:**
  - no máximo 3, com até 5 MB cada;
  - só `.xlsx`, conferido pela assinatura zip `PK\x03\x04`;
  - até 50.000 linhas no total;
  - lidos em memória e descartados, sem gravar nada em disco ou no banco.
  - O limite de corpo das Server Actions sobe para o necessário (ver `serverActions.bodySizeLimit` na documentação do Next 16).
- **Entradas:** as respostas passam pelo Zod. Preços são positivos e finitos; ids seguem o formato da §7; origens de conversão são FIIs que existem no plano.
- **Erros:** mensagens seguras pelo `handleServerError`. O detalhe da linha problemática aparece na prévia, sem stack.
- **Isolamento:** remoção e inserção filtram por `portfolioId`. Os DTOs da prévia não carregam ids internos.

## 12. Fora deste ciclo

- Proventos recebidos (linhas de `Rendimento`) como histórico real de renda.
- Grupamento e bonificação em FIIs: viram pendência e só podem ficar de fora.
- Venda de direitos de subscrição: a B3 não informa o valor.
- Taxas e emolumentos: o extrato não traz.
- Posição por corretora e cálculo de IR.
- Conferência automática com o extrato de Posição.
- Mudanças no importador de linha de comando: ele continua como está.

## 13. Verificação

1. **Script de conferência** descartável (`scripts/_check-b3.ts`, apagado depois): roda `planB3Import` com os três arquivos reais e confere os critérios da §1. Com isso, mostra:
   - as pendências: 3 preços de subscrição (KISU11 226 em 05/2021, RBRP11 21 em 03/2021, HGCR11 31 em 12/2019), 2 conversões (§5.4) e as posições anteriores;
   - as posições anteriores, pelo maior déficit: GGRC11 119, ALZR11 30, HGCR11 91, VISC11 56, XPML11 26 e MALL11 33. Os rendimentos de nov/2019 a mar/2020 confirmam cada uma;
   - a conferência pelos rendimentos (§6.7): 1.238 de 1.248 meses de pagamento batem, e os 10 restantes são explicados (4 posições anteriores datadas tarde demais na análise, 4 de aluguel no SNAG11 e no XPML11, 2 de recibo pró-rata no PVBI11 e no LVBI11);
   - os ignorados por motivo.
2. **Prévia isolada:** banco `koinos_preview`, upload real pela tela, capturas nos temas claro e escuro, confirmar.
   - **Depois de confirmar:** conferir dashboard e Transações.
   - **Reenvio:** reenviar os mesmos arquivos deve mostrar zero mudanças e as respostas preenchidas.
   - **Limpeza:** banco e sessão de prévia apagados no fim.
3. `npm run lint`, `npm run typecheck`, `npm run build` e `npm run format:check`.

## Apêndice A: o que a análise dos arquivos reais mostrou (17/10/2026)

**Negociação**

- 569 negócios de 25/11/2019 a 30/09/2026, com 4 corretoras.
- 552 são de FIIs e Fiagros; o resto são ações e direitos.

**Negociação contra a planilha**

- 426 negócios são idênticos.
- 113 estão só na B3; por exemplo, várias compras de mai–jun/2025.
- 86 estão só na planilha; a maioria são compras de MALL11 registradas como PMLL11.

**Movimentação**

- 23 recibos de subscrição em 13 FIIs.
- 1 desdobro (KISU11: 226 → 2.260), 2 conversões e 1 resgate com leilão de fração.
- Os preços que faltam (3 subscrições e as 6 posições anteriores) são todos de lotes vendidos por inteiro. Eles mudam só o L/P realizado de vendas antigas, nunca o preço médio da posição atual.
- As 530 liquidações de FII somam os negócios do dia e incluem o aluguel de cotas, por isso não servem como fonte de negócios.
