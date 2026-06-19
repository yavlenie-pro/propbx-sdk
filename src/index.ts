/**
 * Public entrypoint. The shape matches v1 exactly (named `ProPBXSDK` +
 * `ProPBXSDKVoices`, `__esModule` set, no default export), so existing bots —
 * whether they do `const { ProPBXSDK } = require('propbx-sdk')`,
 * `import ProPBXSDK from 'propbx-sdk'; new ProPBXSDK.ProPBXSDK({...})`, or
 * `import M from 'propbx-sdk'; const { ProPBXSDK } = M` — keep working unchanged.
 */
export { default as ProPBXSDK } from './propbx';

export const ProPBXSDKVoices = {
    RU_GOOGLE_MALE_A: { id: 'google_ru_male_a', provider: 'google' },
    RU_GOOGLE_MALE_B: { id: 'google_ru_male_b', provider: 'google' },
    RU_GOOGLE_FEMALE_A: { id: 'google_ru_female_a', provider: 'google' },
    RU_GOOGLE_FEMALE_B: { id: 'google_ru_female_b', provider: 'google' },
    RU_YANDEX_ALYSS: { id: 'alyss', provider: 'yandex' },
    RU_YANDEX_ZAHAR: { id: 'zahar', provider: 'yandex' },
};

// Additive re-exports (do not affect the default-namespace pattern above).
export { WS_EVENTS, APP_EVENTS, WS_CALL_EVENTS } from './events';
export { default as ProPBXCall } from './call';
export { default as ProPBXPlayback } from './playback';
export { default as ProPBXSpeechRecognition } from './recognition';
export { default as ProPBXRecording } from './recording';
export { default as ProPBXVariables } from './variables';
export * from './types';
