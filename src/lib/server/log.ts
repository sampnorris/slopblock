export function logInfo(message: string, context: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: "info", message, ...context }));
}

export function logError(message: string, error: unknown, context: Record<string, unknown> = {}) {
  const normalized = error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    : { message: String(error) };

  console.error(JSON.stringify({ level: "error", message, error: normalized, ...context }));
}
