# Atualização da B3 (três extratos): especificação de design

- **Data:** 2026-10-23
- **Status:** design aprovado na conversa; aguardando revisão do spec escrito.
- **Substitui:** a tela de importação de `2026-10-18-importacao-b3-design.md` (§8 a §11), que aceitava Negociação, Movimentação e a planilha opcional. As regras do plano (§4 a §7 daquele spec) continuam valendo.

## 1. Objetivo

Uma página só para atualizar a carteira com a B3.

- O usuário envia os três extratos da Área do Investidor: Negociação, Movimentação e Eventos (Proventos a Receber).
- A página mostra a prévia do que é novo e das inconsistências.
- Só depois disso ela grava, e grava apenas os dados novos.

### Regras do usuário

1. **Três arquivos:** a importação só acontece com os três enviados.
2. **Prévia:** antes de gravar, a página mostra o que será acrescentado e as inconsistências.
3. **Só dados novos:** o que já está gravado igual não é regravado.
4. **A B3 tem prioridade:** onde o extrato diverge do que está gravado, vale o extrato.

### Critérios de sucesso

Com os extratos de 23/10/2026 sobre a carteira de produção:
1. **A prévia mostra:**
   - **Lançamentos:** 0 novos, porque as 10 compras de 30/09 já estão gravadas.
   - **Proventos recebidos:** 3 novos (RBRY11 em 19/10, R$ 296,00; MCCI11 em 20/10, R$ 295,00; VGIP11 em 20/10, R$ 249,91) e 17 iguais.
   - **A receber:** 4, todos com pagamento previsto em 23/10/2026 (BTLG11 R$ 292,41, SNAG11 R$ 1.200,00, SNCI11 R$ 1.000,00 e XPML11 R$ 249,32).
   - **Inconsistências e substituições:** nenhuma de cada.
   - **Ignorados:** PETR4 e EGIE3 nos Eventos; ações, direitos não exercidos e CDB na Movimentação.
2. **Depois de confirmar:**
   - os 587 lançamentos continuam intactos, com os mesmos `_id`, e os 1.284 proventos antigos também;
   - entram 3 proventos e os 4 itens a receber.
3. **Reenviar os mesmos três arquivos não muda nada.** A prévia diz "nada novo".
4. **Com só um ou dois arquivos, nada é importado.** A página diz qual extrato falta.
5. **`/proventos`:**
   - mostra os 4 a receber da B3, com a data oficial e a origem "B3";
   - o Yahoo não repete nenhum deles;
   - RBRY11, MCCI11 e VGIP11 saem do "a receber" e entram como recebidos.
6. **Um envio do histórico completo** (os extratos de 17/10, mais o de Eventos) não reabre as 10 pendências de preço de subscrição que vieram da planilha.

## 2. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Arquivos | Exatamente Negociação, Movimentação e Eventos | Regra do usuário. A planilha sai da página |
| Preço de subscrição já gravado com origem PLANILHA | Vale como resposta anterior, igual a USUARIO e ESTIMADO | Sem a planilha na página, um envio do histórico reabriria as 10 pendências |
| Conflito com o que está gravado | Vale a B3, e a prévia mostra a linha de antes e a de depois | Regra do usuário ("Sempre terá prioridade o que vier da B3") |
| Gravação | Só a diferença: insere o novo e apaga só o que a B3 substitui. O que está igual fica com o mesmo `_id` | Regra do usuário ("Somente dados novos serão importados") |
| A receber | A lista do extrato de Eventos é guardada como foto da data do envio, e cada envio substitui a foto inteira | O extrato é a lista atual de pendências da B3. O provento pago sai dela e entra na Movimentação do mesmo envio |
| Yahoo | Com foto da B3, só entra o que foi anunciado depois do envio (data ex posterior), marcado como "estimado" | A B3 tem prioridade. O Yahoo só cobre o que a B3 ainda não podia listar |
| Eventos de ações e AMORTIZAÇÃO | Ignorados, com aviso na prévia | O app só acompanha proventos de FII (Rendimento e Reembolso), como no ciclo 1 |
| Página | `/atualizacao-b3`, com item "Atualização B3" no menu | "Uma página somente para isso". O `/transacoes/importar` redireciona para ela |
| Script `import:b3` | Fica como está (2 arquivos e a planilha) | É uma ferramenta de operação de terminal |

## 3. Extrato de Eventos

