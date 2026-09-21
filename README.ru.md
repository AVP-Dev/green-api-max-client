# MAX Web Messenger Client

> 🇬🇧 **English version:** [README.md](./README.md) · 📚 **Указатель документации:** [docs/ru/README.md](./docs/ru/README.md)

Лёгкий production-ready React веб-клиент для экосистемы мессенджера MAX через HTTP-эндпоинты GREEN-API. Быстрый отзывчивый интерфейс в духе современных веб-мессенджеров: управление чатами, статусы доставки, поиск контактов и настраиваемая маршрутизация шлюза.

---

## Технологический стек

- **Фронтенд:** React 19 (функциональные компоненты, хуки)
- **Язык:** TypeScript 5+ (строгая типизация, `tsc --noEmit`)
- **Сборка:** Vite 6+ с `@vitejs/plugin-react` и `vite-plugin-pwa`
- **Стили:** Tailwind CSS (утилитарный подход, адаптив, фирменные градиенты MAX)
- **Иконки:** Lucide Icons (`lucide-react`)
- **Состояние и хранение:** React State & Hooks с синхронизацией в `localStorage`
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

---

## Быстрый старт

### Требования

- Node.js 20.x или 22.x
- npm 10.x или выше (или pnpm / bun)

### Установка и локальная разработка

```bash
# Клонировать репозиторий
git clone https://github.com/your-username/max-web-messenger.git

# Перейти в каталог проекта
cd max-web-messenger

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

# Сборка продакшн-бандла в dist/
npm run build

# Локальный предпросмотр сборки
npm run preview
```

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

1. **Type Safety & Lint (`typecheck`):** `ubuntu-latest`, Node.js 22, `npm ci`, `tsc --noEmit` — ноль ошибок типов.
2. **Production Build (`build`):** сборка `vite build`, проверка `dist/index.html` и бандлов, загрузка артефактов.
3. **Docker Verification (`docker`):** проверка многостадийного контейнера и Nginx-конфигурации SPA.

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

### 3. Безопасность и учётные данные

- **Предупреждение:** ввод токенов (`idInstance`, `apiTokenInstance`) прямо в браузерное SPA уместен для демо, внутренних инструментов и личного однопользовательского использования.
- **BFF best practice:** для продакшна с недоверенными пользователями секреты нельзя хранить в `localStorage` — запросы проксируются через безопасный бэкенд (BFF), а пользователи аутентифицируются через JWT/сессии.

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
│       └── ci.yml             # GitHub Actions CI/CD
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
│   │   ├── SettingsModal.tsx  # Диагностика, шлюз, уведомления, звук, сброс данных
│   │   └── Sidebar.tsx        # Поиск, закреплённые чаты, список диалогов
│   ├── hooks/                 # Кастомные хуки
│   │   ├── useGreenApiPolling.ts # Адаптивный long-polling движок
│   │   ├── useOnlineStatus.ts # Слушатель online/offline
│   │   ├── usePWAInstall.ts   # Контроллер PWA-установки
│   │   └── useTabNotification.ts # Мигание заголовка + бейдж на favicon
│   ├── i18n/                  # Локализация
│   │   └── translations.ts    # Полный словарь RU/EN
│   ├── services/              # API-клиент
│   │   └── greenApi.ts        # Обёртка REST-эндпоинтов GREEN-API
│   ├── utils/                 # Хелперы
│   │   ├── formatters.ts      # Форматирование телефонов и времени
│   │   ├── notifications.ts   # Роутинг уведомлений по фокусу, разрешения, tag-дедуп
│   │   ├── sound.ts           # Синтетический chime через Web Audio API
│   │   └── storage.ts         # Безопасная обёртка localStorage
│   ├── types.ts               # Общие TypeScript-типы
│   ├── index.css              # Tailwind, бренд-стили, safe-area
│   ├── App.tsx                # Центральный координатор состояния
│   └── main.tsx               # Точка входа
├── .dockerignore
├── .env.example               # Шаблон переменных окружения
├── .gitignore
├── Dockerfile                 # Многостадийный продакшн-контейнер
├── docker-compose.yml         # Оркестрация контейнера
├── index.html                 # HTML-точка входа, MAX-метатеги
├── nginx.conf                 # Nginx: SPA-роутинг и кэширование
├── package.json
├── package-lock.json
├── README.md                  # Документация на английском
├── README.ru.md               # Документация на русском (этот файл)
├── tsconfig.json              # Строгий TypeScript
└── vite.config.ts             # Vite, Tailwind, PWA-плагин
```

---

## Документация

- [README.md](./README.md) — English documentation
- [docs/ru/README.md](./docs/ru/README.md) — указатель русской документации
- [docs/ru/notifications.md](./docs/ru/notifications.md) — уведомления: каналы, роутинг без задвоения, разрешения, проверка
- [docs/ru/settings.md](./docs/ru/settings.md) — вкладки настроек, диагностика шлюза, данные и аккаунт

---

## Лицензия

MIT License.
