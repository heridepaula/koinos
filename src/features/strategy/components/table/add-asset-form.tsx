"use client";

import { PlusIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { TickerInput } from "@/features/transactions/ui";
import { useTabBarAction } from "@/shared/components/tab-bar-action";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { Button } from "@/shared/ui/button";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/ui/drawer";
import { addTargetAssetAction } from "../../actions";

/**
 * Adiciona um FII à estratégia pelo ticker (com a busca do catálogo): no cabeçalho do card, na
 * mesa; no iPhone, pelo "+" ao lado da tab bar, numa folha com o campo e o botão largo embaixo.
 */
export function AddAssetForm() {
  const [ticker, setTicker] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const add = useAction(addTargetAssetAction, {
    onSuccess: () => {
      toast.success(`${ticker} adicionado à estratégia.`);
      setTicker("");
      setSheetOpen(false);
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (ticker.trim()) add.execute({ ticker, assetClass: "FII" });
  };

  useTabBarAction({ label: "Adicionar ativo", icon: PlusIcon, onPress: () => setSheetOpen(true) });

  return (
    <>
      <form className="flex items-center gap-2 max-md:hidden" onSubmit={submit}>
        <div className="w-32">
          <TickerInput value={ticker} onChange={setTicker} only="FII" />
        </div>
        <Button type="submit" disabled={add.isPending || !ticker.trim()}>
          <PlusIcon />
          Adicionar
        </Button>
      </form>
      <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Adicionar ativo</DrawerTitle>
            <DrawerDescription>
              Entra na estratégia sem rank, teto nem %: preencha na lista.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="pb-0">
            <form id="add-target-asset" onSubmit={submit}>
              <TickerInput value={ticker} onChange={setTicker} only="FII" />
            </form>
          </DrawerBody>
          <DrawerFooter>
            <Button
              type="submit"
              form="add-target-asset"
              disabled={add.isPending || !ticker.trim()}
            >
              Adicionar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
