import { readFile, stat } from "fs/promises";
import {
  contentTypeForExt,
  isSafeUploadName,
  resolveUploadAbsolutePath,
} from "@/lib/uploads";
import { extname } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const notFound = (): Response =>
  new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });

const serveUpload = async (parts: string[]): Promise<Response> => {
  if (parts.length !== 1) return notFound();

  const filename = parts[0];
  if (!filename || !isSafeUploadName(filename)) return notFound();

  const ext = extname(filename).toLowerCase();
  if (!ext || ext === ".") return notFound();

  const absolutePath = await resolveUploadAbsolutePath(filename);
  if (!absolutePath) return notFound();

  try {
    const st = await stat(absolutePath);
    if (!st.isFile()) return notFound();
    const body = await readFile(absolutePath);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentTypeForExt(ext),
        "Content-Length": String(st.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
};

export const GET = async (
  _request: Request,
  context: RouteContext,
): Promise<Response> => {
  const { path: parts } = await context.params;
  return serveUpload(parts ?? []);
};

export const HEAD = async (
  _request: Request,
  context: RouteContext,
): Promise<Response> => {
  const { path: parts } = await context.params;
  const response = await serveUpload(parts ?? []);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
};
