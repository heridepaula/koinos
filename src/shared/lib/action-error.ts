/** Mensagem legível a partir do erro de uma action do next-safe-action. */
export function actionErrorMessage(error: {
  serverError?: unknown;
  validationErrors?: unknown;
  thrownError?: Error;
}): string {
  if (typeof error.serverError === "string") return error.serverError;
  const first = firstValidationMessage(error.validationErrors);
  if (first) return first;
  return "Não foi possível concluir a operação. Tente novamente.";
}

function firstValidationMessage(errors: unknown): string | null {
  if (!errors || typeof errors !== "object") return null;
  for (const [key, value] of Object.entries(errors)) {
    if (key === "_errors" && Array.isArray(value) && typeof value[0] === "string") return value[0];
    const nested = firstValidationMessage(value);
    if (nested) return nested;
  }
  return null;
}
