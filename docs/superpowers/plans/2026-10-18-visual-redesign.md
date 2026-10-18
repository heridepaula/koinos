# Redesign visual "Pro híbrido": plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao Koinos a cara de app da Apple escolhida pelo usuário: papel de parede médio, vidro forte na navegação, cards foscos com borda de luz, titânio nos destaques, azulejos no menu e os 4 efeitos, nos temas claro e escuro.

**Architecture:**
- **Materiais em um lugar só:** são tokens CSS e utilitários do Tailwind 4 (`@utility`) em `globals.css`, e os componentes só aplicam as classes.
- **Camadas por variável:** os materiais compostos (brilho do cursor, escovado, fundo denso) mexem só em variáveis CSS. Por isso não brigam pela ordem das classes.
- **Efeitos:** o brilho do cursor vem de um único ouvinte de `pointermove`. A entrada das telas usa o `<ViewTransition>` do React 19.3 num `template.tsx`.
- **Movimento reduzido:** tudo respeita `prefers-reduced-motion`.

**Tech Stack:** Next.js 16.4 (App Router, Cache Components), React 19.3 (`ViewTransition`), Tailwind 4.3 (`@utility`), shadcn base-nova (Base UI), Playwright (msedge) para a conferência.

**Spec:** `docs/superpowers/specs/2026-10-18-visual-redesign-design.md`.

**Sem testes automatizados** (decisão do usuário). Cada tarefa se verifica com `npx tsc --noEmit`, `npm run lint` e `npm run build`. A Tarefa 5 confere a tela com screenshots e um script de contraste num banco de prévia isolado.

---

## Arquivos

| Arquivo | Ação | Responsabilidade |
| --- | --- | --- |
| `src/app/globals.css` | alterar | Tokens (claro e escuro) e utilitários: `glass-strong`, `card-surface`, `brushed`, `card-lift`, `metal-ring`, `btn-gloss`, `tile`, `knob-metal`. Também as animações de entrada, a queda sem `backdrop-filter` e o movimento reduzido |
| `src/shared/ui/card.tsx` | alterar | Card com `card-surface` e `data-glow` |
| `src/shared/ui/button.tsx` | alterar | `default` com brilho e aro de titânio; toque macio |
| `src/shared/ui/switch.tsx` | alterar | Trilho verde do iOS e knob de metal |
| `src/shared/ui/sidebar.tsx` | alterar | Variante flutuante com vidro forte e raio de 18 px |
| `src/shared/components/app-sidebar.tsx` | alterar | Azulejos, ícone do app e item ativo com titânio |
| `src/shared/components/pointer-glow.tsx` | criar | Brilho que segue o cursor (um ouvinte só) |
| `src/app/(app)/layout.tsx` | alterar | Toolbar com vidro forte e `PointerGlow` |
| `src/app/(app)/template.tsx` | criar | `<ViewTransition>` da entrada das telas |
| `src/features/portfolio/components/summary-cards.tsx` | alterar | Card do patrimônio escovado com aro; cards de número com elevação |
| `src/features/smart-buy/components/aporte-calculator.tsx` | alterar | Cards Aporte, Ordens e Sobra com elevação |

---

### Task 1: Materiais e tokens

**Goal:** `globals.css` com os tokens dos dois temas e os utilitários dos materiais, sem mexer ainda em nenhum componente.

**Files:**
- Modify: `src/app/globals.css`

**Acceptance Criteria:**
- [ ] Tokens do papel de parede médio, vidro forte, card fosco, titânio, botão com brilho, azulejos e chave verde, nos dois temas
- [ ] Utilitários `glass-strong`, `card-surface`, `brushed`, `card-lift`, `metal-ring`, `btn-gloss`, `tile` e `knob-metal`
- [ ] Card com tabela usa o fundo denso; textos secundários da sidebar usam `--sidebar-muted`
- [ ] Animações `page-enter`/`page-exit`; `::view-transition` sem capturar o ponteiro; movimento reduzido zera as animações
- [ ] Sem `backdrop-filter`, os materiais viram fundos sólidos
- [ ] Os tokens `--icon-*` e a regra antiga de sombra do card saem
- [ ] Só `backdrop-filter` no fonte (sem `-webkit-`): com os dois, o Lightning CSS deixava só o `-webkit-`, que o Chrome e o Edge ignoram. O CSS gerado precisa ter os dois
- [ ] `npm run -s build` passa (o Tailwind compila os `@utility`)

