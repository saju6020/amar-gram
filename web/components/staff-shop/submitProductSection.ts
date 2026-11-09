import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiConflictError, ApiValidationError } from '@/lib/api/client';
import {
  applyValidationErrors,
  describeUnexpectedError,
  SHOP_CODE_MESSAGES,
  SHOP_FIELD_MAP,
} from '@/lib/api/errors';
import { CONFLICT_MESSAGE, PartialSaveError } from '@/lib/shop/submitSection';

/**
 * HO-P5 S3 -- the shop section save of `lib/shop/submitSection.ts`, with the property names and plain-language
 * sentences the new catalogue fields add. `lib/api/errors.ts` (the shared table) is outside S3's block (§14), so the
 * additions live here: the server's own message is still preferred and `errorCode` is read only to pick a fallback
 * sentence (NFR-USA-4); it is never shown.
 */
export const CATALOGUE_FIELD_MAP: Readonly<Record<string, string>> = {
  ...SHOP_FIELD_MAP,
  DistrictOfOrigin: 'districtOfOrigin', // BG-12, StaffProductRequests.cs:26-27
  OrganicCertifier: 'organicCertifier',
  OrganicCertificateNumber: 'organicCertificateNumber',
  OrganicCertificateExpiresOn: 'organicCertificateExpiresOn', // BG-14, FoodAndOriginRequests.cs:14-18
  OrganicCertificateFileId: 'organicCertificateFileId',
  ShelfLife: 'shelfLife',
  NetWeight: 'netWeight',
  Allergens: 'allergens',
  CompareAtAmount: 'compareAtAmount', // BG-13, StaffProductRequests.cs:90-91
};

export const CATALOGUE_CODE_MESSAGES: Readonly<Record<string, string>> = {
  ...SHOP_CODE_MESSAGES,
  InvalidDistrictOfOrigin: 'The district of origin is at most 60 characters of plain text.',
  CompareAtMustExceedPrice: 'The “Was” price must be higher than the price.',
  OrganicCertificateExpired:
    'The organic certificate has expired. Update it on Food & labelling before publishing.',
  InvalidCertificateFile:
    'That certificate file could not be attached. Upload it again and save straight away.',
  InvalidBulkAction: 'That action is not available. Choose Publish or Hide from shop.',
  ProductNotFound: 'That product could not be found.',
  InvalidProductTransition: 'That product is not in a state where this can be done.',
};

/** The plain sentence the layout shows when a publish is refused for an expired organic certificate (BG-14). */
export const ORGANIC_CERTIFICATE_EXPIRED_MESSAGE = CATALOGUE_CODE_MESSAGES.OrganicCertificateExpired!;

/** As `submitSection`: a 400 maps to its field, a 409 offers Reload, anything else is a plain root message. */
export async function submitProductSection<T extends FieldValues>(
  action: () => Promise<unknown>,
  setError: UseFormSetError<T>,
  knownFields: ReadonlyArray<Path<T>>,
): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (error) {
    const root = 'root' as Path<T>;
    if (error instanceof PartialSaveError) {
      setError(root, { type: 'partial', message: error.message });
    } else if (error instanceof ApiConflictError) {
      setError(root, { type: 'conflict', message: CONFLICT_MESSAGE });
    } else if (error instanceof ApiValidationError) {
      applyValidationErrors(error, setError, {
        fieldMap: CATALOGUE_FIELD_MAP as Partial<Record<string, Path<T>>>,
        codeMessages: CATALOGUE_CODE_MESSAGES,
        knownFields,
      });
    } else {
      setError(root, { type: 'server', message: describeUnexpectedError(error) });
    }
    return false;
  }
}
