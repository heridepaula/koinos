# Proventos: especificação de design (ciclo 1)

- **Data:** 2026-10-18
- **Status:** implementado em 2026-10-23 (branch feat/proventos). As decisões tomadas na execução estão registradas nas seções abaixo.
- **Ciclos:**
  - **Ciclo 1 (este spec):** proventos recebidos vindos da B3, previsão do mês pelo Yahoo, tela `/proventos` e resultado ajustado.
  - **Ciclo 2 (outro spec):** relatório de aportes × proventos (reinvestimento).

## 1. Objetivo

Guardar os proventos que a B3 informa no extrato de Movimentação e usá-los em três lugares:

- uma tela de proventos com o mês atual (recebido, a receber e total) e o histórico por mês, ano ou papel;
- o resultado de cada FII e da carteira considerando os proventos;
- a previsão do que ainda vai cair no mês.

### Critérios de sucesso

1. Com os extratos reais (e as respostas das pendências), a importação guarda 1.280 Rendimentos (R$ 290.553,26) e 4 Reembolsos (R$ 2.334,41) de FIIs, e nada além disso. Os outros 67 créditos de Rendimento e Reembolso do extrato são de ações (PETR4, BBAS3, BBSE3, VALE3, EGIE3) e ficam de fora.
2. Importar os mesmos extratos de novo não muda nada.
3. O "a receber" de outubro/2026 confere à mão em dois FIIs da carteira que aparecem na lista: cotas que o usuário tinha na véspera da data ex × valor por cota anunciado no Yahoo. MXRF11 e HGLG11, usados como exemplo no design, não estão na carteira.
4. Exemplo do SNFF11: com cotação −60k e proventos +20k, o resultado com proventos é −40k. Somando vendas de −5k, o resultado total é −45k.
5. As Recomendações e a renda mensal estimada do Dashboard não mudam.

## 2. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| O que conta como provento | Créditos de **Rendimento** e **Reembolso** de FIIs | Reembolso é o rendimento pago enquanto as cotas estão emprestadas. Empréstimo (aluguel, R$ 458), Dividendo e JCP (ações) ficam de fora. "Rendimento - Transferido" se anula |
| Período dos proventos | Desde sempre, inclusive de posições já encerradas e recompradas | Pedido do usuário |
| Resultado ajustado | Duas visões: **com proventos** (cotação + proventos) e **total** (cotação + proventos + vendas) | Pedido do usuário ("a e b juntos") |
| Fonte da previsão | Yahoo: data ex e valor por cota, já usado no app | A brapi só libera proventos no plano Startup (R$ 119,99/mês). O token atual é do plano gratuito |
| Data de pagamento prevista | Estimada, sem data oficial | O Yahoo não informa a data de pagamento |
| Chamadas à B3 | Nenhuma | Ver CLAUDE.md. Os recebidos vêm só do extrato enviado pelo usuário |

## 3. Dados

### 3.1 Proventos recebidos

Coleção nova `dividends` em `transactions/server/dividend.model.ts`:

| Campo | Tipo | Observação |
| --- | --- | --- |
| `portfolioId` | ObjectId | indexado com `ticker` e `paidAt` |
| `ticker` | string | código do FII, em maiúsculas |
| `paidAt` | Date | a data da linha do extrato (pagamento) |
| `kind` | `"RENDIMENTO" \| "REEMBOLSO"` | |
| `amount` | number | o "Valor da Operação" creditado |
| `quantity` | number \| null | a quantidade do extrato, quando vier |
| `perShare` | number \| null | o "Preço unitário" do extrato, quando vier |
| `source` | `"B3"` | |

- **O que entra:** o `planB3Import` passa a devolver `dividends`, com os créditos de Rendimento e Reembolso de valor positivo. Valem os códigos da família de um FII, ou seja, a cota, o direito ou o recibo, todos levados ao FII.
- **Escopo da troca ("A B3 manda"):** dentro do período do extrato de Movimentação, o serviço troca, FII por FII, os proventos guardados pelos do extrato, na mesma transação dos lançamentos.
  - **Entram no escopo** os FIIs do plano com situação OK e os FIIs que só aparecem pelos proventos, sem negócio nem evento no período, salvo os que o usuário deixou de fora.
  - **Ficam fora do escopo** os FIIs FORA ou PENDENTE. Eles mantêm os proventos que já existem e não recebem os do extrato.
