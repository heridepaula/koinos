# Redesign visual "Pro híbrido": especificação de design

- **Data:** 2026-10-18
- **Status:** as escolhas vieram do usuário no companion visual (mockups em `.superpowers/brainstorm/140-1792321608/content/`, fora do Git). O usuário pediu para seguir sem novas perguntas, então os detalhes abaixo seguem as opções recomendadas que ele escolheu.
- **Pedido:** "O layout está um pouco simples, sem efeitos, bordas, metalização, não parece muito os do macOS ou do iPhone."

## 1. Objetivo

Dar ao Koinos a cara de um app da Apple, com vidro, profundidade, brilho e toques de titânio, sem perder a leitura dos números, que é o que importa num painel financeiro.

### Critérios de sucesso

1. **Cinco escolhas aplicadas, nos temas claro e escuro:**
   - direção C (Pro híbrido);
   - toques metálicos (nível 2);
   - papel de parede médio;
   - ícones em azulejo;
   - os 4 efeitos.
2. **Contraste:** texto e números mantêm pelo menos 4,5:1 sobre os cards (WCAG AA). O verde e o vermelho de ganho e perda continuam com sinal e seta.
3. **Movimento reduzido:** com `prefers-reduced-motion: reduce`, nada se desloca nem segue o cursor. Ficam só mudanças de cor e opacidade.
4. **Sem `backdrop-filter`:** os materiais de vidro viram fundos sólidos legíveis.
5. **Celular:** em 390 px, nenhuma página rola na horizontal, e o menu lateral continua funcionando.
6. **Só visual:** nenhuma regra de negócio muda. Telas, textos e números são os mesmos.

## 2. Decisões

| Tema | Escolha | Como fica |
| --- | --- | --- |
| Direção | **C, Pro híbrido** | Sidebar flutuante de vidro forte, cards foscos com borda de luz e sombra em camadas, controles com brilho |
| Metal | **2, toques metálicos** | Titânio só nos destaques: card do patrimônio (escovado e com aro), item ativo do menu, aro do botão principal, ícone do app e botão da chave |
| Papel de parede | **2, médio** | Três manchas radiais (azul, roxo, rosa) sobre um fundo claro azulado ou um escuro quase preto |
| Ícones do menu | **2, azulejo** | Quadradinho colorido com brilho e ícone branco, como nos Ajustes do iPhone |
| Efeitos | **Os 4** | Brilho que segue o cursor, elevação ao passar o mouse, toque macio nos botões e entrada suave das telas |

## 3. Materiais (tokens)

Todos ficam em `src/app/globals.css`, como variáveis do `:root` e do `.dark`. Os valores vêm dos mockups aprovados.

### Papel de parede (médio)

- **Claro:**
  - `radial-gradient(60% 80% at 0% 0%, rgb(80 140 255 / .75), transparent 60%)`;
  - `radial-gradient(55% 70% at 100% 10%, rgb(180 120 255 / .6), transparent 60%)`;
  - `radial-gradient(70% 60% at 70% 110%, rgb(255 150 190 / .55), transparent 60%)`;
  - fundo `#eef1fb`.
- **Escuro:** as mesmas posições, com `rgb(10 100 255 / .55)`, `rgb(140 70 220 / .45)` e `rgb(220 60 120 / .3)` sobre `#0a0b14`.
- **Rolagem:** `background-attachment: fixed`, como hoje. O papel de parede não rola com o conteúdo.

### Vidro forte (sidebar e toolbar)

- **Fundo e desfoque:** `rgb(255 255 255 / .34)` com `blur(22px) saturate(200%)`. No escuro, `rgb(30 30 44 / .38)`.
- **Borda:** `rgb(255 255 255 / .65)`. No escuro, `/ .2`.
- **Sombra:** `inset 0 1px 0` de brilho e `0 12px 32px` (azulada no claro, preta no escuro).
- **Reflexo:** um `::before` com `linear-gradient(140deg, branco .5, transparente 38%)`. No escuro, o branco cai para .16.
- **Formato:** a sidebar fica flutuante, com 8 px de margem da janela e raio de 18 px. A toolbar continua flutuante, com o mesmo material.

### Card fosco com borda de luz (todos os `Card`)

