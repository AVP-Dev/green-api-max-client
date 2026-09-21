# Security Policy

## Threat model

MAX Web Messenger — pure frontend SPA без бэкенда. Токены GREEN-API
(`idInstance` / `apiTokenInstance`) хранятся в браузере:
по умолчанию в `sessionStorage` (до закрытия вкладки), опционально
в `localStorage` («Запомнить на этом устройстве»).

Это осознанный компромисс для демо / internal / single-tenant.
Для публичного multi-user прод-деплоя используйте BFF-прокси:
секреты в vault на сервере, а браузер аутентифицируется JWT/session cookie.

## Built-in protections

- Allowlist шлюзов: только `*.green-api.com` / `*.greenapi.com` (+ `localhost` для dev).
  `http://` на внешних хостах запрещён (`src/services/greenApi.ts`).
- postMessage-мост: проверка `event.origin` по allowlist первой строкой,
  fail-closed в проде без `?parentOrigin=` / `VITE_TRUSTED_PARENT_ORIGINS`,
  валидация типов payload и лимит длины строк (`src/utils/postMessageSecurity.ts`).
- Секреты в URL (`?idInstance=`, `?apiTokenInstance=`) не поддерживаются
  и вычищаются из адресной строки.
- Экспорт бэкапа по умолчанию без текстов сообщений, токен не выгружается никогда.
- Security headers в `nginx.conf`: CSP, HSTS (preload), `nosniff`,
  `SAMEORIGIN` + `frame-ancestors 'self'`, `Permissions-Policy`.

## Reporting a vulnerability

Откройте приватный issue в GitHub-репозитории или свяжитесь с мейнтейнерами
напрямую. Не публикуйте PoC с реальными токенами в открытых issues.
