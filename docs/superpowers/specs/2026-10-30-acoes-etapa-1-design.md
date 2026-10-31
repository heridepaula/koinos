# Ações na carteira, etapa 1 (dados e contas): especificação de design

- **Data:** 2026-10-30
- **Status:** aprovado e implementado (branch feat/acoes-etapa-1); conferido com os extratos de 30/10/2026 antes do merge
- **Origem:** pedido do usuário com o texto "Especificação Técnica: Suporte a Ações no Koinos", escrito a partir dos extratos da B3 de 30/10/2026. O texto foi conferido contra o código e os extratos, e as diferenças estão no §2.
- **Ciclo:** etapa 1 de 2. Esta etapa traz as ações para os dados e as contas. A etapa 2, com spec própria, faz as telas por classe:
  - Geral, FIIs e Ações no Dashboard e em Proventos;
  - a rosca por classe;
  - os proventos por tipo, com filtro.

## 1. Objetivo

Trazer as ações e units da B3 para o Koinos: posições, proventos, aluguel e o IR estimado das vendas. A Carteira Alvo e as Recomendações continuam só com FIIs. Entre as duas etapas, o Dashboard mostra FIIs e ações juntos, com as contas certas.

### Critérios de sucesso

Com os extratos de 30/10/2026 (Negociação, Movimentação e Eventos):

1. **Posições:**
   - abertas: BBAS3 200, BBSE3 100, EGIE3 139, PETR4 100 e VALE3 100;
   - encerradas: ITSA4, NEOE3, ODPV3 e WIZS3.
2. **Pendências:** a prévia pede exatamente 3, o custo das bonificações:
   - ITSA4 em 22/12/2021;
   - ITSA4 em 14/11/2022;
   - EGIE3 em 28/11/2025.
3. **Proventos:** os de ações e o aluguel batem com as somas do extrato.

   | Tipo | Ações | FIIs |
   | --- | --- | --- |
   | JCP | R$ 2.865,70 | — |
   | Dividendo | R$ 1.243,22 | — |
   | Reembolso | R$ 5.511,47 | como hoje |
   | Rendimento | R$ 11,16 | como hoje |
   | Aluguel | R$ 308,18 | R$ 149,68 |

4. **FIIs:** nenhum lançamento é trocado ou novo. Nos proventos, entra só o aluguel.
5. **Reenvio:** mandar os mesmos arquivos de novo dá "Nada novo".
6. **"A receber":** traz 4 itens de ações (PETR4 × 3 e EGIE3), que somam R$ 195,11. A EGIE3 não tem aviso de quantidade.
7. **Conferência pelos proventos:** nenhuma divergência sem explicação nas ações. São 53 meses: 52 batem e 1 é explicado pelo aluguel (EGIE3, mai/2026, sobre a fração de 0,2).
8. **IR:** as 4 ações encerradas saem isentas, e o IR estimado dos FIIs não muda.
9. **Carteira Alvo e Recomendações:** saem iguais às de hoje, com as mesmas ordens para o mesmo valor de aporte.
10. **Testes:** os novos (§10) passam, e os de hoje continuam passando.

## 2. O que mudou em relação ao texto de origem

