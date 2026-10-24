// API pública de servidor da feature portfolio.
import "server-only";

export { getClosedPositionsView } from "./server/closed-positions-view";
export { getDividendsView } from "./server/dividends-view";
export { getReinvestmentView } from "./server/reinvestment-view";
export { getEvolution, getPeriodResults, getPortfolioSnapshot } from "./server/snapshot";