**Verify:** `npx tsc --noEmit && npm run -s lint && npm run -s build` → sem erros

**Steps:**

- [ ] **Step 1: Trocar o comentário e os tokens do `:root`**

O comentário antes do `:root` passa a ser:

```css
/*
 * Tema "Pro híbrido" (macOS e iOS): cores de sistema da Apple, papel de parede com manchas de cor,
 * vidro forte na navegação (sidebar e toolbar), cards foscos com borda de luz e titânio só nos
 * destaques. Spec: docs/superpowers/specs/2026-10-18-visual-redesign-design.md.
 */
```

No `:root`, mudam estes valores (o resto fica igual):

```css
  --background: #eef1fb;
  /* Sólido que imita o card denso das tabelas: é o fundo das colunas fixas. */
  --card: #f8f9fe;
  /* Mais escuro que o secondaryLabel da Apple: o texto secundário também fica sobre o papel de parede. */
  --muted-foreground: #545458;
  /* Verde acessível: 4,5:1 sobre o card fosco. */
  --gain: #1d7a33;
```

No `:root`, o bloco que começa em `/* Liquid Glass */` e vai até `--icon-purple` é trocado por:

```css
  /* Vidro dos menus, popovers e faixas. */
  --glass-tint: rgb(255 255 255 / 0.62);
  --glass-border: rgb(255 255 255 / 0.7);
  --glass-edge: rgb(0 0 0 / 0.08);
  --glass-highlight: rgb(255 255 255 / 0.9);
  /* Vidro forte: sidebar e toolbar. */
  --glass-strong-tint: rgb(255 255 255 / 0.34);
  --glass-strong-border: rgb(255 255 255 / 0.65);
  --glass-strong-highlight: rgb(255 255 255 / 0.9);
  --glass-strong-shadow: 0 12px 32px rgb(30 40 100 / 0.2);
  --glass-sheen: rgb(255 255 255 / 0.5);
  --sidebar-muted: #48484d;
  /* Card fosco com borda de luz. */
  --card-fill: rgb(255 255 255 / 0.84);
  --card-fill-dense: rgb(255 255 255 / 0.94);
  --card-fill-brushed: rgb(255 255 255 / 0.86);
  --card-rim: linear-gradient(
    160deg,
    #ffffff,
    rgb(255 255 255 / 0.25) 40%,
    rgb(110 120 170 / 0.4)
  );
  --card-rim-hover: linear-gradient(
    160deg,
    #ffffff,
    rgb(255 255 255 / 0.5) 40%,
    rgb(110 120 170 / 0.6)
  );
  --card-shadow:
    inset 0 1px 0 #ffffff, 0 1px 1px rgb(0 0 0 / 0.04), 0 8px 22px rgb(30 40 100 / 0.14);
  --card-shadow-lifted:
    inset 0 1px 0 #ffffff, 0 2px 4px rgb(0 0 0 / 0.05), 0 14px 32px rgb(30 40 100 / 0.2);
  --glow-color: rgb(255 255 255 / 0.5);
  /* Titânio. */
  --metal: linear-gradient(
    135deg,
    #ffffff 0%,
    #9b9ca3 22%,
    #f4f4f7 42%,
    #6f7077 62%,
    #dcdce1 82%,
    #ffffff 100%
  );
  --brush-light: rgb(255 255 255 / 0.07);
  --brush-dark: rgb(0 0 0 / 0.028);
  /* Botão principal com brilho e chave do iOS. */
  --gloss-from: #52a8ff;
  --gloss-to: #0a7aff;
  --gloss-shadow: 0 5px 14px rgb(10 122 255 / 0.4);
  --switch-on: #34c759;
  /* Papel de parede médio. */
  --wallpaper-base: #eef1fb;
  --wallpaper-1: rgb(80 140 255 / 0.75);
  --wallpaper-2: rgb(180 120 255 / 0.6);
  --wallpaper-3: rgb(255 150 190 / 0.55);
  /* Azulejos do menu, como os Ajustes do iPhone. */
  --tile-blue: linear-gradient(180deg, #3a9bff, #0a6cff);
  --tile-green: linear-gradient(180deg, #4cd964, #28b44a);
  --tile-orange: linear-gradient(180deg, #ffb340, #ff8a00);
  --tile-purple: linear-gradient(180deg, #c77dff, #9b3fe0);
  --tile-app: linear-gradient(160deg, #5ac8fa, #0a7aff 60%, #5e5ce6);
```

