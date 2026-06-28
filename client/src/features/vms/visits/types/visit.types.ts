export interface CreateVisitRequest {
  visitorId: string;
  hostEmployeeId: string;
  purpose: string;
  meetingDetails?: string;
  scheduledAt?: string;
}

export interface CheckInRequest {
  visitId: string;
  photoUrl?: string; 
}

export interface Visit {
  id: string;
  visitorId: string;
  hostEmployeeId: string;
  purpose: string;
  status: string;
  checkInTime?: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  department: string;
}
