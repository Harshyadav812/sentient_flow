// SECURITY: Use env variable for API base. Set VITE_API_BASE for production (https).
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    let errorMessage = `Request failed: ${res.status}`;

    if (typeof error.detail === 'string') {
      errorMessage = error.detail;
    } else if (Array.isArray(error.detail)) {
      // Handle FastAPI Pydantic validation errors
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errorMessage = error.detail.map((err: any) => err.msg).join(', ');
    }

    throw new Error(errorMessage);
  }

  return res.json();
}

// Auth
export async function login(email: string, password: string) {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    body,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Login failed' }));
    let errorMessage = 'Login failed';

    if (typeof error.detail === 'string') {
      errorMessage = error.detail;
    } else if (Array.isArray(error.detail)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errorMessage = error.detail.map((err: any) => err.msg).join(', ');
    }

    throw new Error(errorMessage);
  }
  return res.json() as Promise<LoginResponse>;
}

export interface LoginResponse {
  access_token: string | null;
  token_type: string;
  requires_2fa: boolean;
  challenge_token: string | null;
}

export async function loginTwoFactor(challengeToken: string, code: string) {
  return request<{ access_token: string; token_type: string }>('/auth/login/2fa', {
    method: 'POST',
    body: JSON.stringify({ challenge_token: challengeToken, code }),
  });
}

export async function register(email: string, password: string) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  totp_enabled: boolean;
  created_at: string | null;
}

export async function getMe() {
  return request<UserData>('/auth/me');
}

export async function updateMe(payload: { full_name?: string; email?: string; current_password?: string }) {
  return request<UserData>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return request<{ ok: boolean }>('/auth/me/password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export async function deleteAccount(password: string) {
  return request<{ ok: boolean }>('/auth/me', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
}

export async function setupTwoFactor() {
  return request<{ secret: string; otpauth_uri: string }>('/auth/2fa/setup', { method: 'POST' });
}

export async function enableTwoFactor(code: string) {
  return request<UserData>('/auth/2fa/enable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function disableTwoFactor(password: string, code: string) {
  return request<UserData>('/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ password, code }),
  });
}

// Workflows
export interface WorkflowData {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  data: Record<string, unknown>;
  owner_id: string;
  created_at: string;
  updated_at: string | null;
}

export async function getWorkflows() {
  return request<WorkflowData[]>('/workflows/');
}

export async function getWorkflow(id: string) {
  return request<WorkflowData>(`/workflows/${id}`);
}

export async function createWorkflow(payload: {
  name: string;
  description?: string;
  data: Record<string, unknown>;
}) {
  return request<WorkflowData>('/workflows/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateWorkflow(
  id: string,
  payload: Partial<{ name: string; description: string; is_active: boolean; data: Record<string, unknown> }>
) {
  return request<WorkflowData>(`/workflows/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteWorkflow(id: string) {
  return request(`/workflows/${id}`, { method: 'DELETE' });
}

// Execute
export async function executeWorkflow(payload: Record<string, unknown>) {
  return request<{ status: string; results: Record<string, unknown> }>(
    '/workflows/execute',
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export async function runWorkflowById(id: string) {
  return request<{ status: string; results: Record<string, unknown> }>(
    `/workflows/${id}/run`,
    { method: 'POST' }
  );
}

// Credentials
export interface CredentialData {
  id: string;
  name: string;
  type: string;
  created_at: string;
}

export async function getCredentials() {
  return request<CredentialData[]>('/credentials/');
}

// Shared cache for the node credential dropdown; invalidated on create/delete
// so new credentials show up in the editor without a page reload.
let credentialsCache: Promise<CredentialData[]> | null = null;

export function getCredentialsCached() {
  if (!credentialsCache) {
    credentialsCache = getCredentials().catch((err) => {
      credentialsCache = null;
      throw err;
    });
  }
  return credentialsCache;
}

export async function createCredential(payload: { name: string; type: string; data: Record<string, unknown> }) {
  const cred = await request<CredentialData>('/credentials/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  credentialsCache = null;
  return cred;
}

export async function deleteCredential(id: string) {
  const res = await request(`/credentials/${id}`, { method: 'DELETE' });
  credentialsCache = null;
  return res;
}

// Executions
export interface ExecutionNodeData {
  id: string;
  node_name: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  input_data: unknown;
  output_data: unknown;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface ExecutionData {
  id: string;
  workflow_id: string;
  owner_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  workflow_name: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface ExecutionDetailData extends ExecutionData {
  state: Record<string, unknown>;
  nodes: ExecutionNodeData[];
}

export async function getAllExecutions() {
  return request<ExecutionData[]>('/executions/');
}

export async function getExecutionById(executionId: string) {
  return request<ExecutionDetailData>(`/executions/${executionId}`);
}

export async function getExecutions(workflowId: string) {
  return request<ExecutionData[]>(`/workflows/${workflowId}/executions`);
}

export async function getExecutionDetail(workflowId: string, executionId: string) {
  return request<ExecutionDetailData>(`/workflows/${workflowId}/executions/${executionId}`);
}