E a linha `--card-shadow: 0 1px 2px rgb(0 0 0 / 0.04), 0 2px 12px rgb(0 0 0 / 0.04);` sai.

- [ ] **Step 2: Os mesmos tokens no `.dark`**

No `.dark`, mudam:

```css
  --background: #0a0b14;
  --card: #252531;
  --muted-foreground: #a1a1a6;
  /* Vermelho mais claro: 4,5:1 sobre o card escuro. */
  --loss: #ff6961;
```

E o bloco de `--glass-tint` até `--icon-purple` é trocado por:

```css
  --glass-tint: rgb(44 44 46 / 0.55);
  --glass-border: rgb(255 255 255 / 0.12);
  --glass-edge: rgb(0 0 0 / 0.4);
  --glass-highlight: rgb(255 255 255 / 0.14);
  --glass-strong-tint: rgb(30 30 44 / 0.38);
  --glass-strong-border: rgb(255 255 255 / 0.2);
  --glass-strong-highlight: rgb(255 255 255 / 0.28);
  --glass-strong-shadow: 0 12px 32px rgb(0 0 0 / 0.55);
  --glass-sheen: rgb(255 255 255 / 0.16);
  --sidebar-muted: #aeaeb2;
  --card-fill: rgb(38 38 48 / 0.8);
  --card-fill-dense: rgb(38 38 48 / 0.94);
  --card-fill-brushed: rgb(38 38 48 / 0.84);
  --card-rim: linear-gradient(
    160deg,
    rgb(255 255 255 / 0.4),
    rgb(255 255 255 / 0.06) 40%,
    rgb(255 255 255 / 0.16)
  );
  --card-rim-hover: linear-gradient(
    160deg,
    rgb(255 255 255 / 0.55),
    rgb(255 255 255 / 0.1) 40%,
    rgb(255 255 255 / 0.24)
  );
  --card-shadow: inset 0 1px 0 rgb(255 255 255 / 0.14), 0 8px 24px rgb(0 0 0 / 0.5);
  --card-shadow-lifted: inset 0 1px 0 rgb(255 255 255 / 0.16), 0 14px 34px rgb(0 0 0 / 0.6);
  --glow-color: rgb(255 255 255 / 0.06);
  --metal: linear-gradient(
    135deg,
    #b9bbc3 0%,
    #2b2c31 25%,
    #c9cbd3 45%,
    #34353b 65%,
    #8e9098 85%,
    #e0e2e9 100%
  );
  --brush-light: rgb(255 255 255 / 0.035);
  --brush-dark: rgb(0 0 0 / 0.09);
  --gloss-shadow: 0 5px 14px rgb(10 132 255 / 0.35);
  --switch-on: #30d158;
  --wallpaper-base: #0a0b14;
  --wallpaper-1: rgb(10 100 255 / 0.55);
  --wallpaper-2: rgb(140 70 220 / 0.45);
  --wallpaper-3: rgb(220 60 120 / 0.3);
```

E a linha `--card-shadow: 0 1px 2px rgb(0 0 0 / 0.3), 0 4px 16px rgb(0 0 0 / 0.2);` sai.

- [ ] **Step 3: Utilitários dos materiais**

Depois do `@utility glass { … }` existente:

