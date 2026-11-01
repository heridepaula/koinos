---
name: conselho-investidores
description: Avalia fórmulas e estratégias de investimento do Koinos (a cascata de FIIs Koinos 3.0 e 3.1, o smart buy de ações, a divisão FIIs/ações, os pesos da Carteira Alvo, o reinvestimento) ou uma proposta nova. Primeiro faz uma verificação técnica (contas, unidades, bordas, invariantes, spec × código e simulações com os motores reais sobre a carteira de produção, só leitura); depois passa a fórmula pelas lentes de Tiago Reis, Professor Baroni, Warren Buffett e Luiz Barsi. Aponta erros com evidência e entrega recomendações priorizadas. Use sempre que o dono pedir para avaliar, revisar, criticar, validar ou comparar uma fórmula, um algoritmo, uma regra de aporte, um motor de recomendação, uma estratégia de carteira ou um documento de estratégia; quando perguntar o que Barsi, Buffett, Baroni ou Tiago Reis achariam; e antes de mudar o código de smart-buy, strategy ou portfolio/domain que decide o aporte, mesmo que ele não fale em "conselho".
---

# Conselho de investidores

Avalia uma fórmula de investimento do Koinos em duas camadas:

1. **Verificação técnica**, que não depende de opinião: contas, unidades, bordas, invariantes, spec × código e o que a fórmula faz ao longo dos meses com a carteira real.
2. **O conselho**: as lentes de Tiago Reis, Professor Baroni, Warren Buffett e Luiz Barsi, que julgam se a fórmula serve à estratégia e o que melhorar.

O objeto pode ser um motor que já existe, uma mudança em andamento (um diff) ou uma proposta em texto. A skill não muda código nem dados: entrega um relatório. O dono decide; se ele quiser implementar algo, siga o fluxo normal do projeto (brainstorming, spec, plano).

## Antes de começar

- Leia `references/formulas.md`: onde cada fórmula está, o que calcula, os invariantes, as decisões do dono, os dados que existem e o que parece erro mas é projeto. O mapa resume; o código e as specs mandam, então confirme no código o que for citar.
- Leia `references/personas.md` antes de escrever as lentes.
- Regras da casa (CLAUDE.md): o `MONGODB_URI` do `.env.local` é o banco de produção, então tudo aqui é só leitura; nunca chame sistemas da B3; não gaste cota da brapi (o laboratório lê só o que está gravado). Escreva em pt-BR.

## Fluxo

### 1. Delimite o objeto e a pergunta

Diga qual fórmula está em julgamento (arquivo e função, spec ou proposta) e o que o dono quer saber: se está certa, se vale a pena, o que melhorar, o que uma das personas acharia. Se o pedido for vago ("avalie o motor"), escolha o objeto mais provável e diga a escolha no relatório.

Uma proposta em texto vira fórmula antes de ser julgada: entradas, saída, onde entra no motor, o que acontece sem dado. Se ela for ambígua, escreva a sua leitura e siga com ela.

### 2. Verificação técnica

O objetivo é achar o que está errado independentemente de filosofia. Tente quebrar a fórmula:

- **Contas e unidades:** fração × percentual (os pesos são frações; `suggestedPercent` e `vacancyPct` são %), R$ × cotas, centavos, divisão por zero, sinal.
- **Bordas:** sem cotação, sem teto, sem rank, preço igual ao teto, aporte zero ou menor que uma cota, carteira vazia, todos fora, % que não somam 100, quarentena (0%), dado com mais de 60 dias.
- **Invariantes:** gasto + sobra = aporte; nada comprado acima do teto nem com viés Aguardar; cotas inteiras; travas por aporte; FII fora da estratégia não recebe. Rode os testes da área (`npx vitest run src/features/smart-buy` e os do que a fórmula toca) e diga o que eles não cobrem.
- **Spec × código × CLAUDE.md:** qualquer divergência é um achado. Quem está certo é decisão do dono; aponte as duas versões.
- **Comportamento ao longo do tempo:** rode o laboratório (passo 3) para ver quem nunca recebe, se a carteira concentra, se a recomendação oscila por ruído de preço, se a sobra cresce.