| Texto de origem | O que o código e os extratos mostram | Decisão |
| --- | --- | --- |
| `assetClass` gravado em ativos e lançamentos, com migração para `'FII'` | O catálogo da brapi já separa ação e unit (`stock`) de FII e Fiagro (`fund`). O banco só tem FIIs: 587 lançamentos, todos da B3 | A classe é derivada na leitura (§4). Não há migração |
| Ticker em 11 é unit ou FII | É ambíguo pelo código: TAEE11 é unit, BTLG11 é FII | Vale o catálogo. O código só decide para quem saiu do catálogo |
| Aluguel vem como "Empréstimo" ou "Rendimento", com o IR lançado à parte | O aluguel são as linhas "Empréstimo" com valor. Nos extratos não há linha de IR do aluguel. O "Rendimento" das ações são valores pequenos (R$ 11 no total) pagos junto com o provento, provavelmente a correção pela Selic | `ALUGUEL` vem só do "Empréstimo" com valor, e o `RENDIMENTO` das ações continua `RENDIMENTO` |
| O parser deve garantir o valor líquido do JCP | A B3 já mostra o JCP líquido dos 15% (BBAS3: 100 × 0,352 = 35,20 → 29,92) | Grava o valor da B3 |
| Total = dividendos + JCP + aluguel | O Reembolso, que é o provento pago por quem alugou as ações, é a maior renda das ações: R$ 5.511 de R$ 9.940. A Movimentação não diz se ele era dividendo ou JCP | O Reembolso continua como tipo próprio |
| Isento quando as vendas do mês são inferiores a R$ 20 mil | A lei isenta vendas iguais ou inferiores a R$ 20 mil no mês | Isento até R$ 20.000,00, inclusive |
| Prisma ou Mongoose | O projeto usa Mongoose | Mongoose |
| Filtro global Geral/FIIs/Ações e proventos por tipo | É uma parte grande e separável do resto | Fica para a etapa 2 |

## 3. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Etapas | Duas: (1) dados e contas, (2) telas por classe | Escolha do usuário. Cada push na `main` vai para produção, e o app fica certo entre as etapas |
| Ativos | Ações e units entram. ETFs, BDRs, FI-Infra, FIP, FIDC, renda fixa, Tesouro, direitos e recibos de ações continuam de fora | O pedido é de ações. Units são ações para o catálogo da brapi |
| Classe | Derivada na leitura por uma função pura (§4) | Escolha do usuário: uma fonte de verdade, sem migração |
| Aluguel | Provento do tipo `ALUGUEL`, de ações e de FIIs. Soma nos totais | Escolha do usuário. Os FIIs ganham R$ 149,68 no histórico |
| Bonificação | Compra `BONIFICACAO` pelo custo atribuído, informado numa pendência da prévia. Aceita 0, e a importação espera a resposta | Escolha do usuário. Pela Receita, a ação bonificada entra no custo pelo valor que a empresa atribui |
| "A receber" das ações | Só pelo extrato de Eventos | Escolha do usuário. Nas ações, o pagamento vem meses depois da data ex, e o Yahoo traz o JCP bruto |
| Cards do Dashboard | Tudo junto. A renda mensal estimada passa a somar o último provento das ações com data ex nos últimos 62 dias | Escolha do usuário |
| IR das ações | Estimativa por mês: até R$ 20 mil vendidos em ações no mês, isento; acima, 15% do lucro de cada posição no mês. Sem compensar prejuízos | Escolha do usuário. É a mesma filosofia da estimativa dos FIIs |
| Carteira Alvo e Recomendações | Só FIIs, com filtro também no servidor | Pedido do texto de origem |
| Testes | Vitest para as regras puras novas (§10) | Escolha do usuário. Amplia a regra de 24/10, em que a suíte cobria só os aportes |

## 4. Classe do ativo

`market-data/domain/asset-class.ts` é puro e é exportado por `@/features/market-data`. A função é `assetClassOf(ticker, info)`, em que `info` é a entrada do catálogo (`type` e `subType`) ou null quando o ticker não está nele:

| Catálogo | Classe |
| --- | --- |
| `fund` com `subType` `fii` ou `fi-agro` | `FII` |
| `fund` sem `subType`, código `XXXX11` | `FII` (a prévia marca como hoje) |
| `stock` (`subType` `stock` ou `unit`) | `ACAO` |
| `fund` com `etf`, `fi-infra`, `fip` ou `fidc`; `bdr`; outros | null (fora do app) |
| Fora do catálogo, código `XXXX11` | `FII` (FII que saiu da bolsa, como MALL11 e IRDM11) |
| Fora do catálogo, código `[A-Z0-9]{4}[3-8]` | `ACAO` (ação que saiu da bolsa, como NEOE3, ODPV3 e WIZS3) |
| Fora do catálogo, outro código | null |

