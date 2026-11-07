"use client";

import { PencilIcon } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTabBarAction } from "@/shared/components/tab-bar-action";
import { Button } from "@/shared/ui/button";

type Editing = {
  editing: boolean;
  setEditing: (editing: boolean) => void;
  /** Há meta salva para editar: o painel avisa quando monta (sem ela, a página é o questionário). */
  available: boolean;
  setAvailable: (available: boolean) => void;
};

const EditingContext = createContext<Editing | null>(null);

/**
 * Liga o "Editar meta" do cabeçalho da página (e do botão da tab bar, no iPhone) ao painel, que
 * troca os cards pela revisão do questionário.
 */
export function IndependenceEditingProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [available, setAvailable] = useState(false);
  const value = useMemo(
    () => ({ editing, setEditing, available, setAvailable }),
    [editing, available],
  );
  return <EditingContext value={value}>{children}</EditingContext>;
}

export function useIndependenceEditing(): Editing {
  const context = useContext(EditingContext);
  if (!context) throw new Error("useIndependenceEditing precisa do IndependenceEditingProvider");
  return context;
}

/**
 * "Editar meta": na barra do cabeçalho na mesa e no botão redondo ao lado da tab bar no iPhone (o
 * cabeçalho esconde as ações lá, mas o botão segue montado e registra a da tab bar). Só aparece
 * com meta salva e some enquanto ela está em edição; ao sair da edição, o foco volta para ele.
 */
export function EditPlanButton() {
  const { editing, setEditing, available } = useIndependenceEditing();
  const shown = available && !editing;
  const ref = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(editing);
  useEffect(() => {
    if (wasEditing.current && !editing) ref.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  useTabBarAction(
    shown ? { label: "Editar meta", icon: PencilIcon, onPress: () => setEditing(true) } : null,
  );
  if (!shown) return null;
  return (
    <Button ref={ref} variant="outline" onClick={() => setEditing(true)}>
      <PencilIcon />
      Editar meta
    </Button>
  );
}
