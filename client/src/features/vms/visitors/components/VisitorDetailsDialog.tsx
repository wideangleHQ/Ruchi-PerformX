import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useVisitor } from '../hooks/useVisitor';
import { useVisitorHistory } from '../hooks/useVisitorHistory';
import { format, differenceInMinutes, differenceInHours } from 'date-fns';
import { User, Briefcase, Phone, Mail, Building, MapPin, Loader2, Calendar, FileText, CheckCircle2, AlertCircle, Clock, Camera } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CameraDialog } from '../../camera/components/CameraDialog';
import { updateVisitorPhoto } from '../api/visitor-image.api';
import { useQueryClient } from '@tanstack/react-query';

interface VisitorDetailsDialogProps {
  visitorId: string | null;
  onClose: () => void;
}

export function VisitorDetailsDialog({ visitorId, onClose }: VisitorDetailsDialogProps) {
  const { data: visitor, isLoading, isError } = useVisitor(visitorId);
  const { data: history, isLoading: isHistoryLoading } = useVisitorHistory(visitorId);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">Active</Badge>;
      case 'blacklisted':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">Blacklisted</Badge>;
      case 'archived':
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-0">Archived</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-0">{status}</Badge>;
    }
  };

  const handleUpdatePhoto = async (file: File) => {
    if (!visitorId) return;
    setIsUploading(true);
    try {
      await updateVisitorPhoto(visitorId, file);
      queryClient.invalidateQueries({ queryKey: ['visitor', visitorId] });
      queryClient.invalidateQueries({ queryKey: ['vms', 'visitors'] });
    } catch (err) {
      console.error('Failed to update photo', err);
    } finally {
      setIsUploading(false);
      setCameraOpen(false);
    }
  };

  const profileImage = visitor?.profileImage;

  return (
    <>
      <Dialog open={!!visitorId} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl font-poppins">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Visitor Details</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isError || !visitor ? (
            <div className="flex h-64 flex-col items-center justify-center text-gray-500">
              <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
              <p>Failed to load visitor details.</p>
            </div>
          ) : (
            <div className="mt-4">
              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="history">Visit History</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-6 mt-4">
                  {/* Header Section */}
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-full bg-gray-100 border border-gray-200">
                        {profileImage ? (
                          <img src={profileImage} alt={visitor.fullName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <User className="h-10 w-10 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-7" 
                        onClick={() => setCameraOpen(true)}
                        disabled={isUploading}
                      >
                        <Camera className="h-3 w-3 mr-1" />
                        {profileImage ? 'Update Photo' : 'Add Photo'}
                      </Button>
                    </div>
                    <div className="flex-1 mt-2">
                      <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-gray-900">{visitor.fullName}</h2>
                        {getStatusBadge(visitor.status)}
                      </div>
                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {visitor.firstName} {visitor.lastName}
                      </p>
                      {visitor.companyName && (
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          {visitor.companyName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 border border-gray-100">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{visitor.mobileNumber}</p>
                          <p className="text-xs text-gray-500">Primary Mobile</p>
                        </div>
                      </div>

                      {visitor.email && (
                        <div className="flex items-start gap-3">
                          <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{visitor.email}</p>
                            <p className="text-xs text-gray-500">Email Address</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {visitor.address && (
                        <div className="flex items-start gap-3">
                          <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{visitor.address}</p>
                            <p className="text-xs text-gray-500">Address</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <CheckCircle2 className={`h-5 w-5 mt-0.5 ${visitor.faceRecognitionConsent ? 'text-green-500' : 'text-gray-400'}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {visitor.faceRecognitionConsent ? 'Granted' : 'Not Granted'}
                          </p>
                          <p className="text-xs text-gray-500">Face Recognition Consent</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes Section */}
                  {visitor.notes && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-2">Notes</h3>
                      <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 border border-gray-100">
                        {visitor.notes}
                      </div>
                    </div>
                  )}

                  {/* Metadata Footer */}
                  <div className="grid grid-cols-2 gap-4 border-t pt-4 text-xs text-gray-500">
                    <div>
                      <p>Created: {visitor.createdAt ? format(new Date(visitor.createdAt), 'PPpp') : 'N/A'}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  {isHistoryLoading ? (
                    <div className="flex h-48 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    </div>
                  ) : !history || history.length === 0 ? (
                    <div className="flex h-48 flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                      <Calendar className="h-8 w-8 text-gray-400 mb-2" />
                      <p>No previous visits found.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                      {history.map((visit) => {
                        let durationDisplay = 'N/A';
                        if (!visit.checkInTime) {
                          durationDisplay = 'Scheduled';
                        } else if (!visit.checkOutTime) {
                          durationDisplay = 'Inside';
                        } else {
                          const mins = differenceInMinutes(new Date(visit.checkOutTime), new Date(visit.checkInTime));
                          const hours = Math.floor(mins / 60);
                          const remainingMins = mins % 60;
                          durationDisplay = hours > 0 ? `${hours}h ${remainingMins}m` : `${remainingMins}m`;
                        }

                        return (
                          <div key={visit.id} className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900">
                                    {format(new Date(visit.createdAt), 'MMM d, yyyy')}
                                  </span>
                                  {getStatusBadge(visit.status)}
                                </div>
                                <p className="text-xs text-gray-500 mt-1 font-mono">{visit.visitCode}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-700 flex items-center justify-end gap-1">
                                  <Clock className="h-3 w-3" />
                                  {durationDisplay}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-y-3 text-sm mt-4 bg-gray-50 p-3 rounded-lg">
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Host Employee</p>
                                <p className="font-medium text-gray-900">{visit.hostEmployeeName}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Purpose</p>
                                <p className="font-medium text-gray-900 truncate" title={visit.purpose}>{visit.purpose}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Check In</p>
                                <p className="font-medium text-gray-900">
                                  {visit.checkInTime ? format(new Date(visit.checkInTime), 'h:mm a') : '-'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Check Out</p>
                                <p className="font-medium text-gray-900">
                                  {visit.checkOutTime ? format(new Date(visit.checkOutTime), 'h:mm a') : '-'}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CameraDialog 
        open={cameraOpen} 
        onOpenChange={setCameraOpen} 
        onConfirm={handleUpdatePhoto} 
      />
    </>
  );
}
