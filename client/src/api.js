// Access token lives in memory only (never localStorage) so XSS can't exfiltrate a long-lived credential.
// The refresh token is an httpOnly, SameSite=Strict cookie the JS cannot read.
let accessToken = null;
let refreshing = null;

export const setToken = (t) => { accessToken = t; };

async function raw(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    ...opts,
    credentials: 'include',
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.details?.join('; ') || data.error || 'Request failed'), { status: res.status });
  return data;
}

export async function refresh() {
  refreshing ??= raw('/auth/refresh', { method: 'POST' })
    .then((d) => { accessToken = d.accessToken; return d; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function api(path, opts) {
  try {
    return await raw(path, opts);
  } catch (e) {
    if (e.status === 401 && !path.startsWith('/auth/')) {
      await refresh();
      return raw(path, opts);
    }
    throw e;
  }
}
