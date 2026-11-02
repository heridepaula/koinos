# As quatro lentes

Estas lentes se inspiram no que cada investidor defende publicamente, a partir do perfil que o dono passou.

- **Sem falas inventadas:** escreva "na lente de Barsi" ou "Buffett olharia", e não invente falas nem números atribuídos a eles. Uma máxima pública conhecida pode aparecer identificada como tal, com parcimônia, como a de Buffett sobre a empresa maravilhosa a preço justo.
- **A fórmula em julgamento:** cada lente avalia a fórmula em julgamento, não a filosofia no abstrato. As checagens abaixo são pontos de partida; pule as que não se aplicam ao objeto e acrescente o que a fórmula pedir.

## Sumário

1. Tiago Reis: ranking, preço médio, carteira híbrida
2. Professor Baroni: FIIs, renda mensal, reinvestimento
3. Warren Buffett: valor, qualidade, margem de segurança, caixa
4. Luiz Barsi: dividendos, setores perenes, carteira previdenciária
5. Tensões entre as lentes

## 1. Tiago Reis: ranking, preço médio, carteira híbrida

**A lente:** o Koinos implementa o método dele: o ranking e o preço-teto do ranking, com aportes constantes. Ela pergunta se a fórmula é fiel ao método e se protege o investidor de varejo de modismos e da tentação de acertar o mercado.

**Princípios:**

- **Preço médio** (dollar-cost averaging): aportes constantes e metódicos, sem tentar acertar topo ou fundo.
- **Carteira híbrida:** FIIs pela renda mensal e ações boas pagadoras de dividendos pela valorização.
- **Fundamentos:** análise rigorosa da saúde financeira e do valor intrínseco, sem ativo de risco sem fluxo de caixa comprovado.

**O que verifica no Koinos:**

- **Preço médio de verdade:** o aporte inteiro é investido todo mês?
  - A sobra deve ser pequena (`recomendar`, `projetar`).
  - Na parte de ações, se nenhuma for elegível (todas acima do teto ou com Aguardar), o dinheiro fica parado, e isso quebra o preço médio.
- **Estabilidade:** a recomendação muda por ruído de preço (`choque`)? Mudar por fundamento é esperado; mudar a lista por 1% de preço é ruído.
- **Fidelidade ao método:** só compra abaixo do teto, segue o ranking e respeita o viés.
  - O teto vem do ranking e é digitado à mão, então um teto velho deixa comprar caro.
  - `isSuspiciousCeiling` só pega erro grosseiro (menos da metade ou mais do dobro do preço).
- **Divisão entre classes:** escolher a % de FIIs a cada aporte abre espaço para market timing entre classes. Isso é contraponto a uma decisão do dono, não erro.
- **Fundamentos:** o freio de proventos dos FIIs pune corte, mas nenhum dos motores exige histórico mínimo de fluxo de caixa, e o de ações não olha proventos.

**Sinais de alerta:** sobra crescente; caixa parado; ativo que nunca recebe sem motivo de fundamento; regra que reage a preço de curto prazo.

**Dados que pediria:** a data da última atualização de cada teto e o histórico da Carteira Alvo, para saber se ela está em dia com o ranking.

## 2. Professor Baroni: FIIs, renda mensal, reinvestimento

**A lente:** os FIIs dão ao investidor comum acesso a imóveis de qualidade (galpões, shoppings) e uma renda mensal previsível, que traz estabilidade emocional. O tijolo protege o patrimônio da inflação no longo prazo, e os próprios rendimentos fazem a bola de neve.

**Princípios do perfil:**

- **Renda mensal mensurável:** previsibilidade do fluxo dos aluguéis.
- **Efeito bola de neve:** os rendimentos compram novas cotas.
- **Blindagem de patrimônio:** fundos de tijolo protegem da inflação; ele refuta a crítica de Barsi aos FIIs.

**Regras da live "Como reinvestir os FIIs?":**

- **Origem:** estudo de 7 anos de Alexandre Tauil, de setembro de 2018 em diante, debatido por Baroni.
- **Desenho:** fase de fruição, com renda inicial de R$ 10 mil por mês, nos 20 maiores FIIs por valor patrimonial, em fatias iguais.
- **Números:** vêm do resumo que o dono passou. Não foram verificados pelo Koinos; cite-os como "o estudo".

Resultados:

| Cenário                                                            | Patrimônio | Renda                     | IPCA no período |
| ------------------------------------------------------------------ | ---------- | ------------------------- | --------------- |
| Mista (40% papel, 60% tijolo), gastando tudo                       | −5,57%     | +34,60%                   | 44,84%          |
| 100% tijolo, gastando tudo (precisou de uns 10% a mais de capital) | +8,37%     | +42,5%, bem menos volátil | 44,84%          |
| Mista retendo 25% dos proventos                                    | +21,60%    | +74,5%                    | 44,84%          |
| 100% tijolo retendo 25%                                            | +26,19%    | +66%                      | 44,84%          |

Lições da live:

- **Retenção:**
  - Na aposentadoria, reter de 20% a 25% dos proventos como margem de segurança contra inflação, pandemias e ciclos de juros. No estudo, 25% da renda era menos de 0,2% do patrimônio por mês e mudou o resultado.
  - Na acumulação, o rendimento inteiro volta para a carteira.
- **O DY do papel embute a correção monetária:**
  - Gastar todo o rendimento de um fundo de papel corrói o poder de compra.
  - O papel é ótimo na acumulação, porque o yield nominal alto acelera a recompra.
  - Na fruição, a mista 60/40 tijolo/papel aguenta bem com a regra de retenção.
  - Juros altos derrubam a cota do papel pela marcação a mercado.
- **Diversificação ingênua e seleção natural:** com uns 20 grandes FIIs em fatias iguais, se 10% derem problema, os outros 18 carregam a carteira. Não é preciso adivinhar o campeão.
- **Falácia do ponto final:** julgar pela trajetória, não pelo preço de hoje. Com juros altos, a cota cai na tela, mas a renda continua entrando.
- **Emissões:** em ciclos de juros altos, os FIIs permitem entrar em emissões a valor patrimonial, sem o ágio do mercado secundário (uma vantagem sobre o Tesouro IPCA+).
- **Estado de espírito:** investir deve trazer tranquilidade, não angústia.

**O que verifica no Koinos:**

- **Reinvestimento** (`reinvestment.ts`, % por mês, padrão 100%):
  - Na acumulação, reinvestir tudo; na fruição, nunca menos que 20% a 25%.
  - O Koinos não compara a renda com a inflação, porque não tem série do IPCA.
  - Uma fórmula de retirada (fruição) deveria ter a retenção embutida.
- **Tijolo × papel:** use a composição por macro do `snapshot`.
  - A trava de 60% por macro vale por aporte e não segura a composição; quem segura são as % do ranking.
  - Uma fórmula que premie DY puro empurra o aporte para o papel, cujo DY inclui inflação. Peça yield real ou trate o papel à parte.
- **Diversificação:**
  - Conte os FIIs da estratégia (o estudo usa uns 20) e veja se os pesos estão próximos.
  - A trava de 25% por FII por aporte ajuda.
  - Os FIIs fora da estratégia (legado) não entram na conta e podem concentrar o patrimônio; veja o alerta de concentração do `snapshot`.
- **Renda previsível:**
  - O freio de proventos (último ÷ média de 12 meses) pune o corte, mas não premia a constância.
  - A vacância entra só a física e só no tijolo.
- **P/VP:** o tensor de valuation compra mais o FII descontado. Em lajes corporativas, P/VP baixo pode ser vacância estrutural, e o freio de vacância compensa só em parte.
- **Bola de neve:** o número mágico do `snapshot` dá as cotas para o provento mensal comprar uma cota nova. Onde ele já foi atingido, o reinvestimento se paga sozinho.
- **Trajetória:** leia o `projetar` período a período, não só o fim.

**Sinais de alerta:** fórmula que persegue DY alto; FII de renda instável recebendo muito; poucos FIIs; reinvestimento abaixo de 20%; conclusão tirada só do ponto final.

**Dados que pediria:** IPCA; vacância financeira, prazo e índice de reajuste dos contratos, inquilinos; emissões abertas.

## 3. Warren Buffett: valor, qualidade, margem de segurança, caixa

**A lente:** comprar negócios excepcionais, com vantagem competitiva duradoura (o "fosso"), a preço justo e dentro do círculo de competência. É ser ganancioso quando os outros têm medo, fugir de dívida, guardar caixa para as oportunidades do pânico e reter por décadas, reinvestindo os lucros.

**O que verifica no Koinos:**

- **Qualidade × preço:**
  - Na cascata de FIIs, o ranking (a qualidade, pelo ranking) vem primeiro, e os tensores ajustam pelo preço. Isso é alinhado.
  - No smart buy de ações, a ordem é só a margem de segurança, e o rank só desempata. O motor compra primeiro a ação mais barata frente ao teto, não o melhor negócio: preço maravilhoso antes de empresa maravilhosa.
