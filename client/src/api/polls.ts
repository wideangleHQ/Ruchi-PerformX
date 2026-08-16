import axiosClient from './client';

export interface PollOptionResult {
  id: string;
  label: string;
  votes: number;
  percent: number;
}

export interface Poll {
  id: string;
  question: string;
  createdBy: { id: string; fullName: string };
  createdAt: string;
  closesAt: string;
  isClosed: boolean;
  /** Computed server side from closesAt and isClosed. Do not derive it again here. */
  isOpen: boolean;
  totalVotes: number;
  /** The caller's own choice, so the card paints results on first render. */
  myVoteOptionId: string | null;
  options: PollOptionResult[];
}

export interface CreatePollPayload {
  question: string;
  options: string[];
  closesAt: string;
}

export const pollsApi = {
  getActivePolls: async (): Promise<Poll[]> => {
    const response = await axiosClient.get<Poll[]>('/polls/active');
    return response.data;
  },

  getPolls: async (): Promise<Poll[]> => {
    const response = await axiosClient.get<Poll[]>('/polls');
    return response.data;
  },

  getPoll: async (id: string): Promise<Poll> => {
    const response = await axiosClient.get<Poll>(`/polls/${id}`);
    return response.data;
  },

  createPoll: async (payload: CreatePollPayload): Promise<Poll> => {
    const response = await axiosClient.post<Poll>('/polls', payload);
    return response.data;
  },

  vote: async (id: string, optionId: string): Promise<Poll> => {
    const response = await axiosClient.post<Poll>(`/polls/${id}/vote`, { optionId });
    return response.data;
  },

  closePoll: async (id: string): Promise<Poll> => {
    const response = await axiosClient.patch<Poll>(`/polls/${id}/close`, {});
    return response.data;
  },

  deletePoll: async (id: string): Promise<{ id: string }> => {
    const response = await axiosClient.delete<{ id: string }>(`/polls/${id}`);
    return response.data;
  },
};
