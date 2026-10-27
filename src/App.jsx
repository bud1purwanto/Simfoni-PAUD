import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-2xl">
          🎶
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">SIMFONI PAUD</h1>
        <p className="text-sm text-slate-500 mb-4">Sistem Informasi Monitoring & Pelaporan Terintegrasi PAUD</p>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          Fase 1: Setup Lingkungan Berhasil
        </span>
      </div>
    </div>
  );
}

