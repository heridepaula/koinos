# Relatório de Imposto de Renda e consistência fiscal: especificação de design

- **Data:** 2026-11-16
- **Status:** o Gemini foi removido em 2026-11-17 por decisão do dono (§6); a tela é 100% determinística. Passo 1 implementado em 2026-11-16 (branch `feat/relatorio-ir`, plano `2026-11-16-relatorio-ir-passo-1.md`) e validado no navegador com a carteira real: proventos de 2025 e custo das posições batem com o Dashboard (diferença 0,00). Desvios do plano: o CNPJ roda em rota própria `/api/cron/cnpj` (semanal), `PROVENTO_APOS_ENCERRAR` ficou para o passo 2, a narrativa da IA é por tipo de achado (sem números) e o desempate do CNPJ por nome foi aceito. Falta o passo 2 (day trade e IRRF) e os itens abertos do §9.
- **Origem:** especificação "Feature #10" colada pelo dono, revisada contra o código. §10 lista o que mudou em relação a ela.
- **Specs relacionadas:** `2026-10-23-posicoes-encerradas-design.md` (IR estimado por posição), `2026-10-30-acoes-etapa-1-design.md` §8 (IR de ações), `2026-11-12-resumo-ia-variacao-design.md` (cadeia Gemini).

## 1. Objetivo

Uma página `/imposto-de-renda` que, para um ano-calendário, entrega os dados prontos para a DIRPF: Bens e Direitos em 31/12 (com a discriminação para colar), Rendimentos Isentos, Tributação Exclusiva, e a apuração mensal de vendas (DARF e prejuízo a compensar). Um auditor aponta o que está inconsistente.

### Critérios de sucesso

1. Todo número (quantidade, custo, preço médio, proventos, imposto) sai de código puro e testado. Sem IA: a tela é toda determinística (decisão de 2026-11-17).
2. Bens e Direitos de 31/12 do ano e do ano anterior batem com `replayLedger` cortado nas duas datas e com a posição atual quando o ano é o corrente.
3. A soma dos proventos do ano bate com `/proventos` filtrado pelo mesmo ano, por tipo.
4. A apuração mensal, nos casos de teste da §8, bate com o cálculo à mão. O IR estimado de `/encerradas/ir` não muda.
5. A tela não usa Gemini: mostra tudo, com a discriminação em modelo fixo gerado pelo código e as notas da auditoria em texto fixo (`finding-notes.ts`).
6. Ativo sem CNPJ aparece como pendência bloqueante na ficha dele, nunca com CNPJ inventado.

## 2. Decisões do dono (2026-11-16)

| Tema | Decisão | Consequência |
| --- | --- | --- |
| Gemini | Mantido como na spec original, com os dados da carteira no prompt | Exceção à regra "só dado público vai ao Gemini". Registrada no CLAUDE.md. Ver §6 para os limites |
| Vendas | Apuração mensal completa | Compensação de prejuízo por classe, saldo inicial informado pelo dono, IRRF e day trade (§5.4) |
| CNPJ | Fonte pública automática | Nova integração (CVM dados abertos), com correção manual por ativo (§4) |
| Exportação | Copiar, PDF e JSON | Dependência de PDF nova (§7) |

## 3. Escopo e arquitetura

**Classes:** só FII e ação (inclui units). ETF e BDR da spec original ficam de fora: `assetClassOf` não os acompanha e os extratos importados os descartam (`classify.ts`). Entram quando o app passar a acompanhá-los, com spec própria.

**Módulo:** `src/features/tax-report/` (feature de feature-module, mesmas regras de `index.ts`, `server.ts`, `actions.ts`, `ui.ts`). A spec original citava `/lib/fiscal`, `/app/api/fiscal/audit`, `(dashboard)` e `userId`: não existem aqui. Aqui:

- `domain/` puro, sem Next, banco nem I/O, com Vitest ao lado.
- Tenancy por `getTenant()`/`requireTenant()` e `portfolioId`. Nenhum id interno no DTO.
- Ações com `authActionClient` e `.metadata({ actionName })`.
- Rota `src/app/(app)/imposto-de-renda`, entrada no `proxy.ts` (`/imposto-de-renda/:path*`) e em `nav-items.ts`, grupo `registros`, sem `tab`.
- Textos, comentários e docs em pt-BR. Valores da carteira dentro de `Sensitive`.

