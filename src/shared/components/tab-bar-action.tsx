"use client";

import type { LucideIcon } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

/** A ação principal da página no iPhone: um botão redondo ao lado da tab bar. */
export type TabBarActionSpec = { label: string; icon: LucideIcon; onPress: () => void };

type Registry = {
  action: TabBarActionSpec | null;
  setAction: Dispatch<SetStateAction<TabBarActionSpec | null>>;
};

const TabBarActionContext = createContext<Registry | null>(null);

export function TabBarActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<TabBarActionSpec | null>(null);
  const registry = useMemo(() => ({ action, setAction }), [action]);
  return <TabBarActionContext value={registry}>{children}</TabBarActionContext>;
}

/** A ação registrada pela página aberta (só a tab bar lê). */
export function useCurrentTabBarAction() {
  return useContext(TabBarActionContext)?.action ?? null;
}

/**
 * Registra a ação principal da página no botão ao lado da tab bar, ao alcance do polegar. O
 * registro vive num efeito de propósito: quando a página sai (ou o Next a guarda escondida, numa
 * Activity), o efeito se desfaz e o botão some junto. `null` não registra nada.
 */
export function useTabBarAction(spec: TabBarActionSpec | null) {
  const setAction = useContext(TabBarActionContext)?.setAction;
  const onPress = useEffectEvent(() => spec?.onPress());
  const label = spec?.label;
  const icon = spec?.icon;
  useEffect(() => {
    if (!setAction || !label || !icon) return;
    const action: TabBarActionSpec = { label, icon, onPress: () => onPress() };
    setAction(action);
    return () => setAction((current) => (current === action ? null : current));
  }, [setAction, label, icon]);
}
