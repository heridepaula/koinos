# Koinos

Dashboard pessoal de FIIs que substitui a planilha. As posições saem dos lançamentos, as cotações vêm da B3 e o motor de aportes segue o método Suno: ranking até a % sugerida, só abaixo do preço teto, rebalanceando com aportes (nunca com vendas).

- **Dashboard:** patrimônio, L/P, proventos recebidos e o resultado com proventos, DY 12 meses, alertas, evolução, aportes por mês, composição e posições.
- **Posições encerradas:** os FIIs com posição zerada, com o custo pelo preço médio, o vendido, o resultado e o IR estimado (20% do lucro de cada um, sem compensar prejuízos). Tem menu próprio (`/encerradas`), com o IR no subitem **IR estimado** (`/encerradas/ir`).
- **Transações:** compras e vendas com filtros e paginação. Uma venda que quebra o histórico é recusada.
- **Proventos:** recebido, a receber (pela lista da B3, completada pelo Yahoo) e total do mês, e o histórico por mês (uma matriz ano × mês; clicar num mês mostra os FIIs), ano ou papel. O subitem **Reinvestimento** (`/proventos/reinvestimento`) divide o aporte de cada mês entre proventos reinvestidos e dinheiro do bolso.
- **Atualização da B3:** os três extratos da Área do Investidor (Negociação, Movimentação e Eventos), com a prévia do que é novo e das inconsistências. Só grava o que mudou.
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

| Variável                                    | O que é                                                                                                                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                               | Conexão do Atlas, com o nome do banco no caminho (ex.: `/koinos`).                                                                                                                             |
| `REDIS_URL`                                 | Redis das sessões e do rate limit.                                                                                                                                                             |
| `BETTER_AUTH_SECRET`                        | 32+ caracteres aleatórios: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Também cifra as sessões no Redis: trocar o segredo desloga todo mundo.               |
| `BETTER_AUTH_URL`                           | URL pública do app: `http://localhost:3000` em dev, `https://seu-dominio` em produção.                                                                                                         |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Cliente OAuth do Google (veja abaixo).                                                                                                                                                         |
| `ALLOWED_EMAILS`                            | Só para desenvolvimento local: e-mails que podem entrar, separados por vírgula. Em produção fica sem valor, e quem entra é definido pelos usuários de teste do app OAuth no console do Google. |
| `BRAPI_TOKEN`                               | Opcional. Sem token, as cotações vêm da listagem em lote da brapi, e o que faltar vem do Yahoo.                                                                                                |
| `BRAPI_MONTHLY_QUOTA`                       | Cota mensal do seu plano da brapi (padrão 15000). Ao passar de 90%, o app usa só o Yahoo até o mês virar.                                                                                      |
| `CRON_SECRET`                               | 16+ caracteres. Protege `/api/cron/daily`; obrigatório em produção.                                                                                                                            |
| `OTEL_EXPORTER_OTLP_ENDPOINT`               | Opcional. Para onde vão os traces do APM (em produção, a New Relic: `https://otlp.nr-data.net:4318`). Sem ele, nada sai do servidor.                                                           |
| `OTEL_EXPORTER_OTLP_HEADERS`                | Opcional. Cabeçalho do envio, no formato `api-key=<chave de ingestão>`. É segredo: na Vercel, marque como Sensitive.                                                                           |

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

## Atualizando pela B3

Na Área do Investidor da B3, em Extratos, baixe em Excel os três extratos do mesmo dia: **Negociação**, **Movimentação** e **Eventos** (a aba Proventos a Receber). Envie os três na página **Atualização B3** (`/atualizacao-b3`).

- **Só com os três:** com um ou dois arquivos, a página diz qual extrato falta e não grava nada. A planilha não é mais aceita ali.
- **Prévia:** para lançamentos, proventos recebidos e a receber, ela mostra o que é novo, o que a B3 substitui (a linha gravada e a do extrato) e o que já está igual. Também lista as inconsistências e o que fica de fora.
- **Só o que é novo:** o que já está gravado igual fica como está, com o mesmo id. Reenviar os mesmos arquivos dá "Nada novo".
- **A B3 tem prioridade:** no período dos extratos, onde o extrato diverge do que está gravado, vale o extrato.
- **A receber:** a lista do extrato de Eventos vira a foto do "a receber" em Proventos, com a data oficial de pagamento. Cada envio troca a foto inteira, e o Yahoo só completa com o que foi anunciado depois do envio.
- **Regras completas:** [spec da atualização](docs/superpowers/specs/2026-10-23-atualizacao-b3-design.md).

O script abaixo é a ferramenta de terminal da carga inicial. Ele lê Negociação e Movimentação, desde 11/2019, com a planilha como complemento, e usa o mesmo plano da página.

```bash
npm run import:b3 -- --negociacao negociacao.xlsx --movimentacao movimentacao.xlsx --planilha "FII's.xlsx" --dry-run
npm run import:b3 -- --negociacao negociacao.xlsx --movimentacao movimentacao.xlsx --planilha "FII's.xlsx" --email voce@gmail.com --respostas respostas.json --alvo
```

- **O que o dry-run mostra:**
  - a situação de cada FII;
  - as pendências: preços que nem a B3 nem a planilha informam, posições anteriores a nov/2019 e conversões a confirmar;
  - a conferência da posição pelos rendimentos que a B3 pagou.
