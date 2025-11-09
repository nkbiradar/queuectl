import { useEffect, useState } from 'react';
import axios from 'axios';

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [stateFilter, setStateFilter] = useState('all');

  const fetchJobs = async () => {
    try {
      const url =
        stateFilter === 'all'
          ? 'http://localhost:3000/api/jobs'
          : `http://localhost:3000/api/jobs?state=${stateFilter}`;
      const res = await axios.get(url);
      setJobs(res.data);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [stateFilter]);

  const handleDelete = async (id) => {
    await axios.delete(`http://localhost:3000/api/jobs/${id}`);
    fetchJobs();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-400">QueueCTL Dashboard</h1>

      <div className="flex items-center gap-4 mb-6">
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
        >
          <option value="all">All Jobs</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="dead">Dead</option>
        </select>
        <button
          onClick={fetchJobs}
          className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded text-sm"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto bg-gray-800 rounded-lg shadow">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-700 text-gray-300">
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Command</th>
              <th className="p-3 text-left">State</th>
              <th className="p-3 text-left">Attempts</th>
              <th className="p-3 text-left">Last Error</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length > 0 ? (
              jobs.map((job) => (
                <tr
                  key={job.id}
                  className="border-b border-gray-700 hover:bg-gray-700 transition"
                >
                  <td className="p-3 font-mono text-xs">{job.id}</td>
                  <td className="p-3">{job.command}</td>
                  <td
                    className={`p-3 capitalize ${
                      job.state === 'completed'
                        ? 'text-green-400'
                        : job.state === 'dead'
                        ? 'text-red-400'
                        : 'text-yellow-400'
                    }`}
                  >
                    {job.state}
                  </td>
                  <td className="p-3">{job.attempts}</td>
                  <td className="p-3 text-gray-400 truncate max-w-[200px]">
                    {job.last_error || '-'}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="p-4 text-center text-gray-400">
                  No jobs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