```css
/* Vidro forte (sidebar e toolbar): mais translúcido e saturado, com reflexo no canto. */
@utility glass-strong {
  background:
    linear-gradient(140deg, var(--glass-sheen), transparent 38%), var(--glass-strong-tint);
  backdrop-filter: blur(22px) saturate(200%);
  border: 1px solid var(--glass-strong-border);
  box-shadow:
    inset 0 1px 0 var(--glass-strong-highlight),
    var(--glass-strong-shadow);
}

/*
 * Card fosco com borda de luz. As camadas vêm de variáveis (brilho do cursor, textura e fundo),
 * para os materiais se somarem sem brigar pela ordem das classes.
 */
@utility card-surface {
  border: 1px solid transparent;
  background:
    var(--glow-layer, none) padding-box,
    var(--card-texture, none) padding-box,
    linear-gradient(var(--card-fill), var(--card-fill)) padding-box,
    var(--card-rim) border-box;
  box-shadow: var(--card-shadow);
  backdrop-filter: blur(16px) saturate(160%);
}

/* Titânio escovado (o card do patrimônio). */
@utility brushed {
  --card-fill: var(--card-fill-brushed);
  --card-texture: repeating-linear-gradient(
    90deg,
    var(--brush-light) 0 1px,
    var(--brush-dark) 1px 2px
  );
}

/* Elevação ao passar o mouse: só nos cards de número. */
@utility card-lift {
  transition:
    translate 200ms ease,
    box-shadow 200ms ease;
  @media (hover: hover) and (prefers-reduced-motion: no-preference) {
    &:hover {
      translate: 0 -2px;
      box-shadow: var(--card-shadow-lifted);
    }
  }
}

/* Aro de titânio de 1 px: a máscara deixa o metal só na borda, sem vazar para dentro. */
@utility metal-ring {
  position: relative;
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    padding: 1px;
    border-radius: inherit;
    background: var(--metal);
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask-composite: exclude;
    pointer-events: none;
  }
}

/* Botão principal com brilho na metade de cima. */
@utility btn-gloss {
  position: relative;
  overflow: hidden;
  color: #ffffff;
  background:
    var(--glow-layer, none),
    linear-gradient(180deg, var(--gloss-from), var(--gloss-to));
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.55),
    var(--gloss-shadow);
  &::after {
    content: "";
    position: absolute;
    inset: 0 0 50% 0;
    background: linear-gradient(180deg, rgb(255 255 255 / 0.32), transparent);
    pointer-events: none;
  }
  &:hover {
    filter: brightness(1.06);
  }
}

/* Azulejo do iOS: gradiente em --tile, ícone branco e brilho na metade de cima. */
@utility tile {
  position: relative;
  display: grid;
  flex-shrink: 0;
  place-items: center;
  overflow: hidden;
  color: #ffffff;
  background: var(--tile);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.45),
    inset 0 -1px 1px rgb(0 0 0 / 0.12),
    0 1px 2px rgb(0 0 0 / 0.2);
  &::after {
    content: "";
    position: absolute;
    inset: 0 0 50% 0;
    background: linear-gradient(180deg, rgb(255 255 255 / 0.28), transparent);
    pointer-events: none;
  }
}

/* Botão da chave em metal. */
@utility knob-metal {
  background: radial-gradient(circle at 32% 28%, #ffffff, #d3d5db 55%, #9ea1a9);
  box-shadow:
    0 1px 3px rgb(0 0 0 / 0.4),
    inset 0 -1px 1px rgb(0 0 0 / 0.15);
}
```

- [ ] **Step 4: Papel de parede no `body`**

No `@layer base`, o `background-image` do `body` passa a ser:

```css
    /* Papel de parede médio: dá ao vidro algo para refratar. */
    background-image:
      radial-gradient(60% 80% at 0% 0%, var(--wallpaper-1), transparent 60%),
      radial-gradient(55% 70% at 100% 10%, var(--wallpaper-2), transparent 60%),
      radial-gradient(70% 60% at 70% 110%, var(--wallpaper-3), transparent 60%);
```

- [ ] **Step 5: Regras de componente**

No `@layer components`:
- sai o bloco `[data-slot="card"] { box-shadow: var(--card-shadow); }` com o comentário dele;
- sai o bloco `[data-slot="sidebar-inner"] { backdrop-filter… }` com o comentário dele;
- entra, no lugar deles:

```css
  /* Card com tabela: fundo mais denso, para a coluna fixa (bg-card) não destoar. */
  [data-slot="card"]:has(table) {
    --card-fill: var(--card-fill-dense);
  }
  /* Texto secundário da sidebar mais escuro: o vidro forte deixa passar a cor do fundo. */
  [data-slot="sidebar-inner"] {
    --muted-foreground: var(--sidebar-muted);
  }
  /* Brilho que segue o cursor (posição escrita por pointer-glow.tsx). */
  [data-glow-active] {
    --glow-layer: radial-gradient(
      240px circle at var(--mx, 50%) var(--my, 50%),
      var(--glow-color),
      transparent 60%
    );
  }
  /* Borda de luz mais forte ao passar o mouse (só cor: vale também com movimento reduzido). */
  @media (hover: hover) {
    [data-slot="card"]:hover {
      --card-rim: var(--card-rim-hover);
    }
  }
```

