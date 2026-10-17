// Funções com id explícito, só para scripts locais (ex.: importador).
// O app nunca importa este arquivo (regra de lint): lá o dono vem da sessão, via server.ts.
import "server-only";

export {
  ensureDefaultPortfolioId,
  findDefaultPortfolioId,
  findUserIdByEmail,
} from "./server/portfolio-repo";
