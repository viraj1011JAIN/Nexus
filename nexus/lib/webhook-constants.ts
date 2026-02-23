/**
 * Webhook event types — shared between server actions and client components.
 * Kept in a plain (non-server) module so client bundles can import it directly.
 */
export const WEBHOOK_EVENTS = [
  { value: "card.created",      label: "Card Created" },
  { value: "card.updated",      label: "Card Updated" },
  { value: "card.deleted",      label: "Card Deleted" },
  { value: "card.moved",        label: "Card Moved" },
  { value: "comment.created",   label: "Comment Added" },
  { value: "board.created",     label: "Board Created" },
  { value: "sprint.started",    label: "Sprint Started" },
  { value: "sprint.completed",  label: "Sprint Completed" },
  { value: "member.invited",    label: "Member Invited" },
] as const;
