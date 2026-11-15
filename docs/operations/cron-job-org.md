# Jobs agendados no cron-job.org

O cron-job.org é o único agendador. Não há `crons` no `vercel.json`. Todas as rotas `/api/cron/*` aceitam **só HTTP Basic**, com o usuário fixo `cron` e a senha `CRON_BASIC_PASSWORD`. O job roda dentro da requisição e uma falha vira 500, então o cron-job.org marca a execução como falha.

O cron-job.org corta a requisição em **30 segundos** ([FAQ](https://cron-job.org/faq/)). Se um job passar disso, divida-o em etapas. A casca comum de todas as rotas é `src/app/api/cron/job.ts`: autenticação, span `cron.<nome>`, `api.usage` e resposta sem cache.

## Variável

`CRON_BASIC_PASSWORD` (24+ caracteres), no `.env.local` e na Vercel (Production, Sensitive). Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Variável nova só vale no próximo deploy.

## Os jobs (fuso America/Sao_Paulo)

| Título                             | URL                                                     | Quando                                                             |
| ---------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| `Koinos – Atualização diária`      | `https://koinos-sooty.vercel.app/api/cron/daily`        | seg a sex, 19:00                                                   |
| `Koinos – Fundamentos (VP e P/VP)` | `https://koinos-sooty.vercel.app/api/cron/fundamentals` | todo dia, 02:00                                                    |
| `Koinos – Resumo da IA`            | `https://koinos-sooty.vercel.app/api/cron/day-insights` | seg a sex, a cada 30 min das 10:00 às 20:00 (`*/30 10-20 * * 1-5`) |
| `Koinos – Radar de fundamentos`    | `https://koinos-sooty.vercel.app/api/cron/radar`        | todo dia, a cada 15 min das 03:00 às 06:45 (`*/15 3-6 * * *`)      |
| `Koinos – Notícias`                | `https://koinos-sooty.vercel.app/api/cron/news`         | todo dia, a cada 30 min das 07:00 às 22:30 (`*/30 7-22 * * *`)     |

O resumo da IA cobre até 20:00 porque a regra de nova tentativa do domínio vai até 20:00. O resumo da IA e o Radar precisam de `GEMINI_API_KEY` na Vercel (Production, Sensitive); sem ela, as duas rotas respondem `"status": "off"`. A regra de horários (de manhã até 12:00, depois das 18:00 às 20:00) fica no domínio, então uma chamada entre 12:00 e 18:00 só responde contagens zeradas, sem gastar cota. Cada chamada do resumo processa no máximo 3 ativos. Cada chamada do Radar lê até 6 páginas `detalhes.php` do Fundamentus (as mais antigas primeiro) e depois gera até 6 textos em 25 s; o que sobra fica para a chamada seguinte.

O job de notícias lê os feeds RSS de Suno, fiis.com.br, InfoMoney e Money Times (cada um traz só 10 itens, por isso de 30 em 30 min) e até 4 feeds de empresa da InfoMoney por chamada, e guarda as notícias dos ativos acompanhados e do cenário por 14 dias. No pregão, também atualiza o Ibovespa e o IFIX. Depois da coleta, gera o resumo da semana dos ativos da Carteira Alvo com o Gemini (até 4 por chamada, só quando as notícias da semana do ativo mudam), no mesmo prazo de 25 s. Sem `GEMINI_API_KEY`, só grava os ativos sem notícias.

Nos cinco: método GET, autenticação HTTP ligada (usuário `cron` e a senha), timeout 30 s, salvar respostas, redirecionamento como sucesso desligado, notificações de falha ligadas.

## Testar

```bash
curl -i -u "cron:$CRON_BASIC_PASSWORD" https://koinos-sooty.vercel.app/api/cron/fundamentals
```

Espere 200 com as contagens. Executa o job de verdade. No PowerShell, use `curl.exe`. Sem a senha certa, a rota responde 401.

## Antes do deploy que tira o `crons` do `vercel.json`

Os jobs `daily` e `fundamentals` já rodavam pelos dois agendadores, e o Vercel Cron não envia mais nada. Antes de subir:

1. Confirme em cada um dos cinco jobs que a autenticação é **HTTP Basic** (usuário `cron`). Um job com cabeçalho `Authorization: Bearer` manual vai receber 401 depois do deploy.
2. Cadastre o `Koinos – Resumo da IA`, que ainda não aparece na lista de jobs.
3. Rode "Test run" de cada um e confira o 200.