- **Fundo:** `linear-gradient(rgb(255 255 255 / .84), …) padding-box`.
- **Borda de luz:** `linear-gradient(160deg, #fff, rgb(255 255 255 / .25) 40%, rgb(110 120 170 / .4)) border-box`, sobre uma borda de 1 px transparente.
- **Escuro:** fundo `rgb(38 38 48 / .8)`. A borda vai de `rgb(255 255 255 / .4)` a `/ .06` e depois `/ .16`.
- **Sombra em camadas:** `inset 0 1px 0` de brilho, `0 1px 1px` de contato e `0 8px 22px` de profundidade.
- **Desfoque:** `blur(16px) saturate(160%)`.
- **Popovers, menus e diálogos:** continuam com o vidro de hoje, que já é translúcido.

### Titânio

- **Metal claro:** `linear-gradient(135deg, #fff 0%, #9b9ca3 22%, #f4f4f7 42%, #6f7077 62%, #dcdce1 82%, #fff 100%)`.
- **Metal escuro:** `linear-gradient(135deg, #b9bbc3 0%, #2b2c31 25%, #c9cbd3 45%, #34353b 65%, #8e9098 85%, #e0e2e9 100%)`.
- **Aro (`metal-ring`):** um `::before` com `padding: 1px`, fundo `var(--metal)` e `mask-composite: exclude`. Só a borda de 1 px fica metálica, e o metal não vaza para dentro do card.
- **Escovado (`brushed`):** `repeating-linear-gradient(90deg, rgb(255 255 255 / .07) 0 1px, rgb(0 0 0 / .028) 1px 2px)` sobre o fundo do card. No escuro: `.035` e `.09`.
- **Botão da chave:** o knob ganha `radial-gradient(circle at 32% 28%, #fff, #d3d5db 55%, #9ea1a9)` e uma sombra de profundidade.

### Botão principal com brilho

- **Fundo:** `linear-gradient(180deg, #52a8ff, #0a7aff)`, com `inset 0 1px 0 rgb(255 255 255 / .55)` e sombra azul `0 5px 14px rgb(10 122 255 / .4)`.
- **Brilho:** a metade de cima ganha um `::after` com `linear-gradient(180deg, rgb(255 255 255 / .32), transparente)`.
- **Aro:** o botão `default` ganha o aro de titânio. Os outros (outline, secondary, ghost) ficam como hoje, mas com o toque macio (§5).

### Azulejos do menu

| Item | Gradiente | Ícone |
| --- | --- | --- |
| Dashboard | `#3a9bff → #0a6cff` | `LayoutDashboard` |
| Transações | `#4cd964 → #28b44a` | `ArrowLeftRight` |
| Carteira Alvo | `#ffb340 → #ff8a00` | `Target` |
| Recomendações | `#c77dff → #9b3fe0` | `Lightbulb` |

- **Forma:** azulejo de 24 px, raio de 7 px e ícone branco de 15 px.
- **Brilho:** `inset 0 1px 0 rgb(255 255 255 / .45)`, `inset 0 -1px 1px rgb(0 0 0 / .12)` e sombra `0 1px 2px`. Um `::after` clareia a metade de cima.
- **Menu recolhido:** com a sidebar em modo ícone, o azulejo continua visível.

## 4. Onde cada material entra

| Lugar | Arquivo | Mudança |
| --- | --- | --- |
| Tokens e utilitários | `src/app/globals.css` | Papel de parede médio, vidro forte, card fosco, metal (`metal-ring`, `brushed`), botão com brilho, azulejo e efeitos (§5). Ainda a queda para sólido sem `backdrop-filter` e o movimento reduzido |
| Sidebar | `src/shared/ui/sidebar.tsx` (variante) e `src/app/(app)/layout.tsx` | Sidebar `variant="floating"`, com o vidro forte e o reflexo. O item ativo ganha fundo de vidro claro e aro de titânio |
| Menu | `src/shared/components/app-sidebar.tsx` | Azulejos coloridos. O ícone do app (moedas) vira um azulejo com gradiente azul e aro de titânio |
| Cards | `src/shared/ui/card.tsx` | Material do card fosco, aplicado pelo `data-slot="card"` como hoje |
| Patrimônio | `src/features/portfolio/components/summary-cards.tsx` | O card do patrimônio ganha `brushed` e `metal-ring` |
| Botões | `src/shared/ui/button.tsx` | `default` com brilho e aro; todos com o toque macio |
| Chave | `src/shared/ui/switch.tsx` | Knob de metal |
| Entrada das telas | `src/app/(app)/template.tsx` (novo) | `<ViewTransition>` do React 19.3 em volta da página. O template remonta a cada navegação, e assim a página nova "entra" (§5) |
| Brilho do cursor | `src/shared/components/pointer-glow.tsx` (novo, cliente) | Um ouvinte de `pointermove` no documento atualiza `--mx` e `--my` do card sob o cursor |

