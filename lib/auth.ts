export const ADMIN_ROLE = "admin";

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function getRoleFromClaims(
  claims: unknown,
): string | null {
  if (!isRecord(claims)) {
    return null;
  }

  const appMetadata = claims.app_metadata;

  if (!isRecord(appMetadata)) {
    return null;
  }

  return typeof appMetadata.role === "string"
    ? appMetadata.role
    : null;
}

export function hasAdminRole(claims: unknown) {
  return getRoleFromClaims(claims) === ADMIN_ROLE;
}