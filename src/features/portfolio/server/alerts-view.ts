import "server-only";
import { cache } from "react";
import { getTenant } from "@/features/auth/server";
import { traced } from "@/shared/lib/tracing";
import { withReadState } from "../domain/alerts";
import { dividendAlerts } from "../domain/dividend-alerts";
import type { AlertNotification } from "../domain/types";
import { getAssetClasses } from "@/features/market-data/server";
import { getMyDividends } from "@/features/transactions/server";
import { listAlertReads } from "./alert-read-repo";
import { getDividendsView } from "./dividends-view";
import { getPortfolioSnapshot } from "./snapshot";

/**
 * Os alertas do sino: os proventos anunciados e os que caíram na conta (de FIIs e ações), e depois
 * os da carteira inteira (Geral, com os das ações marcados), cada um lido ou não. Fica no layout, então vale para todas as páginas, seja qual for a classe aberta.
 */
export const getMyAlertNotifications = cache(
  traced(
    "view.alerts",
    async (): Promise<AlertNotification[]> => {
      const tenant = await getTenant(); // chama connection(): só em tempo de requisição
      const [snapshot, dividends, received, reads] = await Promise.all([
        getPortfolioSnapshot(),
        getDividendsView(),
        getMyDividends(),
        listAlertReads(tenant.portfolioId),
      ]);
      // Sem nenhum provento importado, todo anúncio pareceria "a receber" (a tela de proventos
      // também só mostra o convite): os alertas de proventos esperam o primeiro extrato.
      const payments = dividends.imported
        ? dividendAlerts({
            now: new Date(),
            upcoming: dividends.upcoming,
            received,
            classes: await getAssetClasses(dividends.upcoming.map((item) => item.ticker)),
          })
        : [];
      return withReadState([...payments, ...snapshot.alerts], reads);
    },
    (items) => ({
      "koinos.view.alerts": items.length,
      "koinos.view.unread_alerts": items.filter((item) => !item.read).length,
    }),
  ),
);
