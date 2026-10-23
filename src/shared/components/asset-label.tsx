import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";

/** Logo + ticker (+ nome). Sem logo, mostra as iniciais do ticker. */
export function AssetLabel({
  ticker,
  name,
  logoUrl,
}: {
  ticker: string;
  name?: string | null;
  logoUrl?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-6 rounded-md">
        {logoUrl ? <AvatarImage src={logoUrl} alt="" referrerPolicy="no-referrer" /> : null}
        <AvatarFallback className="rounded-md text-[0.6rem] text-foreground">
          {ticker.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 leading-tight">
        <span className="font-medium">{ticker}</span>
        {name ? <span className="truncate text-xs text-muted-foreground">{name}</span> : null}
      </div>
    </div>
  );
}
