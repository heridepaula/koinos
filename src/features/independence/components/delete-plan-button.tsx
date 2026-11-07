"use client";

import { Trash2Icon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/shared/lib/action-error";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";
import { deleteIndependencePlanAction } from "../actions";

/**
 * "Excluir meta" na revisão do questionário: apaga o plano para refazê-lo por completo. Um botão
 * vermelho de largura total, com a confirmação em alerta do iOS, como o de excluir lançamento. Quem
 * zera a edição é o painel, que sai de cena quando a página recarrega sem a meta.
 */
export function DeletePlanButton() {
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(deleteIndependencePlanAction, {
    onSuccess: () => {
      toast.success("Meta excluída.");
      setOpen(false);
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });

  return (
    <div className="grid gap-1.5">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger
          render={
            <Button
              variant="outline"
              className="h-auto min-h-12 w-full justify-start rounded-xl px-4 text-loss"
            />
          }
        >
          <Trash2Icon />
          Excluir meta
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a meta?</AlertDialogTitle>
            <AlertDialogDescription>
              As respostas do questionário são apagadas e você recomeça do zero. O patrimônio, as
              transações e os proventos não mudam.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isPending} onClick={() => execute()}>
              {isPending ? <Spinner /> : null}
              Excluir meta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <p className="px-1 text-footnote text-muted-foreground">
        Para refazer tudo do começo, em vez de editar uma resposta.
      </p>
    </div>
  );
}
