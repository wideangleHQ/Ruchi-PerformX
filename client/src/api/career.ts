/**
 * CareerX launch.
 *
 * Same-tab navigation, not an iframe: exchange the PerformX JWT for a CareerX
 * session, then send the browser to CareerX with a return path so its shell can
 * render a link back here. See docs/src/p2_integration.md.
 *
 * `credentials: 'include'` is what lets CareerX set its own HttpOnly session
 * cookies on the exchange response. The PerformX token is passed in the header
 * and is never logged or persisted anywhere on the way through.
 *
 * Throws an Error carrying the CareerX message when the exchange is refused,
 * which is the case where the user has no HR access, and an Error naming the
 * variable when CareerX is not configured for this deployment.
 */

/**
 * Resolve one `NEXT_PUBLIC_CAREER_*` base, falling back to the local port, and
 * reject anything that is not an absolute URL.
 *
 * `NEXT_PUBLIC_*` is inlined at build time, so a value the build never received
 * ships as whatever placeholder stood in for it. A Vercel variable marked
 * Sensitive comes back from `vercel pull` as the literal `[SENSITIVE]`, which
 * made `fetch` resolve `/auth/exchange` against the PerformX origin, hit the
 * Next 404 page, and reach the user as the generic exchange failure. Name the
 * variable instead. Throws when the value is not an `http(s)` URL.
 */
const configuredUrl = (name: string, value: string | undefined, devDefault: string) => {
  const url = value || devDefault;
  if (!/^https?:\/\//.test(url)) {
    throw new Error(`CareerX is not configured for this deployment (${name} is "${url}").`);
  }
  return url;
};

export const launchCareerX = async (accessToken: string, returnTo?: string) => {
  const CAREER_APP_URL = configuredUrl(
    'NEXT_PUBLIC_CAREER_APP_URL',
    process.env.NEXT_PUBLIC_CAREER_APP_URL,
    'http://localhost:3001',
  );
  const CAREER_API_URL = configuredUrl(
    'NEXT_PUBLIC_CAREER_API_URL',
    process.env.NEXT_PUBLIC_CAREER_API_URL,
    'http://localhost:3000/api/v1',
  );

  if (!accessToken) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${CAREER_API_URL}/auth/exchange`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'CareerX authentication could not be completed.');
  }

  const backTo = returnTo || `${window.location.origin}/dashboard`;
  window.location.href = `${CAREER_APP_URL}/dashboard?returnTo=${encodeURIComponent(backTo)}`;
};
