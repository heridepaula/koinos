"use client";

import { LogOutIcon } from "lucide-react";
import { InsetGroup, insetRowClass } from "@/shared/components/inset-list";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Skeleton } from "@/shared/ui/skeleton";
import { initials, signOutAndLeave } from "./sign-out";
import type { UserMenuUser } from "./user-menu";

/** A conta na folha "Mais" do iPhone: quem está logado e o Sair, como no fim dos Ajustes. */
export function AccountSection({ user }: { user: UserMenuUser }) {
  return (
    <InsetGroup title="Conta">
      <div className={insetRowClass(false)}>
        <Avatar className="size-10">
          {user.image ? <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" /> : null}
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 flex-1">
          <span className="truncate font-medium">{user.name}</span>
          <span className="truncate text-footnote text-muted-foreground">{user.email}</span>
        </div>
      </div>
      <button type="button" onClick={signOutAndLeave} className={cn(insetRowClass(), "text-loss")}>
        <LogOutIcon className="size-5" aria-hidden="true" />
        Sair
      </button>
    </InsetGroup>
  );
}

export function AccountSectionSkeleton() {
  return (
    <InsetGroup title="Conta">
      <div className={insetRowClass(false)}>
        <Skeleton className="size-10 rounded-full" />
        <div className="grid flex-1 gap-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
    </InsetGroup>
  );
}
