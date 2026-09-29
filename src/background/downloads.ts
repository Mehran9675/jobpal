import { getDocument } from '@/lib/db';
import { notify } from './notify';
import { uid } from '@/lib/utils';
import type { ID } from '@/types';

const OFFSCREEN_PATH = 'offscreen.html';

async function hasOffscreen(): Promise<boolean> {
  if (!chrome.offscreen) return false;
  try {
    return await chrome.offscreen.hasDocument();
  } catch {
    return false;
  }
}

async function ensureOffscreen(): Promise<boolean> {
  if (!chrome.offscreen) return false;
  if (await hasOffscreen()) return true;
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['BLOBS' as chrome.offscreen.Reason],
      justification: 'Create object URLs so generated documents can be saved to disk.',
    });
    return true;
  } catch (error) {
    console.warn('[jobpaal] offscreen unavailable', error);
    return false;
  }
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function downloadDocument(documentId: ID): Promise<{ ok: boolean; filename: string }> {
  const document = await getDocument(documentId);
  if (!document) throw new Error('Document not found. It may have been deleted.');
  const base64 = bufferToBase64(await document.blob.arrayBuffer());
  const mime = document.mime || 'application/octet-stream';

  if (await ensureOffscreen()) {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'offscreen.createObjectUrl',
        payload: { base64, mime, id: uid('url') },
      })) as { ok?: boolean; url?: string; key?: string } | undefined;
      if (response?.ok && response.url) {
        await new Promise<void>((resolve, reject) => {
          chrome.downloads.download({ url: response.url as string, filename: document.filename, saveAs: false }, (downloadId) => {
            const error = chrome.runtime.lastError?.message;
            if (error || downloadId === undefined) reject(new Error(error ?? 'Download failed'));
            else resolve();
          });
        });
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'offscreen.revokeObjectUrl', payload: { key: response.key } }).catch(() => undefined);
        }, 30000);
        return { ok: true, filename: document.filename };
      }
    } catch (error) {
      console.warn('[jobpaal] offscreen download failed, trying data URL', error);
    }
  }

  try {
    const dataUrl = `data:${mime};base64,${base64}`;
    await new Promise<void>((resolve, reject) => {
      chrome.downloads.download({ url: dataUrl, filename: document.filename, saveAs: false }, (downloadId) => {
        const error = chrome.runtime.lastError?.message;
        if (error || downloadId === undefined) reject(new Error(error ?? 'Download failed'));
        else resolve();
      });
    });
    return { ok: true, filename: document.filename };
  } catch (error) {
    await notify('Download failed', 'Open the JobPaal management page and download the file from there.', 'error');
    throw error instanceof Error ? error : new Error(String(error));
  }
}