**Pipeline:**

```
transações + proventos + ativos (nome, CNPJ)
  → domain/: posições em 31/12, proventos do ano, apuração mensal, auditoria por regras
  → FiscalYearReport (determinístico)
  → notas fixas por tipo de achado (`finding-notes.ts`), sem IA
  → tela por abas + exportação
```

## 4. CNPJ e nome do emissor

O app guarda só `name` (brapi/Yahoo). Nunca CNPJ.

- **Fonte:** dados abertos da CVM, lidos por um passo do cron diário (`cron.refresh-cnpj`, mesmo padrão de `cron.treasury`: `Koinos/1.0`, `last_modified`/ETag, validação antes de gravar, `withLock`). A CVM não é B3, então a regra "sem chamadas à B3" não se aplica.
- **Validado em 2026-11-16 nos arquivos reais** (ZIPs anuais em `dados.cvm.gov.br`):
  - **Ações e units:** `CIA_ABERTA/DOC/FCA/DADOS/fca_cia_aberta_AAAA.zip`, arquivo `fca_cia_aberta_valor_mobiliario_AAAA.csv`, colunas `Codigo_Negociacao` e `CNPJ_Companhia` (separador `;`, Latin-1). Casam sem ambiguidade PETR4, VALE3, KLBN11, TAEE11, EGIE3, UNIP6, ITUB4 e BBAS3. Descartar valores não ticker (`N/A`, `NÃO HÁ`, `0000`) e tickers com mais de um CNPJ. O nome vem de `Nome_Empresarial`.
  - **FIIs:** `FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_AAAA.zip`, `inf_mensal_fii_geral_AAAA.csv`, com `CNPJ_Fundo_Classe`, `Nome_Fundo_Classe` e `Codigo_ISIN`, mas **sem o ticker**. O ISIN da cota é `BR` + 4 letras do ticker + `CTF` + 4 caracteres (ex.: `BRFVPQCTF015`). Casamento: `BR` + `ticker[0..4]` + `CTF` e aceito só se der um único CNPJ no arquivo mais recente; senão, pendência. É heurística: por isso `cnpjSource: CVM_ISIN` (e `CVM_FCA` para ação), e a tela mostra a origem para o dono conferir na primeira vez.
- **Teste de aceitação do casamento:** os FIIs e ações reais do dono (script de laboratório, só leitura) resolvem para um CNPJ e o nome do fundo é coerente com o `name` do app; o que não resolver vira lista de pendências para o campo manual.
- **Resultado da primeira execução real (2026-11-16, uma chamada local a `/api/cron/cnpj`, 6,4 s):** 34 ativos casaram e 8 não. Os 34 foram lidos um a um contra o `name` do app: todos coerentes (a razão social só difere por abreviação, como "BTGP LOGISTICA FII" para "BTG Pactual Logística"), com um para conferir: **GARE11**, CVM "FII GUARDIAL LOGISTICA" contra "Guardian Real Estate" no app (provável renomeação).
- **Os sem casamento e o porquê** (candidatos lidos do arquivo da CVM):
  - **TRXF11, XPML11, KISU11: o mesmo ISIN aparece em dois CNPJs.** Ex.: `BRXPMLCTF000` é do "XP MALLS FII" (28.757.546/0001-00) e do "PENINSULA FII" (07.583.627/0001-61); `BRTRXFCTF003`, do "TRX REAL ESTATE" (28.548.288/0001-52) e de "LIQUIDEZ PROJETOS GD" (63.134.454/0001-75); `BRKISUCTF000`, do "KILIMA FIC FII" (36.669.660/0001-07) e de "FII RIVIERA RESIDENCIAL" (65.923.811/0001-00). A regra "só um CNPJ" recusou os três de propósito. Desempate por semelhança do nome com o `name` do app resolveria os três, mas é decisão do dono (§9, item 8).
  - **PMLL11, IRDM11:** fundos incorporados; o ISIN do arquivo ainda leva o prefixo do antigo (`BRMALLCTF007` para o Pátria Malls, `BRIRIMCTF003` para o Iridium CRI). Campo manual.
  - **SNAG11 (Fiagro):** o Fiagro não está no informe mensal de FII. Campo manual, ou outra fonte da CVM.