- **Respostas:** o `respostas.json` responde as pendências pelos ids que o dry-run mostra. O formato está no topo de `scripts/import-b3.ts`.
- **Quando grava:** só sem pendência aberta e sem divergência inexplicada na conferência.
- **A B3 manda:** no período dos extratos, os lançamentos de FII dão lugar aos do extrato. Os lançamentos B3 ficam travados em Transações; para corrigir, rode de novo.
- **Proventos:** os créditos de Rendimento e Reembolso de FIIs do extrato de Movimentação vão para a coleção `dividends`. No período do extrato, eles são trocados FII por FII, na mesma transação dos lançamentos. Proventos de ações, JCP e o aluguel de cotas ficam de fora.
- **Preços de subscrição:** os que vieram da planilha num envio anterior valem como resposta. Por isso a página não pede a planilha.
- **`--alvo`:** preenche a Carteira Alvo com o rank e o preço teto da planilha.
- **Regras completas:** [spec da importação](docs/superpowers/specs/2026-10-18-importacao-b3-design.md).

## Scripts

| Comando                                   | O que faz                                                |
| ----------------------------------------- | -------------------------------------------------------- |
| `npm run dev`                             | Servidor de desenvolvimento.                             |
| `npm run build` / `npm start`             | Build e servidor de produção.                            |
| `npm run lint`                            | ESLint, incluindo as regras de fronteira entre features. |
| `npm run typecheck`                       | Tipos das rotas (`next typegen`) e `tsc`.                |
| `npm run format` / `npm run format:check` | Prettier.                                                |
| `npm run import:planilha`                 | Importador da planilha (acima).                          |
| `npm run import:b3`                       | Carga dos extratos da B3 pelo terminal (acima).          |

## Cotações e dados de mercado

- **Cotações:** brapi.dev primeiro (todos os fundos numa requisição só), com o Yahoo Finance de reserva.
- **Validade das cotações:** durante o pregão (10h às 18h30 de Brasília, já contando o atraso da brapi), uma cotação vale 30 minutos. Fora do pregão, vale a do último fechamento e não gasta cota. Feriados não são tratados.
- **Atualização:** as páginas atualizam em segundo plano o que estiver vencido, e o botão ao lado do horário força a atualização.
- **Histórico mensal e proventos** (DY 12 meses, último rendimento e os anúncios dos últimos 90 dias) vêm do Yahoo. Cada mês fechado é buscado uma vez; os proventos, no máximo a cada 20 horas.
- **Proventos da B3:** os recebidos vêm só do extrato de Movimentação, e o "a receber" vem do extrato de Eventos. Os anúncios do Yahoo completam o "a receber" com o que saiu depois do último envio (ou tudo, se o Eventos nunca foi enviado).
- **Cron diário** (`vercel.json`, `0 22 * * 1-5`): às 19h de Brasília, nos dias úteis, atualiza fechamento, proventos, histórico e o catálogo de tickers.

## Arquitetura

Monólito modular por features em `src/features`: `auth`, `transactions`, `market-data`, `strategy`, `portfolio` e `smart-buy`. Cada feature tem pontos de entrada fixos:

- `index.ts`: domínio puro, tipos e schemas (servidor e navegador);
- `ui.ts`: componentes de cliente;
- `server.ts`: API só de servidor (DAL), que tira o usuário da sessão;
- `actions.ts`: Server Actions;
- `repo.ts`: acesso com `portfolioId` explícito, só para scripts (o lint bloqueia o uso no app).

O ESLint impede importar o interior de outra feature e mantém `domain/` puro. A especificação completa está em [`docs/superpowers/specs`](docs/superpowers/specs/2026-10-17-koinos-design.md), e o plano de implementação em [`docs/superpowers/plans`](docs/superpowers/plans/2026-10-17-koinos-mvp.md).

## Observabilidade (APM)

O app manda traces OpenTelemetry (`@vercel/otel`) para a New Relic: os Web Vitals do navegador, as requisições, os carregadores de cada tela, as Server Actions, a atualização B3, o MongoDB, o Redis e as travas, a brapi, o Yahoo e o Google, cada etapa do cron diário e os erros que o Next captura. Sem `OTEL_EXPORTER_OTLP_ENDPOINT`, nada sai do servidor.

- **Privacidade:** as URLs vão sem query string, as queries do MongoDB sem os valores, o Redis só com o nome do comando, as mensagens de erro sem números nem e-mails, e das entradas das actions só o ticker, o tipo e o mês.
- **Dashboard e alertas:** importe [`docs/observability/new-relic-dashboard.json`](docs/observability/new-relic-dashboard.json) (10 páginas) seguindo [o guia](docs/observability/new-relic.md), que também traz a análise de cobertura e os alertas sugeridos (brapi lenta, cron que não rodou, falhas, página lenta).
- **Desligar:** `OTEL_SDK_DISABLED=true`, no próximo deploy.

## Segurança

- Só entram e-mails que o Google confirma como verificados. Em produção, o console do Google (usuários de teste do app OAuth) define quem passa. Localmente, `ALLOWED_EMAILS` restringe ainda mais, no cadastro e em toda sessão.
- A sessão expira depois de 1 hora sem uso. Cada interação no navegador renova o prazo.
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