- **Na atualização da B3:** a classificação (`classify`, §5.1) usa essa função. Recibos e direitos de FII seguem as regras de família de hoje.
- **Nas telas:** os carregadores das telas (`portfolio/server`, `transactions/server`) pedem a classe dos tickers a `market-data/server`, que aplica a função sobre o catálogo em cache (`'use cache'`, horas). As contas do domínio recebem um `Map<ticker, AssetClass>` e continuam puras.
- **Limitação:** uma unit que saia do catálogo seria lida como FII. Não há units na carteira.

## 5. Atualização da B3

Valem as regras de `2026-10-18-importacao-b3-design.md` e de `2026-10-23-atualizacao-b3-design.md`. Este capítulo diz só o que muda.

O princípio continua: a B3 manda. Dentro do período dos extratos, os lançamentos de ações vêm só dela e ficam travados na tela de Transações. Isso vale para os de qualquer origem que existam no período.

### 5.1 Classificação

Os ativos gerenciados passam a ser os de classe `FII` ou `ACAO`. Os ignorados da prévia deixam de listar "Ações e units".

As regras de família continuam só para FIIs:

- recibo `…13`+ vira subscrição do `…11`;
- direitos `…12` são ignorados;
- conversão por "Atualização".

Uma ação usa o próprio código.

### 5.2 Negociação

Uma compra ou venda de ação vira negócio na data do pregão, como nos FIIs (`kind: NEGOCIO`, taxas 0). O fracionário (`…F`) já vira o código normal na leitura.

### 5.3 Movimentação de ações

| Linha | Tratamento |
| --- | --- |
| `Desdobro`, crédito | Compra das ações creditadas a preço 0 (`DESDOBRO`), como nos FIIs |
| `Bonificação em Ativos`, crédito | Compra `BONIFICACAO` das ações creditadas, pelo custo atribuído (§5.4) |
| `Fração em Ativos`, débito | Ignorada: a fração vai a leilão |
| `Leilão de Fração`, crédito com valor | Venda da fração ao preço da linha (`FRACAO`). Não exige evento numa janela: na EGIE3, o leilão veio 63 dias depois da bonificação. Se não houver fração na posição, a conferência de vendas (`findOversells`) acusa |
| `Atualização`, crédito igual à posição do dia | Ignorada, porque só atualiza o saldo (VALE3 em 2025 e 2026, PETR4 em 2026) |
| `Atualização` diferente da posição, `Grupamento`, `Recibo de Subscrição` de ação | Não suportado: a ação fica de fora (FORA), com o motivo na prévia |
| `Direito de Subscrição` e afins, de ação | Ignorados, como nos FIIs |
| `Transferência`, `Transferência - Liquidação`, `Empréstimo` sem valor | Não viram lançamento. Servem para o aluguel (§5.5) |
| `Dividendo`, `Juros Sobre Capital Próprio`, `Rendimento`, `Reembolso`, `Empréstimo` com valor | Proventos (§6) |

### 5.4 Bonificação: custo atribuído

- **Pendência:** uma por evento, com o id `bon:TICKER:AAAA-MM-DD` (a data da linha de bonificação). O tipo novo é `CUSTO_BONIFICACAO`, e a pendência mostra a quantidade e a data.
  - **Texto:** "Custo atribuído por ação (consta no fato relevante; 0 se a empresa não atribuiu)".
  - **Resposta:** um valor ≥ 0. A resposta 0 é válida e conta como respondida.
- **Lançamentos:** `BONIFICACAO`, `priceSource: USUARIO` e `notes: "Bonificação"`.
  - **Ações que voltaram a mais do aluguel (§5.5):** usam o mesmo id e o mesmo custo por ação, com `notes: "Bonificação (ações que estavam alugadas)"`.
