# Документация MAX Web Messenger (RU)

Русскоязычная документация проекта. Английская версия — [README.md](../../README.md), русское зеркало — [README.ru.md](../../README.ru.md).

## Разделы

| Документ | О чём |
|---|---|
| [Уведомления](./notifications.md) | Каналы уведомлений, умный роутинг без задвоения, разрешения браузера, проверка, ограничения и устранение неполадок |
| [Настройки](./settings.md) | Вкладки модалки настроек: интерфейс, звук и уведомления, шлюз и диагностика, интеграция, данные и аккаунт |
| [BFF-прокси](../../bff/README.md) | Бестокенный прокси для многопользовательского продакшна: контракт, запуск, связка с клиентом |

## Быстрые ссылки

- 🚀 Старт: [README.ru.md → Быстрый старт](../../README.ru.md#быстрый-старт)
- 🏗 Архитектура: [README.ru.md → Архитектура](../../README.ru.md#архитектура-и-инженерные-решения)
- 🔔 Как работают уведомления: [notifications.md](./notifications.md#как-это-работает)
- ✅ Проверка уведомлений: [notifications.md → Проверка](./notifications.md#проверка-уведомлений)
- 🛠 Диагностика шлюза: [settings.md → Шлюз и связь](./settings.md#шлюз-и-связь)

## Исходники, о которых говорится в документации

- Уведомления: [`src/utils/notifications.ts`](../../src/utils/notifications.ts), [`src/App.tsx`](../../src/App.tsx), [`src/components/SettingsModal.tsx`](../../src/components/SettingsModal.tsx), [`src/components/PopupNotification.tsx`](../../src/components/PopupNotification.tsx), [`src/hooks/useTabNotification.ts`](../../src/hooks/useTabNotification.ts)
- Настройки: [`src/components/SettingsModal.tsx`](../../src/components/SettingsModal.tsx), [`src/types.ts`](../../src/types.ts)
