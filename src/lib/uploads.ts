import "server-only";
import { z } from "zod";

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 250 * 1024 * 1024; // 250 MB per file (videos)
export const ALLOWED_TYPES = ["image/*", "video/*", "application/pdf", "application/zip", "text/plain"];

export const FileMeta = z.object({
  pathname: z.string().min(1).max(500),
  contentType: z.string().max(100),
  size: z.number().int().min(0).max(MAX_FILE_BYTES),
  name: z.string().max(200),
});
export type FileMeta = z.infer<typeof FileMeta>;

export const uploadsEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/** Every upload lives under submissions/<userId>/ so ownership is in the path. */
export const ownsPath = (pathname: string, userId: string) => pathname.startsWith(`submissions/${userId}/`);

export function kindOf(contentType: string): "photo" | "video" | "file" {
  if (contentType.startsWith("image/")) return "photo";
  if (contentType.startsWith("video/")) return "video";
  return "file";
}
