// dashboard/src/pages/DlqPage.jsx
import React, { useEffect, useState } from 'react';
import API from '../api/client';

export default function DlqPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchDLQ = async () => {
    setLoading(true);
    try {
      const res = await API.get('/dlq');
      setJobs(res.data);
    } catch (err) {
      console.error(err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDLQ();
  }, []);

  const handleRetry = async (id) => {
    if (!confirm('Retry this job (will set to pending)?')) return;
    await API.post(`/dlq/retry/${id}`);
    fetchDLQ();
  };

  return (
    <div className="bg-white shadow rounded p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Dead Letter Queue</h2>
        <button onClick={fetchDLQ} className="px-3 py-1 bg-slate-600 text-white rounded">Refresh</button>
      </div>

      {loading ? <div>Loading…</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500">
              <tr>
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Command</th>
                <th className="px-2 py-2">Attempts</th>
                <th className="px-2 py-2">Last error</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id} className="border-t">
                  <td className="px-2 py-2 max-w-xs truncate">{j.id}</td>
                  <td className="px-2 py-2 max-w-lg truncate">{j.command}</td>
                  <td className="px-2 py-2">{j.attempts}</td>
                  <td className="px-2 py-2 max-w-sm truncate">{j.last_error || ''}</td>
                  <td className="px-2 py-2">
                    <button onClick={() => handleRetry(j.id)} className="px-2 py-1 bg-green-600 text-white rounded text-xs">Retry</button>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr><td colSpan="5" className="p-4 text-center text-gray-500">No dead jobs</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
