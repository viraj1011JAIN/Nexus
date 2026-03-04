// Mock next/cache for Jest — Next.js 16 server internals require Web APIs
// (TextEncoder, Request, etc.) not available in jsdom test environment.
const _unstable_cache = jest.fn(
  (fn: (...args: unknown[]) => unknown) => fn
);
const _revalidateTag = jest.fn();
const _revalidatePath = jest.fn();

module.exports = {
  unstable_cache: _unstable_cache,
  revalidateTag: _revalidateTag,
  revalidatePath: _revalidatePath,
};

// Also support named ESM imports (ts-jest interop)
exports.unstable_cache = _unstable_cache;
exports.revalidateTag = _revalidateTag;
exports.revalidatePath = _revalidatePath;
