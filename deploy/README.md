# FairShare на VPS

Адрес: https://fairshare.15.235.192.28.sslip.io

Войдите на сайт и создайте свой аккаунт и команду. Деморежим отключён.
Адрес временный и зависит от стороннего DNS-сервиса sslip.io и текущего IP VPS.

## Управление

С локального компьютера:

```bash
ssh vps
```

На VPS:

```bash
fairshare status       # приложение, PostgreSQL, Nginx, расписание копий
fairshare health       # проверка приложения и подключения к базе
fairshare logs         # последние логи и новые события; Ctrl+C для выхода
fairshare restart     # перезапуск с проверкой работоспособности
fairshare backup      # резервная копия прямо сейчас
fairshare backups     # список резервных копий
fairshare rollback    # возврат предыдущего выпуска приложения
htop                  # ресурсы сервера
tmux new -As work     # терминал, сохраняющийся при отключении SSH
```

В tmux: `Ctrl+B`, затем `D` — отсоединиться; повторная команда вернёт терминал.

## Обновление с компьютера

Из каталога исходников FairShare:

```bash
bash deploy/push.sh vps
```

Скрипт отправляет исходники без локальной базы, `.env` и `node_modules`.
На сервере создаётся отдельный выпуск, устанавливаются зависимости, выполняются
сборка и все 10 тестов. Перед переключением снимается резервная копия. При ошибке
проверки `/api/health` возвращается предыдущий выпуск.

Исходники текущего выпуска: `/srv/fairshare/current`.
Предыдущий выпуск: `/srv/fairshare/previous`; все выпуски: `/srv/fairshare/releases`.
Выпуски не удаляются автоматически. Старые можно удалить вручную, сохранив текущий
и предыдущий. `rollback` меняет только код; при изменениях схемы совместимость базы
нужно проверить отдельно.

## База и резервные копии

PostgreSQL: база и роль `fairshare`. Приложение подключается через локальный Unix-сокет
с peer-аутентификацией: пароль базы не требуется, роль не имеет прав суперпользователя.
Внешний доступ к PostgreSQL закрыт firewall. Приложение слушает только `127.0.0.1:3000`.

Бэкапы: `/var/backups/fairshare`, ежедневно между **03:15 и 03:25 по Сеулу**,
хранятся примерно 14 дней. Содержат `database.dump`, исходники без зависимостей,
конфигурацию и контрольные суммы. Каталог доступен только root.
Копии лежат на том же VPS; для защиты от потери сервера скачивайте их на компьютер.

Пример скачивания выбранной копии:

```bash
ssh vps 'sudo tar -czf - -C /var/backups/fairshare КАТАЛОГ_КОПИИ' > fairshare-backup.tar.gz
```

Проверка контрольных сумм на VPS:

```bash
sudo bash -c 'cd /var/backups/fairshare/КАТАЛОГ_КОПИИ && sha256sum -c SHA256SUMS'
```

Восстановление (заменяет текущую базу, сначала сохраните свежую копию):

```bash
fairshare backup
sudo install -d -o postgres -g postgres -m 700 /var/lib/postgresql/fairshare-restore
sudo install -o postgres -g postgres -m 600 /var/backups/fairshare/КАТАЛОГ_КОПИИ/database.dump /var/lib/postgresql/fairshare-restore/database.dump
sudo systemctl stop fairshare
sudo -u postgres dropdb fairshare
sudo -u postgres createdb -O fairshare fairshare
sudo -u postgres pg_restore --exit-on-error --no-owner --role=fairshare -d fairshare /var/lib/postgresql/fairshare-restore/database.dump
fairshare restart
sudo rm /var/lib/postgresql/fairshare-restore/database.dump
```

Восстановление сначала проверяйте в отдельной базе.

## Конфигурация

- `/etc/fairshare/app.env` — production-окружение, включая точный `APP_ORIGIN`.
- `/etc/nginx/sites-available/fairshare` — HTTPS-прокси.
- `/etc/systemd/system/fairshare.service` — автозапуск, перезапуск после сбоя и ограничения процесса.
- `/etc/systemd/system/fairshare-backup.timer` — расписание копий.
- `sudo journalctl -u fairshare-backup.service` — журнал резервных копий.
- `sudo certbot certificates` — сертификат; `certbot.timer` обновляет его автоматически.

SSH принимает только ключи; вход root отключён. Доступен прежний `ssh vps` под ubuntu.
Открыты входящие TCP-порты 22, 80, 443. Fail2ban блокирует подбор SSH.
Настроены автоматические обновления безопасности без автоматической перезагрузки,
1 ГБ swap и ограничение объёма системных логов.

Чтобы подключить собственный домен, направьте A-запись на `15.235.192.28`, обновите
`server_name` в Nginx и `APP_ORIGIN` в окружении, выпустите сертификат для нового имени
через `sudo certbot --nginx -d ДОМЕН`, затем проверьте Nginx и перезапустите FairShare.

## Первичная установка на чистом сервере

Сначала установите Node.js 22.12+, npm, nginx, certbot, python3-certbot-nginx,
postgresql, rsync, fail2ban, ufw, unattended-upgrades. Учётная запись деплоя — ubuntu.
Из распакованных исходников выполните:

```bash
sudo bash deploy/install.sh fairshare.15.235.192.28.sslip.io
fairshare deploy /home/ubuntu/fairshare-upload.tar.gz
sudo certbot --nginx -d fairshare.15.235.192.28.sslip.io --redirect --agree-tos --register-unsafely-without-email --non-interactive
```

`harden.sh` рассчитан на этот VPS: выполняйте его только после проверки свежего
входа ubuntu по SSH-ключу и отсутствия других сервисов с требуемыми внешними портами.
