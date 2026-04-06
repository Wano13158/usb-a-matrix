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

## Быстрый старт (локально)

```bash
cp .env.example .env
npm install
npm run start
```

Откройте: `http://localhost:3000`

## Переменные окружения
- `PORT` — порт HTTP-сервера (по умолчанию `3000`)
- `MATRIX_BASE_URL` — URL Matrix homeserver (например `https://matrix.org`)

Пример `.env`:

```env
PORT=3000
MATRIX_BASE_URL=https://matrix.org
```

---

## Установка сервера на Linux (Ubuntu/Debian)

Ниже — базовая инструкция для установки и запуска как системного сервиса через `systemd`.

### 1) Установка зависимостей

```bash
sudo apt update
sudo apt install -y curl git build-essential
```

Установите Node.js LTS (пример через NodeSource):

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### 2) Клонирование проекта и установка пакетов

```bash
sudo mkdir -p /opt/usb-a-matrix
sudo chown "$USER":"$USER" /opt/usb-a-matrix
git clone <URL_ВАШЕГО_РЕПО> /opt/usb-a-matrix
cd /opt/usb-a-matrix
npm ci
```

### 3) Настройка переменных окружения

```bash
cp .env.example .env
nano .env
```

Минимально укажите:
- `PORT=3000`
- `MATRIX_BASE_URL=https://matrix.org` (или ваш homeserver)

### 4) Проверка ручного запуска

```bash
npm run start
```

Проверка health endpoint:

```bash
curl http://127.0.0.1:3000/api/health
```

Если всё ок — остановите сервер (`Ctrl+C`) и настройте автозапуск.

### 5) Запуск через systemd

Создайте пользователя сервиса (без shell):

```bash
sudo useradd --system --home /opt/usb-a-matrix --shell /usr/sbin/nologin usbamatrix
sudo chown -R usbamatrix:usbamatrix /opt/usb-a-matrix
```

Создайте unit-файл `/etc/systemd/system/usb-a-matrix.service`:

```ini
[Unit]
Description=USB-A Matrix Messenger API
After=network.target

[Service]
Type=simple
User=usbamatrix
Group=usbamatrix
WorkingDirectory=/opt/usb-a-matrix
EnvironmentFile=/opt/usb-a-matrix/.env
ExecStart=/usr/bin/node /opt/usb-a-matrix/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Активируйте сервис:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now usb-a-matrix
sudo systemctl status usb-a-matrix
```

Логи:

```bash
journalctl -u usb-a-matrix -f
```

### 6) (Опционально) Nginx как reverse proxy

Если хотите наружный доступ по 80/443 и домену:

```bash
sudo apt install -y nginx
```

Пример `/etc/nginx/sites-available/usb-a-matrix`:

```nginx
server {
    listen 80;
    server_name your-domain.example;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Включение:

```bash
sudo ln -s /etc/nginx/sites-available/usb-a-matrix /etc/nginx/sites-enabled/usb-a-matrix
sudo nginx -t
sudo systemctl reload nginx
```

Для HTTPS можно подключить Certbot (`Let's Encrypt`).

---

## Что проверено в коде
- Добавлено ограничение размера JSON body: `100kb`.
- Добавлен единый helper для чтения Bearer-токена из заголовка.
- Добавлена валидация `limit` в `/api/rooms/:roomId/messages` (диапазон `1..100`).
- Добавлен `.env.example` и `.gitignore` для корректной установки на Linux.

## Важно для production
Это базовый MVP. Для production нужны:
- нормальная авторизация/сессии (например JWT + secure cookies)
- rate limiting
- валидация входных данных (строже, чем сейчас)
- защита от CSRF/XSS
- логирование и мониторинг
- хранение секретов через vault/secret manager