- **Aba:** "Proventos a Receber".
- **Colunas:**
  - **Produto:** "BTLG11 - BTG PACTUAL…"; o código fica antes de " - ".
  - **Tipo:** "Fundo", "PN" ou "ON".
  - **Tipo de Evento:** por exemplo "RENDIMENTO", "Reembolso - DIVIDENDO" ou "DIVIDENDO".
  - **Previsão de pagamento:** dd/mm/aaaa, ou "-".
  - **Instituição** e **Conta:** não são usadas.
  - **Quantidade:** um número, ou "-".
  - **Preço unitário** e **Valor líquido**.
- **Linhas fora da leitura:** a última linha ("Total líquido") e as linhas vazias.
- **Reconhecimento:** `detectB3File` devolve `EVENTOS` quando o cabeçalho tem "Produto", "Tipo de Evento" e "Previsão de pagamento". Nunca pelo nome do arquivo.
- **Leitor puro:** `readEventos(sheets)` devolve linhas `{ row, code, eventType, payDate | null, quantity | null, unitPrice | null, value | null }`, sem interpretação, como o `readMovimentacao`.
- **Plano:** entra no "a receber" a linha cujo código é da família de um FII gerenciado (`managed`) e cujo tipo, normalizado, é "rendimento" ou "reembolso - rendimento".
  - "rendimento" vira o tipo `RENDIMENTO`.
  - "reembolso - rendimento" vira o tipo `REEMBOLSO`.
  - **Ignorados:** o resto (ações, dividendos, JCP, amortização), agrupado por motivo, como os ignorados de hoje.

## 4. Plano e gravação

### 4.1 Entradas e período

`planB3Import` recebe `eventos` (o resultado do leitor) e `asOf` (o dia do envio) e devolve `upcoming: { asOf, items }`.

- Os itens têm FII, tipo, data prevista ou null, quantidade, valor por cota e valor.
- As regras do plano para lançamentos e proventos recebidos não mudam:
  - o período dos lançamentos é a interseção de Negociação e Movimentação;
  - o dos proventos é o da Movimentação;
  - o escopo é o de cada FII.

### 4.2 Diferença em vez de troca

Uma função pura calcula as listas exatas, com a mesma semântica de multiconjunto da comparação atual:

- **Lançamentos:**
  - os lançamentos B3 do período que têm um igual no plano ficam como estão;
  - os do plano sem igual são **inseridos**;
  - os gravados que o plano troca sem igual são **substituídos**. Isso vale para lançamentos manuais ou de planilha no período e para lançamentos B3 que a B3 não mostra mais.
- **Proventos recebidos:** a mesma regra, no escopo atual (FIIs do escopo, dentro do período da Movimentação).
- **A receber:** a foto da carteira é trocada inteira.

A gravação faz uma transação do Mongo só, dentro da trava `import:<portfolioId>`:
1. apaga os substituídos, pelo `_id` e pela carteira;
2. insere os novos;
3. troca a foto do "a receber".

Se nada mudou, nada é gravado.

### 4.3 Preço de subscrição já gravado

O "preço anterior" de uma subscrição (§7 do spec da importação) passa a aceitar `priceSource` PLANILHA, além de USUARIO e ESTIMADO. Ele entra com a mesma origem, e por isso o lançamento continua igual.

## 5. Inconsistências

| Inconsistência | Efeito |
| --- | --- |
| Falta um dos três extratos, há dois do mesmo tipo, chegou um arquivo não reconhecido ou a planilha | Bloqueia, com a mensagem de qual falta ou sobra |
| Negociação e Movimentação sem período em comum | Bloqueia, como hoje |
| Pendências sem resposta (preço de subscrição, posição anterior, conversão) | Bloqueia até responder, na mesma lista de hoje |
| FII que fica de fora (evento não suportado, venda maior que a posição) | Avisa: o FII não é importado |
| Divergência na conferência pelos rendimentos | Exige marcar "Revisei as divergências", como hoje |
| Item "a receber" com quantidade diferente da posição atual do FII na carteira | Avisa ("confira: pode ser compra ou venda depois da data com") |
| Item "a receber" de FII sem posição na carteira | Avisa |

## 6. "A receber" em `/proventos`

`portfolio/domain/dividends.ts` passa a receber a foto da B3 (`asOf` e itens).

- **Itens da B3:**
  - entram todos, com a data prevista e a origem "B3";
  - a data que já passou mostra "a confirmar", como hoje;
  - um item sem data aparece como "sem data".
