# Dashboard_AM

Интерактивный атлас смертности и медицинской инфраструктуры Амурской области.

## Архитектура

Проект постепенно переводится на гибридную архитектуру React + TypeScript. Действующие карты и SVG-визуализации продолжают работать на существующем JavaScript, а новые компоненты подключаются через типизированный мост совместимости.

- Node.js используется только для разработки, сборки и тестов.
- GitHub Pages публикует только проверенный каталог `dist/`, собранный GitHub Actions.
- Production React-модуль собирается в `assets/react/atlas-hybrid.js`.
- Анонимизированные данные разделены на версионируемые ресурсы: наблюдения `data/atlas-observations.js`, справочники `data/atlas-reference.js`, компактный сборщик `data/atlas-data.js` и отложенная резервная геометрия `data/atlas-spatial.js`. Схема, размеры, SHA-256 каждого ресурса и итоговая реконструкция проверяются до тестов и сборки.
- В обычном режиме React-диагностика скрыта; открыть её можно параметром `?reactDebug=1`.
- Глобальные фильтры, верхняя строка состояния, оболочки обеих карт, левая навигационная рейка, а также интерфейсы Treemap, матрицы «территория × причина», Arrow diagram рангов, возрастно-половой пирамиды, «Возраст смерти по причинам» и Dotogram территорий уже работают как React-islands; при ошибке загрузки автоматически остаются старые рабочие блоки.

Подробный порядок: [docs/architecture/react-typescript-migration.md](docs/architecture/react-typescript-migration.md).
Текущий этап и результаты проверок: [docs/architecture/migration-status.md](docs/architecture/migration-status.md).

## Требования

- Node.js 24 LTS;
- npm 11 или совместимая версия;
- Google Chrome для browser smoke-тестов.

Если после установки Node.js команда `node` не находится, перезапустите терминал или временно добавьте путь:

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
```

## Команды

```powershell
npm ci
npm run data:validate
npm run typecheck
npm test
npm run build
npm run dist:reproducible
npm run test:dist-browser
```

Воспроизводимая генерация разделённых ресурсов из текущего набора `DATA`:

```powershell
npm run data:extract
```

Команда идемпотентна по содержимому: повторный запуск восстанавливает полный набор из уже разделённых ресурсов и создаёт те же версии и контрольные суммы.

Для локальной разработки:

```powershell
npm run dev
```

Для browser smoke-теста сначала запустите статический сервер, затем задайте `ATLAS_URL` и выполните:

```powershell
npm run test:hybrid
```

## Публикация

Workflow `.github/workflows/pages.yml` автоматически выполняется после push в `main`: устанавливает зависимости через `npm ci`, проверяет данные и TypeScript, собирает `dist`, повторяет упаковку для контроля воспроизводимости, запускает Chrome smoke-тесты и только затем публикует GitHub Pages.

Перед первым запуском в репозитории нужно один раз выбрать **Settings → Pages → Source → GitHub Actions**.

Каждая публикация сохраняется отдельным артефактом `dashboard-am-<commit>` на 30 дней. Для быстрого отката откройте **Actions → Build and deploy GitHub Pages → Run workflow** и укажите предыдущий commit или tag в поле `deploy_ref`. После публикации workflow повторно скачивает все production-файлы и сверяет их размеры и SHA-256 с `build-manifest.json`.

Подробности решения: [docs/architecture/adr-0002-verified-pages-delivery.md](docs/architecture/adr-0002-verified-pages-delivery.md).
