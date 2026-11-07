import "server-only";
import { cache } from "react";
import { getTenant } from "@/features/auth/server";
import { traced } from "@/shared/lib/tracing";
import { withReadState } from "../domain/alerts";
import type { AlertNotification } from "../domain/types";
import { listAlertReads } from "./alert-read-repo";
import { getPortfolioSnapshot } from "./snapshot";

/**
 * Os alertas do sino: os da carteira inteira (Geral, com os das ações marcados), cada um lido ou
 * não. Fica no layout, então vale para todas as páginas, seja qual for a classe aberta.
 */
export const getMyAlertNotifications = cache(
  traced(
    "view.alerts",
    async (): Promise<AlertNotification[]> => {
      const tenant = await getTenant(); // chama connection(): só em tempo de requisição
      const [snapshot, reads] = await Promise.all([
        getPortfolioSnapshot(),
        listAlertReads(tenant.portfolioId),
      ]);
      return withReadState(snapshot.alerts, reads);
    },
    (items) => ({
      "koinos.view.alerts": items.length,
      "koinos.view.unread_alerts": items.filter((item) => !item.read).length,
    }),
  ),
);
