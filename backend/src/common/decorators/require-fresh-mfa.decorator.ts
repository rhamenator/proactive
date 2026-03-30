import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FRESH_MFA_KEY = 'requireFreshMfaMinutes';

export const RequireFreshMfa = (minutes?: number) => SetMetadata(REQUIRE_FRESH_MFA_KEY, minutes ?? true);
