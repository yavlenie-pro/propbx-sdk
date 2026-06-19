# ProPBX SDK v2

**gRPC**-SDK для управления телефонией ProPBX (звонки, TTS, распознавание речи, запись).
Заменяет легаси WebSocket-SDK (v1), сохраняя **тот же** публичный API и события — боты переходят с минимальным diff'ом.

## Почему v2

v1 держал один WebSocket на инстанс приложения, через который шёл control plane **всех** звонков этого инстанса. Запись звонка приходила инлайном как base64 внутри `callFinished`. Длинный звонок давал многомегабайтный фрейм, превышавший `maxPayload` клиента → клиент закрывал сокет с кодом **1009 (message too big)**, и сервер ронял **все** мультиплексированные на этом соединении звонки сразу.

v2 использует gRPC с **двумя стримами** поверх одного HTTP/2-соединения:
- **Session** (bidi) — control plane: те же actions/events, что в v1.
- **MediaStream** (server-stream) — байты записей отдельными `MediaChunk`. Большая запись больше не может застопорить или уронить control plane.

Сервер: репозиторий **propbx**, ветка `feat/grpc-sdk-v2`. Контракт: `proto/app_gateway.proto` (вендорится в этот репозиторий).

## Архитектура

Исходники на **TypeScript** в `src/`, компилируются в CommonJS + `.d.ts` в `dist/` через `tsc` (`npm run build`). `package.json` указывает на `dist/`. Старые скомпилированные артефакты v1 (`index.js`, `propbx-sdk/`) удалены.

```
src/
  index.ts          — точка входа: ProPBXSDK (= ProPBX), ProPBXSDKVoices, реэкспорт типов/констант
  propbx.ts         — класс ProPBX (extends EventEmitter): соединение, диспетчеризация, makeCall, реконнект-учёт, stop()/close()
  call.ts           — класс ProPBXCall: один звонок (answer, hangup, say, startSpeechRecognition, startAudioRecord, ...)
  playback.ts       — ProPBXPlayback: TTS / воспроизведение, destroy() для снятия слушателей
  recognition.ts    — ProPBXSpeechRecognition: распознавание, destroy()
  recording.ts      — ProPBXRecording: запись, destroy()
  variables.ts      — ProPBXVariables: переменные звонка (get/set/delete), destroy()
  actions.ts        — фабрики v1-сообщений (tts, hangup, playback, ...) + карта ACTIONS
  events.ts         — константы событий: WS_EVENTS, APP_EVENTS, WS_CALL_EVENTS (значения строк = v1)
  types.ts          — InfobotConfig (+ tls/maxChunkBytes/recordingTimeoutMs/keepaliveMs/...), WsMessage, Variable, VadConfig
  transport/
    grpcClient.ts   — GrpcTransport: gRPC-клиент, auth-метадата, Session (Hello→Welcome), MediaStream, keepalive, реконнект/бэкофф
    mapping.ts      — чистые функции трансляции: v1 action ↔ gRPC Action, gRPC Event → v1-сообщение (с подъёмом id-полей)
    struct.ts       — sanitizeForStruct: чистка значения перед кодированием в google.protobuf.Struct
  media/
    mediaAssembler.ts      — сборка MediaChunk → целый буфер записи (демультиплекс по media_id)
    recordingCorrelator.ts — корреляция «байты ↔ событие», инжект аудио в recordingComplete/callFinished в форме v1
proto/app_gateway.proto    — вендорённый контракт (грузится в рантайме из dist/transport/../../proto)
test/                       — unit-тесты (.mjs против dist/) + gated smoke
```

## Транспорт (gRPC)

- **Авторизация** — метадата `app-id` + `app-key` на **обоих** RPC (Session и MediaStream). Никакого `auth`-экшена больше нет. Плохие креды → статус `UNAUTHENTICATED` → SDK эмитит `AUTH_FAIL`.
- **Хендшейк** — первый фрейм клиента ОБЯЗАН быть `Hello{protocol:2, ...}`; сервер отвечает `Welcome{..., session_token}`. **Welcome — это сигнал `connected`** (аналога WS-события `auth-ok` по gRPC нет; транспорт синтезирует его внутри).
- **Трансляция отправки**: v1-объект `{action, callID, ...rest}` → `Action{type:action, call_id:callID, params:rest}`. Всё, кроме `action`/`callID`, кладётся в `params` — сервер разворачивает `params` обратно в v1-сообщение. См. `transport/mapping.ts:toActionFrame`.
- **Трансляция приёма**: `Event{type, call_id, params}` → `{event, callID, params, playbackID, recordingID, sessionID}`. id-поля **поднимаются** из `params` наверх, т.к. классы v1 читают их с верхнего уровня. См. `mapping.ts:toClientMessage`.
- **Keepalive**: клиентский `keepalive_time_ms` ≥ 10000 (сервер форсит min 10s; default 25000). Меньше → сервер шлёт GOAWAY `too_many_pings`.
- **Реконнект**: при падении Session транспорт сам ведёт цикл с экспоненциальным бэкоффом+джиттером, шлёт новый `Hello`, получает **новый** `session_token` и переоткрывает MediaStream с ним. Падение только MediaStream — переоткрытие с **тем же** токеном. Учитывает `config.disableReconnect`.

## Запись (recording) — ключевая особенность v2