- **Armazenamento:** campos novos no ativo (`cnpj`, `legalName`, `cnpjSource`: `CVM_FCA`, `CVM_ISIN` ou `MANUAL`, `cnpjFetchedAt`). O valor `MANUAL` nunca é sobrescrito pela CVM.
- **Correção manual:** campo por ativo na ficha de Bens e Direitos, validado por dígito verificador (função pura). Serve como fallback e como correção.
- **Casamento só vale com certeza:** em caso de dois candidatos, grava nenhum e deixa pendência (`CNPJ_AUSENTE`).
- **Units e tickers de famílias** (PETR3/PETR4, KLBN11): o CNPJ é do emissor, então o casamento é pela família. A unit pode ter nome do emissor e tipo diferente: testar KLBN11 e TAEE11.

## 5. Regras (puras)

### 5.1 Posição em 31/12

`positionAt(ledger, date)`: filtra as entradas com `date` até 31/12 e chama `replayLedger` (verificado em 2026-11-16: ele recebe a lista de entradas, ordena sozinho e soma taxas de compra ao custo; nenhuma mudança nele).

- A ficha pede o **custo médio de aquisição**: o `replayLedger` já inclui as taxas de compra no preço médio. Isso é o método da Receita, mas confirmar no teste com uma compra com taxa.
- Duas fotos por ano: 31/12 do ano anterior e 31/12 do ano. A ficha mostra as duas colunas.
- Posição zerada em 31/12 do ano anterior e comprada no ano: coluna anterior em branco (0,00).
- Posição que zerou no ano: "situação" em 31/12 do ano é zero e a Receita pede que o bem apareça com o valor zero no programa; a tela lista como "encerrada no ano" com a linha, sem texto de discriminação.
- Entradas `ESTIMADO` (preço) e a posição anterior de 2019-11-07 (sem data de compra) viram aviso `PRECO_ESTIMADO` e `POSICAO_ANTERIOR`.
- Incorporação: o custo vai para o destino (regra já existente); a tela mostra a origem no texto.
- Desdobro/bonificação: pelas regras já no ledger. Ações emprestadas (aluguel) continuam do dono: a posição inclui as emprestadas, como o ledger já trata.

### 5.2 Proventos do ano

Fonte: coleção `dividends` por `paidAt` no ano-calendário (regime de caixa, que é o da DIRPF). Mapeamento:

| `DividendKind` | Classe | Ficha | Observação |
| --- | --- | --- | --- |
| `DIVIDENDO` | ação | Rendimentos Isentos | Lucros e dividendos, por CNPJ da pagadora |
| `RENDIMENTO` | FII | Rendimentos Isentos | Isenção do FII depende das condições legais (§9, item 3) |
| `JCP` | ação | Tributação Exclusiva | O valor guardado é **líquido** da retenção (15% até 2025 e 17,5% de 2026 em diante, por data de pagamento: LC 224/2025, confirmado nos extratos reais, ~15% até 2025 e ~17,4–17,9% em 2026); a ficha pede o bruto e o imposto retido: bruto = quantidade × bruto por cota do extrato quando existem, senão líquido ÷ (1 − taxa); retido = bruto − líquido, ao centavo. Com o bruto do extrato, líquido a mais de max(R$ 0,05; 1% do líquido) de bruto × (1 − taxa) gera `JCP_FORA_DA_FAIXA` (recompor o bruto só do líquido sempre fecha, então ali não há o que conferir) |
| `REEMBOLSO` | FII/ação | Segue o tipo do provento reembolsado | Em dúvida, sinaliza `PROVENTO_REEMBOLSO` para o dono conferir; não decide sozinho |
| `ALUGUEL` | ação/FII | Tributação Exclusiva ou rendimentos de aplicação financeira, conforme a Receita | **Pendência de pesquisa** (§9, item 4). Até confirmar, aparece num grupo "Aluguel de ativos" com aviso, fora das somas das fichas |

