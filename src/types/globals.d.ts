declare const __TARGET__: 'chrome' | 'firefox';
declare const __DEV__: boolean;

declare module 'mammoth/mammoth.browser' {
  const mammoth: {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: { type: string; message: string }[] }>;
    convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: { type: string; message: string }[] }>;
  };
  export default mammoth;
}

declare module 'mammoth' {
  const mammoth: {
    extractRawText(input: { arrayBuffer: ArrayBuffer; path?: string; buffer?: Buffer }): Promise<{ value: string; messages: { type: string; message: string }[] }>;
    convertToHtml(input: { arrayBuffer: ArrayBuffer; path?: string; buffer?: Buffer }): Promise<{ value: string; messages: { type: string; message: string }[] }>;
  };
  export default mammoth;
}