- [ ] **Step 6: Entrada das telas, movimento reduzido e queda sem desfoque** (no fim do arquivo, fora de camadas)

```css
/* Entrada suave das telas (template.tsx): a página que sai some rápido, a nova sobe com fade. */
::view-transition {
  pointer-events: none;
}
::view-transition-old(.page-exit) {
  animation: 150ms ease-out both page-fade reverse;
}
::view-transition-new(.page-enter) {
  animation:
    210ms ease-in 150ms both page-fade,
    400ms cubic-bezier(0.2, 0.8, 0.2, 1) both page-rise;
}
@keyframes page-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes page-rise {
  from {
    transform: translateY(10px);
  }
  to {
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*),
  ::view-transition-new(*),
  ::view-transition-group(*) {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
  }
}

/* Sem backdrop-filter, o vidro e os cards viram fundos sólidos legíveis. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :root {
    --glass-strong-tint: #f6f7fb;
    --card-fill: #ffffff;
    --card-fill-dense: #ffffff;
    --card-fill-brushed: #ffffff;
    --card: #ffffff;
  }
  .dark {
    --glass-strong-tint: #1c1c24;
    --card-fill: #262632;
    --card-fill-dense: #262632;
    --card-fill-brushed: #262632;
    --card: #262632;
  }
}
```

- [ ] **Step 7: Verificar e commitar**

Run: `npx prettier --write src/app/globals.css && npx tsc --noEmit && npm run -s lint && npm run -s build`
Expected: sem erros. O build compila os `@utility`. Se o Tailwind recusar `@media` dentro de `@utility card-lift`, trocar por `@variant hover { @media … }` ou mover o `&:hover` para fora da media query, mantendo o efeito.

```bash
git add src/app/globals.css
git commit -m "feat(ui): Pro híbrido materials and tokens (wallpaper, glass, card, titanium)"
```

---

### Task 2: Card, botão e chave

**Goal:** Os componentes base usam os materiais: card fosco com brilho do cursor, botão principal com brilho, aro e toque macio, e chave verde com knob de metal.

**Files:**
- Modify: `src/shared/ui/card.tsx`
- Modify: `src/shared/ui/button.tsx`
- Modify: `src/shared/ui/switch.tsx`

**Acceptance Criteria:**
- [ ] `Card` usa `card-surface`, sem `bg-card` nem `ring-1 ring-foreground/10`, e tem `data-glow`
- [ ] Botão `default` usa `btn-gloss metal-ring` e tem `data-glow`; os outros ficam como estão
- [ ] Todos os botões encolhem para 97% no clique (`motion-safe`), sem o `translate-y-px`
- [ ] A chave ligada usa `--switch-on`, e o knob, `knob-metal`
- [ ] `npx tsc --noEmit`, `npm run -s lint` e `npm run -s build` sem erros

**Verify:** `npx tsc --noEmit && npm run -s lint && npm run -s build` → sem erros

**Steps:**

- [ ] **Step 1: `card.tsx`**

No `Card`, o `div` ganha `data-glow=""`, e o começo do `className` passa de:

```ts
"group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] …"
```

para:

```ts
"group/card card-surface flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl py-(--card-spacing) text-sm text-card-foreground [--card-spacing:--spacing(4)] …"
```

O resto da string não muda.

- [ ] **Step 2: `button.tsx`**

Na string base do `cva`:
- `transition-all` passa a `transition-all duration-150 ease-[cubic-bezier(0.3,0.7,0.4,1)]`;
- `active:not-aria-[haspopup]:translate-y-px` passa a `motion-safe:active:not-aria-[haspopup]:scale-[0.97]`.

A variante `default` passa a:

```ts
        default: "btn-gloss metal-ring text-primary-foreground",
```

No componente, o `ButtonPrimitive` ganha o brilho do cursor só no botão principal:

```tsx
    <ButtonPrimitive
      data-slot="button"
      data-glow={variant === "default" ? "" : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
```

