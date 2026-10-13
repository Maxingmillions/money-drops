import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ApiError, handler, json, requireSession } from "@/lib/api";
import { ALLOWED_TYPES, MAX_FILE_BYTES, uploadsEnabled } from "@/lib/uploads";

/**
 * Issues short-lived client upload tokens so files go straight from the
 * browser to the private Blob store (no size limit through our server).
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  if (!uploadsEnabled()) throw new ApiError(503, "Uploads aren't configured on this server");
  const body = (await req.json()) as HandleUploadBody;
  const result = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      if (!pathname.startsWith(`submissions/${session.userId}/`)) throw new Error("Invalid upload path");
      return {
        allowedContentTypes: ALLOWED_TYPES,
        maximumSizeInBytes: MAX_FILE_BYTES,
        addRandomSuffix: true,
        tokenPayload: session.userId,
      };
    },
    onUploadCompleted: async () => {
      /* The submission row references the file once the form is sent. */
    },
  });
  return json(result);
});
