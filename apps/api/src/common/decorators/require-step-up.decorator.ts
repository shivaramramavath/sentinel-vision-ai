import { SetMetadata } from '@nestjs/common';

export const REQUIRE_STEP_UP_KEY = 'requireStepUp';

/**
 * Decorator to require a fresh step-up authentication token (within 5 minutes).
 */
export const RequireStepUp = (enabled = true) =>
  SetMetadata(REQUIRE_STEP_UP_KEY, enabled);