- [ ] **Step 3: `switch.tsx`**

No `Root`, `data-checked:bg-primary` passa a `data-checked:bg-[var(--switch-on)]`.

No `Thumb`, saem `bg-background`, `dark:data-checked:bg-primary-foreground` e `dark:data-unchecked:bg-foreground`, e entra `knob-metal` logo depois de `rounded-full`.

- [ ] **Step 4: Verificar e commitar**

Run: `npx prettier --write src/shared/ui && npx tsc --noEmit && npm run -s lint && npm run -s build`
Expected: sem erros

```bash
git add src/shared/ui/card.tsx src/shared/ui/button.tsx src/shared/ui/switch.tsx
git commit -m "feat(ui): frosted cards, glossy primary button and metal switch knob"
```

---

### Task 3: Sidebar flutuante, azulejos e toolbar

**Goal:** A sidebar vira um painel flutuante de vidro forte. Os itens ganham azulejos coloridos, o ícone do app e o item ativo ganham titânio, e a toolbar usa o mesmo vidro.

**Files:**
- Modify: `src/shared/ui/sidebar.tsx`
- Modify: `src/shared/components/app-sidebar.tsx`
- Modify: `src/app/(app)/layout.tsx`

**Acceptance Criteria:**
- [ ] `variant="floating"`: o painel tem `glass-strong` e raio de 18 px, sem o `ring-1`
- [ ] Cada item tem um azulejo de 24 px (raio 7 px) com o gradiente da sua cor; recolhido, o azulejo cabe no botão de 32 px
- [ ] O ícone do app é um azulejo de 32 px com `--tile-app` e `metal-ring`
- [ ] O item ativo tem fundo de vidro claro, brilho interno e `metal-ring`
- [ ] O rótulo do grupo usa `--sidebar-muted`
- [ ] A toolbar usa `glass-strong`
- [ ] `npx tsc --noEmit`, `npm run -s lint` e `npm run -s build` sem erros

**Verify:** `npx tsc --noEmit && npm run -s lint && npm run -s build` → sem erros

**Steps:**

- [ ] **Step 1: Painel flutuante em `sidebar.tsx`**

No `div` com `data-slot="sidebar-inner"`, o `className` passa a:

```ts
"flex size-full flex-col bg-sidebar group-data-[variant=floating]:rounded-[18px] group-data-[variant=floating]:glass-strong"
```

- [ ] **Step 2: Azulejos em `app-sidebar.tsx`**

Os itens trocam `color` por `tile`:

```ts
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon, tile: "[--tile:var(--tile-blue)]" },
  { href: "/transacoes", label: "Transações", icon: ArrowLeftRightIcon, tile: "[--tile:var(--tile-green)]" },
  { href: "/carteira-alvo", label: "Carteira Alvo", icon: TargetIcon, tile: "[--tile:var(--tile-orange)]" },
  { href: "/recomendacoes", label: "Recomendações", icon: LightbulbIcon, tile: "[--tile:var(--tile-purple)]" },
] as const;

// Item ativo: vidro claro com brilho interno (o aro de titânio vem do metal-ring).
const ACTIVE_ITEM =
  "data-active:bg-white/60 data-active:shadow-[inset_0_1px_0_#fff,0_1px_3px_rgb(30_40_100/0.12)] dark:data-active:bg-white/12 dark:data-active:shadow-[inset_0_1px_0_rgb(255_255_255/0.22)]";
```

Importar `cn` (`import { cn } from "cn";`). O `Sidebar` ganha a variante: `<Sidebar collapsible="icon" variant="floating">`.

O ícone do app passa a:

```tsx
              <div className="tile metal-ring aspect-square size-8 rounded-[9px] [--tile:var(--tile-app)]">
                <CoinsIcon className="size-4" />
              </div>
```

O rótulo do grupo: `<SidebarGroupLabel className="text-[var(--sidebar-muted)]">Carteira</SidebarGroupLabel>`.

Cada item:

```tsx
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={active}
                      tooltip={item.label}
                      // Recolhida, a sidebar tem botões de 32 px: o azulejo de 24 px pede padding menor.
                      className={cn(
                        ACTIVE_ITEM,
                        "group-data-[collapsible=icon]:p-1!",
                        active && "metal-ring",
                      )}
                    >
                      {/* Azulejo colorido, como os Ajustes do iPhone. */}
                      <span className={cn("tile size-6 rounded-[7px]", item.tile)}>
                        <item.icon />
                      </span>
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
```