Байты записи приходят по MediaStream, а метаданные (`recordingID/format/size/duration_ms`) — в событии `recordingComplete`/`callFinished`. SDK прячет этот side-channel: `RecordingCorrelator` дожидается сборки байтов и **инжектит** аудио в запись-entry в форме v1 (`data` и `binaryData` = base64, плюс `buffer`), прежде чем событие уйдёт в приложение. Боты не замечают, что байты пришли отдельным стримом.

- Обрабатываются оба порядка прихода (байты-раньше-события и событие-раньше-байтов).
- Если байты не пришли (сервер ушёл в CDR/S3, MediaStream был закрыт) — по таймауту (`recordingTimeoutMs`, default 15s) событие уходит только с метаданными, приложение не зависает.
- Корреляция делается в транспорте **до** диспетчеризации, т.к. `callFinished` тут же вызывает `removeCall` (снимает слушатели ProPBXRecording).

## Команды уровня соединения (без звонка)

- `precacheTTS(text, opts)` / `precacheTTSMany(phrases)` на `ProPBX` — пресинтез TTS-фразы в кэш сервера (звонок не нужен). Шлёт `cache-tts` с `call_id:""` и `requestID` (UUID), возвращает `Promise<void>`, который резолвится на `cacheTTSReady{ok:true, requestID}`. Пендинги трекаются в `pendingPrecache: Map<requestID,...>`, диспетчер маршрутизирует событие по `requestID`; при таймауте/дисконнекте/`stop()` все пендинги реджектятся (без утечек).
- **opts пресинтеза должны точно совпадать с последующим `say()/tts`** — иначе промах кэша (ключ сервера = `sha256(text, voice, language, emotion, speed, ssml, provider)`).
- Не путать с легаси `call.cacheTTS(phrases)` — это другой вызов (на уровне звонка, поле `phrases`), хотя wire-тип тот же `cache-tts`.

## Ключевые принципы

- Каждый Playback/Recognition/Recording/Variables вешает слушатели на объект call — и **обязан** снимать их через `destroy()`. Критично против утечек памяти.
- `removeCall()` чистит и таймер, и все слушатели объекта call. Всегда используй его вместо ручного `delete this.calls[id]`.
- `touchCall()` **всегда** перезапускает таймер (watchdog на вечно висящие звонки, `maxCallTimeout`).
- Перед отправкой не нужно проверять readyState вручную: `GrpcTransport.sendAction` сам ставит экшены в очередь до `Welcome` и гарантирует, что первым фреймом уйдёт `Hello`.
- При `CALL_DISCONNECTED` / `CALL_FINISHED` обработка завершается `return` — без дублирования событий.
- Реконнект-учёт (`onReconnect`) чистит звонки через `removeCall()`, но **не трогает** пользовательские слушатели на экземпляре ProPBX.

## Частые ошибки, которых нужно избегать

- **Graceful shutdown**: на SIGTERM/SIGINT вызывать `bot.stop()` (дренаж + закрытие стримов этого инстанса) и `process.exit()`, **НИКОГДА не `stopApp()`** — он останавливает приложение серверно для **всех** инстансов карусели.
- **Не использовать `function` в обработчиках событий** внутри классов — только стрелочные `() => {}`, иначе теряется `this`.
- **Не забывать `return`** после терминальных событий (CALL_DISCONNECTED, ERROR), чтобы не дублировать emit/processEvent.
- **Не вешать `.on()` без парного `.off()`** — хранить ссылку на обработчик.
- **RECORDING_FAILED и RECORDING_SESSION_NOT_FOUND** — разные события (`'recordingFailed'` vs `'recordingSessionNotFound'`). Не путать.
- **`session_token` нельзя переиспользовать** после нового Session — всегда брать токен из последнего `Welcome` (старый сервер отвергает с `NotFound`).
- На этой ветке сервера `send-sms`/`file-stored`/`speech-recognition-eou` ещё не реализованы серверно — API сохранён, но событий/эффекта может не быть.

## Зависимости

- `@grpc/grpc-js` — gRPC-клиент
- `@grpc/proto-loader` — динамическая загрузка `app_gateway.proto` (Struct ↔ обычные JS-объекты)
- `uuid` (v8) — генерация ID звонков/сессий (v1/v4, форматы сохранены)
- `md5`, `mime` (v2) — для `playFile` (хеш + MIME-тип)
- `fs` (встроенный) — чтение файла через `fs.promises.readFile`
- dev: `typescript`, `@types/*`

## Сборка и тесты

```
npm run build     # tsc -> dist/
npm test          # билд + node:test (юнит-тесты против dist/, smoke пропускается)
npm run smoke     # PBX_HOST=host:9091 PBX_APP_ID=... PBX_APP_KEY=... npm run smoke
```

## Использование (API идентичен v1)

```js
import ProPBXSDK from 'propbx-sdk';

const bot = new ProPBXSDK.ProPBXSDK({
    url: 'pbx.example.com:9091',  // host:port (схема wss:// тоже принимается и срезается)
    appId: 'APP_ID',
    key: 'APP_KEY',
    pingEnable: true,
    // tls: true,                 // включить TLS для gRPC-канала
    // disableReconnect: true,
});

bot.start();

bot.on('connected', () => { /* Welcome получен */ });
bot.on('incomingCall', (call, params) => {
    call.answer();
    const playback = call.say('Привет', { provider: 'yandex', voice: { id: 'alyss' } });
    playback.on('playbackFinished', () => call.hangup());
});

process.on('SIGTERM', () => { bot.stop(); process.exit(0); });  // НЕ stopApp()
```
