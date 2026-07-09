import { BlobNotFoundError, get, put } from "@vercel/blob";

const CMS_BLOB_PREFIX = "cms";

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function canUseBlobStorage() {
  if (readEnv("BLOB_READ_WRITE_TOKEN")) return true;
  if (process.env.VERCEL === "1" && readEnv("BLOB_STORE_ID")) return true;
  return false;
}

function blobCommandOptions() {
  const token = readEnv("BLOB_READ_WRITE_TOKEN");
  const storeId = readEnv("BLOB_STORE_ID");
  const oidcToken = readEnv("VERCEL_OIDC_TOKEN");

  return {
    access: "private" as const,
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    ...(token ? { token } : {}),
    ...(storeId ? { storeId } : {}),
    ...(oidcToken ? { oidcToken } : {}),
  };
}

export function cmsBlobPath(relativePath: string) {
  return `${CMS_BLOB_PREFIX}/${relativePath.replace(/^\/+/, "")}`;
}

async function streamToText(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

export async function readBlobJson<T>(relativePath: string): Promise<T | null> {
  if (!canUseBlobStorage()) return null;

  const pathname = cmsBlobPath(relativePath);

  try {
    const result = await get(pathname, blobCommandOptions());
    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }

    const text = await streamToText(result.stream);
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

export async function writeBlobJson(relativePath: string, data: unknown) {
  if (!canUseBlobStorage()) {
    throw new Error(
      "Vercel Blob no está configurado. Conecta un Blob store al proyecto en Vercel para persistir los archivos JSON del CMS."
    );
  }

  const pathname = cmsBlobPath(relativePath);
  const body = JSON.stringify(data, null, 2);

  await put(pathname, body, blobCommandOptions());
}
