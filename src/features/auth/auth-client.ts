import { createAuthClient } from "better-auth/react";

/** Cliente do Better Auth para o navegador (mesma origem, /api/auth). */
export const authClient = createAuthClient();
