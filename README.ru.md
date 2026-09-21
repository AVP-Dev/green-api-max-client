# MAX Web Messenger Client

> **Русский** • [🇬🇧 English version](./README.md) · [📚 Документация](./docs/ru/README.md)

Лёгкий production-ready React веб-клиент для экосистемы мессенджера MAX через HTTP-эндпоинты GREEN-API. Быстрый отзывчивый интерфейс в духе современных веб-мессенджеров: управление чатами, статусы доставки, поиск контактов и настраиваемая маршрутизация шлюза.

---

## Технологический стек

- **Фронтенд:** React 19 (функциональные компоненты, хуки)
- **Язык:** TypeScript 7 (строгая типизация, `tsc --noEmit`)
- **Сборка:** Vite 8 с `@vitejs/plugin-react` и `vite-plugin-pwa`
- **Стили:** Tailwind CSS (class-based тёмная тема, палитра централизована в `src/theme.ts`)
- **Иконки:** Lucide Icons (`lucide-react`)
- **Рантайм-валидация:** `zod`-схемы для payload GREEN-API (`src/utils/greenApiSchemas.ts`)
- **Состояние и хранение:** React State & Hooks с синхронизацией в `localStorage`/`sessionStorage`
- **Тесты:** Vitest (`npm test`), включая сторож централизации темы
- **Контейнеризация:** Docker (многостадийная сборка) и Nginx Alpine
- **CI:** GitHub Actions (`.github/workflows/ci.yml`)

---

## Возможности

- **Совместимость с экосистемой MAX:** строго числовой формат телефонов (например, `79991234567`) без посторонних суффиксов.
- **Двусторонняя связь:** мгновенная отправка текста через `sendMessage` и приём сообщений в реальном времени через `receiveNotification`.
- **Маршрутизация шлюза и инстанса:** стандартный публичный шлюз GREEN-API (`https://api.green-api.com`) и выделенные хосты инстансов (например, `https://7103.api.greenapi.com`).
- **Управление диалогами:** живой поиск, создание чатов, закрепление, счётчики непрочитанных, удаление диалогов.
- **Полная двуязычная локализация:** переключение Русский/English на лету (интерфейс, время, статусы, алерты).
- **Адаптивная вёрстка:** десктопный сплит-пейн и мобильный полноэкранный режим с нижней навигацией.
- **PWA и офлайн:** Web App Manifest, кэширование через service worker, баннер потери сети.
- **Умные уведомления без задвоения:** красивая карточка внутри вкладки, когда вы на неё смотрите, и системное уведомление браузера, когда вкладка в фоне, — всегда только один канал за раз. Проверка разрешения, включение в один клик и независимые тумблеры каналов в «Настройки → Звук и уведомления». Подробнее: [Уведомления](./docs/ru/notifications.md).
- **Богатые настройки и интеграции:** язык интерфейса, горячие клавиши, интервал опроса, диагностика шлюза с автоисправлением, шаблоны быстрых ответов, записная книжка с синхронизацией, бэкап в JSON и iframe/postMessage-интеграция с CRM. Подробнее: [Настройки](./docs/ru/settings.md).
- **Тёмная тема:** режимы Светлая / Тёмная / Система с pre-paint инициализацией (без вспышки), переключатель в «Настройки → Интерфейс». Палитра централизована в `src/theme.ts` и охраняется тестом-сторожем в CI.
- **Приватность:** session- или persistent-хранение токенов (переключатель), авто-выход при простое, TTL сообщений, шифрованные AES-GCM бэкапы с импортом.
- **BFF-прокси (опционально):** бестокенный режим браузера для многопользовательского продакшна (`bff/`, Node 22 без зависимостей) — см. [bff/README.md](./bff/README.md).
- **Масштабируемая записная книжка:** алфавитные секции с липкими заголовками, живой поиск со счётчиками, порционный рендер для тысяч контактов, синхронизация с GREEN-API.
- **Честный typing:** исходящее «печатает» работает (`sendTyping` по докам); входящего typing-события в GREEN-API нет — индикатор в шапке оставлен заделом, проверяется пунктом «Тест» в меню ⋮.
- **Честный presence:** никакого фейкового «в сети» — в шапке online/недавно/«был(а) сегодня» только по реальной входящей активности (GREEN-API presence не отдаёт), для групп — «группа», обновление вживую каждые 30 сек.

---

## Быстрый старт

### Требования

- Node.js 20.x или 22.x
- npm 10.x или выше (или pnpm / bun)

