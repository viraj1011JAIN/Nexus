// Polyfill Web APIs that Next.js 16 server internals need but jsdom lacks.
// This runs via setupFiles (before test framework and module loading).
const { TextEncoder, TextDecoder } = require('util');

if (typeof globalThis.TextEncoder === 'undefined') {
  Object.assign(globalThis, { TextEncoder, TextDecoder });
}

if (typeof globalThis.Request === 'undefined') {
  Object.assign(globalThis, {
    Request: class Request {
      url: string;
      method: string;
      headers: Map<string, string>;
      constructor(url: string, init?: Record<string, unknown>) {
        this.url = url;
        this.method = (init?.method as string) || 'GET';
        this.headers = new Map();
      }
    },
    Response: class Response {
      body: unknown;
      status: number;
      constructor(body?: unknown, init?: Record<string, unknown>) {
        this.body = body;
        this.status = (init?.status as number) || 200;
      }
    },
    Headers: (() => {
      // Web API Headers.get() returns null for missing keys (not undefined like Map)
      class H extends Map<string, string> {
        // @ts-expect-error — intentionally returning null instead of undefined to match Web API
        get(key: string): string | null { return super.get(key) ?? null; }
      }
      return H;
    })(),
  });
}

if (typeof globalThis.ReadableStream === 'undefined') {
  const { ReadableStream, TransformStream } = require('stream/web');
  Object.assign(globalThis, { ReadableStream, TransformStream });
}
