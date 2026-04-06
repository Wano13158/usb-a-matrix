# USB-A Tuwunel Messenger

Простой мессенджер **USB-A** на базе протокола **Tuwunel**:
- веб-сайт (frontend) в папке `public/`
- серверная часть (backend/API proxy) в `server.js`

## Что уже реализовано
- регистрация пользователя Tuwunel
- вход пользователя Tuwunel
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
- `MATRIX_BASE_URL` — URL *вашего* Matrix homeserver (для локального Tuwunel обычно `http://127.0.0.1:6167`)
- `MATRIX_SHARED_SECRET` *(опционально)* — shared secret Synapse Admin API fallback (актуально только если вы используете именно Synapse)

Пример `.env`:

```env
PORT=3000
MATRIX_BASE_URL=http://127.0.0.1:6167
# MATRIX_SHARED_SECRET=change_me
```

---


## Поднять собственный Matrix сервер (Tuwunel) на Linux

Ниже минимальный рабочий вариант для **Ubuntu 22.04/24.04**. После этого USB-A будет работать с вашим сервером, а не с публичными homeserver.

### 1) Установить Tuwunel

```bash
sudo apt update
./scripts/install-tuwunel.sh
```

Скрипт автоматически выбирает бинарник для `x86_64` и `arm64` (`aarch64`).

Во время установки укажите домен вашего сервера (например `matrix.example.com`).

### 2) Базовая настройка Tuwunel

Откройте конфиг:

```bash
sudo nano /etc/tuwunel/tuwunel.toml
```

Проверьте ключевые параметры:

```toml
server_name = "matrix.example.com"
database_path = "/var/lib/tuwunel"
address = "0.0.0.0"
port = 6167

# регистрация
allow_registration = true
registration_token = "CHANGE_ME_LONG_RANDOM_SECRET"
```

Перезапуск:

```bash
sudo systemctl restart tuwunel
sudo systemctl status tuwunel
```

Проверка локально:

```bash
curl -s http://127.0.0.1:6167/_matrix/client/versions
```

### 3) Привязать USB-A к вашему Tuwunel

В `.env` проекта USB-A:

```env
PORT=3000
MATRIX_BASE_URL=http://127.0.0.1:6167
# MATRIX_SHARED_SECRET можно оставить пустым при Tuwunel
```

После изменения `.env` перезапустите сервис USB-A.



## Запуск через Docker / Docker Compose (x86_64 + ARM64)

Добавлен готовый `docker-compose.yml`, который поднимает:
- `tuwunel` (ваш Matrix homeserver)
- `usb-a-matrix` (этот backend+frontend)

Официальные образы `ghcr.io/matrix-construct/tuwunel` и `node:20-alpine` поддерживают разные архитектуры (включая **ARM64**, например Apple Silicon и Raspberry Pi 4/5).

Для ARM (Raspberry Pi/Apple Silicon) это рекомендованный способ запуска.

### 1) Подготовка

```bash
cp .env.example .env
```

При необходимости поменяйте в `.env`:
- `TUWUNEL_SERVER_NAME` (например `matrix.example.com`)
- `TUWUNEL_PORT` (`6167` по умолчанию)
- `TUWUNEL_ALLOW_REGISTRATION` / `TUWUNEL_REGISTRATION_TOKEN` (если хотите закрытую регистрацию через токен)

### 2) Подготовить переменные Tuwunel

```bash
./scripts/init-tuwunel.sh matrix.local true
```

Скрипт создаст `.env.tuwunel` с готовыми переменными и директорию `./tuwunel-data`.

### 3) Запуск стека

```bash
docker compose up -d --build
```

Проверки:

```bash
curl http://127.0.0.1:8008/_matrix/client/versions
curl http://127.0.0.1:3000/api/health
```

### 4) Создать первого администратора Tuwunel

Первый зарегистрированный пользователь становится администратором Tuwunel.

### 5) Полезные команды

```bash
docker compose logs -f tuwunel
docker compose logs -f usb-a-matrix
docker compose down
```


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
- `MATRIX_BASE_URL=http://127.0.0.1:8008` (или ваш homeserver)

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
Description=USB-A Tuwunel Messenger API
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

## Troubleshooting

### Ошибка регистрации: `Registration has been disabled. Only m.login.application_service registrations are allowed.`

Это означает, что на вашем Matrix homeserver отключена обычная регистрация пользователей.

Что делать:
1. Входите существующим пользователем через кнопку **Вход**.
2. Если вы админ Tuwunel и хотите включить self-registration, проверьте `tuwunel.toml`:

```toml
allow_registration = true
```

3. Если публичную регистрацию включать нельзя, используйте регистрацию по токену:
   - задайте `TUWUNEL_REGISTRATION_TOKEN` в `.env`;
   - включите `TUWUNEL_ALLOW_REGISTRATION=true`;
   - перезапустите backend (`sudo systemctl restart usb-a-matrix` или `npm run start`).

4. После изменения конфигурации Tuwunel перезапустите его (пример):

```bash
sudo systemctl restart tuwunel
```

5. Проверьте, что регистрация открылась (для варианта с `allow_registration = true`):

```bash
curl -s "http://127.0.0.1:6167/_matrix/client/v3/register/available?username=test_user"
```

Если не хотите открывать публичную регистрацию, оставьте её выключенной и используйте `TUWUNEL_REGISTRATION_TOKEN`.
