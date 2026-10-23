// API pública de servidor da feature portfolio.
import "server-only";

export { getDividendsView } from "./server/dividends-view";
export { getReinvestmentView } from "./server/reinvestment-view";
export { getEvolution, getPortfolioSnapshot } from "./server/snapshot";
