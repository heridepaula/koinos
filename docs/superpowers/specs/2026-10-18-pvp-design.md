# P/VP dos FIIs: especificação de design

- **Data:** 2026-10-18
- **Status:** design aprovado na conversa: "informar e alertar", com dados da CVM
- **Ciclo:** complemento das Recomendações. A cascata Suno (spec do MVP, §9) não muda.

## 1. Objetivo

Mostrar o P/VP (cotação ÷ valor patrimonial por cota) de cada FII e avisar quando um FII de papel ou FoF estiver com ágio alto. Para a Suno, o P/VP é mais útil nesses dois tipos, porque CRIs e cotas de FIIs têm preço objetivo. Em tijolo, o valor patrimonial depende de laudos. Um P/VP baixo sozinho não é sinal de compra, e o preço teto continua sendo o filtro do aporte.

### Critérios de sucesso

1. Os 20 FIIs da carteira real têm P/VP, inclusive os que o ISIN não liga ao fundo (TRXF11, KNUQ11, PMLL11) e o Fiagro SNAG11.
2. O MXRF11 tem o mesmo valor patrimonial da brapi Pro: 9,352547 em 09/2026.
3. Nenhum P/VP absurdo aparece: dado inconsistente é descartado (§5).
4. Para o mesmo aporte, as Recomendações geram exatamente as mesmas ordens de antes.

## 2. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Fonte | Informe Mensal da CVM (dados abertos) | Grátis, oficial, atualizado todo dia. A brapi Pro (R$ 139,99/mês) entrega o mesmo número. A B3 não tem API pública com esse dado para pessoa física |
| Uso | Informar e alertar; a cascata não muda | O preço teto já é o filtro de preço no método Suno. Uma trava de P/VP filtraria duas vezes |
| Quando alerta | FII de **papel ou FoF** com P/VP **acima de 1,05** | É onde o P/VP é mais objetivo; 5% de ágio sobre o patrimônio |
| Categoria | A que o usuário define na Carteira Alvo | A CVM não ajuda: o segmento vem quase sempre "Multicategoria" ou "Outros", e o mandato vem vazio |

## 3. Fontes

| Fonte | Endereço | Campos usados |
| --- | --- | --- |
| CVM, FII (um zip por ano) | `https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_AAAA.zip` | `inf_mensal_fii_geral_AAAA.csv`: `CNPJ_Fundo_Classe`, `Data_Referencia`, `Nome_Fundo_Classe`, `Codigo_ISIN`. `inf_mensal_fii_complemento_AAAA.csv`: `CNPJ_Fundo_Classe`, `Data_Referencia`, `Patrimonio_Liquido`, `Cotas_Emitidas`, `Valor_Patrimonial_Cotas` |
| CVM, Fiagro (um zip por mês) | `https://dados.cvm.gov.br/dados/FIAGRO/DOC/INF_MENSAL/DADOS/inf_mensal_fiagro_AAAAMM.zip` | `inf_mensal_fiagro_AAAAMM.csv`: `CNPJ_Classe`, `Nome_Classe`, `Data_Referencia`, `Codigo_ISIN`, `Patrimonio_Liquido`, `Cotas_Emitidas`, `Valor_Patrimonial_Cotas` |
| B3, fundos listados | `https://sistemaswebb3-listados.b3.com.br/fundsListedProxy/Search/GetListFunds/<base64 do JSON>` com `{"language":"pt-br","typeFund":"FII" ou "FIAGRO","pageNumber":n,"pageSize":120}` | `acronym` (sigla), `fundName` (nome oficial) |

Os CSVs da CVM vêm em Latin-1, separados por `;`, com o cabeçalho na primeira linha. Os valores usam ponto como separador decimal.

## 4. Ligação ticker ↔ fundo

- **Ticker:** é a sigla da B3 + `11`.
- **Candidatos na CVM:**
  - **(a)** os fundos cujo ISIN começa por `BR` + sigla + `CTF`;
  - **(b)** os fundos cujo nome normalizado é igual ao nome normalizado da B3.
- **Normalização do nome:**
  - maiúsculas, sem acento e sem pontuação;
  - "FUNDO DE INVESTIMENTO IMOBILIÁRIO" vira "FII", e "FUNDO DE INVESTIMENTO NAS CADEIAS PRODUTIVAS AGROINDUSTRIAIS" vira "FIAGRO";
  - saem "RESPONSABILIDADE LIMITADA", "CLASSE ÚNICA" e "IMOBILIÁRIO" depois de FIAGRO.
