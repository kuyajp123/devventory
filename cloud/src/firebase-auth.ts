import { importX509, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { ApiError, boundedText } from './http.ts';

export interface FirebaseIdentity {
  uid: string;
  email: string;
}
// Only Google's Firebase signing certificates are trusted. No request or env may override this URL.
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
const certificatesUrl =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certificates: Record<string, string> = {};
let expiresAt = 0;
let fetching: Promise<void> | null = null;
async function updateCertificates() {
  try {
    const response = await fetch(certificatesUrl, {
      // workerd supports manual/follow, not error. Non-2xx (including redirects)
      // is rejected below, so a certificate request can never change origin.
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('unavailable');
    const data: unknown = JSON.parse(await boundedText(response, 65_536));
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('invalid');
    const entries = Object.entries(data);
    if (
      !entries.length ||
      entries.length > 16 ||
      entries.some(
        ([key, value]) =>
          key.length > 256 ||
          typeof value !== 'string' ||
          value.length > 10_000 ||
          !value.startsWith('-----BEGIN CERTIFICATE-----'),
      )
    )
      throw new Error('invalid');
    certificates = Object.fromEntries(entries);
    const ttl = Number(
      /max-age=(\d+)/.exec(response.headers.get('Cache-Control') ?? '')?.[1] ??
        300,
    );
    expiresAt = Date.now() + Math.min(ttl, 3600) * 1000;
  } catch {
    throw new ApiError(503, 'AUTH_UNAVAILABLE');
  }
}
const googleKey: JWTVerifyGetKey = async (header) => {
  if (Date.now() >= expiresAt) {
    fetching ??= updateCertificates().finally(() => {
      fetching = null;
    });
    await fetching;
  }
  if (!header.kid || !Object.hasOwn(certificates, header.kid))
    throw new ApiError(401, 'UNAUTHORIZED');
  return importX509(certificates[header.kid], 'RS256');
};
export async function verifyFirebaseToken(
  token: string,
  projectId: string,
  resolve: JWTVerifyGetKey = googleKey,
): Promise<FirebaseIdentity> {
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(projectId))
    throw new ApiError(503, 'NOT_CONFIGURED');
  if (token.length > 8192 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token))
    throw new ApiError(401, 'UNAUTHORIZED');
  try {
    const { payload, protectedHeader } = await jwtVerify(token, resolve, {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      requiredClaims: ['exp', 'iat', 'auth_time', 'sub'],
      clockTolerance: 0,
    });
    const now = Math.floor(Date.now() / 1000);
    if (
      !protectedHeader.kid ||
      protectedHeader.kid.length > 256 ||
      !payload.sub ||
      payload.sub.length > 128 ||
      typeof payload.iat !== 'number' ||
      payload.iat > now ||
      typeof payload.auth_time !== 'number' ||
      payload.auth_time < 0 ||
      payload.auth_time > now ||
      typeof payload.email !== 'string' ||
      payload.email.length > 320
    )
      throw new ApiError(401, 'UNAUTHORIZED');
    if (payload.email_verified !== true)
      throw new ApiError(403, 'EMAIL_VERIFICATION_REQUIRED');
    return { uid: payload.sub, email: payload.email };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'UNAUTHORIZED');
  }
}