- **Respostas anteriores:** ficam nos próprios lançamentos B3 do período, como as de subscrição. Assim, o reenvio já vem respondido.
- **Sem resposta:** a ação fica PENDENTE e a importação espera, como hoje. Também dá para deixar a ação de fora.

### 5.5 Aluguel: saídas, voltas e ações a mais

Novo módulo `transactions/import/b3/lending.ts`, puro, que serve à conferência (§5.6) e à regra abaixo.

1. **Liquidação de negócio:** é a `Transferência - Liquidação` que corresponde aos negócios do ativo num pregão:
   - mesmo sentido (crédito na compra, débito na venda);
   - a quantidade somada dos negócios do dia, fracionário incluso. A venda do ITSA4 de 28/12/2022 (2.300 + 10 no fracionário) liquidou numa linha só de 2.310;
   - de 0 a 7 dias corridos depois do pregão. Em geral é D+2 somado a fins de semana e feriados: essa mesma venda liquidou em 02/01/2023. Também aparece D+0, como nas compras de MCCI11 e XPML11 de 01/11/2023;
   - sem uma linha para a soma do dia, cada negócio sozinho.
2. **Saída e volta de aluguel:** toda outra `Transferência - Liquidação` é saída de aluguel (débito) ou volta (crédito).
3. **Pareamento:** cada volta fecha a saída aberta mais antiga de mesma quantidade. Se não houver, fecha a maior saída aberta menor que ela. Volta sem saída aberta é ignorada, sem aviso: na prática, é liquidação que o passo 1 não reconheceu, e não muda a posição.
4. **Ações a mais:** volta maior que a saída quer dizer que houve um evento durante o aluguel. A diferença entra como o evento do ativo entre a saída e a volta:
   - bonificação: `BONIFICACAO` pelo mesmo custo por ação (§5.4);
   - desdobro: `DESDOBRO` a 0.

   A data do lançamento é a da volta. Na EGIE3, saíram 32 em 28/11/2025 e voltaram 44 em 02/12/2025: as 12 entram na bonificação de 28/11/2025, e a posição fecha em 139.
5. **Sem evento entre a saída e a volta:** vira aviso na prévia ("voltaram N ações a mais do aluguel sem bonificação ou desdobro"), e a posição não muda. Assim, um pareamento errado nunca inventa ações.
6. **Abrangência:** a regra vale para todos os ativos gerenciados e lê os extratos inteiros, para parear também o aluguel aberto antes do período. Só a volta dentro do período gera lançamento. Nos extratos de 30/10/2026, há 147 contratos de aluguel, e só a EGIE3 volta com ações a mais.

### 5.6 Conferências

- **Posição anterior ao extrato:** a mesma regra de hoje, para ações também. Nos extratos de 30/10/2026, nenhuma ação precisa dela.
- **Quantidade × proventos (`dividendCheck`):** vale para ações também, pelas linhas de `Dividendo`, `Juros Sobre Capital Próprio` e `Rendimento` com quantidade.
  - **Janela:** a busca pela posição igual vai até **365 dias** antes do pagamento, contra 45 dias nos FIIs. A ação paga muito depois da data com: o JCP do ITSA4 de out/2023 era sobre a posição de dez/2022, e o dividendo da NEOE3 de dez/2021 sobre a posição vendida em mai/2021.
  - **O mês de uma ação bate** quando a quantidade de alguma linha do mês, ou a soma das linhas do mesmo provento (mesmo tipo, dia e valor por ação, como em duas corretoras), é a posição de algum dia da janela. Não se soma o mês inteiro, como nos FIIs: o mesmo dia traz JCP, dividendo e rendimento, cada um sobre a posição inteira. Exigir que todas as linhas batam falharia em ago/2021 no ITSA4, que pagou três JCP no mesmo dia com o mesmo valor arredondado (R$ 0,01).
  - **Aluguel:** explica as diferenças como hoje. A janela é do `Empréstimo` que abre o contrato até o que fecha, mais 45 dias, e o pareamento do §5.5 entra junto.
