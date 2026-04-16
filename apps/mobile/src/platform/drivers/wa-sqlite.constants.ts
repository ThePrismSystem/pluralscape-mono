/**
 * SQLite C API result codes used by the OPFS wa-sqlite driver.
 * Values match the SQLite ABI and are stable across versions.
 * @see https://www.sqlite.org/rescode.html
 */

/** Successful result. */
export const SQLITE_OK = 0;
/** Result from sqlite3_step indicating a row of data is available. */
export const SQLITE_ROW = 100;
/** Result from sqlite3_step indicating the statement has finished executing. */
export const SQLITE_DONE = 101;
