// Copying a code block. The clipboard is passed in (navigator.clipboard in
// the page), so the outcome can be tested without a browser.

interface Clipboard {
  writeText: (text: string) => Promise<unknown>;
}

/**
 * Puts `text` on the clipboard. Returns false where there is no clipboard
 * (plain http, old browsers) or the browser refuses, so the page can select
 * the text for a manual copy instead.
 */
export async function copyText(text: string, clipboard: Clipboard | undefined): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
