export type EngineState =
  'ready' | 'downloading-model' | 'provider-unavailable' | 'error';
export interface Pair {
  source: string;
  target: string;
}
export interface Segment {
  id: string;
  text: string;
}
export interface TranslationJob {
  requestId: string;
  documentId: string;
  documentEpoch: number;
  routeEpoch: number;
  originKey: string;
  provider: 'chrome-native';
  sourceLanguage: string;
  targetLanguage: string;
  segments: Segment[];
}
export interface TranslationResult {
  requestId: string;
  documentId: string;
  documentEpoch: number;
  routeEpoch: number;
  segments: { id: string; translatedText: string }[];
}
export interface TranslationEngine {
  readonly id: 'chrome-native';
  isAvailable(pair: Pair): Promise<boolean>;
  prepare(
    pair: Pair,
    onState?: (state: EngineState, progress?: number) => void,
  ): Promise<void>;
  translate(
    job: TranslationJob,
    signal?: AbortSignal,
  ): Promise<TranslationResult>;
  dispose(): void;
}
