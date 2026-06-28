import { useQuery } from '@tanstack/react-query';
import { getVisitorPhoto } from '../api/visitor-image.api';

export function useVisitorPhoto(visitorId?: string | null) {
  return useQuery({
    queryKey: ['vms', 'visitors', visitorId, 'photo'],
    queryFn: async () => {
      if (!visitorId) return null;
      return await getVisitorPhoto(visitorId);
    },
    enabled: !!visitorId,
  });
}
