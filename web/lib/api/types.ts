/**
 * Shared, area-agnostic API contract shapes.
 *
 * These two are "the error shape every 400 returns" and are
 * genuinely shared — every area's mutations go through the same client and the same shape.
 *
 * Domain types (a product, an order line, an area's own paged-list shape, ...) belong to the
 * area that owns the endpoint they describe. Add them in that area's own `lib/api/<area>.ts`,
 * mirroring that area's handover §12.3 view models exactly — same field names, same
 * nullability. Do not add domain types here; this file is imported by every area.
 */

export interface ValidationError {
  propertyName: string;
  errorCode: string; // violation code — never shown to the user
  errorMessage: string;
  resourceName: string;
}

export interface ValidationResponse {
  errors: ValidationError[];
  isValid: boolean;
}

/**
 * ARCH gate LOW (first pass) — a generic pagination wrapper, not itself a domain type (`T` is
 * whatever the area's own endpoint returns), so it belongs here rather than in `staff-admin.ts`
 * (where it previously lived and was re-exported from `staff-customers.ts` for that area to use
 * too) — every area with a paginated list endpoint needs this same shape.
 */
export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}
