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
    };
    statusData?: {
      status: string;
      sendByApi?: boolean;
    };
  };
}

export type PollingStatus = 'idle' | 'active' | 'error' | 'reconnecting' | 'paused';

export type Language = 'ru' | 'en';

export interface AppSettings {
  pollingIntervalMs: number; // 1000, 2000, 5000
  soundEnabled: boolean;
  sendShortcut: 'enter' | 'ctrl_enter';
  fontSize: 'small' | 'medium' | 'large';
  showPhoneFormatting: boolean;
}
