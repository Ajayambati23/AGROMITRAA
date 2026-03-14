'use client';

import { useEffect, useMemo, useState } from 'react';
import { trainingAPI } from '@/lib/api';

const CATEGORIES = [
  'crop_recommendation',
  'harvesting_guidance',
  'pest_control',
  'irrigation',
  'fertilization',
  'weather',
  'market_price',
  'general',
];

const LANGUAGES = ['english', 'hindi', 'telugu', 'kannada', 'tamil', 'malayalam'];

export default function TrainingAdmin() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [testResults, setTestResults] = useState<any[]>([]);

  const [text, setText] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [queriesInput, setQueriesInput] = useState('What crop is best for black soil?\nHow to control stem borer in paddy?');

  const metrics = useMemo(() => {
    const trainingSamples = stats?.stats?.totalSamples ?? stats?.totalSamples ?? 0;
    const labels = stats?.stats?.categories ?? stats?.categories ?? {};
    const accuracy = performance?.performance?.accuracy ?? performance?.accuracy;
    const model = performance?.performance?.model ?? performance?.model ?? 'N/A';
    return { trainingSamples, labels, accuracy, model };
  }, [stats, performance]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsResp, perfResp] = await Promise.all([
        trainingAPI.getStats(),
        trainingAPI.getPerformance(),
      ]);
      setStats(statsResp);
      setPerformance(perfResp);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load training data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddTrainingData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setActionLoading(true);
    setError('');
    setNotice('');
    try {
      const resp = await trainingAPI.addData({
        text: text.trim(),
        category,
        language,
      });
      setNotice(resp?.message || 'Training sample added');
      setText('');
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to add training data');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestModel = async () => {
    const queries = queriesInput
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (queries.length === 0) return;

    setActionLoading(true);
    setError('');
    setNotice('');
    try {
      const resp = await trainingAPI.testModel(queries, language);
      setTestResults(resp?.results || []);
      setNotice('Model test completed');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to test model');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetrain = async () => {
    setActionLoading(true);
    setError('');
    setNotice('');
    try {
      const resp = await trainingAPI.retrain();
      setNotice(resp?.message || 'Model retraining started/completed');
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to retrain model');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-800">Admin Training</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadData}
            className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50"
            disabled={loading || actionLoading}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleRetrain}
            className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
            disabled={loading || actionLoading}
          >
            Retrain Model
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {notice && <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">{notice}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Samples</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{loading ? '--' : metrics.trainingSamples}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Accuracy</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">
            {loading ? '--' : metrics.accuracy != null ? `${Number(metrics.accuracy).toFixed(2)}%` : 'N/A'}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Model</p>
          <p className="text-lg font-semibold text-gray-800 mt-1 break-all">{loading ? '--' : metrics.model}</p>
        </div>
      </div>

      <div className="card card-padded">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Add Training Data</h2>
        <form onSubmit={handleAddTrainingData} className="space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter training sentence/query"
            className="w-full min-h-[110px] p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="p-3 rounded-xl border border-gray-300 bg-white"
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="p-3 rounded-xl border border-gray-300 bg-white"
            >
              {LANGUAGES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-black disabled:opacity-60"
            disabled={actionLoading}
          >
            Add Sample
          </button>
        </form>
      </div>

      <div className="card card-padded">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Test Model</h2>
        <textarea
          value={queriesInput}
          onChange={(e) => setQueriesInput(e.target.value)}
          className="w-full min-h-[120px] p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter one test query per line"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleTestModel}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            disabled={actionLoading}
          >
            Run Test
          </button>
        </div>
        {testResults.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200">
                  <th className="py-2 pr-3 font-semibold text-gray-700">Query</th>
                  <th className="py-2 pr-3 font-semibold text-gray-700">Prediction</th>
                  <th className="py-2 pr-3 font-semibold text-gray-700">Confidence</th>
                  <th className="py-2 pr-3 font-semibold text-gray-700">Model</th>
                </tr>
              </thead>
              <tbody>
                {testResults.map((item, idx) => (
                  <tr key={`${item.query}-${idx}`} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-3 text-gray-700">{item.query}</td>
                    <td className="py-2 pr-3 text-gray-700">{item.prediction || item.error || 'N/A'}</td>
                    <td className="py-2 pr-3 text-gray-700">
                      {item.confidence != null ? `${Number(item.confidence).toFixed(3)}` : 'N/A'}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">{item.model || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card card-padded">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Category Distribution</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.keys(metrics.labels || {}).length === 0 && (
            <p className="text-sm text-gray-500">No category stats available.</p>
          )}
          {Object.entries(metrics.labels || {}).map(([key, value]) => (
            <div key={key} className="p-3 rounded-xl border border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{key}</p>
              <p className="text-lg font-semibold text-gray-800 mt-1">{String(value)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
