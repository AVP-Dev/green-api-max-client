export interface GreenApiCredentials {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl?: string; // Optional custom gateway host (e.g. https://api.green-api.com)
}

export type MessageDirection = 'outgoing' | 'incoming';
export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface ChatMessage {
  id: string;
  chatId: string; // Plain numeric phone ID (e.g. 79991234567)
  senderPhone: string;
  text: string;
  timestamp: number; // Unix timestamp in milliseconds
  direction: MessageDirection;
  status: MessageStatus;
}

export interface ChatDialog {
  chatId: string; // Plain numeric phone ID
  displayName?: string;
  lastMessageText: string;
  lastMessageTimestamp: number;
  lastMessageDirection: MessageDirection;
  unreadCount: number;
  draft?: string;
  isPinned?: boolean;
}

export interface GreenApiNotification {
  receiptId: number;
  body: {
    typeWebhook: string;
    instanceData?: {
      idInstance: number;
      typeInstance: string;
      wid: string;
    };
    timestamp?: number;
    idMessage?: string;
    chatId?: string;
    sender?: string;
    presence?: string;
    state?: string;
    status?: string;
    senderData?: {
      chatId: string;
      sender: string;
      senderName?: string;
      senderContactName?: string;
    };
    presenceData?: {
      presence?: string;
      chatId?: string;
    };
    chatData?: {
      chatId?: string;
    };
    messageData?: {
      typeMessage: string;
      textMessageData?: {
        textMessage: string;
      };
      extendedTextMessageData?: {
        text: string;
        description?: string;
        title?: string;
      };
      fileMessageData?: {
        downloadUrl?: string;
        caption?: string;
        fileName?: string;
        mimeType?: string;
      };
      locationMessageData?: {
        nameLocation?: string;
        address?: string;
        latitude?: number;
        longitude?: number;
      };
      contactMessageData?: {
        displayName?: string;
        vcard?: string;
      };
    };
    statusData?: {
      status: string;
      sendByApi?: boolean;
    };
  };
}

export type PollingStatus = 'idle' | 'active' | 'error' | 'reconnecting' | 'paused';

export type Language = 'ru' | 'en';

export type ContactSource = 'api' | 'manual' | 'chat' | 'green_api';

export interface Contact {
  id: string; // Clean numeric phone (MAX ID) e.g. "79991234567"
  name?: string; // Profile name
  contactName?: string; // Address book friendly name (e.g. "Иван Иванов")
  avatarUrl?: string;
  type?: 'user' | 'group';
  source: ContactSource;
  note?: string;
  company?: string;
  lastSeen?: number | null;
  updatedAt: number;
}

export interface GreenApiRawContact {
  id: string; // e.g. "79991234567@c.us" or "79991234567"
  name?: string;
  contactName?: string;
  type?: 'user' | 'group';
}

export interface GreenApiJournalMessage {
  type?: 'incoming' | 'outgoing' | string;
  idMessage?: string;
  timestamp?: number;
  typeMessage?: string;
  chatId?: string;
  chatType?: string;
  textMessage?: string;
  extendedTextMessage?: {
    text?: string;
    description?: string;
    title?: string;
  };
  fileMessage?: {
    downloadUrl?: string;
    caption?: string;
    fileName?: string;
  };
  senderId?: string;
  senderName?: string;
  senderContactName?: string;
  statusMessage?: string;
  sendByApi?: boolean;
}

export interface AppSettings {
  pollingIntervalMs: number; // 1000, 2000, 5000
  soundEnabled: boolean;
  sendShortcut: 'enter' | 'ctrl_enter';
  fontSize: 'small' | 'medium' | 'large';
  showPhoneFormatting: boolean;
}

export interface QuickReply {
  id: string;
  title: string;
  text: string;
  createdAt?: number;
}

