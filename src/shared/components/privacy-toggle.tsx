"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/shared/ui/button";
import { PRIVACY_EVENT, PRIVACY_STORAGE_KEY } from "./privacy";

function subscribe(onChange: () => void) {
  window.addEventListener(PRIVACY_EVENT, onChange);
  return () => window.removeEventListener(PRIVACY_EVENT, onChange);
}

const isVisible = () => document.documentElement.dataset.privacy === "visible";

export function useValuesVisible() {
  return useSyncExternalStore(subscribe, isVisible, () => false);
}

export function setValuesVisible(visible: boolean) {
  if (visible) document.documentElement.dataset.privacy = "visible";
  else delete document.documentElement.dataset.privacy;
  try {
    if (visible) localStorage.setItem(PRIVACY_STORAGE_KEY, "visible");
    else localStorage.removeItem(PRIVACY_STORAGE_KEY);
  } catch {
    // Sem armazenamento (aba privada): vale só até recarregar.
  }
  window.dispatchEvent(new Event(PRIVACY_EVENT));
}

/** O olho da barra do topo: mostra ou esconde os valores da carteira. */
export function PrivacyToggle() {
  const visible = useValuesVisible();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={visible ? "Ocultar valores" : "Mostrar valores"}
      aria-pressed={visible}
      onClick={() => setValuesVisible(!visible)}
    >
      {/* Troca por CSS, como o tema: o servidor não sabe o estado. */}
      <EyeIcon className="hidden values-visible:block" />
      <EyeOffIcon className="values-visible:hidden" />
    </Button>
  );
}