- **Reenvio sem mudança:** os proventos são comparados pelos campos (FII, data, tipo, valor, cotas e valor por cota), contando repetições. Se os proventos não mudaram, eles não são regravados; se nada mudou, nada é gravado. Quando algo muda, o escopo inteiro é trocado.
- **Prévia:** mostra "N proventos novos · N saem · N já iguais".
- **Script:** o `scripts/import-b3.ts` usa o mesmo plano, então também grava os proventos.

### 3.2 Anúncios do Yahoo

- No ativo (`market-data/server/models.ts`), o campo novo `dividendAnnouncements: { exDate, perShare }[]` guarda os anúncios dos últimos 90 dias.
- Ele é preenchido pelo `refreshDividends` na mesma busca que já calcula `lastDividend`.
- Continua rodando no cron diário (`/api/cron/daily`) e no refresh sob demanda da tela.
- O `AssetSnapshot` passa a expor esses anúncios. O `PriceInfo` do snapshot não os leva, porque só a tela de proventos usa.

## 4. Regras (puras)

As regras ficam em `portfolio/domain/dividends.ts`, sem I/O.

### 4.1 A receber

Para cada anúncio com data ex até hoje:

- **Cotas:** as que o usuário tinha no fim do dia anterior à data ex, calculadas pelo `replayLedger` até essa data.
- **Valor estimado:** cotas × valor por cota. Se as cotas forem zero, o anúncio não entra.
- **Já recebido:** um anúncio sai do "a receber" quando existe um provento da B3 do mesmo ticker com `paidAt` na data ex ou depois dela.
- **Pagamento estimado:** "~ até" data ex + 15 dias. Quando essa data já passou e o extrato ainda não confirmou, a tela mostra "a confirmar".

Só entram anúncios cuja data ex cai no mês atual ou no anterior, desde que ainda não tenham sido recebidos. Do mês anterior, só os que têm pagamento estimado neste mês. Assim, um provento com data ex no fim do mês passado e pagamento neste mês aparece, mas um que vencia no mês passado não infla o total deste mês.

### 4.2 Totais do mês atual

- **Recebido:** a soma dos proventos da B3 com `paidAt` no mês atual.
- **A receber:** a soma dos valores estimados pela §4.1.
- **Total:** recebido + a receber.

### 4.3 Histórico

Agregações dos proventos recebidos:

- **por mês:** total e detalhe por FII;
- **por ano:** total e média mensal, considerando os meses com algum provento no ano;
- **por papel:** total acumulado, quantidade de pagamentos e data do último.

### 4.4 Resultado ajustado

Para cada ticker, posições abertas e encerradas:

- **Proventos:** a soma de todos os proventos recebidos do ticker.
- **Com proventos:** resultado não realizado + proventos.
- **Total:** resultado não realizado + proventos + resultado realizado das vendas.

Nas posições encerradas, o resultado não realizado é zero.

A carteira mostra a soma das três medidas.

## 5. Telas

### 5.1 `/proventos`

A página é nova, com o item "Proventos" no menu lateral, depois de "Transações".

- **Cards do mês atual:**
  - Recebido;
  - A receber (estimado), com a nota "Previsão pelo Yahoo, confirmada quando o extrato da B3 for importado";
  - Total do mês.
- **Lista "A receber":** FII, data ex, cotas, valor por cota, valor estimado e "pagamento ~ até".
- **Histórico, com as abas Mês | Ano | Papel:**
  - a aba fica na URL, com a chave `agrupar` (nuqs);
  - **Mês:** gráfico de barras dos últimos 24 meses e uma tabela por mês que se expande por FII;
  - **Ano:** tabela com total e média mensal;
  - **Papel:** tabela com total, número de pagamentos e último pagamento.
