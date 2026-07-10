import { BlobNotFoundError, get, put } from "@vercel/blob";

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/**
 * Blob is available when a read/write token is present, or on Vercel with a
 * connected store (OIDC via BLOB_STORE_ID / VERCEL_OIDC_TOKEN).
 */
export function canUseBlobStorage() {
  if (readEnv("BLOB_READ_WRITE_TOKEN")) return true;
  if (readEnv("BLOB_STORE_ID")) return true;
  // On Vercel, the SDK can still resolve credentials from the linked store.
  if (process.env.VERCEL === "1") return true;
  return false;
}

function blobAuthOptions() {
  const token = readEnv("BLOB_READ_WRITE_TOKEN");
  const storeId = readEnv("BLOB_STORE_ID");
  const oidcToken = readEnv("VERCEL_OIDC_TOKEN");

  return {
    ...(token ? { token } : {}),
    ...(storeId ? { storeId } : {}),
    ...(oidcToken ? { oidcToken } : {}),
  };
}

/**
 * Paths must match the Blob store layout:
 *   products.json, vehicles.json, quote-config.json, hotspots/{id}.json
 */
export function cmsBlobPath(relativePath: string) {
  return relativePath.replace(/^\/+/, "").replace(/^cms\//, "");
}

async function streamToText(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

async function readWithAccess<T>(
  pathname: string,
  access: "private" | "public"
): Promise<T | null> {
  const result = await get(pathname, {
    access,
    ...blobAuthOptions(),
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const text = await streamToText(result.stream);
  return JSON.parse(text) as T;
}

export async function readBlobJson<T>(relativePath: string): Promise<T | null> {
  const pathname = cmsBlobPath(relativePath);
  // Legacy path used by an earlier version of this app.
  const legacyPath = `cms/${pathname}`;

  for (const path of [pathname, legacyPath]) {
    try {
      const privateResult = await readWithAccess<T>(path, "private");
      if (privateResult !== null) return privateResult;
    } catch (error) {
      if (!(error instanceof BlobNotFoundError)) {
        // Fall through and try public / next path.
      }
    }

    try {
      const publicResult = await readWithAccess<T>(path, "public");
      if (publicResult !== null) return publicResult;
    } catch (error) {
      if (error instanceof BlobNotFoundError) continue;
      // Keep trying alternate paths/access modes.
    }
  }

  return null;
}

async function writeWithAccess(
  pathname: string,
  body: string,
  access: "private" | "public"
) {
  await put(pathname, body, {
    access,
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 60,
    ...blobAuthOptions(),
  });
}

export async function writeBlobJson(relativePath: string, data: unknown) {
  const pathname = cmsBlobPath(relativePath);
  const body = JSON.stringify(data, null, 2);

  let lastError: unknown;

  for (const access of ["private", "public"] as const) {
    try {
      await writeWithAccess(pathname, body, access);

      // Confirm the write is readable so callers never get a false success.
      const verified = await readBlobJson<unknown>(pathname);
      if (verified === null) {
        throw new Error(
          `Se escribió ${pathname} en Blob pero no se pudo leer de vuelta`
        );
      }
      return;
    } catch (error) {
      lastError = error;
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : "Error desconocido de Blob";

  throw new Error(
    `No se pudo guardar el JSON del CMS en Vercel Blob (${pathname}): ${detail}`
  );
}
