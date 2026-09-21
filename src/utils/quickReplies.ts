import type { QuickReply, Language } from '../types';

/** Дефолтные шаблоны быстрых ответов. Вынесено отдельно, чтобы не тянуть модалку в стартовый бандл. */
export function getDefaultQuickReplies(lang: Language): QuickReply[] {
  if (lang === 'ru') {
    return [
      {
        id: 'qr_1',
        title: 'Приветствие',
        text: 'Здравствуйте! Сообщение отправлено из веб-клиента MAX.',
      },
      {
        id: 'qr_2',
        title: 'Проверка связи',
        text: 'Добрый день! Проверяю доставку сообщений через шлюз GREEN-API.',
      },
      {
        id: 'qr_3',
        title: 'Всё получил',
        text: 'Спасибо, всё получил и проверил. Отличного дня!',
      },
      {
        id: 'qr_4',
        title: 'Скоро отвечу',
        text: 'Сейчас немного занят, отвечу вам в течение 15 минут.',
      },
    ];
  }
  return [
    {
      id: 'qr_1',
      title: 'Greeting',
      text: 'Hello! Message sent from MAX Web client.',
    },
    {
      id: 'qr_2',
      title: 'Connection check',
      text: 'Good day! Testing message delivery via GREEN-API gateway.',
    },
    {
      id: 'qr_3',
      title: 'Received',
      text: 'Thank you, received and confirmed. Have a great day!',
    },
    {
      id: 'qr_4',
      title: 'Be right back',
      text: 'Currently occupied, will reply to you within 15 minutes.',
    },
  ];
}
