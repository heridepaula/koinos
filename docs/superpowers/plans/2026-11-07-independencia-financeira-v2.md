# Independência financeira v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar as regras da v1 pelas da spec `2026-11-07-independencia-financeira-v2-design.md`: meta perpétua a 0,4% a.m., saúde em degraus por faixa etária, fundo temporário depois da idade alvo, prazo com idade prevista, folga ou aporte necessário, e o plano v1 como rascunho.

**Architecture:** Mesma feature `independence`. O `domain/` ganha `constants.ts`, `health.ts` e `migrate.ts`, e `plan.ts` é reescrito. O repo lê o documento cru e devolve `{ plan, draft }`; salvar substitui o documento com `version: 2`. Os componentes são o questionário de 7 passos, os 4 cards (com a rosca sob demanda) e a linha do Dashboard com "Atualizar meta".

**Tech Stack:** Next 16, React 19, Mongoose, next-safe-action 8, Zod 4, Recharts, Vitest.

---

## Task 1: Domínio v2 com testes
- [ ] `constants.ts`, `health.ts`, `types.ts`, `catalog.ts`, `migrate.ts` e `plan.ts` (spec §2).
- [ ] Testes: `health.test.ts`, `plan.test.ts` (o exemplo de §2.6), `migrate.test.ts` e `catalog.test.ts`.
- **Verify:** `npx vitest run src/features/independence`.

## Task 2: Servidor
- [ ] `schemas.ts` (Zod v2), `plan.model.ts` (`version: 2`), `plan-repo.ts` (`{ plan, draft }`, `replaceOne`) e `independence-view.ts` (`draft`, `koinosWealth`).
- **Verify:** `npm run typecheck`; ler o documento v1 de produção pelo repo, só leitura.

## Task 3: Interface
- [ ] O questionário de 7 passos, `ProgressCard`, `ForecastCard`, `TargetSplit` com `SplitDonut` (dinâmico), `TargetBreakdown` e a linha do Dashboard com `needsUpdate`.
- **Verify:** `npm run build`.

## Task 4: Docs e checks
- [ ] `CLAUDE.md`.
- **Verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`.
