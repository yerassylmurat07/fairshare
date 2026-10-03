# Интернет-источники и решения

Проверены 2 октября 2026 года. В `research/sources.json` сохранены адреса, HTTP-статусы и время получения, в `research/*.txt` — полученный текст. Это проверка официальной документации, а не пользовательское исследование.

| Источник | Что проверено | Влияние на FairShare |
| --- | --- | --- |
| [React: Creating a React App](https://react.dev/learn/creating-a-react-app) | React рекомендует фреймворки, допускает самостоятельную сборку при соответствующих ограничениях | SPA/Vite выбран осознанно для закрытой доски с отдельным API; Next.js остаётся альтернативой |
| [Vite: Guide](https://vite.dev/guide/) | TypeScript/React шаблоны, требования к Node | Воспроизводимая сборка и актуальный Node |
| [PostgreSQL: Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) | Row-level locks, FOR UPDATE, взаимные блокировки | Блокировка команды и пользователей в стабильном порядке |
| [PostgreSQL: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) | Согласованность конкурентных транзакций | Повторное чтение снимка и атомарное принятие |
| [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Deny by default, полномочия на каждом запросе | Членство в команде проверяется сервером, а не только UI |
| [TanStack Query: Overview](https://tanstack.com/query/latest/docs/framework/react/overview) | Управление server state, кеширование и синхронизация | Рекомендован для дальнейшего роста; в MVP не подключён |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Клавиатура, фокус, доступность и адаптивность | Focus trap, видимый фокус, мобильная компоновка; без заявления о сертификации |
| [Supabase: Securing your API](https://supabase.com/docs/guides/api/securing-your-api) | Экспонирование схем, grants и Data API | Если выбран как PostgreSQL-провайдер, серверные таблицы не должны открываться браузеру |
| [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) | Политики доступа к строкам | RLS нужен для экспонируемых таблиц; отдельный API не включает его автоматически |
| [Supabase: JWTs](https://supabase.com/docs/guides/auth/jwts) | Верификация токенов и signing keys | Будущая замена Identity требует настоящей проверки JWT; текущий MVP использует серверные сессии |
| [Supabase: Changelog](https://supabase.com/changelog) | Актуальные изменения, breaking changes | Не предполагается, что облачный API остаётся неизменным |

Индекс Supabase сообщает изменение PostgreSQL minor versions от 25 сентября 2026 года с предупреждением о переиндексации отдельных extensions и legacy-cipher данных. MVP не использует ltree, btree_gist, pgcrypto-шифрование или существующую Supabase-базу; конкретную миграцию чужого проекта не выполняли. Документация signing keys также проверена через официальный поиск Supabase MCP.

Страница NestJS была получена, но содержала только короткую JavaScript-заглушку. Она не использована как подтверждение архитектурного решения. Выбор Fastify связан с размером feature-модулей и простотой небольшого монолита; это инженерное решение, не результат сравнительного бенчмарка.

Требования продуктовой границы и гипотез взяты из пользовательского PDF, а не из интернет-источников. Ссылка на Gemini в PDF не проверялась; приведённые там выводы учтены как записанные решения команды, а не новая беседа с Gemini.
