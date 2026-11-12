/**
 * Decodes the server's compressed frames (docs/protocol.md, Compression).
 *
 * After a `welcome` with `compression: "deflate-raw"` every server message is a
 * binary frame: its JSON and a newline, raw-deflated on one stream for the
 * whole connection and sync-flushed. So the frames go through one
 * DecompressionStream in order, and each newline ends a message.
 */

export const DEFLATE_RAW = "deflate-raw";

/** True when this browser can decode deflate-raw frames (Chrome 103, Firefox 113, Safari 16.4). */
export function canInflate(Decompression = globalThis.DecompressionStream) {
  if (typeof Decompression !== "function") return false;
  try {
    new Decompression(DEFLATE_RAW);
    return true;
  } catch {
    return false;
  }
}

/**
 * One connection's decoder. `push` takes the binary frames in order; `onText`
 * gets each message's JSON text in the same order, asynchronously.
 * `drained()` resolves once every pushed frame has been delivered (or the
 * stream failed), so a close can wait for the messages sent before it.
 *
 * @param {(text: string) => void} onText
 * @param {{
 *   onError?: (error: Error) => void,
 *   report?: (error: Error) => void,
 *   Decompression?: typeof DecompressionStream,
 * }} [options] `onError`: the stream is corrupt (once; later frames are
 *   dropped). `report`: an `onText` handler threw; the next messages still come.
 */
export function createInflater(
  onText,
  { onError = () => {}, report = (error) => console.error(error), Decompression = globalThis.DecompressionStream } = {},
) {
  const stream = new Decompression(DEFLATE_RAW);
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const decoder = new TextDecoder();
  let text = "";
  // Frames pushed whose message hasn't come out yet: every frame holds exactly one.
  let pending = 0;
  let waiters = [];
  let failed = false;

  const settle = () => {
    if (pending > 0) return;
    for (const resolve of waiters) resolve();
    waiters = [];
  };
  const fail = (error) => {
    if (failed) return;
    failed = true;
    pending = 0;
    settle();
    onError(error);
  };

  (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      text += decoder.decode(value, { stream: true });
      for (let end = text.indexOf("\n"); end >= 0; end = text.indexOf("\n")) {
        const message = text.slice(0, end);
        text = text.slice(end + 1);
        pending = Math.max(0, pending - 1);
        try {
          onText(message);
        } catch (error) {
          report(error);
        }
        settle();
      }
    }
  })().catch(fail);

  return {
    /** @param {ArrayBuffer | Uint8Array} bytes */
    push(bytes) {
      if (failed) return;
      pending += 1;
      writer.write(ArrayBuffer.isView(bytes) ? bytes : new Uint8Array(bytes)).catch(fail);
    },
    drained() {
      return new Promise((resolve) => {
        waiters.push(resolve);
        settle();
      });
    },
  };
}
