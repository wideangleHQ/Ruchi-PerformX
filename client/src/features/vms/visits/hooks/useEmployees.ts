import { useQuery } from '@tanstack/react-query';
import { getEmployees } from '../api/visit.api';

export interface Employee {
  id: string;
  fullName: string;
  department?: string;
  role: string;
  employeeCode: string;
  email?: string;
}

export const useEmployees = () => {
  return useQuery<Employee[], Error>({
    queryKey: ['employees'],
    queryFn: async () => {
      const data = await getEmployees();
      console.log("Fetched Users:", data);
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};