- A categoria `TRIBUTADO` da spec original deixa de existir: nenhum provento do app é tributado na tabela, e o tipo vazio era enganoso.
- Agrupado por CNPJ da fonte pagadora (quando o ativo não tem CNPJ, por ticker, com pendência).
- **Provento declarado e não pago em 31/12** não entra: a DIRPF é por pagamento. O app não tem fonte confiável para "declarado mas não pago" (o `dividend_forecasts` é foto do dia do upload), então o auditor só avisa quando um ativo zerou e tem provento a receber (`dividend_forecasts`/Fundamentus) no ano seguinte.

### 5.3 Lei 15.270/2025 (ano-calendário 2026 em diante)

A Lei 15.270/2025 criou retenção de 10% sobre lucros e dividendos de ações pagos por uma mesma empresa a uma pessoa física acima de R$ 50 mil no mês, e a tributação mínima anual para renda alta. Para o ano-calendário 2025 (declaração 2026) a isenção de dividendos continua. Para 2026+, o relatório:

- calcula por ticker e mês o total de `DIVIDENDO` e marca `RETENCAO_DIVIDENDO_POSSIVEL` quando passar de R$ 50 mil de uma fonte no mês;
- não tenta aplicar a regra de transição dos lucros apurados até 2025 (as fontes divergem sobre prazo de aprovação e pagamento). Mostra aviso e deixa a decisão com o dono e o contador;
- FIIs ficam no regime próprio, sem a retenção.

Isto é aviso, não cálculo, até a regra ser lida no texto da lei (§9).

### 5.4 Apuração mensal de vendas

`domain/monthly-apuration.ts`. Reaproveita `replayLedger.sales` (custo no preço médio do dia) e `closed-positions.ts` para as regras já testadas. Regras:

- **Classes separadas:** FII (20%, sem isenção, qualquer venda) e ação swing trade (15%, isenta se o total vendido de **ações** no mês ≤ R$ 20.000, só o lucro; units contam como ação). O prejuízo de uma classe só compensa lucro da própria classe e da modalidade.
- **Day trade** (compra e venda do mesmo ticker no mesmo dia, detectado pelo ledger): ação a 20%, modalidade própria; FII day trade também 20% e modalidade própria. A venda que forma day trade sai do swing.
- **Saldo inicial de prejuízo:** o ledger só começa em 2019-11. Um registro novo `tax_loss_balances` (por carteira, classe, modalidade) guarda o saldo de prejuízo de anos anteriores informado pelo dono, na data do primeiro mês apurado. Sem saldo informado, assume zero e mostra o aviso `SALDO_PREJUIZO_NAO_INFORMADO`.
- **Compensação:** prejuízo de um mês reduz o lucro tributável dos meses seguintes da mesma classe e modalidade, sem prazo de expiração. Lucro em mês isento (ação ≤ R$ 20 mil) não consome prejuízo e prejuízo em mês isento continua compensável.
- **IRRF "dedo-duro":** 0,005% do valor da venda em swing de ações e 1% do lucro no day trade (FII swing sem retenção; FII day trade 1%). O IRRF do mês é abatido do imposto do mês e o excedente carrega para o próximo, como a Receita. O app não recebe o IRRF dos extratos, então calcula por regra; o campo é `irrfEstimated` e a tela diz "estimado".
- **Saída:** por mês e (classe, modalidade): vendido, custo, resultado, parte isenta, prejuízo compensado, base de cálculo, imposto devido, IRRF abatido, DARF (código 6015, vencimento último dia útil do mês seguinte) e saldo de prejuízo ao fim do mês. DARF abaixo de R$ 10,00 acumula para o mês seguinte.
- **Relação com `/encerradas/ir`:** continua sendo a estimativa simples por posição, sem compensar prejuízo, como a spec de 2026-10-23 decidiu. A tela nova é a apuração e prevalece quando divergem; a tela antiga ganha uma frase com link. Nenhum número de `/encerradas` muda.
- **Ressalvas que a tela mostra:** custo estimado (`ESTIMADO`), posição anterior sem data de compra, e que a apuração é do que está no extrato (vendas fora da B3 não entram).

### 5.5 Auditoria (regras, em código)

