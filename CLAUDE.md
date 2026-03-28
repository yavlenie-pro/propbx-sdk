# ProPBX SDK

WebSocket SDK для управления телефонией (звонки, TTS, распознавание речи, запись).
WebSocket SDK для управления телефонией ProPBX.

## Архитектура

```
index.js                  — точка входа, экспортирует ProPBXSDK и ProPBXSDKVoices
propbx-sdk/
  index.js                — класс ProPBX (extends EventEmitter): WS-соединение, авторизация, управление звонками, реконнект
  call.js                 — класс ProPBXCall: один звонок (hangup, answer, say, playURL, startSpeechRecognition и т.д.)
  actions.js              — фабрики WS-сообщений (auth, hangup, tts, playback, recording, sms и т.д.)
  events.js               — константы событий: WS_EVENTS, APP_EVENTS, WS_CALL_EVENTS
  playback.js             — класс ProPBXPlayback: TTS и воспроизведение аудио, destroy() для очистки слушателей
  recognition.js          — класс ProPBXSpeechRecognition: распознавание речи, destroy() для очистки
  recording.js            — класс ProPBXRecording: запись аудио, destroy() для очистки
  variables.js            — класс ProPBXVariables: переменные звонка (get/set/delete), destroy() для очистки
  types.js                — пустой модуль (типы в .d.ts)
```

## Ключевые принципы

- Каждый Playback/Recognition/Recording/Variables создаёт слушатели на объекте call — и **обязан** их снимать через `destroy()` при завершении. Это критично для предотвращения утечек памяти.
- `removeCall()` чистит и таймер, и все слушатели объекта call. Всегда используй его вместо ручного `delete this.calls[id]`.
- `touchCall()` **всегда** перезапускает таймер (не только при первом вызове). Это защита от вечно висящих звонков в памяти.
- Перед отправкой в WebSocket всегда проверяется `readyState === OPEN`.
- При `CALL_DISCONNECTED` обработка завершается `return` — без дублирования событий.
- `reconnect()` чистит звонки через `removeCall()`, но **не трогает** пользовательские слушатели на экземпляре ProPBX.

## Частые ошибки, которых нужно избегать

- **Не использовать `function` в обработчиках событий** внутри классов — только стрелочные функции `() => {}`, иначе теряется `this`.
- **Не забывать `return`** после обработки терминальных событий (CALL_DISCONNECTED, ERROR), чтобы не дублировать emit/processEvent.
- **Не вешать слушатели через `.on()` без парного `.off()`** — сохранять ссылку на функцию-обработчик для последующего снятия.
- **RECORDING_FAILED и RECORDING_SESSION_NOT_FOUND** — это разные события с разными строковыми значениями (`'recordingFailed'` и `'recordingSessionNotFound'`). Не путать.

## Зависимости

- `ws` — WebSocket-клиент
- `uuid` — генерация ID звонков/сессий
- `md5`, `mime` — для playFile (хеширование и определение MIME-типа)
- `fs` (Node.js built-in) — асинхронное чтение файлов через `fs.promises.readFile`

## Использование

```js
import ProPBXSDK from 'propbx-sdk';

const bot = new ProPBXSDK.ProPBXSDK({
    url: 'wss://...',
    appId: 'APP_ID',
    key: 'APP_KEY',
    pingEnable: true,
    // disableReconnect: true  // отключить автореконнект
});

bot.start();

bot.on('connected', () => { /* авторизация успешна */ });
bot.on('incomingCall', (call, params) => {
    call.answer();
    const playback = call.say('Привет', { provider: 'yandex', voice: 'alyss' });
    playback.on('playbackFinished', () => call.hangup());
});
```
