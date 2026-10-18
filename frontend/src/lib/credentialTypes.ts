/** Credential types and the data fields each one stores. */
export const CREDENTIAL_TYPES = {
  api_key: {
    label: 'API Key',
    fields: [{ key: 'api_key', label: 'API key', secret: true, placeholder: 'sk-…' }],
  },
  basic_auth: {
    label: 'Basic Auth',
    fields: [
      { key: 'username', label: 'Username', secret: false, placeholder: '' },
      { key: 'password', label: 'Password', secret: true, placeholder: '' },
    ],
  },
  oauth2: {
    label: 'OAuth2 Token',
    fields: [{ key: 'access_token', label: 'Access token', secret: true, placeholder: '' }],
  },
  custom: {
    label: 'Custom (JSON)',
    fields: [],
  },
} as const;
