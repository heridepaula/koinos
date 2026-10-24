"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/ui/drawer";

/*
 * Diálogo que vira folha de baixo no celular: a folha macOS centrada a partir de 768 px e, abaixo,
 * o Drawer do iOS (arrastar para fechar, botões largos embaixo, teclado virtual). As partes têm os
 * nomes das do Dialog; ResponsiveDialogBody é o miolo que rola na folha.
 */

const MobileContext = React.createContext(false);

function ResponsiveDialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const mobile = useIsMobile();
  return (
    <MobileContext value={mobile}>
      {mobile ? (
        <Drawer open={open} onOpenChange={(next) => onOpenChange?.(next)}>
          {children}
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={(next) => onOpenChange?.(next)}>
          {children}
        </Dialog>
      )}
    </MobileContext>
  );
}

function ResponsiveDialogTrigger({ render }: { render: React.ReactElement }) {
  return React.useContext(MobileContext) ? (
    <DrawerTrigger render={render} />
  ) : (
    <DialogTrigger render={render} />
  );
}

function ResponsiveDialogContent({
  className,
  children,
}: {
  /** Só para o diálogo da mesa (largura, por exemplo). */
  className?: string;
  children: React.ReactNode;
}) {
  return React.useContext(MobileContext) ? (
    <DrawerContent>{children}</DrawerContent>
  ) : (
    <DialogContent className={className}>{children}</DialogContent>
  );
}

function ResponsiveDialogHeader(props: React.ComponentProps<"div">) {
  return React.useContext(MobileContext) ? (
    <DrawerHeader {...props} />
  ) : (
    <DialogHeader {...props} />
  );
}

function ResponsiveDialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return React.useContext(MobileContext) ? (
    <DrawerBody className={className} {...props} />
  ) : (
    <div className={cn("grid gap-4", className)} {...props} />
  );
}

function ResponsiveDialogFooter(props: React.ComponentProps<"div">) {
  return React.useContext(MobileContext) ? (
    <DrawerFooter {...props} />
  ) : (
    <DialogFooter {...props} />
  );
}

function ResponsiveDialogTitle({ children }: { children: React.ReactNode }) {
  return React.useContext(MobileContext) ? (
    <DrawerTitle>{children}</DrawerTitle>
  ) : (
    <DialogTitle>{children}</DialogTitle>
  );
}

function ResponsiveDialogDescription({ children }: { children: React.ReactNode }) {
  return React.useContext(MobileContext) ? (
    <DrawerDescription>{children}</DrawerDescription>
  ) : (
    <DialogDescription>{children}</DialogDescription>
  );
}

export {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
};
