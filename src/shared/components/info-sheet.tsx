"use client";

import { InfoIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";

/**
 * O "ⓘ" do iOS: no celular, o texto de apoio longo de um card sai da tela e fica numa folha de
 * baixo, aberta por este botão (alvo de 44 px). Na mesa o texto segue no card, e o botão some.
 */
export function InfoSheet({
  title,
  label,
  className,
  children,
}: {
  title: string;
  /** Nome do botão para leitor de tela, como "Sobre a lista a receber". */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn("-my-2 -mr-2 text-muted-foreground md:hidden", className)}
      >
        <InfoIcon />
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="grid content-start gap-4 px-6 text-subheadline text-muted-foreground">
            {children}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
