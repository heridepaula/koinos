# Koinos

Dashboard pessoal de FIIs que substitui a planilha. As posições saem dos lançamentos, as cotações vêm da B3 e o motor de aportes segue o método Suno: ranking até a % sugerida, só abaixo do preço teto, rebalanceando com aportes (nunca com vendas).

- **Dashboard:** patrimônio, L/P, DY 12 meses, alertas, evolução, aportes por mês, composição e posições.
- **Transações:** compras e vendas com filtros. Uma venda que quebra o histórico é recusada.
- **Carteira Alvo:** ranking Suno, preço teto, % sugerida e categoria, editados na própria tabela.
- **Recomendações:** "Quanto vou aportar hoje?" vira ordens de compra exatas, com o motivo de cada uma.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript 6 · Tailwind 4 + shadcn (Base UI) · MongoDB Atlas (Mongoose 9) · Better Auth (Google) com sessões no Redis · brapi.dev e Yahoo Finance · Vercel.

## Requisitos

- **Node.js 26** (versão do `.nvmrc`). A Vercel roda Node 24, e o projeto aceita os dois (`engines: >=24`).
  - No Windows, com o nvm-windows: `nvm install 26.12.0` e `nvm use 26.12.0`.
- Contas gratuitas: MongoDB Atlas, Redis Cloud, Google Cloud (login) e, se quiser, brapi.dev.

## Rodando localmente

```bash
npm ci
cp .env.example .env.local   # e preencha (tabela abaixo)
npm run dev                  # http://localhost:3000
```

| Variável                                    | O que é                                                                                                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                               | Conexão do Atlas, com o nome do banco no caminho (ex.: `/koinos`).                                                                                                               |
| `REDIS_URL`                                 | Redis das sessões e do rate limit.                                                                                                                                               |
| `BETTER_AUTH_SECRET`                        | 32+ caracteres aleatórios: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Também cifra as sessões no Redis: trocar o segredo desloga todo mundo. |
| `BETTER_AUTH_URL`                           | URL pública do app: `http://localhost:3000` em dev, `https://seu-dominio` em produção.                                                                                           |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Cliente OAuth do Google (veja abaixo).                                                                                                                                           |
| `ALLOWED_EMAILS`                            | E-mails que podem entrar, separados por vírgula. Qualquer outro é recusado, já no cadastro.                                                                                      |
| `BRAPI_TOKEN`                               | Opcional. Sem token, as cotações vêm da listagem em lote da brapi, e o que faltar vem do Yahoo.                                                                                  |
| `BRAPI_MONTHLY_QUOTA`                       | Cota mensal do seu plano da brapi (padrão 15000). Ao passar de 90%, o app usa só o Yahoo até o mês virar.                                                                        |
| `CRON_SECRET`                               | 16+ caracteres. Protege `/api/cron/daily`; obrigatório em produção.                                                                                                              |

### Login com Google

1. No Google Cloud Console, abra **Google Auth Platform** e configure o app com público **Externo**. Deixe em modo de teste e adicione o seu e-mail como usuário de teste: para uso pessoal, basta.
2. Em **Clientes → Criar cliente → Aplicativo da Web**, cadastre:
   - origens JavaScript: `http://localhost:3000` e `https://seu-dominio`;
   - URIs de redirecionamento: `http://localhost:3000/api/auth/callback/google` e `https://seu-dominio/api/auth/callback/google`.
3. Copie o ID e a chave secreta para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.

### MongoDB Atlas

- Crie um usuário de banco com leitura e escrita e uma senha forte.
- Em **Network Access**, libere `0.0.0.0/0`: a Vercel não tem IP fixo. A proteção fica na senha e no TLS do Atlas.
- Dica: use outro nome de banco no `.env.local` (ex.: `/koinos_dev`) para os testes não se misturarem aos dados reais.

### Redis

Use o Redis Cloud (plano gratuito) e copie a URL `redis://default:SENHA@host:porta`. O plano gratuito não tem TLS, por isso o app grava as sessões cifradas (AES-256-GCM), com as chaves embaralhadas (HMAC), e cada valor só abre na própria chave. Quem ler o Redis não vê tokens nem e-mails. Sem TLS, porém, a senha do Redis trafega em texto puro. Em produção, prefira um Redis com TLS (`rediss://`), como o Upstash, que a Vercel oferece como integração.

## Importando a planilha

1. Entre uma vez no app com o seu e-mail: isso cria o usuário.
2. Simule, sem gravar nada:

   ```bash
   npm run import:planilha -- --file "C:\caminho\FII's.xlsx" --dry-run
   ```

3. Importe:

   ```bash
   npm run import:planilha -- --file "C:\caminho\FII's.xlsx" --email voce@gmail.com
   ```

- Só entram os ativos com histórico consistente e quantidade final igual à da planilha. Os outros aparecem com o motivo (aba e linha).
- Depois de corrigir a planilha, rode de novo com `--replace`. Ele troca a importação anterior e não toca nos lançamentos feitos no app.
- A Carteira Alvo recebe o rank e o preço teto dos ativos importados (rank 99 fica fora da estratégia).
- O script grava no banco do `.env.local`. Para importar em produção, use o `MONGODB_URI` de produção.
- Planilhas nunca entram no Git: `*.xlsx` está no `.gitignore`.

