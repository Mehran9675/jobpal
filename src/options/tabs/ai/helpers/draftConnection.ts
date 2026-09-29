export interface DraftConnection {
  apiKey: string;
  baseUrl: string;
  model: string;
  customModel: string;
  clientId: string;
  headersText: string;
}

export const emptyDraftConnection: DraftConnection = {
  apiKey: '',
  baseUrl: '',
  model: '',
  customModel: '',
  clientId: '',
  headersText: '',
};
