import { Button } from '@/components/ui/button';
import { Camera, User } from 'lucide-react';
import { Visitor } from '../../visitors/types/visitor.types';

interface CheckInCardProps {
  onCheckIn: () => void;
  isPending: boolean;
  visitor?: Visitor;
}

export function CheckInCard({ onCheckIn, isPending, visitor }: CheckInCardProps) {
  const profileImage = visitor?.profileImage;

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm flex flex-col gap-4 font-poppins">
      <h3 className="font-semibold text-gray-900">Visitor Profile Photo</h3>
      
      <div className="h-48 rounded-lg bg-gray-50 border-2 border-dashed flex flex-col items-center justify-center text-gray-400 gap-2 overflow-hidden">
        {profileImage ? (
          <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <>
            <User className="h-8 w-8 text-orange-400" />
            <span className="text-sm text-orange-600 text-center px-4">Profile photo not available. <br /> Please update Profile Photo.</span>
          </>
        )}
      </div>

      <Button 
        onClick={onCheckIn} 
        disabled={isPending}
        className="w-full bg-green-600 text-white hover:bg-green-700 mt-4 h-12 text-base font-semibold"
      >
        {isPending ? 'Checking In...' : 'Confirm Check-In'}
      </Button>
    </div>
  );
}
