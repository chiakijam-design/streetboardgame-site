// Test-server boundary, not production routing or access control.
// Browser routing does not reliably intercept every HTTP redirect hop.
export function guardTestRedirect(response, requestURL) {
  if (![301,302,303,307,308].includes(response.status) || !response.headers.has('location')) return response;
  let allowed=false;
  try {
    const current=new URL(requestURL),next=new URL(response.headers.get('location'),current);
    allowed=['http:','https:'].includes(current.protocol)
      && ['127.0.0.1','localhost','[::1]'].includes(current.hostname)
      && next.origin===current.origin && !next.username && !next.password;
  } catch {}
  if (allowed) return response;
  return new Response('External redirect blocked in isolated test environment.',{
    status:502,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-wata-test-redirect-blocked':'1'},
  });
}

// Node-side Worker fetches must not reach providers during local game tests.
export function guardTestFetch(fetchImplementation) {
  return async function localTestFetch(input, options = {}) {
    let url;
    try { url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url); } catch {}
    if (!url || !['http:','https:'].includes(url.protocol)
      || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.username || url.password) {
      throw new Error('External fetch blocked in isolated test server');
    }
    // A Worker-side redirect may not silently escape the loopback boundary.
    return fetchImplementation(input, { ...options, redirect:'error' });
  };
}
