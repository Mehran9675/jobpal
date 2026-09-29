const urls = new Map<string, string>();

interface OffscreenMessage {
  type?: string;
  payload?: { base64?: string; mime?: string; id?: string; key?: string };
}

chrome.runtime.onMessage.addListener((message: OffscreenMessage, _sender, sendResponse) => {
  if (message?.type === 'offscreen.createObjectUrl') {
    const { base64 = '', mime = 'application/octet-stream', id = `${Date.now()}` } = message.payload ?? {};
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      urls.set(id, url);
      sendResponse({ ok: true, url, key: id });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (message?.type === 'offscreen.revokeObjectUrl') {
    const key = message.payload?.key;
    if (key && urls.has(key)) {
      URL.revokeObjectURL(urls.get(key) as string);
      urls.delete(key);
    }
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
