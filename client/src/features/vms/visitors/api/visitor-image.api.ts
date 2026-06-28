import axiosClient from '@/api/client';

export const uploadVisitorPhoto = async (visitorId: string, file: File): Promise<{ success: boolean, imageUrl: string, visitorImageId: string }> => {
  const formData = new FormData();
  formData.append('photo', file);

  const { data } = await axiosClient.post(`/vms/visitors/${visitorId}/photo`, formData);
  return data;
};

export const updateVisitorPhoto = async (visitorId: string, file: File): Promise<any> => {
  const formData = new FormData();
  formData.append('photo', file);

  const { data } = await axiosClient.put(`/vms/visitors/${visitorId}/photo`, formData);
  return data;
};

export const getVisitorPhoto = async (visitorId: string): Promise<{ success: boolean, imageUrl: string | null, visitorImageId?: string }> => {
  const { data } = await axiosClient.get(`/vms/visitors/${visitorId}/photo`);
  return data;
};
