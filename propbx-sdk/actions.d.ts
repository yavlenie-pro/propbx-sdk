import { Variable } from './types';
export declare const ACTIONS: {
    PONG: string;
    AUTH: string;
    MAKE_CALL: string;
    HANGUP: string;
    ANSWER: string;
    RING: string;
    STOP_DELIVERY: string;
    STOP_TRY: string;
    START_CALL: string;
    FINISH_CALL: string;
    START_AUDIO_STREAM: string;
    STOP_AUDIO_STREAM: string;
    FORWARAD_AUDIO_STREAM: string;
    SEND_SMS: string;
    CALL_FORWARD: string;
    START_BACKGROUND_SOUND: string;
    STOP_BACKGROUND_SOUND: string;
    CACHE_TTS: string;
    START_AUDIO_RECORD: string;
    STOP_AUDIO_RECORD: string;
    TTS_ACTION: string;
    PLAYBACK_ACTION: string;
    PLAYBACK_FILE: string;
    STOP_PLAYBACK: string;
    FILE_RESPONSE: string;
    START_SPEECH_RECOGNITION: string;
    START_SPEECH_RECOGNITION_CUSTOM: string;
    STOP_SPEECH_RECOGNITION: string;
    REACH_MARKER: string;
    VARIABLES_SET: string;
    VARIABLES_DELETE: string;
    VARIABLES_GET: string;
    STOP_APP: string;
};
export declare function variablesGet(): {
    action: string;
};
export declare function variablesSet(variables: Array<Variable>): {
    action: string;
    params: {
        variables: Variable[];
    };
};
export declare function variablesDelete(name: string): {
    action: string;
    params: {
        name: string;
    };
};
export declare function reachMarker(blockId: number, name: string): {
    action: string;
    params: {
        blockId: number;
        name: string;
    };
};
export declare function auth(appID: string, key: string): {
    action: string;
    appID: string;
    key: string;
};
export declare function makeCall(params?: any): any;
export declare function hangup(reason: any): {
    action: string;
    params: {
        reason: any;
    };
};
export declare function answer(): {
    action: string;
};
export declare function ring(): {
    action: string;
};
export declare function stopDelivery(params?: any): {
    action: string;
    params: any;
};
export declare function stopTry(): {
    action: string;
};
export declare function startCall(params?: any): {
    action: string;
    params: any;
};
export declare function finishCall(params?: any): {
    action: string;
    params: any;
};
export declare function pong(): {
    action: string;
};
export declare function startAudioStream(): {
    action: string;
};
export declare function stopAudioStream(): {
    action: string;
};
export declare function forwardAudioStream(host: string, port: number | string): {
    action: string;
    params: {
        host: string;
        port: string | number;
    };
};
export declare function sendSms(to: string, text: string, digital: any, short: any, from: string, id?: string | number): {
    action: string;
    to: string;
    text: string;
    from: string;
    digital: any;
    short: any;
    id: string | number;
};
export declare function callForward(to: string, message: string, tts: any, headers?: any): {
    action: string;
    params: {
        to: string;
        message: string;
        tts: any;
        headers: any;
    };
};
export declare function startBackgroundSound(url: string, volume: any, repeat: any): {
    action: string;
    params: {
        url: string;
        repeat: any;
        volume: any;
    };
};
export declare function cacheTTS(phrases: any): {
    action: string;
    params: {
        phrases: any;
    };
};
export declare function stopBackgroundSound(): {
    action: string;
};
export declare function startAudioRecord(recordingID: string | number, format: any): {
    action: string;
    params: {
        format: any;
        recordingID: string | number;
    };
};
export declare function stopAudioRecord(recordingID: string | number): {
    action: string;
    params: {
        recordingID: string | number;
    };
};
export declare function ttsAction(playbackID: string | number, text: string, params: any, ssml: any): {
    action: string;
    params: any;
};
export declare function playbackAction(playbackID: string | number, url: string): {
    action: string;
    params: {
        url: string;
        playbackID: string | number;
    };
};
export declare function playbackFile(playbackID: string | number, fileHash: any, fileType: string): {
    action: string;
    params: {
        fileHash: any;
        fileType: string;
        playbackID: string | number;
    };
};
export declare function fileResponse(playbackID: string | number, fileData: string, fileType: string): {
    action: string;
    params: {
        fileData: string;
        fileType: string;
        playbackID: string | number;
    };
};
export declare function stopPlayback(playbackID: string | number): {
    action: string;
    params: {
        playbackID: string | number;
    };
};
export declare function startSpeechRecognition(sessionID: string | number, provider: any, language: any, grammar: any, timeout: any): {
    action: string;
    params: {
        provider: any;
        language: any;
        grammar: any;
        timeout: any;
        sessionID: string | number;
    };
};
export declare function startSpeechRecognitionWithCustomConfig(sessionID: string | number, provider: string, config: any): {
    action: string;
    params: {
        provider: string;
        customConfig: any;
        sessionID: string | number;
    };
};
export declare function stopSpeechRecognition(sessionID: string | number): {
    action: string;
    params: {
        sessionID: string | number;
    };
};
