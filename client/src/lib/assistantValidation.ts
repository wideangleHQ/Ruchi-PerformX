import { z } from 'zod';

/**
 * Mirrors the POST /assistant/chat DTO. The API runs `forbidNonWhitelisted`, so
 * a field here without the matching DTO field is a 400 with an unhelpful
 * message, and a field of the wrong shape is the same.
 *
 * Worth validating rather than trusting: `conversation_id` is `@IsUUID()` on the
 * server, and the client generates it. A fallback that produced something merely
 * unique rather than a real v4 would have 400d every question on any host
 * without `crypto.randomUUID`, which means anything served over a LAN address
 * rather than localhost. Checking it here fails loudly at the boundary instead.
 */
export const assistantChatSchema = z.object({
  conversation_id: z.string().uuid('conversation_id must be a UUID'),
  question: z.string().trim().min(1, 'Ask a question').max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      }),
    )
    .max(40)
    .optional(),
  page_context: z.string().max(200).optional(),
});

export type AssistantChatBody = z.infer<typeof assistantChatSchema>;