Cada achado tem `code`, `severity` (`INFO`, `ATENCAO`, `CRITICO`), ticker e mês quando houver. A narrativa do Gemini (§6) só reescreve a descrição; severidade e código vêm do código. Códigos iniciais:

`CNPJ_AUSENTE`, `PRECO_ESTIMADO`, `POSICAO_ANTERIOR`, `VENDA_ACIMA_ISENCAO_SEM_DARF` (mês acima de R$ 20 mil de ações com lucro e imposto não zerado), `SALDO_PREJUIZO_NAO_INFORMADO`, `PROVENTO_APOS_ENCERRAR`, `PROVENTO_REEMBOLSO`, `ALUGUEL_NAO_CLASSIFICADO`, `RETENCAO_DIVIDENDO_POSSIVEL`, `JCP_FORA_DA_FAIXA` (JCP líquido que não corresponde ao bruto arredondado menos a retenção do ano), `POSICAO_NEGATIVA` (não deve ocorrer: `findOversells`; é guarda), `ATIVO_SEM_COTACAO_NA_DATA` (se for preciso para algo além do custo; hoje não é).

## 6. Gemini (removido)

> **Removido em 2026-11-17 por decisão do dono.** A reescrita da discriminação não agregava nada (o modelo fixo já é exato) e as explicações por tipo de achado viraram textos fixos escritos à mão (`domain/finding-notes.ts`). Não há mais chamada ao Gemini, exceção de privacidade nem coleção `tax_narratives` em uso. O texto abaixo é histórico.

- **Exceção de privacidade (decisão do dono, 2026-11-16):** o prompt leva quantidade, preço médio, custo e proventos por ativo. O CLAUDE.md passa a registrar a exceção, com o risco: o nível gratuito pode treinar com os prompts (a regra antiga existia por isso).
- **Mínimo necessário:** não vão ao prompt id de portfólio, e-mail, nome do usuário, corretora e valores de patrimônio total. O prompt leva só os campos da §3 que a discriminação pede.
- **Cadeia de modelos:** `gemini-chain.ts` (`GEMINI_MODELS`, contadores por modelo, 429 diário esgota, 429 por minuto só pula). A spec original fixava `gemini-2.5-flash` e a lib `@google/genai`: usar o adaptador e a cadeia existentes (`adapters/gemini.ts`), sem dependência nova. Sem `GEMINI_API_KEY`, desligado.
- **Nada de número do modelo:** o código monta primeiro a discriminação em **modelo fixo** (`discriminationTemplate`): `"{qtd} AÇÕES/COTAS DE {NOME} ({TICKER}), CNPJ {cnpj}. CUSTO TOTAL DE AQUISIÇÃO: R$ {total} (PREÇO MÉDIO DE R$ {pm})."` (sem corretora, decisão do dono). O Gemini pode reescrever a frase, e o código só aceita a resposta se o texto contiver exatamente os mesmos quantidade, CNPJ, total e preço médio (comparação por regex dos números formatados, como `parseWeekReading` faz) e não trouxer número que não esteja na entrada. Qualquer falha usa o modelo fixo.
- **Corretora:** fora do texto da discriminação (decisão do dono, 2026-11-16). O app não a guarda e nenhum campo novo é criado.
- **Saída (decisão de 2026-11-16, após medir 125 achados em 2025, 80 quase idênticos):** `responseJsonSchema` com `bensDescriptions[{ ticker, text }]` (uma reescrita por ativo, validada pelos números do modelo fixo) e `codeNarratives[{ code, text }]` (**uma por tipo de achado**, em linguagem clara e **sem número nenhum**: ela explica o que o achado significa e o que conferir). A mensagem de cada achado, com ticker, mês e valor, continua vinda do código. Isso cabe numa chamada e um JSON cortado não derruba dezenas de achados. Sem `severity` na saída (ela vem do código).
- **Texto da IA passa pelo mesmo mascaramento da tela:** valores em R$ dentro de qualquer texto renderizado passam por `moneySegments` e `Sensitive`.
- **Em segundo plano, nunca pela página:** o padrão do resumo do dia. Server Action `generateTaxNarrativesAction` (botão "Gerar textos com IA") grava o resultado em `tax_narratives` (carteira + ano + chave). A chave é um hash dos dados do ano (posições, proventos, achados); só chama de novo quando a chave muda. A página só lê.
- **Resiliência:** com falha, a página mostra todos os números e textos de modelo fixo, com a faixa "Os textos automáticos estão indisponíveis agora". A discriminação em modelo fixo é sempre válida para copiar.
- **Observabilidade:** span `tax.narratives`, contadores de aceito/recusado (`koinos.tax.rejected` com o código da regra, nunca o texto). Dados do prompt nunca vão ao log.