- **Anúncios do Yahoo:** com foto, só entram os de data ex depois do `asOf`, pelas regras de hoje, com a origem "estimado". Sem foto, tudo como hoje.
- **Total do mês:** conta os itens da B3 com data prevista no mês atual, mais os estimados de hoje. Um item da B3 de outro mês ou sem data aparece na lista, mas não entra no total do mês.
- **Coluna "Origem" na lista:** "B3" ou "estimado".
- **Notas que mudam:**
  - a do card fica "Pela B3 (Proventos a Receber), completado com o Yahoo";
  - a da lista explica as duas origens.

## 7. Página `/atualizacao-b3`

- **Menu:** um item "Atualização B3", com azulejo próprio. Ele entra no `matcher` do `src/proxy.ts`.
- **Redirecionamento:** o `/transacoes/importar` redireciona para a página. Os botões "Importar da B3" (Transações e carteira vazia) e "Importar da B3" (Proventos vazio) passam a levar para ela.
- **Fluxo:** é o do assistente atual. A diferença é que o seletor pede os três extratos e diz quais já foram reconhecidos (✓ Negociação · ✓ Movimentação · ✓ Eventos).
- **Prévia:**
  - **Resumo:**
    - **Lançamentos:** quantos são novos, quantos substituídos e quantos iguais.
    - **Proventos recebidos:** a mesma contagem.
    - **A receber:** quantos itens e o valor.
  - **Novos:** uma tabela por categoria, com data, FII, tipo, quantidade, valor e a data prevista para o "a receber".
  - **Substituídos pela B3:** para cada um, a linha gravada e a do extrato. Só aparece quando existe.
  - **Inconsistências:** a §5, com as respostas das pendências como hoje.
  - **Ignorados:** agrupados por motivo.
  - **Botão "Importar":**
    - fica bloqueado nos casos da §5 que bloqueiam;
    - quando não há nada novo, vira o aviso "Nada novo: a carteira já está igual aos extratos".

## 8. Arquitetura

| Peça | Arquivo | Responsabilidade |
| --- | --- | --- |
| Reconhecimento | `transactions/import/b3/detect.ts` | Tipo `EVENTOS` |
| Leitor (puro) | `transactions/import/b3/read-eventos.ts` | §3 |
| Plano (puro) | `transactions/import/b3/plan.ts`, `types.ts` | `upcoming` e preço anterior PLANILHA |
| Diferença (pura) | `transactions/import/b3/changes.ts` | §4.2 (substitui `dividend-changes.ts`, que passa a viver aqui) |
| Modelo da foto | `transactions/server/dividend-forecast.model.ts` | Coleção `dividend_forecasts` (carteira, `asOf`, itens) |
| Repositório | `transactions/server/transaction-repo.ts`, `dividend-repo.ts` | Gravação da diferença e da foto numa transação; leitura da foto |
| Serviço | `transactions/server/b3-import.ts` | Três arquivos, prévia nova e confirmação pela diferença |
| DAL | `transactions/server.ts` | `getMyDividendForecast()` |
| A receber | `portfolio/domain/dividends.ts`, `portfolio/server/dividends-view.ts`, `components/dividends/upcoming-list.tsx` | §6 |
| Telas | `transactions/components/b3-import/*`, `app/(app)/atualizacao-b3/page.tsx` | §7 |
| Navegação | `shared/components/app-sidebar.tsx`, `src/proxy.ts`, `app/(app)/transacoes/importar/page.tsx` (redirect) | §7 |

## 9. Fora deste ciclo

- O extrato de Eventos no script `import:b3`.
- Os eventos de ações.
- A amortização de FII como provento.

## 10. Verificação

1. **Scripts sem banco:**
   - o leitor do extrato de Eventos com o arquivo real;
   - a função de diferença: iguais ficam, novos entram, divergentes são substituídos, com repetições;
   - o "a receber" com foto e Yahoo, que não duplica e respeita o `asOf`.
2. **Prévia isolada, uma cópia da produção com os proventos de 17/10:**
   - enviar os três extratos de 23/10 pela tela e conferir os critérios 1 a 3, inclusive que os `_id` dos lançamentos não mudaram;
   - enviar só dois e conferir o bloqueio (critério 4);
   - conferir `/proventos` (critério 5);
   - enviar o histórico completo de 17/10 com o Eventos, sem a planilha, e conferir que não há pendências (critério 6).
3. **Telas:** capturas da página nova nos dois temas, em 1440 e 390 px, e o contraste com 0 falhas.
4. **Checagens:** `npm run format:check`, `lint`, `typecheck` e `build`.
