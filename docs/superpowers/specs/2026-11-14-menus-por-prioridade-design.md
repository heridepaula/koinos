# Menus por prioridade e o olho dos valores no iPhone

Data: 2026-11-14. Estado: proposta, sem implementação.

Pedido do dono: avaliar os menus no computador e no celular, reorganizar por prioridade das
funções e, no celular, tirar o mostrar/ocultar valores de dentro do "Mais" ("…"), porque deve ser
de acesso fácil.

## 1. Como está hoje

Uma lista só, `NAV_ITEMS` (`shared/components/nav-items.ts`), alimenta os três menus.

**Computador (sidebar, `app-sidebar.tsx`):** um grupo único, "Carteira", com 9 itens nesta ordem:
Dashboard, Ativos, Transações, Proventos (Reinvestimento), Posições encerradas (IR estimado),
Atualização B3, Carteira Alvo, Recomendações, Independência. A cápsula da direita da barra do topo
tem o olho (`PrivacyToggle`), o tema (`ThemeToggle`) e o sino. A conta fica no rodapé da sidebar.

**Celular (`tab-bar.tsx`, `more-sheet.tsx`, `mobile-nav-bar.tsx`):**

- Tab bar: Dashboard, Proventos, Aporte (= Recomendações), Mais.
- Barra de cima: voltar (subpáginas), título compacto, sino.
- Folha "Mais", de cima para baixo: 6 páginas (Ativos, Transações, Posições encerradas,
  Atualização B3, Carteira Alvo, Independência), Aparência, Valores, Conta.

## 2. Avaliação

| # | Problema | Onde |
|---|----------|------|
| 1 | Ocultar valores custa 2 toques e uma rolagem: "Mais", passar por 6 páginas e pela Aparência, tocar em "Ocultos". É o controle usado com pressa (alguém olhando a tela) e é o mais escondido. No computador é 1 clique. | celular |
| 2 | A ordem não segue o uso. Recomendações e Carteira Alvo, a jornada principal do app (aportar), são o 7º e o 8º itens; Transações e Atualização B3, manutenção ocasional, vêm antes. | computador |
| 3 | Um grupo só, sem hierarquia: 9 itens e 2 subitens com o mesmo peso. O rótulo "Carteira" não diz nada, porque tudo é a carteira. | computador |
| 4 | Pares separados: Carteira Alvo (onde se ajusta o método) fica longe de Recomendações (onde se usa); Transações fica longe de Atualização B3 (que é quem as escreve). | os dois |
| 5 | No "Mais", Carteira Alvo, par da aba Aporte, é o 5º item, depois de Encerradas e B3. | celular |
| 6 | As abas estão certas: Dashboard, Proventos e Aporte são as três jornadas do dia a dia, e uma quinta aba não cabe em 393 px ao lado do botão da ação (decisão registrada em `nav-items.ts`). | celular |

## 3. Decisões

### 3.1 Três grupos, na ordem de uso

| Grupo | Itens, em ordem | Critério |
|-------|-----------------|----------|
| **Carteira** | Dashboard · Ativos · Proventos (Reinvestimento) · Independência | ver: uso diário, só leitura |
| **Aporte** | Recomendações · Carteira Alvo | decidir: a cada aporte |
| **Registros** | Transações · Posições encerradas (IR estimado) · Atualização B3 | manter: ocasional (mensal, IR) |

- Dentro do grupo, do mais usado para o menos usado. Independência fecha a Carteira: é consulta de
  acompanhamento, não muda toda semana.
- Recomendações vem antes de Carteira Alvo: a tela de uso antes da de ajuste.
- Atualização B3 fecha os Registros, ao lado de Transações, que ela alimenta.
- Nenhum rótulo, ícone, cor de azulejo ou rota muda. A aba do celular continua "Aporte".

### 3.2 Computador

- A sidebar desenha um `SidebarGroup` por grupo, com o rótulo do grupo (`SidebarGroupLabel`).
- Recolhida (só ícones), os rótulos somem como hoje e os grupos ficam separados pelo espaço entre
  eles, o que mantém a divisão visível sem texto.
- Subitens, destaque do item ativo, tooltip e rodapé da conta ficam como estão.
- A cápsula da barra do topo não muda: olho, tema, sino.

### 3.3 Celular: o olho na barra de cima

- O olho sai do "Mais" e vai para a barra de navegação, à esquerda do sino, na mesma cápsula de
  vidro: 1 toque, em qualquer página, na mesma posição relativa do computador (olho antes do sino).
- É o mesmo `PrivacyToggle` (mesmo estado, `aria-pressed`, ícone trocado por CSS). Área de toque de
  44 px, como o sino.
- A seção "Valores" do "Mais" é removida (`ValuesSection`, `VALUES_OPTIONS`): um controle só, sem
  duplicata para manter em sincronia.
- A regra de privacidade não muda: ao entrar, os valores começam ocultos.

**A barra com dois botões à direita:**

- O `trailing` de `MobileNavBar` passa de um círculo de 44 px para uma cápsula `glass-strong` de
  44 px de altura com os dois botões redondos (92 px de largura com o respiro).
- O olho vem no shell estático; o sino continua em `<Suspense>`. O fallback do sino reserva 44 px,
  para a cápsula não crescer quando ele chega.
