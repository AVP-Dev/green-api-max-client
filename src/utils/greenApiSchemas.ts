/**
 * greenApiSchemas.ts — runtime-валидация внешних payload GREEN-API (zod).
 * Заменяет слепые `as any`: повреждённые/враждебные тела отбрасываются,
 * очередь при этом обязательно подтверждается (ack), чтобы не висеть.
 */
import { z } from 'zod';

/** Уведомление очереди: receiptId обязан быть числом, body — объект любой формы. */
export const notificationSchema = z.object({
  receiptId: z.number(),
  body: z.record(z.string(), z.unknown()).optional().default({}),
});

export type ParsedNotification = z.infer<typeof notificationSchema>;

/** Сообщение журнала (lastIncoming/lastOutgoing/getChatHistory): всё опционально, лишнее игнорируется. */
export const journalMessageSchema = z
  .object({
    type: z.string().optional(),
    idMessage: z.string().optional(),
    timestamp: z.number().optional(),
    typeMessage: z.string().optional(),
    chatId: z.string().optional(),
    chatType: z.string().optional(),
    textMessage: z.string().optional(),
    extendedTextMessage: z
      .object({ text: z.string().optional(), description: z.string().optional(), title: z.string().optional() })
      .optional(),
    fileMessage: z
      .object({ downloadUrl: z.string().optional(), caption: z.string().optional(), fileName: z.string().optional() })
      .optional(),
    senderId: z.string().optional(),
    senderName: z.string().optional(),
    senderContactName: z.string().optional(),
    statusMessage: z.string().optional(),
    sendByApi: z.boolean().optional(),
  })
  .passthrough();

export type ParsedJournalMessage = z.infer<typeof journalMessageSchema>;

/** Сырой контакт getContacts: требуется только id-строка. */
export const rawContactSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    contactName: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

/** Безопасный парс уведомления. null — тело повреждено (caller обязан ack по receiptId если он есть). */
export function parseNotification(data: unknown): ParsedNotification | null {
  const res = notificationSchema.safeParse(data);
  return res.success ? res.data : null;
}

/** Фильтрует массив журнала, отбрасывая невалидные элементы. */
export function parseJournalList(data: unknown): ParsedJournalMessage[] {
  if (!Array.isArray(data)) return [];
  const out: ParsedJournalMessage[] = [];
  for (const item of data) {
    const res = journalMessageSchema.safeParse(item);
    if (res.success) out.push(res.data);
  }
  return out;
}