Antes de chamar algo de erro, confira "Parece erro, mas é projeto" em `references/formulas.md`. Um falso positivo custa a confiança do dono no relatório inteiro.

Classifique cada achado:

| Tipo              | Quando                                                                       |
| ----------------- | ---------------------------------------------------------------------------- |
| Erro              | contradiz a spec, o CLAUDE.md ou a matemática                                |
| Fragilidade       | uma borda não tratada                                                        |
| Divergência       | spec, código e CLAUDE.md não dizem a mesma coisa                             |
| Efeito de projeto | funciona como escrito, mas tem uma consequência que o dono talvez não queira |

- **Severidade:** alta (ordem ou dinheiro errado), média, baixa (texto, exibição).
- **Status:** Confirmado quando você reproduziu (teste, laboratório ou script, com a entrada e a saída); Provável quando é raciocínio. Nunca apresente um Provável como fato: o dono age em cima disso.

### 3. Números

Responda com a carteira real sempre que a pergunta permitir. O laboratório (abaixo) reconstrói a carteira como a tela de Recomendações e roda os motores. Diga as premissas de cada número (preços parados, Carteira Alvo de hoje). Numa projeção, relate a trajetória mês a mês, não só o fim: o ponto final esconde o caminho.

Para julgar uma proposta, simule-a como uma opção ou uma versão do motor e compare com `comparar` (abaixo): o laboratório roda as versões de `ENGINE_VERSIONS` e mostra o primeiro aporte e as notas das lentes lado a lado. Veja em `references/formulas.md` ("Versões do motor") o que já é opção. Só o que ainda não é opção pede um script descartável: copie o trecho necessário do laboratório para um arquivo na raiz do repositório (ex.: `_conselho-tensor-dy.mts`), mude só o que a proposta muda (ex.: o `need` de cada FII), rode e apague o arquivo. Nunca edite `src/` para testar. Sem tempo para isso, faça a conta à mão com os números reais do `snapshot` e diga que foi à mão.

### 4. O conselho

Para cada persona, na ordem de relevância para o objeto (FIIs: Baroni e Tiago Reis primeiro; ações: Barsi e Buffett), escreva:

- **Aprova:** o que a fórmula faz bem nessa lente.
- **Critica:** o que falha nessa lente.
- **Recomenda:** o que mudaria.

São de 1 a 4 itens em cada parte. Cada item se apoia em pelo menos uma destas coisas: um mecanismo da fórmula (a função, a regra, o tensor), um número do passo 3, ou um dado que falta (qual e de onde poderia vir). Um item que caberia em qualquer fórmula ("diversificar é bom") não entra.

Escreva como lente: "na lente de Barsi", "Buffett olharia". Não invente falas nem números atribuídos às pessoas. Quando uma persona rejeitaria a premissa inteira (Barsi e os FIIs), registre isso uma vez como contraponto e avalie a fórmula nos termos dela mesmo assim.

### 5. Síntese

- **Concordâncias:** o que três ou mais lentes apontam juntas costuma ser o achado mais forte.
- **Divergências:** por exemplo, preço médio × caixa para o pânico, diversificar × concentrar, FIIs × só ações. Diga quanto cada lado custaria nesta carteira, com número quando houver.
- **Recomendações priorizadas:**
  - P1 corrige um erro ou um risco relevante;
  - P2 é uma melhora clara;
  - P3 é uma ideia a considerar.

  Cada uma diz o que muda, onde, o efeito esperado, como testar, quem defende, se conflita com uma decisão do dono (nomeie a decisão) e o esforço (P, M ou G).

- **Veredito:** fica no topo do relatório.

## Relatório

Use esta estrutura. Seja tão longo quanto o conteúdo pede, sem enchimento.