- O título compacto hoje é centrado na tela com `max-w-[60vw]` e colunas `1fr auto 1fr`. Com 92 px
  à direita isso não cabe em 393 px. A grade passa a `auto minmax(0,1fr) auto` e o título fica
  centrado no espaço livre, truncando com reticências. Largura livre do título:

  | Largura | Página raiz | Subpágina (com voltar) |
  |---------|-------------|------------------------|
  | 393 px  | 253 px      | 209 px                 |
  | 320 px  | 180 px      | 136 px                 |

  O maior título raiz, "Posições encerradas" (~165 px em Headline), cabe nos dois; nas subpáginas,
  "Reinvestimento" (~125 px) cabe em 320 px.

### 3.4 Celular: a folha "Mais"

De cima para baixo:

1. **Carteira:** Ativos · Independência
2. **Aporte:** Carteira Alvo
3. **Registros:** Transações · Posições encerradas · Atualização B3
4. **Aparência** (Automático / Claro / Escuro)
5. **Conta**

- Cada grupo é um `InsetGroup` com o título em Footnote, no mesmo estilo de "Aparência". São os
  mesmos grupos e a mesma ordem da sidebar, sem os itens que já são abas.
- Sem a seção "Valores" a folha fica mais curta, e a Aparência aparece sem rolar num iPhone de
  393 × 852.
- As subpáginas (Reinvestimento, IR estimado) continuam fora do "Mais": chega-se a elas pela linha
  que já existe na página-mãe.

### 3.5 O tema no celular fica no "Mais"

O pedido cita a troca de tema como referência de acesso fácil. No computador ela está na barra; no
celular, hoje, também está dentro do "Mais". Esta spec **mantém o tema no "Mais"**:

- o padrão do celular é "Automático" (segue o iPhone), então a troca manual é rara, ao contrário do
  olho;
- são três opções, e um botão de alternar na barra perderia o "Automático";
- um terceiro botão deixaria 165 px para o título numa subpágina em 393 px, e 92 px em 320 px.

Se o dono quiser o tema também na barra, a alternativa é um terceiro botão na cápsula que alterna
claro/escuro (como o `ThemeToggle` do computador), com o "Automático" só no "Mais".

## 4. Alternativas descartadas

- **Olho no botão redondo ao lado da tab bar:** esse lugar é da ação principal da página
  (`useTabBarAction`: nova transação, busca, editar meta) e some nas páginas sem ação.
- **Olho no card de patrimônio do Dashboard:** só existiria numa página; os valores aparecem em
  todas.
- **Olho no topo do "Mais":** continua a 2 toques.
- **Ativos como quinta aba:** não cabe (item 6 da avaliação).
- **Ordenar sem agrupar:** resolve a ordem, mas mantém 9 itens com o mesmo peso.

## 5. Mudanças no código

| Arquivo | Mudança |
|---------|---------|
| `shared/components/nav-items.ts` | `NavItem.group: "carteira" \| "aporte" \| "registros"`; `NAV_GROUPS` (id e rótulo, na ordem); `NAV_ITEMS` reordenado; função pura `navGroups(items)` que devolve `{ id, label, items }[]` sem grupos vazios. `isWithin` e `parentOf` não mudam. |
| `shared/components/app-sidebar.tsx` | um `SidebarGroup` por grupo de `navGroups(NAV_ITEMS)`. |
| `shared/components/more-sheet.tsx` | um `InsetGroup` com título por grupo de `navGroups(itens sem aba)`; remove `ValuesSection`. |
| `shared/components/mobile-nav-bar.tsx` | grade `auto minmax(0,1fr) auto`; `trailing` numa cápsula; remove o `max-w-[60vw]` do título. |
| `app/(app)/layout.tsx` | `trailing` = `<PrivacyToggle />` + o sino em `<Suspense>` com fallback de 44 px. |
| `shared/components/tab-bar.tsx` | nenhuma: as abas saem de `tab`, que não muda. |

Sem mudança em rotas, `proxy.ts`, dados, ações ou telemetria.

## 6. Testes e verificação

- `shared/components/nav-items.test.ts` (puro): todo item tem grupo; `navGroups` devolve os três
  grupos na ordem da seção 3.1 com os itens na ordem; sem os itens de aba, devolve os grupos da
  seção 3.4; as abas continuam Dashboard, Proventos, Aporte, nessa ordem; `parentOf` de
  `/proventos/reinvestimento`, `/encerradas/ir` e `/ativos/HGLG11` devolve o mesmo de hoje.
- `format:check`, `lint`, `typecheck`, `test`, `build`.
- No navegador, tema claro e escuro:
  - 393 px e 320 px: o olho alterna os valores com 1 toque em Dashboard, Proventos, Aporte e numa
    subpágina; o título compacto não encosta nos botões; a cápsula não muda de largura quando o
    sino carrega;
  - iPhone deitado: a cápsula respeita `--safe-right`;
  - "Mais": três grupos, sem "Valores", a página aberta marcada;
  - computador: três grupos com a sidebar aberta; recolhida, os grupos separados e os tooltips
    funcionando; o item ativo e o subitem ativo como hoje.
- Contraste AA do olho sobre o vidro da barra nos dois temas (mesmo material do sino).

## 7. Documentação

Atualizar no `CLAUDE.md`: o parágrafo de "A new top-level page" (o item novo precisa de `group`),
o do "Phone frame" (o "Mais" sem os valores, por grupos; o olho na barra de navegação) e a lista de
testes (`nav-items.test.ts`).