## 7. Interface

Rota `/imposto-de-renda`, `?ano=` por `nuqs` (padrão: ano anterior até 30/04, ano corrente depois; só anos com lançamentos). Cabeçalho estático e seções em `<Suspense>`, como as outras páginas. Cinco abas (`SegmentedControl` em telas pequenas):

1. **Resumo e auditoria:** achados por severidade, estado das pendências (CNPJ, saldo de prejuízo, corretora), botão "Gerar textos com IA", "Copiar tudo".
2. **Bens e Direitos:** tabela por ativo (grupo/código, 31/12 anterior, 31/12 atual, discriminação, copiar). No celular vira lista com folha (`Drawer`). O CNPJ é editável aqui.
3. **Rendimentos isentos:** por CNPJ da fonte pagadora, com código da ficha.
4. **Tributação exclusiva:** JCP bruto, imposto retido, líquido.
5. **Vendas e apuração:** a tabela mensal da §5.4, saldo de prejuízo, DARF por mês, campo do saldo inicial.

- **Códigos da Receita** (`domain/receita-codes.ts`, constantes por ano-calendário, testadas): Ações = Grupo 03, Código 01; FII = Grupo 07, Código 03; Dividendos = Isentos 09; JCP = Exclusiva 10; Rendimento de FII = Isentos 26 (uma fonte consultada traz 14: conferir no programa do ano). Guardados por ano para o programa do ano seguinte mudar sem quebrar o histórico.
- **Exportação:** botões copiar por linha e geral (Clipboard API, com retorno visual); **JSON** (`FiscalYearReport` como baixado, sem ids); **PDF**. O PDF é a impressão do navegador (`window.print()` com CSS `@media print` para a aba ativa e para o relatório completo), sem dependência nova (decisão do dono). Todo export leva o aviso fixo e o ano.
- **Privacidade:** valores sob `Sensitive` na tela. JSON e impressão saem sempre completos, mesmo no modo privado (decisão do dono), com um aviso ao exportar ("o arquivo contém seus valores").
- **Aviso fixo:** "Estimativa do Koinos. Não é orientação fiscal nem substitui a conferência com o informe da corretora e o programa da Receita."

## 8. Testes (Vitest, só código puro)

Cenários calculados à mão, cobrindo o domínio:

- `positionAt`: compra com taxa, venda parcial, incorporação, desdobro, posição zerada no ano, posição anterior de 2019.
- Proventos: JCP líquido→bruto→retido fechando ao centavo; `REEMBOLSO`; provento no ano seguinte; agrupamento por CNPJ e fallback por ticker.
- Apuração: mês ≤ R$ 20 mil isento; mês acima com lucro; prejuízo compensado por classe sem vazar entre FII e ação; day trade separado; saldo inicial informado; IRRF excedente carregando; DARF < R$ 10 acumulando.
- Invariantes em 500 carteiras com semente: o resultado da apuração soma o resultado de `closed-positions` + posições abertas vendidas; o saldo de prejuízo nunca fica negativo; FII jamais compensa com ação.
- CNPJ: dígito verificador, casamento ambíguo, manual não sobrescrito, família de ticker.
- Narrativa: o texto aceito tem exatamente os números do modelo fixo; recusa por número extra, CNPJ trocado, sem acento (quando exigido), vazio.
- Reconciliação: soma de proventos do ano = `getDividendsView` do ano; custo de 31/12 do ano corrente = posição atual.

Critério de desempenho: 50 ativos em menos de 3,5 s (a spec original); o relatório é calculado no servidor sobre os lançamentos já em memória (`cache`), sem chamada externa no render.

## 9. Pendências e riscos (resolver antes do plano ou no início dele)