## 5. Efeitos

Todos vivem em `@media (prefers-reduced-motion: no-preference)`. Fora dela, ficam só as mudanças de cor.

1. **Brilho que segue o cursor:**
   - em todos os cards e no botão principal, um `radial-gradient(240px circle at var(--mx) var(--my), rgb(255 255 255 / .14), transparent 60%)` aparece sob o cursor (no escuro, `/ .06`). É só cor, sem movimento de layout;
   - um só ouvinte de `pointermove` no documento, com `requestAnimationFrame`, escreve as variáveis no card sob o ponteiro;
   - não há ouvinte por card, e em toque (`pointerType` ≠ `mouse`) não acontece nada.
2. **Elevação ao passar o mouse:**
   - sobem 2 px, e a sombra de profundidade cresce em 200 ms:
     - os cards de número: os do resumo do dashboard e Aporte, Ordens e Sobra nas Recomendações;
     - quem usa a classe `card-lift`.
   - cards com tabela ou gráfico não sobem, porque mexer a tabela inteira atrapalha a leitura. Ganham só a borda de luz mais forte.
3. **Toque macio nos botões:** `scale(.97)` no `:active`, com `transition: transform 120ms cubic-bezier(.3,.7,.4,1)`. Substitui o `translate-y-px` de hoje.
4. **Entrada suave das telas:**
   - na navegação, a página que sai some com fade de 150 ms;
   - a que entra aparece com fade de 210 ms (depois da saída) e sobe 10 px em 400 ms;
   - isso vem de `<ViewTransition enter="page-enter" exit="page-exit" default="none">` no `template.tsx`;
   - a toolbar e a sidebar ficam na raiz da transição, que é igual antes e depois, por isso não se mexem; só o item ativo do menu troca com fade;
   - `::view-transition { pointer-events: none }` mantém a página clicável durante a animação.

## 6. Acessibilidade e desempenho

- **Contraste:** a conferência de 4,5:1 vale para texto normal e números sobre o card fosco, nos dois temas. O tom de `muted-foreground` pode escurecer (claro) ou clarear (escuro) se for preciso.
- **Sem `backdrop-filter`** (`@supports not (backdrop-filter: blur(1px))`): o vidro vira fundo sólido, `#f6f7fb` no claro e `#1c1c24` no escuro.
- **Desfoque:**
  - o desfoque forte fica só na sidebar, na toolbar e nos menus;
  - nos cards, o desfoque é menor (16 px) sobre um fundo 84% opaco;
  - se o scroll da Carteira Alvo (tabela grande) travar, o desfoque dos cards sai, e o fundo vai a 92%.
- **Textos e foco:** continuam os mesmos, inclusive o anel de foco azul.

## 7. Fora deste ciclo

- Novos gráficos ou mudança no layout das páginas.
- Ícones novos além dos 4 do menu e do app.
- Tema por usuário além de claro, escuro e sistema.

## 8. Verificação

1. **Screenshots** de todas as páginas, em claro, escuro e 390 px. Usa o banco de prévia isolado (`koinos_preview`), com usuário de teste e sessão revogada no fim.
2. **Contraste:** um script mede as cores efetivas de texto e fundo nos cards e garante 4,5:1.
3. **Movimento reduzido:** o Playwright com `reducedMotion: "reduce"` confirma que nada se desloca.
4. **Celular:** sem rolagem horizontal em 390 px, e o menu abre e fecha.
5. **Checagens do projeto:** `npm run format:check`, `lint`, `typecheck` e `build` passam.
