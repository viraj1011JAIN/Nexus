/**
 * API Key scopes — shared between server actions and client components.
 * Kept in a plain (non-server) module so client bundles can import it directly.
 */
export const API_SCOPES = [
  { value: "boards:read",    label: "Boards — Read",    description: "List and view boards" },
  { value: "boards:write",   label: "Boards — Write",   description: "Create and update boards" },
  { value: "cards:read",     label: "Cards — Read",     description: "List and view cards" },
  { value: "cards:write",    label: "Cards — Write",    description: "Create, update, delete cards" },
  { value: "members:read",   label: "Members — Read",   description: "List organization members" },
  { value: "webhooks:write", label: "Webhooks — Write", description: "Manage webhooks" },
] as const;
