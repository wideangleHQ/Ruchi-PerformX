'use client';

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
      <p className="mt-2 text-gray-600">Manage your account settings</p>

      <div className="mt-8 space-y-6">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">Preferences</h2>
          <p className="mt-2 text-gray-600">Notification and display preferences - Coming soon</p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">Security</h2>
          <p className="mt-2 text-gray-600">Change password and security settings - Coming soon</p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
          <p className="mt-2 text-gray-600">Third-party integrations - Coming soon</p>
        </div>
      </div>
    </div>
  );
}
