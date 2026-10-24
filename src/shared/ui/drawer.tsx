"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { XIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

/*
 * Folha de baixo do iPhone (sheet do iOS 26) sobre o Drawer do Base UI: flutua a 8 px das bordas,
 * cantos de 34 px (contínuos onde há corner-shape), alça no topo e o vidro dos diálogos. Arrastar
 * para baixo fecha; o teclado virtual empurra o campo focado para cima (VirtualKeyboardProvider).
 * Partes: DrawerHeader e DrawerFooter fixos, DrawerBody rola entre os dois.
 */

/** Curva da folha do iOS: sobe rápido e assenta devagar. */
const SHEET_EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";

function Drawer(props: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger(props: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose(props: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DrawerPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  return (
    <DrawerPrimitive.VirtualKeyboardProvider>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Backdrop
          data-slot="drawer-backdrop"
          className={cn(
            "fixed inset-0 z-50 min-h-dvh bg-black [--backdrop-opacity:0.22] dark:[--backdrop-opacity:0.6]",
            "opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-450",
            SHEET_EASE,
            "data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:opacity-0 data-swiping:duration-0",
            // iOS 26: o fundo cobre também a área sob a barra do Safari.
            "supports-[-webkit-touch-callout:none]:absolute",
          )}
        />
        <DrawerPrimitive.Viewport
          data-slot="drawer-viewport"
          className="fixed inset-0 z-50 flex items-end justify-center px-2 pt-[calc(var(--safe-top)+0.75rem)] pb-2"
        >
          <DrawerPrimitive.Popup
            data-slot="drawer-popup"
            className={cn(
              "relative flex max-h-full w-full max-w-lg flex-col rounded-[34px] text-sm text-popover-foreground shadow-[0_-4px_40px_rgb(0_0_0/0.18)] ring-1 ring-foreground/10 outline-none",
              "[transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-450",
              SHEET_EASE,
              "data-ending-style:[transform:translateY(calc(100%+1rem))] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:[transform:translateY(calc(100%+1rem))] data-swiping:select-none",
              className,
            )}
            {...props}
          >
            {/* Alça: diz que a folha arrasta. Decorativa: o leitor de tela fecha pelo botão. */}
            <div
              aria-hidden="true"
              className="mx-auto mt-1.5 h-[5px] w-9 shrink-0 rounded-full bg-foreground/20"
            />
            {children}
            {showCloseButton ? (
              <DrawerPrimitive.Close
                data-slot="drawer-close"
                render={
                  <Button variant="secondary" size="icon-sm" className="absolute top-3 right-3" />
                }
              >
                <XIcon />
                <span className="sr-only">Fechar</span>
              </DrawerPrimitive.Close>
            ) : null}
          </DrawerPrimitive.Popup>
        </DrawerPrimitive.Viewport>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.VirtualKeyboardProvider>
  );
}

/** Título centrado, como a barra de uma folha do iOS; o botão de fechar fica à direita. */
function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "grid shrink-0 touch-none gap-1 px-14 pt-2.5 pb-3 text-center select-none",
        className,
      )}
      {...props}
    />
  );
}

/** Corpo que rola entre o cabeçalho e o rodapé (o gesto de fechar só vale com ele no topo). */
function DrawerBody({ className, ...props }: DrawerPrimitive.Content.Props) {
  return (
    <DrawerPrimitive.Content
      data-slot="drawer-body"
      className={cn(
        "min-h-0 flex-1 touch-auto overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,calc(var(--safe-bottom)-0.5rem))]",
        className,
      )}
      {...props}
    />
  );
}

/** Botões largos de 50 px, ao alcance do polegar; o principal vem primeiro. */
function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "grid shrink-0 gap-2 px-4 pt-3 pb-[max(1.25rem,calc(var(--safe-bottom)-0.5rem))] *:data-[slot=button]:h-12 *:data-[slot=button]:text-headline",
        className,
      )}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("font-heading text-headline", className)}
      {...props}
    />
  );
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-footnote text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
};
