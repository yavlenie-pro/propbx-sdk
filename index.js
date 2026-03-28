"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProPBXSDKVoices = exports.ProPBXSDK = void 0;
var index_1 = require("./propbx-sdk/index");
Object.defineProperty(exports, "ProPBXSDK", { enumerable: true, get: function () { return __importDefault(index_1).default; } });
exports.ProPBXSDKVoices = {
    RU_GOOGLE_MALE_A: { id: 'google_ru_male_a', provider: 'google' },
    RU_GOOGLE_MALE_B: { id: 'google_ru_male_b', provider: 'google' },
    RU_GOOGLE_FEMALE_A: { id: 'google_ru_female_a', provider: 'google' },
    RU_GOOGLE_FEMALE_B: { id: 'google_ru_female_b', provider: 'google' },
    RU_YANDEX_ALYSS: { id: 'alyss', provider: 'yandex' },
    RU_YANDEX_ZAHAR: { id: 'zahar', provider: 'yandex' },
};
//# sourceMappingURL=index.js.map