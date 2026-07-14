/**
 * CareerX Launch Service
 * Responsible for the SSO handshake between PerformX and CareerX
 */

export const launchCareerX = async (accessToken: string) => {
  const CAREER_APP_URL = process.env.NEXT_PUBLIC_CAREER_APP_URL || 'http://localhost:3001';
  const CAREER_API_URL = process.env.NEXT_PUBLIC_CAREER_API_URL || 'http://localhost:3000/api/v1';

  if (!accessToken) {
    throw new Error('No access token found');
  }

  try {
    console.log("Access Token:", accessToken);
    // Perform the secure exchange request
    // This sends the PerformX JWT to CareerX backend
    // credentials: 'include' allows CareerX to set its own HttpOnly cookies
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

    // On success, redirect to CareerX dashboard
    window.location.href = `${CAREER_APP_URL}/dashboard`;
  } catch (error: any) {
    console.error('CareerX launch error:', error);
    throw error;
  }
};
