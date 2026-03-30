/** Wrap a success payload in the standard { data } envelope. */
export function envelope<T>(data: T): { readonly data: T } {
  return { data };
}