- **"A receber" com quantidade diferente da posição:** só aviso, como hoje, agora para ações também.

### 5.7 Prévia, respostas e textos

- **Respostas (`b3AnswersSchema`):**
  - `prices` aceita os ids `sub:`, `prev:` e `bon:` de qualquer ticker (`TICKER_REGEX`), e `bon:` aceita 0;
  - `exclude` aceita qualquer ticker;
  - `conversions` continua só de FIIs.
- **Prévia:** a lista de ativos mostra as ações com a marca "Ação". A pendência de bonificação aparece junto das outras.
- **Textos:** onde a prévia e o assistente dizem "FII" querendo dizer qualquer ativo ("deixe o FII de fora"), passam a dizer "ativo".

### 5.8 Organização do código

O `plan.ts` já tem 1.189 linhas. As partes que esta mudança mexe saem para módulos próprios em `transactions/import/b3/`:

- `classify.ts`: a classificação, com `assetClassOf`;
- `lending.ts`: o §5.5;
- `dividends.ts`: proventos, "a receber" e a conferência pelos proventos (`extractDividends`, `extractUpcoming`, `dividendCheck`).

A simulação, os grupos e a aceitação continuam no `plan.ts`.

## 6. Proventos e "a receber"

### 6.1 Proventos (Movimentação)

| Linha (crédito com valor > 0) | Tipo | Ativos |
| --- | --- | --- |
| `Rendimento` | `RENDIMENTO` | FIIs (como hoje) e ações |
| `Reembolso` | `REEMBOLSO` | FIIs (como hoje) e ações |
| `Dividendo` | `DIVIDENDO` | Ações |
| `Juros Sobre Capital Próprio` | `JCP` | Ações. `amount` é o valor da B3, já líquido dos 15%; `perShare` fica o bruto que a B3 mostra. Por isso, no JCP, `amount` ≠ `quantity × perShare` |
| `Empréstimo` | `ALUGUEL` | Ações e FIIs. `quantity` é a do contrato (pode ser 0), e `perShare` fica null |
| `Rendimento - Transferido` | Ignorado (como hoje) | É troca de corretora: o crédito e o débito se anulam |

- **Valor:** o valor de cada provento é o "Valor da Operação". Nos FIIs, o código da família (`…12` a `…19`) continua levado ao `…11`. Nas ações, vale o próprio código.
- **Troca no reenvio:** dentro do período da Movimentação, os proventos continuam trocados ativo por ativo (`PlannedDividends`), agora com as ações e os tipos novos. No primeiro envio depois do deploy, o aluguel dos FIIs aparece na prévia como novo.

### 6.2 "A receber" (Eventos)

| Tipo de Evento (sem acento, minúsculo) | Tipo |
| --- | --- |
| `rendimento` | `RENDIMENTO` (como hoje) |
| `reembolso - rendimento` | `REEMBOLSO` (como hoje) |
| `dividendo` | `DIVIDENDO` |
| `juros sobre capital proprio` | `JCP` |
| `reembolso - dividendo`, `reembolso - juros sobre capital proprio` | `REEMBOLSO` |

O valor é o "Valor líquido". Sem previsão ("-"), o item fica sem data, como hoje: é o caso do dividendo da EGIE3.

### 6.3 Onde os tipos novos somam

`ALUGUEL`, `DIVIDENDO` e `JCP` são proventos como os outros. Eles entram:

- no total recebido;
- no ritmo dos 12 meses, do ano atual e do ano passado (`dividendPace`);
- no resultado com proventos e no total, de cada posição e da carteira (`adjustedResult`);
- no card das encerradas;
- nos agrupamentos de `/proventos`;
- no dinheiro de proventos do reinvestimento.

Na etapa 1, a tela de Proventos mistura os tipos. A quebra por tipo é da etapa 2.