```markdown
# Conselho: <o que foi avaliado>

**Veredito:** <2 a 3 frases: se a fórmula está certa, o achado mais grave e a recomendação nº 1>

## Verificação técnica

| #   | Tipo | Severidade | Onde | O que acontece | Cenário (entrada → saída) | Status |
| --- | ---- | ---------- | ---- | -------------- | ------------------------- | ------ |

Testes rodados: <arquivos e resultado>. Não cobertos: <...>.

## Números

<os comandos do laboratório usados, as premissas e 3 a 6 resultados que sustentam o resto>

## O conselho

### <Persona> (<o que a lente olha>)

- **Aprova:** ...
- **Critica:** ...
- **Recomenda:** ...

(as quatro, na ordem de relevância)

## Onde concordam e onde divergem

## Recomendações

| Prioridade | Recomendação | Quem defende | Evidência | Conflita com decisão do dono? | Esforço |
| ---------- | ------------ | ------------ | --------- | ----------------------------- | ------- |

## Limites desta avaliação

<dados que faltaram, o que não foi simulado, o que é Provável>
```

As personas são lentes inspiradas no que cada investidor defende publicamente. Diga isso numa linha no começo do conselho.

## Laboratório

`scripts/lab.mts` reconstrói o snapshot como `getPortfolioSnapshot` (visão Geral), sem a sessão, e roda `sunoCascade` e `stockSmartBuy` com as opções de uma versão do motor (`--versao`, padrão a da tela). Só lê o banco e não chama nenhuma API. Rode da raiz do repositório:

```bash
npx tsx --conditions=react-server --env-file=.env.local \
  .claude/skills/conselho-investidores/scripts/lab.mts <comando> [opções]
```

| Comando                                                                     | Para quê                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `snapshot`                                                                  | as duas estratégias hoje (rank, teto, preço, margem, meta × atual, P/VP, freio de proventos, vacância, macro, setor, viés, número mágico; nas ações, MS e DY), a composição por macro e setor, o frescor das cotações e o último lançamento |
| `recomendar --valor 10000 [--fiis 100]`                                     | o que a tela recomenda agora, com tensores, pedido, trava e quem ficou de fora (e por quê)                                                                                                                                                  |
| `projetar --valor 10000 --periodos 8 [--fiis 100]`                          | executa cada recomendação e repete; mostra cada período e, no fim, o peso inicial → final × meta de cada ativo                                                                                                                              |
| `choque --valor 10000 [--cenarios 5000] [--comum 0.025] [--proprio 0.03]`   | sorteia preços (fator comum + próprio) e mede quanto a recomendação muda: frequência de cada ativo, mesmo conjunto, mesmas quantidades                                                                                                      |
| `mes --mes 2026-10`                                                         | as compras do mês × o que o motor faria com a carteira do fim do mês anterior (preços e Carteira Alvo de hoje)                                                                                                                              |
| `comparar --a 3.0 --b 3.1 [--valor 10000] [--periodos 12] [--cenarios 300]` | o primeiro aporte das duas versões lado a lado (ordens `TICKER×qtd(R$)` e quem ficou de fora, por motivo) e a tabela de notas das lentes A × B, com preços parados e com preços sorteados (`--cenarios`, `--semente`)                       |

- **`--versao`:** `recomendar`, `projetar`, `choque` e `mes` aceitam `--versao 3.0|3.1`; sem ela, vale `CURRENT_ENGINE`, a versão da tela. Uma versão desconhecida dá erro com a lista das válidas.
- **`comparar`:** só roda versões nomeadas (`ENGINE_VERSIONS`). As notas e o que cada lente lê estão em `references/formulas.md` ("Versões do motor"); em preços sorteados, cada nota é a média dos cenários, com os mesmos caminhos de preço nas duas versões. "Compras fora do método" precisa dar 0.
- **`--fiis`:** é a % do aporte nos FIIs, como o slider da tela. 100 manda tudo para os FIIs; 0 manda tudo para as ações. Com 100, as notas das ações ficam em "-" ou em zero.
- **`--email`:** escolhe o dono; sem ele, vale o primeiro e-mail de `ALLOWED_EMAILS` no `.env.local`.
- **Aporte semanal × mensal:** compare `projetar --valor 2500 --periodos 32` com `projetar --valor 10000 --periodos 8`.
- **Preços parados:** o `projetar` não move preços, proventos, P/VP nem a Carteira Alvo; serve para ver a mecânica, não para prever o mercado.