1. (Resolvida em 2026-11-16, §4) Ação casa pelo FCA; FII pelo ISIN, com conferência pelo dono.
2. (Resolvida, §5.1) `replayLedger` aceita o corte por filtro das entradas.
3. Isenção do rendimento de FII (condições legais do fundo: cotas negociadas em bolsa, 100 cotistas ou mais, cotista com menos de 10% das cotas) e o código da ficha (26 ou 14).
4. Tratamento do aluguel de ativos na declaração e o código da ficha.
5. Texto da Lei 15.270/2025: transição dos lucros apurados até 2025 e o que o relatório deve fazer para o ano-calendário 2026.
5b. **Alíquota do JCP:** **confirmado** com os extratos reais (2026-11-17): retenção de 15% até 2025 e ~17,5% em 2026 (LC 224/2025). Implementado por data de pagamento (`jcpWithholdingRate`, 17,5% de 2026-01-01 em diante); a vigência exata (pagamento ou crédito) não está no texto da lei. Também não está claro se a ficha de Tributação Exclusiva leva o JCP bruto ou o líquido: a tela mostra líquido, bruto e retido e manda conferir com o informe de rendimentos.
5c. **Fiagro** é tratado como FII (Grupo 07, Código 03) e pode ter outro código na ficha: conferir.
   Implementado: 07/02 com selo `needsCheck`; conferir no programa da Receita.
5d. **Saldo inicial de prejuízo (decisão do dono, 2026-11-16):** é o saldo anterior a nov/2019, o primeiro mês do livro-razão; a apuração soma os prejuízos dali em diante. O rótulo do formulário diz isso.
6. (Resolvida) PDF pelo navegador, export completo no modo privado, corretora fora do texto.
8. **Desempate do CNPJ por nome (decisão do dono, aberta):** quando mais de um CNPJ divide o ISIN (TRXF11, XPML11, KISU11), aceitar o único candidato cujo nome tem semelhança clara com o `name` do app, ou manter tudo manual. Hoje tudo isso fica manual.
9. **Reconciliação da apuração (aberta, não bloqueia):** somar o "Resultado" de todos os anos e comparar com "Vendas (realizado)" do Dashboard (−R$ 44.630,09); se diferir, descobrir qual lado exclui o quê antes de chamar de erro.
7. **Entrega em dois passos (decisão do dono), no mesmo contrato de dados:** passo 1 = CNPJ, Bens e Direitos, proventos, auditoria, Gemini, exportação e a apuração mensal com saldo inicial e compensação por classe, **sem** day trade e **sem** IRRF (`irrfEstimated` nulo, vendas de day trade sinalizadas `DAY_TRADE_NAO_APURADO` e a tela avisa); passo 2 = day trade e IRRF. Cada passo tem plano e testes próprios.
8. O CLAUDE.md muda com a exceção do Gemini (feito junto com esta spec).

## 10. O que mudou em relação à spec colada

- ETF e BDR saíram (§3). `TRIBUTADO` saiu (§5.2).
- Estrutura de pastas, rota, ações, Tenancy e testes alinhados ao repositório (§3).
- Gemini: mantido por decisão do dono, mas com modelo fixo como referência, validação numérica da resposta, cadeia de modelos existente, geração fora da página e fallback (§6). A spec original deixava o modelo "calcular" o texto com o JSON inteiro, incluindo `userId`.
- Bens e Direitos precisa de duas fotos (31/12 anterior e atual), que a spec original não modelava.
- Vendas com classes separadas, saldo inicial, IRRF, day trade e DARF (§5.4), em vez de um `lossCarriedForward` sem origem.
- JCP guardado líquido: bruto e retido calculados (§5.2).
- "Bater com o extrato consolidado da B3 / CEI" saiu dos critérios: a B3 não publica preço médio e o app não chama a B3. Entrou reconciliação com as telas e cenários à mão (§1, §8).
- Corretora fica fora do texto (§6).
- Status: decisões abertas da revisão (passos, PDF, modo privado, corretora) fechadas em 2026-11-16. Resta só a §9, itens 3 a 5 (regras fiscais a confirmar; o item 3 e o 4 não bloqueiam o passo 1, entram como aviso).
