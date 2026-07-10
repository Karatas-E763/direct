import { BlobNotFoundError, get, put } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";
import { headers } from "next/headers";

type BlobAccess = "private" | "public";

type BlobAuth = {
  token?: string;
  storeId?: string;
  oidcToken?: string;
};

/**
 * Static property access is required so Next.js/Vercel keep these env vars
 * available in serverless functions. Dynamic process.env[name] can be empty.
 */
function getReadWriteToken() {
  const direct =
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN?.trim();

  if (direct) return direct;

  // Blob "Advanced Options" may use a custom env prefix.
  for (const [key, value] of Object.entries(process.env)) {
    if (!value?.trim()) continue;
    if (!value.trim().startsWith("vercel_blob_rw_")) continue;
    if (
      key === "BLOB_READ_WRITE_TOKEN" ||
      key.endsWith("_BLOB_READ_WRITE_TOKEN") ||
      (key.includes("BLOB") && key.includes("READ_WRITE") && key.includes("TOKEN"))
    ) {
      return value.trim();
    }
  }

  return undefined;
}

function getStoreId() {
  const direct =
    process.env.BLOB_STORE_ID?.trim() ||
    process.env.VERCEL_BLOB_STORE_ID?.trim();

  if (direct) return direct;

  for (const [key, value] of Object.entries(process.env)) {
    if (!value?.trim()) continue;
    if (
      key === "BLOB_STORE_ID" ||
      key.endsWith("_BLOB_STORE_ID") ||
      (key.includes("BLOB") && key.endsWith("STORE_ID"))
    ) {
      return value.trim();
    }
  }

  // Read-write tokens encode the store id: vercel_blob_rw_<storeId>_<secret>
  const token = getReadWriteToken();
  if (token) {
    const parts = token.split("_");
    // ["vercel", "blob", "rw", "<storeId>", "<secret>"]
    if (parts.length >= 5 && parts[0] === "vercel" && parts[1] === "blob") {
      return parts[3];
    }
  }

  return undefined;
}

export function canUseBlobStorage() {
  if (getReadWriteToken()) return true;
  if (getStoreId()) return true;
  if (process.env.VERCEL === "1") return true;
  if (process.env.VERCEL_OIDC_TOKEN?.trim()) return true;
  return false;
}

/**
 * Capture the per-request Vercel OIDC token so Blob auth works inside
 * App Router handlers (token arrives as x-vercel-oidc-token).
 */
export function ensureBlobRequestAuth(request: Request) {
  const oidc = request.headers.get("x-vercel-oidc-token")?.trim();
  if (oidc && !process.env.VERCEL_OIDC_TOKEN?.trim()) {
    process.env.VERCEL_OIDC_TOKEN = oidc;
  }
}

/**
 * Paths must match the Blob store layout:
 *   products.json, vehicles.json, quote-config.json, hotspots/{id}.json
 */
export function cmsBlobPath(relativePath: string) {
  return relativePath.replace(/^\/+/, "").replace(/^cms\//, "");
}

async function resolveOidcToken(): Promise<string | undefined> {
  const fromEnv = process.env.VERCEL_OIDC_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  try {
    const h = await headers();
    const fromHeader = h.get("x-vercel-oidc-token")?.trim();
    if (fromHeader) return fromHeader;
  } catch {
    // Not in a Next.js request context.
  }

  try {
    const fromHelper = (await getVercelOidcToken())?.trim();
    if (fromHelper) return fromHelper;
  } catch {
    // OIDC unavailable in this runtime.
  }

  return undefined;
}

async function resolveAuthOptions(): Promise<BlobAuth> {
  const token = getReadWriteToken();
  if (token) {
    return { token };
  }

  const storeId = getStoreId();
  const oidcToken = await resolveOidcToken();

  if (oidcToken && storeId) {
    return { oidcToken, storeId };
  }

  // Partial credentials — still pass what we have so the SDK can finish resolution.
  return {
    ...(oidcToken ? { oidcToken } : {}),
    ...(storeId ? { storeId } : {}),
  };
}

function describeMissingCredentials(auth: BlobAuth) {
  return [
    `token=${auth.token || getReadWriteToken() ? "set" : "missing"}`,
    `storeId=${auth.storeId || getStoreId() ? "set" : "missing"}`,
    `oidc=${auth.oidcToken || process.env.VERCEL_OIDC_TOKEN ? "set" : "missing"}`,
  ].join(", ");
}

async function streamToText(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

async function readWithAccess<T>(
  pathname: string,
  access: BlobAccess,
  auth: BlobAuth
): Promise<T | null> {
  const result = await get(pathname, {
    access,
    ...auth,
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const text = await streamToText(result.stream);
  return JSON.parse(text) as T;
}

export async function readBlobJson<T>(relativePath: string): Promise<T | null> {
  const pathname = cmsBlobPath(relativePath);
  const legacyPath = `cms/${pathname}`;
  const auth = await resolveAuthOptions();

  for (const path of [pathname, legacyPath]) {
    for (const access of ["private", "public"] as const) {
      try {
        const data = await readWithAccess<T>(path, access, auth);
        if (data !== null) return data;
      } catch (error) {
        if (error instanceof BlobNotFoundError) continue;
      }
    }
  }

  return null;
}

async function writeWithAccess(
  pathname: string,
  body: string,
  access: BlobAccess,
  auth: BlobAuth
) {
  await put(pathname, body, {
    access,
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 60,
    ...auth,
  });
}

export async function writeBlobJson(relativePath: string, data: unknown) {
  const pathname = cmsBlobPath(relativePath);
  const body = JSON.stringify(data, null, 2);
  const auth = await resolveAuthOptions();

  let lastError: unknown;

  for (const access of ["private", "public"] as const) {
    try {
      await writeWithAccess(pathname, body, access, auth);

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
    `No se pudo guardar el JSON del CMS en Vercel Blob (${pathname}): ${detail} [${describeMissingCredentials(auth)}]`
  );
}
