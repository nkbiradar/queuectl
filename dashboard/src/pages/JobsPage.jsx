// dashboard/src/pages/JobsPage.jsx
import React, { useEffect, useState } from 'react';
import API from '../api/client';

function JobsTable({ stateFilter }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  // normalize state to lowercase before sending to API
  const fetchJobs = async (state) => {
    setLoading(true);
    try {
      const params = state ? { state: String(state).toLowerCase() } : {};
      const res = await API.get('/jobs', { params });
      console.log('API /jobs response:', res.data); // debug log
      setJobs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs(stateFilter);
  }, [stateFilter]);

  const handleDelete = async (id) => {
    if (!confirm('Delete job? This is permanent.')) return;
    await API.delete(`/jobs/${id}`);
    fetchJobs(stateFilter);
  };

  return (
    <div className="bg-white shadow rounded p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Jobs {stateFilter ? `— ${stateFilter}` : ''}</h2>
        <button onClick={() => fetchJobs(stateFilter)} className="px-3 py-1 bg-slate-600 text-white rounded">Refresh</button>
      </div>

      {loading ? <div>Loading…</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500">
              <tr>
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Command</th>
                <th className="px-2 py-2">State</th>
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
                  <td className="px-2 py-2">{j.state}</td>
                  <td className="px-2 py-2">{j.attempts}</td>
                  <td className="px-2 py-2 max-w-sm truncate">{j.last_error || ''}</td>
                  <td className="px-2 py-2">
                    <button onClick={() => handleDelete(j.id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr><td colSpan="6" className="p-4 text-center text-gray-500">No jobs</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function JobsPage() {
  const [filter, setFilter] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select value={filter} onChange={e => setFilter(e.target.value)} className="p-2 border rounded">
          <option value=''>All</option>
          <option value='pending'>Pending</option>
          <option value='processing'>Processing</option>
          <option value='completed'>Completed</option>
          <option value='dead'>Dead</option>
        </select>
        <button onClick={() => setFilter('pending')} className="px-3 py-1 bg-slate-600 text-white rounded">Show Pending</button>
      </div>

      <JobsTable stateFilter={filter} />
    </div>
  );
}
