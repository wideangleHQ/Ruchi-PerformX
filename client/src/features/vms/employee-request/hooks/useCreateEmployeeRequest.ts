import { useMutation } from '@tanstack/react-query';
import { createEmployeeVisitorRequest } from '../api/employee-request.api';
import { VisitorRequestPayload, VisitorRequestResponse } from '../types/employee-request.types';

export const useCreateEmployeeRequest = () => {
  return useMutation<VisitorRequestResponse, Error, VisitorRequestPayload>({
    mutationFn: createEmployeeVisitorRequest,
  });
};
