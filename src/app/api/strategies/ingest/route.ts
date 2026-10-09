import { withUser, errorResponse } from "@/server/http";
import { ingestStrategyUpload } from "@/server/strategy-ingest";
import { AuthError, requireUser } from "@/server/session";
import { ensureSeeded } from "@/server/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const user = await requireUser();
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const pasted = String(form.get("text") ?? "");
      if (file instanceof File) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await ingestStrategyUpload(user.userId, file.name || "upload.bin", buffer, pasted || undefined);
        return Response.json(result);
      }
      if (pasted) {
        const result = await ingestStrategyUpload(user.userId, String(form.get("filename") ?? "pasted.txt"), Buffer.from(pasted), pasted);
        return Response.json(result);
      }
      throw new Error("file or text is required");
    }
    return withUser(async (u) => {
      const body = (await req.json()) as { filename?: string; text?: string };
      if (!body.text) throw new Error("text is required");
      return ingestStrategyUpload(u.userId, body.filename ?? "pasted.txt", Buffer.from(body.text), body.text);
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    return errorResponse(error);
  }
}