## Scripts

| Comando                                   | O que faz                                                |
| ----------------------------------------- | -------------------------------------------------------- |
| `npm run dev`                             | Servidor de desenvolvimento.                             |
| `npm run build` / `npm start`             | Build e servidor de produção.                            |
| `npm run lint`                            | ESLint, incluindo as regras de fronteira entre features. |
| `npm run typecheck`                       | Tipos das rotas (`next typegen`) e `tsc`.                |
| `npm run format` / `npm run format:check` | Prettier.                                                |
| `npm run import:planilha`                 | Importador da planilha (acima).                          |

## Cotações e dados de mercado

- **Cotações:** brapi.dev primeiro (todos os fundos numa requisição só), com o Yahoo Finance de reserva.
- **Validade das cotações:** durante o pregão (10h às 18h30 de Brasília, já contando o atraso da brapi), uma cotação vale 30 minutos. Fora do pregão, vale a do último fechamento e não gasta cota. Feriados não são tratados.
- **Atualização:** as páginas atualizam em segundo plano o que estiver vencido, e o botão ao lado do horário força a atualização.
- **Histórico mensal e proventos** (DY 12 meses e último rendimento) vêm do Yahoo. Cada mês fechado é buscado uma vez; os proventos, no máximo a cada 20 horas.
- **Cron diário** (`vercel.json`, `0 22 * * 1-5`): às 19h de Brasília, nos dias úteis, atualiza fechamento, proventos, histórico e o catálogo de tickers.

## Arquitetura

Monólito modular por features em `src/features`: `auth`, `transactions`, `market-data`, `strategy`, `portfolio` e `smart-buy`. Cada feature tem pontos de entrada fixos:

- `index.ts`: domínio puro, tipos e schemas (servidor e navegador);
- `ui.ts`: componentes de cliente;
- `server.ts`: API só de servidor (DAL), que tira o usuário da sessão;
- `actions.ts`: Server Actions;
- `repo.ts`: acesso com `portfolioId` explícito, só para scripts (o lint bloqueia o uso no app).

O ESLint impede importar o interior de outra feature e mantém `domain/` puro. A especificação completa está em [`docs/superpowers/specs`](docs/superpowers/specs/2026-10-17-koinos-design.md), e o plano de implementação em [`docs/superpowers/plans`](docs/superpowers/plans/2026-10-17-koinos-mvp.md).

## Segurança

- Só entram os e-mails de `ALLOWED_EMAILS` que o Google confirma como verificados. A lista é checada no cadastro e em toda sessão.
- Toda consulta parte da sessão. O `Tenant` (usuário + carteira) só nasce nas funções de sessão; editar e excluir filtram por `_id` **e** carteira. As telas recebem DTOs sem ids internos.
- Server Actions validam a entrada com Zod e só devolvem mensagens seguras.
- As sessões ficam cifradas no Redis, e o login tem rate limit de 100 requisições por minuto.
- Há cabeçalhos de segurança: HSTS, X-Frame-Options, nosniff, Referrer-Policy e Permissions-Policy.
- `/api/cron/daily` exige o `CRON_SECRET` (comparado em tempo constante) e responde só contagens.
- Os segredos ficam no `.env.local` e nas variáveis da Vercel, nunca no Git.

## Deploy na Vercel

1. Importe o repositório na Vercel (framework Next.js). As Functions rodam em Node 24.x.
2. Em **Settings → Environment Variables**, cadastre as variáveis do `.env.example` com os valores de produção, incluindo `CRON_SECRET` e o `BETTER_AUTH_URL` com o domínio de produção do projeto (o que aparece em **Settings → Domains**, não os aliases `*-git-*` ou `*-projects.vercel.app`).
3. Adicione o domínio de produção ao cliente OAuth do Google (origem e redirecionamento).
4. O cron já vem no `vercel.json`. Quando `CRON_SECRET` existe, a Vercel envia `Authorization: Bearer <CRON_SECRET>` sozinha. No plano Hobby, o cron roda uma vez por dia, em algum momento dentro da hora agendada.
5. Publique, entre com o seu e-mail e importe a planilha apontando para o banco de produção.

A configuração também fixa três escolhas:

- **Região `gru1` (São Paulo):** as Functions rodam ao lado do cluster do Atlas (`sa-east-1`), em vez de Washington.
- **Domínio único:** em produção, uma página aberta por outro endereço `*.vercel.app` redireciona para o domínio do `BETTER_AUTH_URL`, o único onde o login funciona (`next.config.ts`). As rotas `/api` ficam de fora: o cron chama um endereço `*.vercel.app` e não segue redirects.
- **Deploy só da `main`:** outros branches não geram preview. Num preview, o login não funcionaria (o `BETTER_AUTH_URL` é o domínio de produção) e o banco seria o de produção. O CI já valida cada push.

## CI

O GitHub Actions (`.github/workflows/ci.yml`) roda a cada push, em Node 24 e 26:

- Prettier, ESLint, checagem de tipos e build;
- `npm audit` das dependências de produção.

O build usa variáveis fictícias, sem acesso a banco ou serviços externos. O audit ignora as devDependencies: a CLI do shadcn, usada só para gerar componentes, depende do `braces`, que tem um alerta ainda sem correção.

## Licença

[MIT](LICENSE).