- [ ] **Step 3: Toolbar em `layout.tsx`**

No `header`, `glass` passa a `glass-strong`. O comentário vira `{/* Toolbar flutuante de vidro forte, como a sidebar. */}`.

- [ ] **Step 4: Verificar e commitar**

Run: `npx prettier --write src/shared src/app && npx tsc --noEmit && npm run -s lint && npm run -s build`
Expected: sem erros

```bash
git add src/shared/ui/sidebar.tsx src/shared/components/app-sidebar.tsx "src/app/(app)/layout.tsx"
git commit -m "feat(ui): floating glass sidebar with iOS tile icons and titanium accents"
```

---

### Task 4: Efeitos e destaques

**Goal:** O brilho que segue o cursor, a elevação dos cards de número, o card do patrimônio escovado com aro e a entrada suave das telas.

**Files:**
- Create: `src/shared/components/pointer-glow.tsx`
- Create: `src/app/(app)/template.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/features/portfolio/components/summary-cards.tsx`
- Modify: `src/features/smart-buy/components/aporte-calculator.tsx`

**Acceptance Criteria:**
- [ ] `PointerGlow` registra um único `pointermove` (passivo, com `requestAnimationFrame`). Só funciona com mouse e sem movimento reduzido, e marca `data-glow-active` com `--mx`/`--my` no elemento `[data-glow]` sob o cursor
- [ ] `template.tsx` envolve a página em `<ViewTransition enter="page-enter" exit="page-exit" default="none">`
- [ ] O card do patrimônio tem `brushed metal-ring card-lift`; os outros cards do resumo e Aporte, Ordens e Sobra têm `card-lift`
- [ ] `npx tsc --noEmit`, `npm run -s lint` e `npm run -s build` sem erros

**Verify:** `npx tsc --noEmit && npm run -s lint && npm run -s build` → sem erros

**Steps:**

- [ ] **Step 1: Criar `src/shared/components/pointer-glow.tsx`**

```tsx
"use client";

import { useEffect } from "react";

/**
 * Brilho que segue o cursor: um só ouvinte no documento escreve a posição (--mx, --my) no
 * elemento [data-glow] sob o ponteiro. Em toque ou com movimento reduzido, não faz nada.
 */
export function PointerGlow() {
  useEffect(() => {
    const wanted = window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)");
    if (!wanted.matches) return;
    let target: HTMLElement | null = null;
    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty("--mx", `${x - rect.left}px`);
      target.style.setProperty("--my", `${y - rect.top}px`);
    };
    const setTarget = (next: HTMLElement | null) => {
      if (next === target) return;
      target?.removeAttribute("data-glow-active");
      next?.setAttribute("data-glow-active", "");
      target = next;
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const element = event.target instanceof Element ? event.target : null;
      setTarget(element?.closest<HTMLElement>("[data-glow]") ?? null);
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => setTarget(null);

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
      setTarget(null);
    };
  }, []);
  return null;
}
```

- [ ] **Step 2: Montar no `layout.tsx`**

Importar `import { PointerGlow } from "@/shared/components/pointer-glow";` e colocar `<PointerGlow />` logo dentro do `<QueryProvider>`, antes do `<SidebarProvider>`.

- [ ] **Step 3: Criar `src/app/(app)/template.tsx`**

```tsx
import { ViewTransition, type ReactNode } from "react";

// Entrada suave das telas: o template remonta a cada navegação, e a página nova "entra"
// (animações page-enter e page-exit em globals.css). Sem suporte no navegador, só troca.
export default function AppTemplate({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
```

- [ ] **Step 4: Destaques em `summary-cards.tsx`**

- O card do patrimônio: `<Card className="md:col-span-2 brushed metal-ring card-lift">` e o comentário `{/* Número principal do dashboard: o patrimônio, em titânio escovado. */}`.
- Os outros dois cards: `<Card className="card-lift">`.

- [ ] **Step 5: Elevação em `aporte-calculator.tsx`**

Os três `<Card size="sm">` de Aporte, Ordens e Sobra passam a `<Card size="sm" className="card-lift">`.

- [ ] **Step 6: Verificar e commitar**