- **Escolha, por ordem:**
  1. um fundo que esteja em (a) e em (b);
  2. senão, o único de (b);
  3. senão, o único de (a), desde que o nome dele tenha pelo menos metade das palavras do nome da B3;
  4. senão, nenhum: o ticker fica sem P/VP.

## 5. Valor patrimonial

- **Mês usado:** para cada fundo, o informe mais recente com `Valor_Patrimonial_Cotas` > 0.
- **Checagem:** com `Cotas_Emitidas` > 0, o VP por cota precisa ficar a até 1% de `Patrimonio_Liquido ÷ Cotas_Emitidas`. Senão, o informe é descartado.
- **Gravação:** no ativo, como `nav: { perShare, month (AAAA-MM), cnpj, fetchedAt }`.
- **P/VP:** é calculado na hora (cotação ÷ VP por cota). Só aparece entre 0,3 e 3; fora disso é tratado como dado suspeito e não aparece.

## 6. Atualização

- O **cron diário** já existente ganha `refreshNavs(tickers)`, que roda depois das cotações e usa os mesmos tickers: os negociados e os da Carteira Alvo.
- **O que ele baixa:**
  - o informe de FII do ano atual, e também o do ano anterior em janeiro e fevereiro;
  - os de Fiagro dos últimos 3 meses;
  - as 6 páginas da lista da B3.
- **Falhas:** se a CVM ou a B3 falhar, o cron registra o erro e segue; o P/VP anterior continua valendo.
- **Limites do download:** tempo máximo de 60 s e 30 MB por arquivo.

## 7. Telas

- **Carteira Alvo:** embaixo do preço atual, em letra menor, aparece "P/VP 0,97". O tooltip mostra "VP por cota R$ 106,22 em 09/2026 (CVM)". Fica em âmbar quando há alerta. Nenhuma coluna nova, para a tabela continuar cabendo em 1440 px.
- **Recomendações:**
  - o "Por quê" de cada ordem ganha "P/VP 0,89";
  - com alerta, a ordem mostra o aviso "P/VP 1,12: ágio sobre o patrimônio. Confira antes de comprar".
- **Dashboard:** novo alerta "P/VP alto", com os FIIs de papel ou FoF em carteira acima de 1,05.

## 8. Arquitetura

| Peça | Arquivo | Responsabilidade |
| --- | --- | --- |
| Adaptador CVM | `src/features/market-data/adapters/cvm.ts` | Baixa os zips (FII anual, Fiagro mensal), descompacta com `fflate` e lê os CSVs → informes `{ cnpj, month, name, isin, perShare, netWorth, shares }` |
| Adaptador B3 | `src/features/market-data/adapters/b3-funds.ts` | Lista os fundos listados (FII e Fiagro), paginando |
| Regras (puro) | `src/features/market-data/domain/nav.ts` | Normalização de nome, ligação (§4), informe mais recente com checagem (§5), `priceToNav` com a faixa válida |
| Serviço | `src/features/market-data/server/nav-service.ts` | `refreshNavs(tickers)`: junta as fontes e grava `nav` no `AssetModel` |
| Modelo e leitura | `server/models.ts`, `server/assets-read.ts` | Campo `nav` no ativo e no `AssetSnapshot` |
| Cron | `server/daily-job.ts` | Chama `refreshNavs`; o resumo ganha `navs` |
| Carteira | `portfolio/domain/{types,snapshot,alerts}.ts` | `PriceInfo.nav`, P/VP nas linhas da Carteira Alvo e das posições, alerta "P/VP alto" (`PVP_ALERT = 1.05`) |
| Telas | `strategy/components/strategy-table.tsx`, `smart-buy` (calculadora) | P/VP embaixo do preço; P/VP e aviso no "Por quê" |

## 9. Fora deste ciclo

- P/VP como filtro ou desempate da cascata.
- Histórico do P/VP.
- Outros indicadores do informe (vacância, inadimplência, cotistas).
- Sugestão automática de categoria.

## 10. Verificação

1. **Script de conferência** descartável com a carteira real:
   - o P/VP dos 20 FIIs, com mês e fonte;
   - o MXRF11 igual à brapi;
   - TRXF11, KNUQ11, PMLL11 e SNAG11 resolvidos;
   - nenhum P/VP fora de 0,3 a 3.
2. **Mesmo aporte, mesmas ordens:** a cascata é a mesma função, sem mudança.
3. `npm run lint`, `npm run typecheck`, `npm run build` e `npm run format:check`.
4. **Produção:** depois do deploy, roda a carga inicial do P/VP e confere no banco.