- **Sem proventos importados:** só o aviso com o botão "Importar da B3". Sem nenhum extrato importado não dá para saber o que já foi pago: todo anúncio pareceria "a receber".

A estrutura segue as outras páginas: Server Components, a casca estática e as partes da sessão em `<Suspense>`. Só as abas e o gráfico são Client Components (`ui.ts`). Os materiais visuais são os de `globals.css`.

### 5.2 Dashboard

- **Card de resumo novo, "Proventos recebidos":** o total desde sempre, com o L/P c/ proventos e o resultado total embaixo.
  - Os cards se arrumam pela largura disponível (container queries): 1, 2, 3 ou 5 colunas, sem card sozinho numa linha.
- **Tabela de posições:** uma coluna nova, "c/ proventos", logo depois do L/P.
  - Em cima vem o resultado com proventos; embaixo, em letra menor, os proventos recebidos ("prov. R$ …").
  - O tooltip mostra a conta: cotação, + proventos, = com proventos, + vendas, = resultado total.
  - Duas colunas separadas empurravam "% carteira" e "Prioridade" para fora da tela em 1440 px. Com uma coluna e um respiro menor nas colunas do meio, a tabela volta a caber.
- **Posições encerradas:** viram uma tabela com FII, Última venda, Vendas, Proventos e Total. O resumo mostra os três totais. Um FII que só aparece pelos proventos, sem nenhum lançamento, entra aqui com "—" na última venda, para o total de proventos do resumo fechar com a soma das linhas.
- **Renda mensal estimada (`monthlyIncome`):** não muda.

## 6. Arquitetura

| Peça | Arquivo | Responsabilidade |
| --- | --- | --- |
| Modelo | `transactions/server/dividend.model.ts` | Coleção `dividends` |
| Plano (puro) | `transactions/import/b3/plan.ts`, `types.ts` | Extrair os proventos, mais os contadores da prévia |
| Serviço | `transactions/server/b3-import.ts` | Substituir os proventos no período, dentro da transação e do lock, com a comparação por assinatura |
| DAL | `transactions/server.ts` | `listDividends(tenant)`, que devolve DTOs sem ids internos |
| Anúncios | `market-data/server/history-service.ts`, `models.ts`, `assets-read.ts` | `dividendAnnouncements` |
| Regras (puro) | `portfolio/domain/dividends.ts` | §4 |
| Snapshot | `portfolio/domain/snapshot.ts`, `types.ts`, `server/snapshot.ts` | Proventos e resultado ajustado nas linhas e no resumo |
| Telas | `portfolio/components/dividends/*`, rota `(app)/proventos/page.tsx` | §5 |

As telas ficam em `portfolio/components/dividends/`, para não criar uma feature nova que só leria dados de outras.

## 7. Fora deste ciclo

- O relatório de reinvestimento (ciclo 2).
- A data de pagamento oficial, que exige a brapi paga.
- A remuneração do aluguel de cotas, dividendos e JCP de ações.
- A edição manual de proventos.
- **Proventos anteriores a 08/11/2019.** O extrato da B3 começa em novembro de 2019, e antes disso a carteira só tem as posições anteriores de 07/11/2019, sem data de compra. A planilha começa em 12/2019. O Yahoo não tem proventos de FII entre 2018 e o começo de 2022. Em 2026-10-19, o usuário decidiu deixar como está: os proventos começam no que a B3 registra, sem estimativa.

## 8. Verificação

1. **Script descartável com os extratos reais em um banco isolado:** confere os totais do critério 1 (§1) e confere que reenviar não muda nada.
2. **Conferência à mão do "a receber" de outubro:** dois FIIs da carteira que aparecem na lista.
3. **Cascata:** as mesmas ordens de antes para o mesmo aporte.
4. **Checagens:** `npm run format:check`, `lint`, `typecheck` e `build`.
5. **Capturas de tela da preview isolada:** `/proventos` nas três abas, nos temas claro e escuro, mais o Dashboard.