### 6.4 Só para FIIs

- **Estimativa pelo Yahoo** (data ex × cotas, pagamento em data ex + 15 dias): só para FIIs. As ações entram no "a receber" só pela foto da B3.
- **"Não divulgado"** (o FII mensal sem provento no mês): só para FIIs.

## 7. Carteira e telas na etapa 1

- **Snapshot (`buildSnapshot`):** ganha o mapa de classes na entrada. O DTO de cada posição aberta ou encerrada ganha `assetClass`.
- **Resumo do Dashboard:** patrimônio, investido, L/P, proventos, DY 12m e renda mensal estimada somam tudo. A renda mensal estimada soma o último provento das ações com data ex nos últimos 62 dias, pela mesma regra dos FIIs. A comparação com a média e o yield on cost seguem dela.
- **Composição:**
  - **ações:** entram como uma fatia "Ações", com a chave `ACAO` e a cor que a categoria já tem em `category-colors.ts`;
  - **FIIs:** seguem pela categoria da Carteira Alvo;
  - **barra do card de patrimônio:** tem a mesma composição.
- **Posições:** ações e FIIs na mesma tabela e na mesma lista do iPhone. A tabela não tem coluna de categoria, e a ação se reconhece pelo nome (PETROLEO BRASILEIRO…). A categoria da ação vale `ACAO` nos dados, e é ela que leva a ação à fatia "Ações". Ranking, teto, prioridade e peso alvo ficam vazios.
- **Textos das listas:** onde uma lista passa a mostrar ações, o cabeçalho "FII" vira "Ativo" e "Cotas" vira "Qtd.". Isso vale para as encerradas (página, IR e card do Dashboard), o histórico e o "a receber" de Proventos e as compras do reinvestimento.
- **Encerradas (card e páginas):** incluem as ações. O IR está no §8.
- **Aportes por mês (`monthlyContributions`):** a compra de ação conta, e a `BONIFICACAO` não, como a perna de compra da incorporação, porque não sai dinheiro. O desdobro já soma 0.
- **Investido:** segue o custo da Receita. O custo atribuído da bonificação entra no investido no dia dela, e a evolução mostra isso.
- **Reinvestimento:** continua contando só negócios e subscrições como compra, então a compra de ação conta e a bonificação não.
- **Evolução e Variação da cotação:** as ações entram pelos fechamentos do Yahoo, sem regra nova. NEOE3, ODPV3 e WIZS3, que saíram da bolsa, usam o preço médio nos meses sem fechamento ("estimado"), como o MALL11.
- **Alertas:**
  - concentração e "sem cotação" valem para todos os ativos;
  - "Ativos fora da Carteira Alvo" fica só com FIIs, porque segue as linhas da Carteira Alvo.
- **Carteira Alvo:**
  - as linhas são só os FIIs em carteira ou configurados;
  - a busca para adicionar só oferece FIIs e Fiagros;
  - a action que grava um ativo-alvo recusa ação com `ActionError`.
- **Recomendações:** a entrada da cascata (`cascadeInput`) é feita só com os FIIs da estratégia. Mesmo um ativo-alvo de ação gravado antes ficaria de fora.
- **Transações:**
  - a tabela e a lista mostram as ações;
  - o cadastro manual de ação já é aceito hoje (`TICKER_REGEX`);
  - lançamentos B3 de ação ficam travados como os de FII.

  O filtro por classe é da etapa 2.
- **Dados de mercado:**
  - **cotação:** as ações em carteira saem da listagem de ações da brapi. São cerca de 790 tickers, uma página a mais por atualização: o uso estimado sobe de cerca de 350 para cerca de 700 requisições por mês, dentro do previsto no spec do MVP. O Yahoo continua de reserva;
  - **proventos do Yahoo:** DY 12m e último provento entram pelo refresh de hoje (`refreshDividends`);
  - **usebolsai:** continua só para os FIIs da Carteira Alvo.

