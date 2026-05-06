/**
 * Factory Inspector Modal — Supabase backend
 * Shows factory terrains with available build slots.
 */
'use client';

import React, { useState, useEffect } from 'react';

interface FactoryData {
  id: string;
  x: number;
  y: number;
  owner: string | null;
  defense: number;
  slots: number;
  used_slots: number;
  level: number;
  production_rate: number;
}

interface FactoryInspectorModalProps { onClose: () => void; }

export default function FactoryInspectorModal({ onClose }: FactoryInspectorModalProps) {
  const [factories, setFactories] = useState<FactoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchOwner, setSearchOwner] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/factories');
        const data = await res.json();
        setFactories(data.factories || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = factories.filter(f =>
    !searchOwner || (f.owner || '').toLowerCase().includes(searchOwner.toLowerCase())
  );
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  if (loading) return <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"><p className="text-white">Loading...</p></div>;
  if (error) return <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"><div className="bg-gray-900 border border-red-500 rounded-lg p-8"><p className="text-red-400">{error}</p><button onClick={onClose} className="mt-4 px-4 py-2 bg-red-600 text-white rounded">Close</button></div></div>;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-purple-500 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-purple-500">
          <div>
            <h2 className="text-2xl font-bold text-purple-400">🏭 Factory Inspector</h2>
            <p className="text-gray-400 text-sm mt-1">{filtered.length} factories</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>

        <div className="p-4 border-b border-gray-700 bg-gray-800/50 flex gap-4">
          <input type="text" value={searchOwner} onChange={e => { setSearchOwner(e.target.value); setCurrentPage(1); }} placeholder="Filter by owner..." className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm w-64" />
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 uppercase text-xs">Location</th>
                <th className="px-4 py-3 text-left text-gray-400 uppercase text-xs">Owner</th>
                <th className="px-4 py-3 text-left text-gray-400 uppercase text-xs">Level</th>
                <th className="px-4 py-3 text-left text-gray-400 uppercase text-xs">Defense</th>
                <th className="px-4 py-3 text-left text-gray-400 uppercase text-xs">Slots Used</th>
                <th className="px-4 py-3 text-left text-gray-400 uppercase text-xs">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {paginated.map(f => (
                <tr key={f.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-white font-mono">({f.x}, {f.y})</td>
                  <td className="px-4 py-3 text-cyan-400">{f.owner || '—'}</td>
                  <td className="px-4 py-3 text-yellow-400">{f.level}</td>
                  <td className="px-4 py-3 text-red-400">{f.defense.toLocaleString()}</td>
                  <td className="px-4 py-3 text-white">{f.used_slots} / {f.slots}</td>
                  <td className="px-4 py-3 text-green-400">{Math.max(0, f.slots - f.used_slots)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-700 flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setCurrentPage(i + 1)} className={`px-3 py-1 rounded text-sm ${currentPage === i + 1 ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>{i + 1}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
