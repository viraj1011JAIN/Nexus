// Jest mock for the 'server-only' package.
//
// In the real Next.js runtime, 'server-only' throws if a Client Component
// tries to import a module that contains this import. Jest runs in plain
// Node.js where the client/server boundary doesn't exist, so we export a
// no-op module that satisfies the import without throwing.
export {};
