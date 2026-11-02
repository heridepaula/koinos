# Aviso de divergência do teto (ranking × NTN-B)

Data: 2026-11-01. Estado: **implementada** (plano em `docs/superpowers/plans/2026-11-01-divergencia-teto.md`). Origem: o item 1 do parecer do conselho sobre as 4 regras (`2026-11-01-fruicao-design.md`, §1) e a coleta da taxa real da NTN-B (`2026-11-01-taxa-ntnb-design.md`), que deixou o dado pronto e sem uso.

## 1. Objetivo

Mostrar um triângulo de aviso nos FIIs cujo teto do ranking (digitado pelo dono) está longe do teto que a fórmula "proventos de 12 meses ÷ (NTN-B + spread)" daria. O aviso é **só informativo**: nenhum motor, ordem, Prioridade ou alerta muda.

## 2. A regra

Função pura em `strategy/domain/ceiling.ts`, ao lado de `marginToCeiling` e `isSuspiciousCeiling`.

- **Teto calculado** = proventos dos 12 meses por cota ÷ rendimento exigido.
  - **Tijolo e as demais classes** (inclui "Outros", isto é, FoF e o que não se classifica): rendimento exigido = NTN-B real + 1,0 p.p. O aluguel acompanha a inflação, então o provento nominal se compara com a taxa real.
  - **Papel:** rendimento exigido = NTN-B real + 4,0% de IPCA assumido + 1,0 p.p. O DY do papel já traz a inflação, então se compara com uma taxa nominal.
- **Divergência** = teto calculado ÷ teto do ranking − 1. Há aviso quando o valor absoluto passa de **10%**, nos dois lados (teto do ranking acima ou abaixo do calculado).
- **Taxa da NTN-B:** a **mediana de 60 pregões** de `getRealRate()` (7,675% em 30/10/2026), e não o último ponto (7,92%). Um teto que se mexe 16% de um pregão para outro por causa de eleição seria ruído.
- **Constantes nomeadas** no código (`CEILING_CHECK`): spread de tijolo 1,0 p.p., spread de papel 1,0 p.p., IPCA assumido 4,0%, limite 10%. Mudar um valor é uma alteração de código; não há tela de configuração.
- **Unidades:** a função recebe e devolve **frações** (taxa de 7,675% entra como `0.07675`), como o resto do domínio (`dy12m`, `marginToCeiling`). A conversão de % para fração acontece uma vez, na fronteira do snapshot.

### Sem dado, sem aviso

Nenhuma destas situações é erro; o resultado é "sem aviso":

- FII sem teto do ranking (ou teto ≤ 0);
- sem proventos de 12 meses, ou soma zero (último pagamento com mais de 365 dias);
- proventos buscados há mais de 10 dias (`dividendsFetchedAt`, a mesma regra de frescor da suspensão de proventos);
- taxa da NTN-B ausente, ou velha (`stale`, mais de 10 dias), ou falha na leitura dela;
- FII fora da estratégia (só os FIIs da estratégia têm a classe tijolo ou papel calculada no snapshot) e ações.

## 3. Dados

- `SnapshotInput` ganha `ntnbRealRate?: number | null` (fração; padrão null). Os chamadores que não passam nada continuam iguais.
- `getPortfolioSnapshot` (`portfolio/server`) lê `getRealRate(now)`. Se há resumo e ele não é velho, passa `median / 100`; senão, null. **Uma falha na leitura da taxa não pode derrubar a página:** o erro é registrado no log e vira null.
- Tipo `CeilingCheck` (DTO, sem ids internos): `{ calculated: number; divergence: number; requiredYield: number; ntnbRealRate: number }`. É criado **só quando há aviso**; sem aviso, o campo é null. O teto do ranking e o provento já estão na linha.
- `StrategyRow` ganha `ceilingCheck: CeilingCheck | null`. A página de Recomendações põe o aviso no `AssetMeta` de cada FII avisado (`ceilingWarning`: o `CeilingCheck` e o teto do ranking), que já chega às ordens pelo `AporteCalculator`.
- `buildSnapshot` calcula o campo ao montar as linhas dos FIIs da estratégia, com `macro`, `dividends12m` e o teto que a cascata já usa. **A cascata, o `cascadeInput` e a Prioridade ficam iguais com e sem a taxa.**

## 4. Telas

> **Revisado em 2026-11-02, a pedido do dono:** o triângulo fica **ao lado do preço teto** (célula da coluna Teto na tabela; na folha do celular, ao lado da linha "Preço teto" e no resumo da lista), e não ao lado da margem. O texto ganhou o sinal (**Positivo**: o teto calculado está acima do ranking; **Negativo**: abaixo) e um layout em blocos: selo com seta e a diferença, manchete, valores em colunas, o preço atual contra o teto calculado (destacado quando já passou), a conta e o que ela significa. É a função pura `ceilingCheckDetails` e o componente `CeilingCheckBody`. O sinal tem cor: o triângulo e o selo são **verdes no positivo e vermelhos no negativo** (tokens `gain`/`loss` sobre o card e a folha; no tooltip, de fundo invertido, um par de tons por tema, com no mínimo 4,5:1 sobre o selo). O resto desta seção descreve a primeira versão.


