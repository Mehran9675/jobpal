import { uid } from './utils';
import { AppError, errorCodeOf, type ErrorCode } from './errors';
import type { MessageType, Request, RequestMap, Response } from '@/types/messages';

const DEFAULT_TIMEOUT = 120000;

export function sendMessage<K extends MessageType>(
  type: K,
  payload: RequestMap[K]['req'],
  options: { timeout?: number } = {},
): Promise<RequestMap[K]['res']> {
  const message: Request<K> = { type, payload, id: uid('msg') };
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Message "${type}" timed out after ${timeout}ms`));
    }, timeout);
    try {
      chrome.runtime.sendMessage(message, (response: Response<K> | undefined) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const error = chrome.runtime.lastError?.message;
        if (error) {
          reject(new Error(error));
          return;
        }
        if (!response) {
          reject(new Error(`No response for "${type}"`));
          return;
        }
        if (!response.ok) {
          reject(new AppError(response.error ?? `Request "${type}" failed`, (response.code as ErrorCode | undefined) ?? 'UNKNOWN'));
          return;
        }
        resolve(response.data as RequestMap[K]['res']);
      });
    } catch (error) {
      settled = true;
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export function sendTabMessage<K extends MessageType>(
  tabId: number,
  type: K,
  payload: RequestMap[K]['req'],
  options: { timeout?: number } = {},
): Promise<RequestMap[K]['res']> {
  const message: Request<K> = { type, payload, id: uid('tabmsg') };
  const timeout = options.timeout ?? 30000;
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Tab message "${type}" timed out`));
    }, timeout);
    chrome.tabs.sendMessage(tabId, message, (response: Response<K> | undefined) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const error = chrome.runtime.lastError?.message;
      if (error) {
        reject(new Error(error));
        return;
      }
      if (!response) {
        reject(new Error(`No response from tab for "${type}"`));
        return;
      }
      if (!response.ok) {
        reject(new AppError(response.error ?? `Tab request "${type}" failed`, (response.code as ErrorCode | undefined) ?? 'UNKNOWN'));
        return;
      }
      resolve(response.data as RequestMap[K]['res']);
    });
  });
}

export type Handler<K extends MessageType = MessageType> = (
  payload: RequestMap[K]['req'],
  sender: chrome.runtime.MessageSender,
) => Promise<RequestMap[K]['res'] | void> | RequestMap[K]['res'] | void;

export interface Router {
  handle<K extends MessageType>(type: K, handler: Handler<K>): void;
  install(): void;
  dispatch(message: Request, sender: chrome.runtime.MessageSender): Promise<Response>;
}

export function createRouter(): Router {
  const handlers = new Map<string, Handler>();

  const dispatch = async (message: Request, sender: chrome.runtime.MessageSender): Promise<Response> => {
    const handler = handlers.get(message.type);
    if (!handler) return { ok: false, error: `Unhandled message type: ${message.type}`, id: message.id };
    try {
      const data = await handler(message.payload as never, sender);
      return { ok: true, data: data as never, id: message.id };
    } catch (error) {
      const message_ = error instanceof Error ? error.message : String(error);
      console.error(`[jobpaal] handler "${message.type}" failed:`, error);
      return { ok: false, error: message_, code: errorCodeOf(error), id: message.id };
    }
  };

  return {
    handle(type, handler) {
      handlers.set(type, handler as unknown as Handler);
    },
    dispatch,
    install() {
      chrome.runtime.onMessage.addListener((message: Request, sender, sendResponse) => {
        if (!message || typeof message.type !== 'string') return false;
        if (!handlers.has(message.type)) return false;
        dispatch(message, sender).then(sendResponse);
        return true;
      });
    },
  };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
