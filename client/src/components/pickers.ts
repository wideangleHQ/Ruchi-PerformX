'use client';

import { useQuery } from '@tanstack/react-query';
import { User } from '@/api/types';
import { Department, usersApi } from '@/api/users';

/**
 * Employee and department option lists for the owner, department and filter
 * selects.
 *
 * Both fail soft to an empty list. GET /departments excludes EMPLOYEE, so an
 * employee holding VENDOR_VIEWER gets a 403 there while the rest of the screen
 * is legitimately theirs to see. An empty select beats a blank page.
 */
export function useDepartmentOptions(): Department[] {
  const { data } = useQuery({
    queryKey: ['departments'],
    queryFn: () => usersApi.getDepartments().catch((): Department[] => []),
    staleTime: 5 * 60 * 1000,
  });
  return data ?? [];
}

export function useUserOptions(): User[] {
  const { data } = useQuery({
    queryKey: ['users', 'options'],
    queryFn: () =>
      usersApi.getUsers().catch((): User[] => []),
    staleTime: 5 * 60 * 1000,
  });
  return data ?? [];
}
