/**
 * Type-level interface for thumbnail generation.
 *
 * Actual resize implementation is platform-specific:
 * - Web: Canvas API
 * - React Native: react-native-image-resizer
 *
 * This module defines the contract only.
 */

import {
  THUMBNAIL_MAX_HEIGHT,
  THUMBNAIL_MAX_WIDTH,
  THUMBNAIL_WEBP_QUALITY,
} from "./blob-constants.js";

/** Result of generating a thumbnail. */
export interface ThumbnailResult {
  /** Thumbnail bytes (resized image). */
  readonly data: Uint8Array;
  /** MIME type of the thumbnail. */
  readonly mimeType: ThumbnailConfig["format"];
  /** Width of the thumbnail in pixels. */
  readonly width: number;
  /** Height of the thumbnail in pixels. */
  readonly height: number;
}

/** Configuration for thumbnail generation. */
export interface ThumbnailConfig {
  /** Maximum width in pixels. */
  readonly maxWidth: number;
  /** Maximum height in pixels. */
  readonly maxHeight: number;
  /** Output format. */
  readonly format: "image/jpeg" | "image/webp" | "image/png";
  /** Quality for lossy formats (0-1). */
  readonly quality: number;
}

/** Platform-specific thumbnail generator. */
export interface ThumbnailGenerator {
  /** Generate a thumbnail from image bytes. Returns null if the image format is unsupported. */
  generate(data: Uint8Array, config: ThumbnailConfig): Promise<ThumbnailResult | null>;
}

/** Default thumbnail configuration. */
export const DEFAULT_THUMBNAIL_CONFIG: ThumbnailConfig = {
  maxWidth: THUMBNAIL_MAX_WIDTH,
  maxHeight: THUMBNAIL_MAX_HEIGHT,
  format: "image/webp",
  quality: THUMBNAIL_WEBP_QUALITY,
};
