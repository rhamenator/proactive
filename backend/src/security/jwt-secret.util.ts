const insecureSecrets = new Set(['dev-secret', 'change_me_in_production']);
const minimumProductionJwtSecretLength = 32;

function currentEnvironment() {
  return (process.env.NODE_ENV ?? 'development').toLowerCase();
}

function allowsDevelopmentFallback() {
  const environment = currentEnvironment();
  return environment === 'development' || environment === 'test';
}

export function getJwtSecret() {
  const configuredSecret = process.env.JWT_SECRET?.trim();

  if (configuredSecret) {
    if (!allowsDevelopmentFallback()) {
      if (insecureSecrets.has(configuredSecret)) {
        throw new Error('JWT_SECRET must be set to a strong, non-default value outside development and test environments.');
      }

      if (configuredSecret.length < minimumProductionJwtSecretLength) {
        throw new Error(`JWT_SECRET must be at least ${minimumProductionJwtSecretLength} characters outside development and test environments.`);
      }
    }

    return configuredSecret;
  }

  if (allowsDevelopmentFallback()) {
    return 'dev-secret';
  }

  throw new Error('JWT_SECRET must be configured outside development and test environments.');
}
