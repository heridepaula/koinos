"use client";

import { ChevronRightIcon } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/ui/drawer";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { InsetGroup, insetRowClass } from "./inset-list";
import { NAV_ITEMS, isWithin } from "./nav-items";
import { setValuesVisible, useValuesVisible } from "./privacy-toggle";

const MORE_ITEMS = NAV_ITEMS.filter((item) => !item.tab);

const THEME_OPTIONS = [
  { value: "system", label: "Automático" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
] as const;
type ThemeChoice = (typeof THEME_OPTIONS)[number]["value"];

const VALUES_OPTIONS = [
  { value: "hidden", label: "Ocultos" },
  { value: "visible", label: "À mostra" },
] as const;
type ValuesChoice = (typeof VALUES_OPTIONS)[number]["value"];

/**
 * A aba "Mais" do iPhone: uma folha com as páginas que não cabem na tab bar (com os azulejos da
 * sidebar, como os Ajustes), a aparência e a conta. Tocar numa página navega e fecha a folha.
 */
export function MoreSheet({
  open,
  onOpenChange,
  pathname,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  account: ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Mais</DrawerTitle>
          <DrawerDescription className="sr-only">
            Outras páginas, aparência e conta.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="grid content-start gap-6">
          <InsetGroup>
            {MORE_ITEMS.map((item) => {
              const current = isWithin(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  onClick={() => onOpenChange(false)}
                  className={cn(insetRowClass(), current && "bg-foreground/5")}
                >
                  <span className={cn("tile size-8 rounded-lg [&_svg]:size-4.5", item.tile)}>
                    <item.icon aria-hidden="true" />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              );
            })}
          </InsetGroup>
          <ThemeSection />
          <ValuesSection />
          {account}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

/** Claro, escuro ou o do sistema (o padrão do iPhone). Só monta com a folha aberta, no cliente. */
function ThemeSection() {
  const { theme, setTheme } = useTheme();
  return (
    <section className="grid gap-1.5">
      <h3 className="px-4 text-footnote font-medium text-muted-foreground">Aparência</h3>
      <SegmentedControl<ThemeChoice>
        label="Aparência"
        value={(theme as ThemeChoice | undefined) ?? "system"}
        options={THEME_OPTIONS}
        onChange={setTheme}
        className="w-full"
      />
    </section>
  );
}

/** O olho da barra do computador, ao lado da aparência: ao logar, os valores começam ocultos. */
function ValuesSection() {
  const visible = useValuesVisible();
  return (
    <section className="grid gap-1.5">
      <h3 className="px-4 text-footnote font-medium text-muted-foreground">Valores</h3>
      <SegmentedControl<ValuesChoice>
        label="Valores"
        value={visible ? "visible" : "hidden"}
        options={VALUES_OPTIONS}
        onChange={(choice) => setValuesVisible(choice === "visible")}
        className="w-full"
      />
    </section>
  );
}