- **Carteira Alvo** (`MarginValue`, `strategy/components/table/read-only-cells.tsx`): triângulo âmbar (`text-warn`) ao lado do "Teto suspeito" que já existe, com tooltip e `aria-label` próprios ("Teto diverge do calculado"), para as duas poderem aparecer juntas.
  - Texto do tooltip: "Teto do ranking R$ 84,00; calculado R$ 57,52 (−32%). Proventos de 12 meses ÷ (NTN-B 7,68% + 1,0 p.p.). Confira o teto." Para papel, o texto cita o IPCA assumido.
  - Aparece nas duas abas só onde há `ceilingCheck` (ações nunca têm).
- **Recomendações:** o mesmo triângulo ao lado do ticker nas ordens de compra, na tabela e na lista do celular (a folha com o "Por quê" repete o texto do tooltip). Não aparece em "Fora deste aporte".
- O Dashboard (posições) **não** recebe o aviso nesta entrega.
- Acessibilidade e contraste: o âmbar segue o token `text-warn` do projeto (AA); o triângulo tem 44 px de área de toque no celular como os demais ícones com tooltip.

## 5. O que não muda

Cascata (elegibilidade, ordem, tensores, travas, mínimo por ordem), smart buy de ações, divisão FIIs/ações, `aportePriorities`, alertas do snapshot e a fruição. O teto continua o do ranking; o calculado só aparece no tooltip.

## 6. Exemplo real (2026-11-01, taxa mediana 7,675%, spread 1,0 p.p., IPCA 4,0%)

Com o limite de 10%, **5 de 17** FIIs da estratégia recebem o triângulo (conta à mão sobre os proventos de 12 meses gravados):

| FII | Calc./ranking |
|---|---|
| PVBI11 | 68% |
| TRXF11 | 129% |
| FATN11 | 114% |
| XPML11 | 111% |
| VGIP11 | 87% |

Com o último ponto da taxa (7,92%) seriam 4, sem o XPML11. O teto calculado reproduz bem o do ranking: a mediana de calculado ÷ teto do ranking foi de 97% nos 17 FIIs (medida com o último ponto da taxa). O caso mais relevante é o PVBI11: o preço (R$ 61,00) já está acima do teto calculado (R$ 57,52) enquanto está abaixo do teto do ranking (R$ 84,00).

**Até o primeiro cron diário rodar em produção não existe taxa gravada**, então nenhum triângulo aparece nos primeiros dias.

## 7. Testes

Puros, sem banco, em `strategy/domain/ceiling.test.ts` e `portfolio/domain/snapshot.test.ts`:

- a fórmula de tijolo e a de papel, com os números do exemplo;
- o limite de 10%: 9,9% e 10% sem aviso, 10,1% com aviso, nos dois lados;
- cada caso de "sem dado" do §2 (teto ausente, proventos ausentes, zerados e velhos, taxa ausente);
- "Outros" tratado como tijolo;
- o snapshot leva `ceilingCheck` às linhas dos FIIs da estratégia, não às ações nem aos FIIs fora dela;
- **o `cascadeInput` e as Prioridades são idênticos com e sem a taxa**;
- o texto do tooltip (função pura de formatação) para tijolo e para papel.

## 8. Decisões do dono (2026-11-01)

1. **Tratamento da inflação:** papel com IPCA somado, tijolo literal.
2. **Spreads:** 1,0 p.p. para tijolo e 1,0 p.p. para papel. **IPCA assumido:** 4,0% ao ano.
3. **Limite:** mais de 10% de diferença, nos dois lados.
4. **Onde aparece:** Carteira Alvo e Recomendações.
5. **Aprovadas no desenho:** mediana de 60 pregões, constantes no código e só FIIs da estratégia.

Ponto para o dono confirmar na revisão: com a mediana o limite de 10% pega 5 FIIs (a escolha foi feita olhando 4, com o último ponto).

## 9. Fora do escopo

- Tela para editar spreads, IPCA ou limite.
- Aviso no Dashboard, em "Fora deste aporte" e para FIIs fora da estratégia.
- Teto calculado para ações.
- Qualquer efeito do aviso sobre as ordens, a Prioridade ou os alertas.
- Fonte de IPCA (a spec do SGS substituiria o IPCA fixo de 4,0%).
- O comando `snapshot` do laboratório mostrar o aviso.

## 10. Ordem de trabalho

1. Função pura e testes em `ceiling.ts`.
2. Snapshot: entrada `ntnbRealRate`, campo nas linhas e testes.
3. `getPortfolioSnapshot` lendo a taxa, com a falha isolada.
4. Triângulo na Carteira Alvo e nas Recomendações.
5. Documentação (`CLAUDE.md`, `formulas.md`).
6. Verificação: `format:check`, `lint`, `typecheck`, `test`, `build` e a conferência visual das duas telas.
