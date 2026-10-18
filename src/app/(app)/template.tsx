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
