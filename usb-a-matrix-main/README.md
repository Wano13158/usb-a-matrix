# USB-A Matrix Messenger

Простой мессенджер **USB-A** на базе протокола **Matrix**:
- веб-сайт (frontend) в папке `public/`
- серверная часть (backend/API proxy) в `server.js`

## Что уже реализовано
- регистрация пользователя Matrix
- вход пользователя Matrix
- получение списка подключённых комнат
- вход в комнату по `roomId` или `alias`
- загрузка сообщений комнаты
- отправка текстовых сообщений

## Быстрый старт

```bash
cp .env.example .env
npm install
npm run start
```

Откройте: `http://localhost:3000`

## Переменные окружения
- `PORT` — порт HTTP-сервера
- `MATRIX_BASE_URL` — URL Matrix homeserver (например `https://matrix.org`)

## Важно
Это базовый MVP. Для production нужны:
- нормальная авторизация/сессии (например JWT + secure cookies)
- rate limiting
- валидация входных данных
- защита от CSRF/XSS
- логирование и мониторинг
