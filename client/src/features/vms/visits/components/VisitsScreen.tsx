import { QuickEntryCard } from './QuickEntryCard';

export function VisitsScreen() {
  return (
    <div className="flex flex-col gap-6 font-poppins">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Visits & Check-In</h2>
        <p className="text-sm text-gray-500 mt-1">Create new visits and check in existing visitors</p>
      </div>

      <div className="mt-4">
        <QuickEntryCard />
      </div>
    </div>
  );
}