Run: `npx prettier --write src && npx tsc --noEmit && npm run -s lint && npm run -s build`
Expected: sem erros

```bash
git add src/shared/components/pointer-glow.tsx "src/app/(app)/template.tsx" "src/app/(app)/layout.tsx" src/features/portfolio/components/summary-cards.tsx src/features/smart-buy/components/aporte-calculator.tsx
git commit -m "feat(ui): cursor glow, hover lift, brushed patrimony card and page entry transition"
```

---

### Task 5: Conferência visual e de contraste

**Goal:** Ver o redesign com dados reais no banco de prévia isolado, nos temas claro e escuro e no celular. Ajustar os tokens até todo texto passar de 4,5:1, ou 3:1 em texto grande.

**Files:**
- Modify (se o contraste pedir): `src/app/globals.css`
- Create (fora do repositório, no scratchpad): `shots-tool/shoot-all.mjs`, `shots-tool/contrast.mjs`

**Acceptance Criteria:**
- [ ] Screenshots de Dashboard, Transações, Carteira Alvo e Recomendações em claro, escuro e 390 px
- [ ] Nenhuma página com rolagem horizontal em 390 px
- [ ] `contrast.mjs` mostra 0 textos abaixo do mínimo nos dois temas
- [ ] Com `reducedMotion: "reduce"`, passar o mouse num `card-lift` não muda o `translate`, e nenhum card ganha `data-glow-active`
- [ ] `npm run -s format:check`, `lint`, `typecheck` e `build` passam
- [ ] O banco de prévia é apagado e a sessão de teste revogada no fim

**Verify:** saída do `contrast.mjs` com "abaixo do mínimo: 0" em claro e escuro

**Steps:**

- [ ] **Step 1: Prévia isolada**

Usar os scripts do scratchpad, com o env de prévia que aponta para `koinos_preview`:
- `aporte/seed-preview.ts` monta o banco a partir da carteira real;
- `aporte/env-exports.mjs` carrega as variáveis.

Depois, fazer o build do worktree com esse env e rodar `next start -p 3100`.

- [ ] **Step 2: Screenshots** (`shots-tool/shoot-all.mjs`)

As 4 páginas, em 1440×900 nos temas claro e escuro (página inteira) e em 390×844, com a medida de rolagem horizontal. O script segue o padrão do `shoot-aporte.mjs`.

- [ ] **Step 3: Contraste** (`shots-tool/contrast.mjs`)

Para cada página e tema:
1. Coleta os textos visíveis: títulos, descrições, `text-muted-foreground`, células e cabeçalhos de tabela, ganho e perda, e os rótulos da sidebar. De cada um, guarda a cor computada (convertida para sRGB num canvas), o tamanho e o peso.
2. Injeta `* { color: transparent !important } svg { visibility: hidden !important }` e fotografa a página.
3. Calcula, num canvas no próprio navegador, a cor média do fundo no retângulo de cada texto.
4. Aplica o contraste da WCAG: o mínimo é 4,5, ou 3 para texto de 24 px ou mais, e de 18,66 px ou mais em negrito.
5. Lista os 15 piores e o total abaixo do mínimo.

No mesmo contexto, com `reducedMotion: "reduce"`:
- passa o mouse sobre o primeiro `.card-lift` e confere `getComputedStyle(card).translate === "none"`;
- confere que nenhum elemento tem `data-glow-active`.

- [ ] **Step 4: Ajustar tokens e repetir**

Para cada texto abaixo do mínimo, ajustar o token da cor dele no tema em que falhou: `--muted-foreground`, `--sidebar-muted`, `--gain` ou `--loss`. Depois, refazer o build e rodar os passos 2 e 3 de novo, até zerar.

- [ ] **Step 5: Verificações e commit**

Run: `npm run -s format:check && npm run -s lint && npm run -s typecheck && npm run -s build`
Expected: tudo passa

```bash
git add src/app/globals.css
git commit -m "fix(ui): tune text tokens for 4.5:1 contrast on the new materials"
```

(só se o passo 4 mudou algo)

- [ ] **Step 6: Limpeza**

Revogar a sessão de teste (`aporte/revoke-preview.ts`), apagar o banco de prévia (`drop-preview-db.mjs --drop`) e parar o servidor da prévia.
