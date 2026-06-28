interface PurposeFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function PurposeField({ value, onChange, error }: PurposeFieldProps) {
  return (
    <div className="space-y-2 font-poppins">
      <label className="text-sm font-medium text-gray-700">Purpose of Visit *</label>
      <input 
        type="text"
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder="e.g. Interview, Vendor Meeting"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
