# Reinvestimento de proventos: especificação de design (ciclo 2)

- **Data:** 2026-10-23
- **Status:** implementado em 2026-10-23.
- **Atualização (2026-10-23):** a pedido do usuário, o relatório também virou subitem "Reinvestimento" de Proventos no menu lateral, como o IR estimado nas posições encerradas. O botão no cabeçalho de `/proventos` continua, e o menu marca Proventos e o subitem.
- **Ciclo:** segundo ciclo dos proventos. O primeiro, `2026-10-18-proventos-design.md`, guardou os proventos da B3 e criou `/proventos`.

## 1. Objetivo

Um relatório mensal que separa o aporte do mês em duas partes: o que veio de proventos reinvestidos e o que saiu do bolso.

- Ele lista as compras do mês e os proventos recebidos no mês.
- O usuário informa a % dos proventos do mês que foi reinvestida.
- A % fica salva por mês e alimenta o histórico.

### Critérios de sucesso

1. Para um mês com aporte de R$ 20.000, proventos de R$ 7.000 e 100% reinvestido, a tela mostra R$ 7.000 de proventos e R$ 13.000 do bolso.
2. Com 50% no mesmo mês, aparecem R$ 3.500 de proventos e R$ 16.500 do bolso.
3. Se a parte de proventos passa do aporte, ela fica limitada ao aporte e a sobra aparece. Por exemplo, aporte de R$ 5.000 com R$ 7.000 de proventos e 100% dá R$ 5.000 de proventos, R$ 0 do bolso e R$ 2.000 sem compra.
4. A % salva de um mês vale só para aquele mês. Mês sem % usa 100% e mostra "padrão".
5. A soma de "aporte no mês" bate com o gráfico "Aportes por mês" do Dashboard nos meses que ele mostra. Nos dados reais, a única compra que o gráfico conta e o relatório não é a posição anterior de 07/11/2019, fora da janela de 24 meses. O desdobro custa zero, e a fração é uma venda.
6. Nenhum outro número do app muda: Dashboard, Proventos, Recomendações e importação.

## 2. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| % por mês | Salva por mês, editável depois | Decisão do usuário ("Uma % por mês, salva") |
| Mês sem % | 100% | Decisão do usuário. No método Suno, todo provento volta para a carteira; uma exceção fica só no mês dela |
| Onde guardar | Coleção nova `reinvestments` (carteira, mês, %) | É isolada, filtrada pela carteira, e apagar o documento volta o mês ao padrão. Um mapa dentro da carteira misturaria configuração com cadastro e cresceria sem limite |
| Aporte do mês | Compras em dinheiro: negócios e subscrições, com taxas | Desdobro (custo zero), incorporação (só transfere custo) e posição anterior (não foi comprada naquele mês) não são dinheiro novo |
| Proventos do mês | Os pagos pela B3 no mês (`paidAt`) | O "a receber" é estimado e ainda não está em caixa |
| Precisão da % | 0 a 100, com uma casa decimal | Permite, por exemplo, 68,1% quando o reinvestido foi um valor redondo em reais |

## 3. Regras (puras)

As regras ficam em `portfolio/domain/reinvestment.ts`, sem I/O.

### 3.1 Compras do mês

Uma compra é um lançamento com `type` BUY e `kind` igual a NEGOCIO ou SUBSCRICAO (um lançamento antigo, sem `kind`, vale como negócio), com data no mês (AAAA-MM pela data de negócio).

- **Valor:** quantidade × preço + taxas.
- **Lista:** data, FII, tipo, quantidade, preço unitário e total, da mais recente para a mais antiga.
- **Aporte do mês:** a soma dos valores.

### 3.2 Divisão do mês

Entram o aporte `A`, os proventos recebidos no mês `P` e a % `r`, de 0 a 100.

- **Reinvestido pretendido:** `R = P × r / 100`.
- **Dinheiro de proventos:** `min(R, A)`.
- **Dinheiro do bolso:** `A − dinheiro de proventos`.
- **Sobra:** `R − dinheiro de proventos`, ou seja, os proventos que a % mandaria reinvestir mas que não tiveram compra no mês. Ela só aparece quando é maior que zero.
- **Participação:** com `A > 0`, a participação dos proventos é `dinheiro de proventos ÷ A`. Com `A = 0`, não há divisão.

### 3.3 Histórico

Para cada mês pedido, o histórico traz:
- o aporte e os proventos;
- a % e se ela é a padrão;
- o dinheiro de proventos e o dinheiro do bolso.

O resumo dos últimos 12 meses (até o mês atual, inclusive) soma os aportes e o dinheiro de proventos e mostra a participação dos proventos no total.

## 4. Dados

Coleção `reinvestments` em `portfolio/server/reinvestment.model.ts`:

| Campo | Tipo | Observação |
| --- | --- | --- |
| `portfolioId` | ObjectId | índice único com `month` |
| `month` | string | AAAA-MM |
| `percent` | number | 0 a 100, com uma casa decimal |

- **Repositório:** recebe o `portfolioId` explícito em toda consulta, gravação e remoção.
- **Leitura:** um DAL de sessão, que passa por `getTenant`.
- **Escrita:** a Server Action `setReinvestmentPercentAction` (`portfolio/actions.ts`, `authActionClient`) recebe `{ month, percent }`.
  - **Validação (Zod):** `month` com o formato AAAA-MM, entre 2000-01 e o mês atual; `percent` entre 0 e 100, ou `null`.
  - **Gravação:** com um número, faz upsert. Com `null`, apaga o documento e o mês volta ao padrão.
  - **Depois:** chama `refresh()`.

## 5. Tela

A página fica em `/proventos/reinvestimento?mes=AAAA-MM`. O botão "Reinvestimento" no cabeçalho de `/proventos` leva até ela. O menu lateral continua marcando "Proventos".

- **Seletor de mês:**
  - setas de anterior e próximo, e uma lista dos meses com compra ou provento, mais o mês atual;
  - começa no mês atual;
  - a escolha fica na URL (`mes`), via nuqs;
  - um `mes` inválido ou futuro cai no mês atual.
- **Cards:**
  - **Aporte no mês:** com o número de compras.
  - **Proventos recebidos no mês.**
  - **% reinvestida:**
    - um campo numérico de 0 a 100, com "Salvar";
    - mostra "padrão (100%)" quando o mês não tem % salva, e "Voltar ao padrão" quando tem.
    - A divisão na tela acompanha o que se digita, antes de salvar.
  - **Divisão:** dinheiro de proventos e dinheiro do bolso, com valores e %, numa barra de duas partes.
    - A sobra aparece como aviso quando existe.
    - Sem compras no mês: "Nenhuma compra no mês".
- **Compras do mês:** tabela com Data, FII, Tipo, Qtd., Preço e Total, mais o total no rodapé. Em card estreito, as colunas de detalhe saem pela largura do card.
- **Histórico:**
  - barras empilhadas dos últimos 24 meses, com o dinheiro do bolso em `--chart-1` (o azul dos aportes) e o de proventos em `--chart-2` (o laranja dos proventos);
  - legenda com as duas séries e tooltip por barra com bolso, proventos, total e a % usada;
  - acima do gráfico, o resumo "Nos últimos 12 meses, X% dos aportes vieram de proventos (R$ Y de R$ Z)".
  - O par de cores passou no validador nos dois temas, com distância de cor (CVD) acima de 24.

As telas seguem o padrão das outras: Server Components com a casca estática e o conteúdo da sessão em `<Suspense>`. O campo da % e o gráfico são Client Components.

## 6. Arquitetura

| Peça | Arquivo | Responsabilidade |
| --- | --- | --- |
| Regras (puro) | `portfolio/domain/reinvestment.ts` | §3 |
| Tipos | `portfolio/domain/types.ts` | `ReinvestmentView` e as linhas do histórico |
| Modelo e repositório | `portfolio/server/reinvestment.model.ts`, `reinvestment-repo.ts` | §4 |
| Leitura da tela | `portfolio/server/reinvestment-view.ts` | Junta lançamentos, proventos e % do tenant e monta o DTO, sem ids |
| Ação | `portfolio/actions.ts`, `portfolio/schemas.ts` | `setReinvestmentPercentAction` |
| Telas | `portfolio/components/reinvestment/*` e `app/(app)/proventos/reinvestimento/page.tsx` | §5 |
| Link | `app/(app)/proventos/page.tsx` | Botão "Reinvestimento" no cabeçalho |
| Proxy | `src/proxy.ts` | Já cobre `/proventos/:path*` |

## 7. Fora deste ciclo

- A % por FII (reinvestimento só nos FIIs que pagaram).
- O reinvestimento calculado automaticamente a partir das compras.
- A exportação do relatório.

## 8. Verificação

1. **Script sem banco:** os critérios 1 a 4 e o mês sem compras.
2. **Prévia isolada (`koinos_preview`) com os dados reais:**
   - salvar 50% num mês, conferir a divisão e o histórico, e voltar ao padrão;
   - conferir que a % de um mês não muda os outros.
3. **Conferência do critério 5:** o aporte de cada mês comparado com o gráfico do Dashboard.
4. **Telas:** capturas nos dois temas, em 1440 e 390 px, e a checagem de contraste com 0 falhas.
5. **Checagens:** `npm run format:check`, `lint`, `typecheck` e `build`.