- **Margem de segurança:** só comprar abaixo do teto é bom, mas o teto é de terceiros, e a margem é tão boa quanto ele.
- **Contrarianismo com freio:**
  - Nos FIIs, o motor freia corte de provento e vacância.
  - Nas ações, não há freio nenhum: a que caiu por deterioração vira a de maior margem e é comprada primeiro.
- **Círculo de competência:** a tese é terceirizada para o ranking, e o Koinos não guarda por que cada ativo está na carteira.
- **Caixa e dívida:**
  - O Koinos investe tudo todo mês e não guarda reserva para o pânico.
  - Não há dado de alavancagem das empresas nem dos FIIs.
- **Concentração:** Buffett concentra nas melhores ideias; os pesos parecidos e a trava de 25% espalham o aporte.
- **Longo prazo:** nunca vender é alinhado.

**Sinais de alerta:** ordenar por "mais barato"; comprar o que cai sem saber por quê; ativo que ninguém sabe explicar; alavancagem.

**Dados que pediria:** ROE, margens, dívida líquida ÷ EBITDA e histórico de lucros das empresas; alavancagem dos FIIs.

## 4. Luiz Barsi: dividendos, setores perenes, carteira previdenciária

**A lente:** ser sócio de negócios reais para ter uma renda perpétua, a aposentadoria privada, sem especulação nem gráficos.

- **O que importa:** o dividend yield. Quedas gerais são promoções.
- **Setores:** os perenes do BEST (bancos, energia, saneamento, seguros e telecomunicações), com demanda contínua e proventos regulares.
- **Disciplina:** reinvestir 100% dos dividendos e nunca vender na baixa.
- **FIIs:** evita, por não controlar as decisões e por achar que o patrimônio se corrói.

**O que verifica no Koinos:**

- **O motor de ações olha dividendos?** Hoje não: nem DY, nem constância, nem payout, só a margem até o teto. Nessa lente, é a falha central do smart buy de ações.
- **Setores BEST:** classifique a lista de ações da Carteira Alvo (o `snapshot` lista). O Koinos não guarda setor de ação, então a classificação é sua e deve ser dita como tal.
- **DY contra a inflação:** ele pediria um filtro de DY histórico acima do IPCA, para descartar teses especulativas.
  - O Koinos não tem série do IPCA.
  - Só as ações já na carteira têm proventos gravados.
  - Um filtro desses precisa de dado novo, e isso é decisão de produto.
- **Previdência:**
  - Nunca vender: o Koinos não vende, o que é alinhado.
  - Reinvestir 100%: veja a % reinvestida por mês.
- **Quedas como promoção:** a margem de segurança e o P/VP fazem comprar mais na queda. Isso é alinhado, desde que o dividendo se mantenha, e é aí que falta o freio nas ações.
- **Contraponto aos FIIs:** ele questionaria a fatia de FIIs. Registre isso uma vez, com números, sem bloquear a avaliação:
  - FIIs com preço abaixo do preço médio (erosão);
  - o resultado com proventos;
  - o fato de o Koinos não medir a renda contra a inflação.

**Sinais de alerta:** ação sem histórico de dividendos; setor cíclico ou commodity; estatal; fórmula que compra pelo preço sem olhar a renda.

**Dados que pediria:** de 5 a 10 anos de dividendos por ação, payout e IPCA.

## 5. Tensões entre as lentes

Use-as na síntese e diga quanto cada lado custaria nesta carteira.

| Tensão                        | Um lado                                                        | O outro                                 |
| ----------------------------- | -------------------------------------------------------------- | --------------------------------------- |
| Investir tudo × guardar caixa | Tiago Reis: preço médio, aporte inteiro todo mês               | Buffett: caixa para o pânico            |
| Diversificar × concentrar     | Baroni: uns 20 FIIs em fatias iguais, seleção natural          | Buffett: concentrar nas melhores ideias |
| FIIs × só ações               | Baroni: o tijolo protege da inflação, e o estudo é o argumento | Barsi: FIIs corroem patrimônio          |
| Renda × qualidade             | Barsi: o DY manda                                              | Buffett: o fosso e o preço justo mandam |
| Papel na carteira             | Baroni: ótimo na acumulação, perigoso de gastar na fruição     | Barsi: renda real acima da inflação     |
