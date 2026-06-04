'use client';

import { useAuth } from '@/context/AuthContext';
import { useScores } from '@/hooks/useQueries';

export default function ScoringPage() {
  const { user } = useAuth();
  const { data: scoresData, isLoading } = useScores();

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">Scoring & Performance</h1>
      <p className="mt-2 text-gray-600">View performance metrics</p>

      {isLoading ? (
        <p className="mt-8">Loading scores...</p>
      ) : scoresData?.data && scoresData.data.length > 0 ? (
        <div className="mt-8">
          <div className="rounded-lg bg-white shadow">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                      Total Score
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                      Tasks Completed
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                      On-Time Tasks
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                      Quality Score
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {scoresData.data.map((score) => (
                    <tr key={score.userId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {score.user?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {score.totalScore}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {score.tasksCompleted}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {score.tasksOnTime}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {score.qualityScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-lg bg-gray-50 p-8 text-center">
          <p className="text-gray-600">No scoring data available</p>
        </div>
      )}
    </div>
  );
}
