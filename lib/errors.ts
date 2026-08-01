// The RPCs raise short fact strings ("already reserved") that scripts/verify-db.mjs asserts
// and that act as the API contract, so they stay as raised. This lookup turns each into the
// sentence a person mid-action needs; anything unmapped passes through.

const MESSAGES: Record<string, string> = {
  "already reserved": "Someone already holds that locker.",
  "no approved request": "Your request is not approved yet.",
  "already holds a locker": "You already have a locker.",
  "already holding a reservation": "You already hold a locker. Cancel it first.",
  "locker unavailable": "That locker is not available.",
  "already leased": "That locker is occupied.",
  "reservation expired": "Your hold expired. Pick another locker.",
  "not signed in": "Your session ended. Sign in again.",
  "admin only": "Only an admin can do that.",
  "no active lease with that id": "That lease is not active anymore.",
  "locker is reserved": "A user is holding that locker. Release the hold first.",
};

export function friendlyError(message: string): string {
  return MESSAGES[message] ?? message;
}
