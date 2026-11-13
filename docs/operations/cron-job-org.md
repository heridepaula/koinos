# Jobs agendados no cron-job.org

As rotas são as de sempre, `/api/cron/daily` e `/api/cron/fundamentals`. Elas aceitam `Bearer CRON_SECRET` (Vercel Cron) ou **HTTP Basic** com o usuário fixo `cron` e a senha `CRON_BASIC_PASSWORD` (cron-job.org). O job roda dentro da requisição e uma falha vira 500, então o cron-job.org marca a execução como falha.

O cron-job.org corta a requisição em **30 segundos** ([FAQ](https://cron-job.org/faq/)). Se o job diário passar disso, divida-o em etapas.

## Variável

`CRON_BASIC_PASSWORD` (24+ caracteres), no `.env.local` e na Vercel (Production, Sensitive). Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Variável nova só vale no próximo deploy.

## Os jobs (fuso America/Sao_Paulo)

| Título                             | URL                                                     | Quando                                                             |
| ---------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| `Koinos – Atualização diária`      | `https://koinos-sooty.vercel.app/api/cron/daily`        | seg a sex, 19:00                                                   |
| `Koinos – Fundamentos (VP e P/VP)` | `https://koinos-sooty.vercel.app/api/cron/fundamentals` | todo dia, 02:00                                                    |
| `Koinos – Resumo da IA`            | `https://koinos-sooty.vercel.app/api/cron/day-insights` | seg a sex, a cada 30 min das 10:00 às 19:30 (`*/30 10-19 * * 1-5`) |
| `Koinos – Radar de fundamentos`    | `https://koinos-sooty.vercel.app/api/cron/radar`        | todo dia, a cada 15 min das 03:00 às 06:45 (`*/15 3-6 * * *`)      |
| `Koinos – Notícias`                | `https://koinos-sooty.vercel.app/api/cron/news`         | todo dia, a cada 30 min das 07:00 às 22:30 (`*/30 7-22 * * *`)     |

O resumo da IA e o Radar de fundamentos precisam de `GEMINI_API_KEY` na Vercel (Production, Sensitive); sem ela, as duas rotas respondem `"status": "off"`. A regra de horários (de manhã até 12:00, depois das 18:00 às 20:00) fica no domínio, então uma chamada entre 12:00 e 18:00 só responde contagens zeradas, sem gastar cota. Cada chamada do resumo processa no máximo 3 ativos. Cada chamada do Radar lê até 6 páginas `detalhes.php` do Fundamentus (as mais antigas primeiro) e depois gera até 6 textos em 25 s; o que sobra fica para a chamada seguinte.

O job de notícias lê os feeds RSS de Suno, fiis.com.br, InfoMoney e Money Times (cada um traz só 10 itens, por isso de 30 em 30 min) e até 4 feeds de empresa da InfoMoney por chamada, e guarda as notícias dos ativos acompanhados e do cenário por 14 dias. No pregão, também atualiza o Ibovespa e o IFIX. Depois da coleta, gera o resumo da semana dos ativos da Carteira Alvo com o Gemini (até 4 por chamada, só quando as notícias da semana do ativo mudam; ~10–20 chamadas por dia), no mesmo prazo de 25 s. Sem `GEMINI_API_KEY`, só grava os ativos sem notícias.

Nos cinco: método GET, autenticação HTTP ligada (usuário `cron` e a senha), timeout 30 s, salvar respostas, redirecionamento como sucesso desligado, notificações de falha ligadas.

## Testar

```bash
curl -i -u "cron:$CRON_BASIC_PASSWORD" https://koinos-sooty.vercel.app/api/cron/fundamentals
```

Espere 200 com as contagens. Executa o job de verdade. No PowerShell, use `curl.exe`.

## Migração

1. Cadastre a variável na Vercel (Production) e publique.
2. Crie os jobs, rode "Test run" e confira o 200.
3. Só então tire o bloco `crons` do `vercel.json`. Com os dois ligados, a rotina roda duas vezes: é inofensivo, mas gasta cota.