### Установка и локальная разработка

```bash
# Клонировать репозиторий
git clone https://github.com/AVP-Dev/green-api-max-client.git

# Перейти в каталог проекта
cd green-api-max-client

# Установить зависимости
npm install

# Запустить dev-сервер (слушает 0.0.0.0:3000)
npm run dev
```

Приложение будет доступно по адресу `http://localhost:3000`.

### Продакшн-сборка и проверка

```bash
# Проверка типов TypeScript
npm run lint

# Юнит-тесты (vitest)
npm test

# Сборка продакшн-бандла в dist/
npm run build

# Локальный предпросмотр сборки
npm run preview
```

### Переменные окружения (build-time)

Скопируйте `.env.example` в `.env` перед сборкой. Переменные `VITE_*` вшиваются Vite **на этапе сборки** — runtime-`environment:` на них не действует, используйте `build.args` в docker-compose (уже проброшены):

```bash
cp .env.example .env
# VITE_TRUSTED_PARENT_ORIGINS=https://crm.example.com,https://portal.example.com
# VITE_DEFAULT_API_URL=https://3100.api.green-api.com
# VITE_BFF_URL=https://bff.example.com  # опционально, см. bff/README.md
```

Embed-allowlist можно передать и через URL: `?parentOrigin=https://crm.example.com`.
Без него виджет отбрасывает входящие postMessage-команды в продакшне (fail-closed).

### Docker-развёртывание

В репозитории есть многостадийный `Dockerfile` и `docker-compose.yml`:

```bash
# Запуск через Docker Compose
docker compose up -d --build

# Или напрямую через Docker CLI
docker build -t max-web-messenger .
docker run -d -p 3000:80 --name max-web-messenger max-web-messenger
```

---

## CI/CD

Строгий GitHub Actions workflow в `.github/workflows/ci.yml`:

1. **Type Safety, Lint & Tests (`typecheck`):** `ubuntu-latest`, Node.js 22, `npm ci`, `tsc --noEmit` — ноль ошибок типов, плюс `npm test` (Vitest, включая сторож централизации темы).
2. **Security Audit (`security-audit`):** `npm audit --omit=dev --audit-level=moderate` — падает на moderate+.
3. **Production Build (`build`):** сборка `vite build`, проверка `dist/index.html` и бандлов, загрузка артефактов.
4. **Docker Verification (`docker`):** проверка многостадийного контейнера и Nginx-конфигурации SPA.

---

## Архитектура и инженерные решения

### 1. HTTP Long-Polling (`receiveNotification`)

- **Опрос на клиенте:** чтобы оставаться автономным SPA без промежуточного бэкенда и публичного webhook-туннеля, входящие забираются вызовом `receiveNotification`.
- **Адаптивный backoff:** пауза 2 сек при пустой очереди, ускорение до 300 мс сразу после сообщения (разгрести пачку), экспоненциальный backoff до 10 сек при сетевых ошибках.
- **Компромисс для продакшна:** в многопользовательских средах клиентский polling — лишние roundtrip'ы и расход батареи. Там обычно: вебхуки GREEN-API → бэкенд → WebSocket/SSE клиентам.

### 2. Подтверждение очереди (`deleteNotification` и `receiptId`)

- **FIFO-очередь:** GREEN-API — очередь уведомлений. `receiveNotification` возвращает событие с числовым `receiptId`.
- **Анти-дедлок:** пока уведомление не удалено через `deleteNotification(credentials, receiptId)`, следующие сообщения стоят за ним.
- **Немедленное подтверждение:** клиент обрабатывает `incomingMessageReceived`, обновляет диалог и сразу вызывает `deleteNotification`. Служебные события (печатает, статусы) тоже подтверждаются сразу.

### 3. Индикаторы печати (`sendTyping` / presence)

- **Исходящее «печатает» работает:** пока печатаете, клиент шлёт `sendTyping` (`{ chatId, typingTime: 5000 }`, сначала plain numeric, при 400 — fallback на `@c.us` по официальным докам).
- **Входящее «печатает» прийти не может:** у GREEN-API нет входящего presence/typing вебхука (проверено по официальному списку `type-webhook`), поэтому «собеседник печатает» из сети не приезжает никогда. Индикатор в шапке оставлен заделом (проверяется пунктом «Тест» в меню ⋮) — парсер в `src/utils/typing.ts`.

### 4. Безопасность и учётные данные

