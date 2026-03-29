/**
 * Defense-in-depth email format assertion.
 * NOT a full RFC 5322 check — just ensures the string has `@` with non-empty local and domain parts.
 * Call before hashing or encrypting to catch obviously malformed input early.
 */
export function assertBasicEmailFormat(email: string): void {
  const atIndex = email.indexOf("@");
  if (atIndex < 1 || atIndex === email.length - 1) {
    throw new Error("Invalid email format: must contain '@' with non-empty local and domain parts");
  }
}
