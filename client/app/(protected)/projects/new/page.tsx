'use client';

import Link from 'next/link';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { ArrowLeft } from 'lucide-react';

export default function NewProjectPage() {
  return (
    <div>
      <div className="mb-8">
        <Link
          href="/projects"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back to Projects
        </Link>

        <h1 className="text-3xl font-bold text-gray-900">Create New Project</h1>
        <p className="mt-2 text-gray-600">
          Name it, say what it is for and when it is due. Everything else can wait for the project page.
        </p>
      </div>

      <div className="max-w-3xl">
        <ProjectForm />
      </div>
    </div>
  );
}