- **Предупреждение:** ввод токенов (`idInstance`, `apiTokenInstance`) прямо в браузерное SPA уместен для демо, внутренних инструментов и личного однопользовательского использования.
- **BFF best practice:** для продакшна с недоверенными пользователями секреты нельзя хранить в `localStorage` — запросы проксируются через безопасный бэкенд (BFF), а пользователи аутентифицируются через JWT/сессии.
- **BFF уже в репозитории:** минимальный прокси без зависимостей (`bff/server.mjs`, см. [bff/README.md](./bff/README.md)) + бестокенный режим клиента (`src/utils/bffClient.ts`, тумблер в «Настройки → Шлюз и связь»). Детали — в [`SECURITY.md`](./SECURITY.md).

### 4. Умные уведомления без задвоения

- **Роутинг по фокусу:** каждое входящее сообщение идёт ровно в один визуальный канал — карточка `PopupNotification` во вкладке, если она в фокусе, или нативное `Notification` ОС/браузера, если вкладка скрыта. Фокус определяется через `document.hidden` / `document.hasFocus()` и трекинг фокуса окна. Центр логики — `src/utils/notifications.ts` (`resolveNotificationChannel`).
- **Дедупликация по чатам:** нативные уведомления делят `tag: max-chat-<chatId>` с `renotify: true` — быстрые сообщения одного чата заменяют друг друга, а не копятся стопкой (паттерн MDN Notifications API).
- **Автоочистка:** протухшие системные уведомления закрываются сами при `visibilitychange`/`focus` и при открытии чата; открытие чата также гасит его карточку во вкладке.
- **Хром вкладки всегда включён:** мигание заголовка и бейдж на favicon (`useTabNotification`) — индикаторы уровня вкладки, работают независимо от канала.
- **Управление (Настройки → Звук и уведомления):** живой статус разрешения ОС (`default` / `granted` / `denied` / `unsupported`), включение в один клик (запрос строго внутри жеста клика — требование Chrome), независимые тумблеры `browserNotificationsEnabled` / `inAppPopupsEnabled`, тест умного канала и принудительный тест системного.
- **Известное ограничение SPA:** `new Notification()` срабатывает, только пока открыта вкладка (опрос останавливается вместе с ней). Уведомления при полностью закрытом браузере требуют серверного Push + Service Worker — вне скоупа long-polling SPA.
- **Полное руководство:** [docs/ru/notifications.md](./docs/ru/notifications.md)

---

## Структура проекта

