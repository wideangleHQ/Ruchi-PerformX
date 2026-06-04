import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
      <div className="max-w-md text-center">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900">404</h1>
          <p className="mt-2 text-xl font-semibold text-gray-900">
            Page not found
          </p>
          <p className="mt-2 text-gray-600">
            The page you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/dashboard">
            <Button className="w-full bg-green-600 hover:bg-green-700 sm:w-auto">
              Go to Dashboard
            </Button>
          </Link>
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
