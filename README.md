# Ridgeline (Tauri)

Порт Electron-версии Ridgeline на Tauri 2: интерфейс не менялся (ванильные ES-модули из `src/renderer`),
основной процесс на Node переписан на Rust (`src-tauri/src`).

    npm install
    npm start          # запуск в dev
    npm run dist       # сборка .exe (nsis) в src-tauri/target/release/bundle

## Устройство

| Слой | Где |
|---|---|
| Интерфейс | `src/renderer/*` — тот же код, что в Electron-версии |
| Мост `window.api` | `src/api.js` — замена preload.js: команды через `invoke`, события Яндекса/файлов |
| Файлы и теги | `fsx.rs` (обход папок, числовая сортировка), `meta.rs` (lofty вместо music-metadata) |
| Хранилище | `store.rs` (library/queue/playback/stats) |
| Яндекс Музыка | `ym.rs` (токен шифруется DPAPI, формат совместим с Electron: библиотека и вход продолжаются) |
| SoundCloud | `sc.rs`, потоки через протокол `scproxy://` (CORS-хаки Electron не нужны) |
| Воспроизведение локально | протокол `media://` с поддержкой Range |
| Окно | `main.rs`: frameless (CSS `-webkit-app-region` в Tauri не работает — рамка теперь `data-tauri-drag-region`), single-instance, дроп файлов |

Хранилище данных — та же папка, что у Electron-версии (`%APPDATA%\Ridgeline`, старая `%APPDATA%\Dasuto Player` тоже читается):
библиотека, статистика и вход в Яндекс переносятся без действий. Не открывай обе версии одновременно —
файлы хранилища у них общие.

- macOS: отдельной «черты» под старые системы (elcapitan/catalina и т.д.) больше нет — Tauri собирает
  один universal-бинарник (arm64 + x64). Сборка запускается на GitHub: Actions → «macOS build»
  (`.github/workflows/mac.yml`), готовые .dmg и .zip — в артефактах запуска.

## Отличия от Electron

- Перетаскивание файлов работает через событие Tauri (рамка окна не поддаёт DOM-drag с путями).
- Закрытие окна завершает приложение: «окно-иконка в Dock с играющей музыкой» из Electron не портировано — поведение закрытия на mac ещё не обкатано.

## Ссылки

- Оригинал: `C:\ridgeline` (Electron 33)
