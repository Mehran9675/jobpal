import { FIELD_DEFINITIONS } from '@/lib/autofill/fields';

/** The profile fields offered in the manual field-mapping dropdown. */
export const MAPPING_KEYS = FIELD_DEFINITIONS.filter((definition) => definition.key !== 'unknown' && !definition.file).slice(0, 40);