```
├── .github/
│   └── workflows/
│       └── ci.yml             # typecheck + тесты + аудит + сборка + docker
├── bff/                       # Опциональный бестокенный BFF-прокси (Node 22, без зависимостей)
│   ├── server.mjs             # Проксирование send/receive/ack, vault токенов
│   └── README.md              # Контракт BFF и запуск
├── docs/
│   └── ru/                    # Русская документация (со взаимными ссылками)
│       ├── README.md          # Указатель русской документации
│       ├── notifications.md   # Уведомления: каналы, роутинг, разрешения, проверка
│       └── settings.md        # Вкладки настроек
├── public/                    # Статика и PWA-иконки
│   ├── favicon.svg            # Favicon
│   ├── logo.svg               # Векторный логотип MAX
│   ├── apple-touch-icon.png   # iOS-иконка
│   ├── pwa-192x192.png        # PWA-иконка
│   ├── pwa-512x512.png        # PWA-сплэш
│   └── pwa-maskable-512x512.png # Маскируемая PWA-иконка
├── scripts/
│   └── generate-icons.js      # Генерация иконок (Sharp)
├── src/
│   ├── components/            # React UI-компоненты
│   │   ├── AddressBookModal.tsx # Записная книжка (CRUD + синхронизация GREEN-API)
│   │   ├── AuthScreen.tsx     # Учётные данные инстанса и шлюз
│   │   ├── Avatar.tsx         # Инициалы и детерминированные пастельные цвета
│   │   ├── ChatView.tsx       # Лента сообщений, статусы, поле ввода
│   │   ├── ErrorBoundary.tsx  # Граница ошибок React
│   │   ├── IntegrationModal.tsx # (legacy) диалог интеграции
│   │   ├── IntegrationPanel.tsx # Iframe/URL/postMessage-интеграция с CRM
│   │   ├── MaxLogo.tsx        # Векторный знак MAX
│   │   ├── MobileBottomNav.tsx # Мобильная нижняя навигация
│   │   ├── NewChatModal.tsx   # Валидация телефона и создание чата
│   │   ├── OfflineIndicator.tsx # Баннер потери сети
│   │   ├── PopupNotification.tsx # Карточка входящего сообщения во вкладке
│   │   ├── PWAInstallButton.tsx # Кнопка установки на домашний экран
│   │   ├── QuickRepliesModal.tsx # Управление шаблонами быстрых ответов
│   │   ├── SettingsModal.tsx  # 5 вкладок: чат, уведомления, шлюз, интеграция, данные
│   │   ├── Sidebar.tsx        # Поиск, закреплённые чаты, список диалогов
│   │   └── Skeletons.tsx      # Скелетоны загрузки (чаты, диалоги)
│   ├── hooks/                 # Кастомные хуки
│   │   ├── useGreenApiPolling.ts # Адаптивный long-polling движок + типы вебхуков
│   │   ├── useOnlineStatus.ts # Слушатель online/offline
│   │   ├── usePWAInstall.ts   # Контроллер PWA-установки
│   │   └── useTabNotification.ts # Мигание заголовка + бейдж на favicon
│   ├── i18n/                  # Локализация
│   │   └── translations.ts    # Полный словарь RU/EN
│   ├── services/              # API-клиент
│   │   └── greenApi.ts        # Обёртка REST GREEN-API (allowlist + маршрут BFF)
│   ├── utils/                 # Хелперы
│   │   ├── backupCrypto.ts    # Шифрование бэкапов AES-GCM (WebCrypto)
│   │   ├── bffClient.ts       # Бестокенный клиент BFF-прокси
│   │   ├── credentialStorage.ts # Хранилище ключей session/localStorage
│   │   ├── formatters.ts      # Форматирование телефонов и времени
│   │   ├── greenApiSchemas.ts # Zod-валидация payload GREEN-API
│   │   ├── notifications.ts   # Одноканальный роутинг, tag-дедуп, автозакрытие
│   │   ├── postMessageSecurity.ts # OWASP-хелперы postMessage-моста
│   │   ├── quickReplies.ts    # Дефолтные шаблоны быстрых ответов
│   │   ├── sound.ts           # Синтетический chime через Web Audio API
│   │   ├── storage.ts         # Безопасная обёртка localStorage
│   │   └── typing.ts          # Извлечение presence/typing + честная пометка
│   ├── config.ts              # Центральные дефолты (опрос, лимиты, ключи)
│   ├── theme.ts               # Палитра тёмной темы + правила централизации
│   ├── types.ts               # Общие TypeScript-типы
│   ├── index.css              # Tailwind, бренд-стили, safe-area
│   ├── App.tsx                # Центральный координатор состояния
│   └── main.tsx               # Точка входа
├── .dockerignore
├── .env.example               # Шаблон build-time переменных VITE_*
├── .gitignore
├── Dockerfile                 # Многостадийный продакшн-контейнер
├── docker-compose.yml         # Оркестрация (+ опциональный профиль bff)
├── index.html                 # HTML-точка входа, MAX-метатеги, pre-paint темы
├── nginx.conf                 # Nginx: SPA-роутинг, кэширование, security-заголовки
├── package.json
├── package-lock.json
├── README.md                  # Документация на английском
├── README.ru.md               # Документация на русском (этот файл)
├── tsconfig.json              # Строгий TypeScript
├── vitest.config.ts           # Конфигурация Vitest
└── vite.config.ts             # Vite, Tailwind, PWA-плагин
```

---

## Документация

- [README.md](./README.md) — English documentation
- [docs/ru/README.md](./docs/ru/README.md) — указатель русской документации
- [docs/ru/notifications.md](./docs/ru/notifications.md) — уведомления: каналы, роутинг без задвоения, разрешения, проверка
- [docs/ru/settings.md](./docs/ru/settings.md) — вкладки настроек, диагностика шлюза, данные и аккаунт
- [bff/README.md](./bff/README.md) — BFF-прокси: контракт и запуск
- [SECURITY.md](./SECURITY.md) — threat model и сообщение об уязвимостях

---

## Автор

Разработка и поддержка — **[Aliaksei Patskevich (AVPDev)](https://avpdev.com)** —
[LinkedIn](https://linkedin.com/in/avp-dev) • [Telegram](https://t.me/AVP_Dev) • [Блог](https://avpdev.com/en/blog/)

---

## Лицензия

MIT License. См. [LICENSE](./LICENSE).
