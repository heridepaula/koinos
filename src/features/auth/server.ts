// API pública de servidor da feature auth.
import "server-only";

export { auth } from "./server/auth";
export {
  getCurrentUser,
  getTenant,
  redirectIfSignedIn,
  requireTenant,
  UnauthorizedError,
  type CurrentUser,
  type Tenant,
} from "./server/session";
export { ActionError, authActionClient } from "./server/action-client";
