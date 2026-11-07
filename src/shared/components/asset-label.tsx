import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { cn } from "@/shared/lib/utils";

/**
 * Logo + ticker (+ nome). Sem logo, mostra as iniciais do ticker. `size="lg"` é o das listas do
 * celular: logo de 36 px e o ticker em Headline, como as células com imagem do iOS.
 */
export function AssetLabel({
  ticker,
  name,
  logoUrl,
  size = "default",
  href,
}: {
  ticker: string;
  name?: string | null;
  logoUrl?: string | null;
  size?: "default" | "lg";
  /** Faz do ticker um link (a página do ativo). Não use dentro de botões ou gatilhos de folha. */
  href?: string;
}) {
  const large = size === "lg";
  return (
    <div className={cn("flex min-w-0 items-center", large ? "gap-3" : "gap-2")}>
      <Avatar className={cn(large ? "size-9 rounded-[10px]" : "size-6 rounded-md")}>
        {logoUrl ? <AvatarImage src={logoUrl} alt="" referrerPolicy="no-referrer" /> : null}
        <AvatarFallback
          className={cn(
            "text-foreground",
            large ? "rounded-[10px] text-caption" : "rounded-md text-[0.6rem]",
          )}
        >
          {ticker.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 leading-tight">
        {href ? (
          <Link
            href={href}
            className={cn("hover:underline", large ? "text-headline" : "font-medium")}
          >
            {ticker}
          </Link>
        ) : (
          <span className={cn(large ? "text-headline" : "font-medium")}>{ticker}</span>
        )}
        {name ? (
          <span
            className={cn("truncate text-muted-foreground", large ? "text-footnote" : "text-xs")}
          >
            {name}
          </span>
        ) : null}
      </div>
    </div>
  );
}
