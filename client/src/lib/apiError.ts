/**
 * The message the server actually sent, or a fallback.
 *
 * Nest returns `message` as a string for a thrown exception and as an array of
 * strings when class-validator rejects a DTO, so both shapes have to be handled
 * everywhere an error is shown. This was hand-rolled in more than twenty files,
 * and two of them wrote `error instanceof Error ? error.message : ...`, which
 * always wins for an AxiosError and shows "Request failed with status code 409"
 * in place of "A leave type with that name exists".
 */
export function apiMessage(error: unknown, fallback = 'Something went wrong'): string {
  const message = (
    error as { response?: { data?: { message?: string | string[] } } } | null
  )?.response?.data?.message;

  if (Array.isArray(message)) return message[0] ?? fallback;
  if (typeof message === 'string' && message.trim() !== '') return message;
  return fallback;
}

/**
 * Every message the server sent. Validation failures arrive as a list and the
 * apply form shows them all at once, because fixing one field at a time on a
 * phone is miserable.
 */
export function apiMessages(error: unknown, fallback = 'Something went wrong'): string[] {
  const message = (
    error as { response?: { data?: { message?: string | string[] } } } | null
  )?.response?.data?.message;

  if (Array.isArray(message)) return message.length > 0 ? message : [fallback];
  if (typeof message === 'string' && message.trim() !== '') return [message];
  return [fallback];
}