## 8. IR das ações

`portfolio/domain/closed-positions.ts`:

- **FIIs:** não mudam. O IR é 20% do lucro da posição, somando todos os ciclos, e zero no prejuízo.
- **Ações:**
  1. **Vendido no mês:** para cada mês de São Paulo (`monthKeyOfTradeDate`), a soma de quantidade × preço de todas as vendas de ações (`NEGOCIO` e `FRACAO`), de posições abertas ou encerradas. É o valor bruto, sem as taxas, como na regra da isenção. A perna de saída da incorporação não conta.
  2. **Isenção:** um mês com vendido até R$ 20.000,00, inclusive, é isento.
  3. **Lucro por mês:** para cada posição encerrada, o lucro de cada mês é a soma do resultado das suas vendas naquele mês (`proceeds − cost`, do `replayLedger`).
  4. **IR estimado:** a soma, nos meses não isentos com lucro de pelo menos meio centavo, de 15% desse lucro, arredondado ao centavo. Prejuízo não paga e não compensa nada.
  5. **`taxExempt`:** é true quando a posição teve mês com lucro e todos esses meses foram isentos. A tela mostra "Isento" no lugar de R$ 0,00.
- **Telas:**
  - **`ClosedPosition`:** ganha `assetClass` e `taxExempt`. `estimatedTax` passa a seguir a regra da classe;
  - **`/encerradas/ir`:** troca o texto dos 20% por um texto curto com as duas regras, e a tabela mostra "Isento";
  - **cards do IR:** o rótulo "IR estimado (20% do lucro)" vira "IR estimado". O card "Lucro tributável" vira "Lucro das vendas", porque soma também o lucro isento das ações;
  - **somas (`ClosedPositionsTotals`):** não mudam de forma.
- **Seus dados:** as vendas de ações foram R$ 4.204,00 em mai/2021 (NEOE3, ODPV3 e WIZS3) e R$ 19.542,60 em dez/2022 (ITSA4). Os dois meses são isentos.
- **Fora da estimativa:** os mesmos limites de hoje, mais os das ações:
  - **compensação de prejuízos:** não é feita;
  - **IRRF de 0,005%:** fica de fora;
  - **day trade:** compra e venda da mesma ação no mesmo dia pagaria 20%, sem isenção. Não há caso no histórico, e a estimativa trata tudo como operação comum;
  - **units:** não está confirmado que a isenção de R$ 20 mil vale para elas. A estimativa trata a unit como ação, e isso precisa ser conferido se houver venda de unit;
  - **vendas parciais:** a de posição aberta conta para o limite do mês, mas não aparece na página, que lista só as encerradas (como hoje).

## 9. Dados

- **`transactions/domain/types.ts`:**
  - `TRANSACTION_KINDS` ganha `BONIFICACAO`;
  - `DIVIDEND_KINDS` ganha `DIVIDENDO`, `JCP` e `ALUGUEL`;
  - o tipo novo `AssetClass = "FII" | "ACAO"` fica em `market-data/domain/asset-class.ts`.
- **Modelos** (`dividend.model.ts`, `dividend-forecast.model.ts`): o `match` do ticker passa de `^[A-Z0-9]{4}11$` para o ticker geral (`^[A-Z0-9]{4}\d{1,2}$`). Os enums de tipo seguem `DIVIDEND_KINDS`.
- **Lançamentos:** o modelo de lançamento já aceita qualquer ticker, e o enum de `kind` segue `TRANSACTION_KINDS`.
- **Migração:** nenhuma. Os documentos de hoje (só FIIs, tipos `RENDIMENTO` e `REEMBOLSO`) continuam válidos.
- **Reversão:** o código anterior lê os documentos novos sem erro, porque o `lean()` não valida, e trata as ações como ativos fora da importação.

## 10. Verificação

**Testes novos (Vitest)**, ao lado do código, puros e sem banco:

- `market-data/domain/asset-class.test.ts`: cada linha da tabela do §4, inclusive unit, ETF, FII sem `subType`, FII e ação fora do catálogo, e direito ou recibo.
- `transactions/import/b3/lending.test.ts`: liquidação de negócio somando o dia, pareamento exato e "maior menor", o caso EGIE3 (32 → 44 com bonificação no meio dá +12), volta a mais sem evento (só aviso) e volta sem saída (ignorada).
- `transactions/import/b3/dividends.test.ts`: o tipo de cada linha da Movimentação e do Eventos (§6.1 e §6.2), o JCP com `amount` líquido e o aluguel com quantidade 0.
- `portfolio/domain/closed-positions.test.ts`:
  - FII a 20% (sem mudança);
  - ação em mês de R$ 20.000,00 (isento) e de R$ 20.000,01 (15%);
  - o limite somando vendas de posição aberta;
  - prejuízo num mês e lucro em outro, sem compensação;
  - leilão de fração contando para o limite;
  - `taxExempt`.
- **CLAUDE.md:** a lista "Covered" ganha estes arquivos. A regra de que a suíte cobre só os aportes passa a citar as regras das ações.

**Conferência com os arquivos reais:**

- **Como:** um script fora do repositório roda o plano com os extratos de 30/10/2026 contra os lançamentos e proventos atuais, só lendo, e confere os critérios 1 a 7 e 9. O critério 8 sai do `closedPositions` sobre o histórico resultante.
- **Ordem:** a conferência acontece antes do merge. Nada é gravado em produção nessa etapa.
- **Comandos:** `npm run format:check`, `lint`, `typecheck`, `test` e `build`.

## 11. Deploy e documentação

1. **Branch:** o trabalho fica em `feat/acoes-etapa-1`, com as verificações do §10.
2. **Produção:** o `main` é avançado (fast-forward), e o push publica.
3. **Envio:** o usuário manda os 3 extratos em `/atualizacao-b3`. A prévia mostra:
   - as 9 ações;
   - as 3 pendências de bonificação;
   - os proventos de ações e o aluguel dos FIIs como novos;
   - nenhum lançamento de FII trocado.

   Ele responde e confirma.
4. **CLAUDE.md:** a descrição do app passa a ser FIIs e ações. Os trechos de B3 update, Domain flow e Product rules, e a lista de testes, descrevem as regras deste spec.
5. **Specs antigos:** `2026-10-18-importacao-b3-design.md` (§4 e a linha de proventos do §5.2) e `2026-10-23-posicoes-encerradas-design.md` (alíquota) ganham uma nota apontando para este spec.

## 12. Fora do escopo e limitações

- **Etapa 2:**
  - Geral, FIIs e Ações no Dashboard e em Proventos;
  - a rosca por classe com detalhe por setor;
  - os proventos por tipo ("só aluguel", "só JCP");
  - o filtro por classe em Transações.
- **Eventos de ações não suportados:** grupamento, subscrição, conversão ou incorporação de ações ("Atualização" diferente da posição). A ação fica de fora, com o motivo.
- **Outros ativos:** ETFs, BDRs, FI-Infra e os demais fundos continuam fora.
- **Reembolso de fração:** em 30/01/2026, um "Reembolso" de R$ 24,46 na EGIE3 é o dinheiro da fração de 0,8 ação que estava alugada (0,8 × 30,578). Entra como provento, porque a Movimentação não distingue esse reembolso dos outros.
- **IR do aluguel:** o valor é o que a B3 mostra. O extrato não traz o IR retido sobre o aluguel, e o app não o calcula.
- **Units fora do catálogo:** seriam lidas como FII (§4).
- **Bonificação com todas as ações alugadas:** se todas as ações estavam alugadas na data com, a B3 pode não lançar a "Bonificação em Ativos" para você. Aí a regra do §5.5 não acha o evento e só avisa.
- **IR:** os limites do §8.
