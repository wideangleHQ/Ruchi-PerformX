'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { useAuth } from '@/context/AuthContext';

interface NavAccess {
  rndMember: boolean;
  vendorAccess: boolean;
}

const NONE: NavAccess = { rndMember: false, vendorAccess: false };

/**
 * Two sidebar entries are grants rather than roles, so the JWT cannot answer
 * them. R&D membership lives in rnd_team_members and vendor management access
 * in vendor_dashboard_access, both per person.
 *
 * Asked once per session and cached, because the alternative is either
 * rendering a tab that 403s on click, which reads as broken software, or
 * hiding a tab from someone who was granted it.
 *
 * Both calls fail soft. A 403 or a network error means no extra access, which
 * is the safe direction: the role check still runs and MD/EA/PA keep their
 * items regardless of what this returns.
 */
export function useNavAccess(): NavAccess {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['nav-access', user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<NavAccess> => {
      const [rnd, vendor] = await Promise.allSettled([
        apiClient.get('/rnd/team/me'),
        apiClient.get('/vendor-access/me'),
      ]);
      return {
        rndMember:
          rnd.status === 'fulfilled' && rnd.value.data?.isMember === true,
        vendorAccess:
          vendor.status === 'fulfilled' && !!vendor.value.data?.accessLevel,
      };
    },
  });

  return data ?? NONE;
}
