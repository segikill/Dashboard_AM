# Dashboard_AM

Интерактивный атлас смертности и медицинской инфраструктуры Амурской области.

## Архитектура

Проект постепенно переводится на гибридную архитектуру React + TypeScript. Действующие карты и SVG-визуализации продолжают работать на существующем JavaScript, а новые компоненты подключаются через типизированный мост совместимости.

- Node.js используется только для разработки, сборки и тестов.
- GitHub Pages продолжает публиковать статические файлы.
- Production React-модуль собирается в `assets/react/atlas-hybrid.js`.
- Анонимизированный набор из 30 232 наблюдений загружается как отдельный версионируемый ресурс `data/atlas-data.js`; его схема и SHA-256 проверяются до тестов и сборки.
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
```

Одноразовый механический вынос `DATA` из сгенерированного HTML:

```powershell
npm run data:extract
```

Команда идемпотентна: если набор уже вынесен, файлы не перезаписываются.

Для локальной разработки:

```powershell
npm run dev
```

Для browser smoke-теста сначала запустите статический сервер, затем задайте `ATLAS_URL` и выполните:

```powershell
npm run test:hybrid
```
