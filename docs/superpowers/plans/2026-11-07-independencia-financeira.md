# Independência financeira Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Meta de independência financeira (questionário de 5 passos, meta, progresso e prazo) em `/independencia`, com um card mínimo no Dashboard. Spec: `docs/superpowers/specs/2026-11-07-independencia-financeira-design.md`.

**Architecture:** Nova feature `src/features/independence`, com `domain/` puro (catálogo, meta, prazo, PMT) testado no Vitest, um model e um repo Mongoose (`independence_plans`), uma Server Action, a view DAL `getIndependenceView` (snapshot Geral + `reinvestmentHistory`) e os componentes client e server. A página de topo entra em `nav-items.ts` e no `proxy.ts`.

**Tech Stack:** Next 16 (cacheComponents), React 19, Mongoose, next-safe-action 8, Zod 4, Base UI/shadcn base-nova, Tailwind 4, Vitest.

---

## File map

| Arquivo | Responsabilidade |
| --- | --- |
| `src/features/independence/domain/catalog.ts` | Perguntas, opções, R$ sugeridos, padrões, `defaultPlan()` |
| `src/features/independence/domain/plan.ts` | `monthlyNeed`, `grossIncome`, `portfolioYield`, `monthsToTarget`, `targetMonthKey`, `durationLabel`, `independenceSummary` |
| `src/features/independence/domain/aporte.ts` | `cashSales`, `averageMonthlyAporte`, `closedMonths` |
| `src/features/independence/domain/types.ts` | `IndependencePlan`, `PlanAnswers`, `IndependenceSummary`, `IndependenceView` |
| `src/features/independence/domain/*.test.ts` | Testes da spec §6 |
| `src/features/independence/index.ts` | API pura |
| `src/features/independence/schemas.ts` | Zod do plano |
| `src/features/independence/server/plan.model.ts`, `plan-repo.ts` | Coleção `independence_plans` |
| `src/features/independence/server/independence-view.ts`, `server.ts` | `getIndependenceView` |
| `src/features/independence/actions.ts` | `saveIndependencePlanAction` |
| `src/features/independence/components/*` | `ProgressBar`, `ChoiceList`, `IndependenceWizard`, `IndependencePanel`, `ProgressCard`, `TargetBreakdown`, `ForecastCard`, `IndependenceCard` |
| `src/features/independence/ui.ts` | Barrel client |
| `src/app/(app)/independencia/page.tsx` | Página |
| `src/app/(app)/dashboard/page.tsx` | Card na visão Geral |
| `src/shared/components/nav-items.ts`, `src/proxy.ts` | Menu e matcher |
| `CLAUDE.md` | Docs |

## Task 1: Domínio puro com testes

**Goal:** Funções puras da spec §2, com os testes de §6 passando.

**Files:** Create `domain/catalog.ts`, `domain/plan.ts`, `domain/aporte.ts`, `domain/types.ts`, `domain/plan.test.ts`, `domain/aporte.test.ts`, `domain/catalog.test.ts` e `index.ts`.

**Acceptance Criteria:**
- [ ] O exemplo de §2.2 dá R$ 1.785.714,29, e o de §2.3 dá 118 meses.
- [ ] Yield fora de 0,2–1,5% a.m., com patrimônio 0 ou sem proventos usa 0,6% a.m. com `source: "padrao"`.
- [ ] `monthsToTarget`: 0 quando PV ≥ FV, `(FV−PV)/PMT` com r = 0, `null` sem crescimento.
- [ ] PMT: 6 meses fechados, vendas abatem, piso 0 só na média.
- [ ] As retenções do catálogo são `[MIN_RETENTION, DEFAULT_RETENTION, 0.3]`, com o padrão `DEFAULT_RETENTION`.

**Verify:** `npx vitest run src/features/independence` → todos passam.

**Steps:** escrever os testes (TDD), rodar e ver falhar, implementar, rodar e ver passar, commit `feat(independence): add the pure target, forecast and aporte rules`.

## Task 2: Persistência, view e action

**Goal:** Salvar e ler o plano do tenant e montar o DTO da view.

**Files:** Create `schemas.ts`, `server/plan.model.ts`, `server/plan-repo.ts`, `server/independence-view.ts`, `server.ts` e `actions.ts`.

**Acceptance Criteria:**
- [ ] O plano é salvo por upsert em `{ portfolioId }` (índice único), e todo filtro usa `portfolioId`.
- [ ] A action tem `.metadata({ actionName: "saveIndependencePlan" })` e valida com Zod (R$ de 0 a 1.000.000, pessoas inteiras de 1 a 10, retenção nas opções, chaves do catálogo); chama `refresh()`.
- [ ] `getIndependenceView` passa por `getTenant`, tem o span `view.independence` com `koinos.independence.has_plan` e devolve um DTO sem ids.

**Verify:** `npm run typecheck && npm run lint` → sem erros.

## Task 3: Interface

**Goal:** A página `/independencia` (questionário, ou os três cards) e o card do Dashboard.

**Files:** Create os componentes, `ui.ts` e `src/app/(app)/independencia/page.tsx`; Modify `dashboard/page.tsx`, `nav-items.ts` e `proxy.ts`.

**Acceptance Criteria:**
- [ ] Sem plano, a página mostra o questionário com 5 passos e um resumo, e Salvar grava o plano e mostra os cards.
- [ ] Com plano, mostra os cards de progresso, de "como chegamos" e de prazo, mais "Refazer questionário", que reabre os passos preenchidos.
- [ ] O Dashboard Geral mostra o card mínimo (%, barra e prazo), ou "Definir meta →", com link para `/independencia`.
- [ ] Todo R$ fica em `Sensitive`; a barra tem `role="progressbar"`; as escolhas são radios com setas e 44 px no toque.
- [ ] O menu tem "Independência" e o `proxy.ts` tem `/independencia/:path*`.

**Verify:** `npm run build` (com env) e a página aberta no dev server.

## Task 4: Docs e verificação final

**Goal:** CLAUDE.md descreve a feature, e todos os checks passam.

**Files:** Modify `CLAUDE.md`.

**Verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`.
