import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Save, Users, Sparkles } from 'lucide-react';
import { getKelompokOptions } from '../../utils/schoolConfig';

export default function ModalFormSiswa({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  loading = false,
  schoolData = null,
  currentUser = null
}) {
  const [formData, setFormData] = useState({
    nisn: '',
    nama_lengkap: '',
    nama_panggilan: '',
    kelompok: '',
    jenis_kelamin: 'L',
    tanggal_lahir: '',
    nama_orang_tua: '',
    kontak_orang_tua: '',
    alamat: '',
    catatan_khusus: '',
    status: 'aktif'
  });

  const [formError, setFormError] = useState('');

  const daftarKelompok = getKelompokOptions(schoolData).filter(k => k !== 'Semua');

  useEffect(() => {
    if (initialData) {
      setFormData({
        nisn: initialData.nisn || '',
        nama_lengkap: initialData.nama_lengkap || '',
        nama_panggilan: initialData.nama_panggilan || '',
        kelompok: initialData.kelompok || daftarKelompok[0] || 'TK A',
        jenis_kelamin: initialData.jenis_kelamin || 'L',
        tanggal_lahir: initialData.tanggal_lahir || '',
        nama_orang_tua: initialData.nama_orang_tua || '',
        kontak_orang_tua: initialData.kontak_orang_tua || '',
        alamat: initialData.alamat || '',
        catatan_khusus: initialData.catatan_khusus || '',
        status: initialData.status || 'aktif'
      });
    } else {
      // Default: kelompok sesuai kelas guru yang login jika ada
      const defaultKelompok = (currentUser?.kelompok_kelas && currentUser.kelompok_kelas !== 'Semua')
        ? currentUser.kelompok_kelas
        : (daftarKelompok[0] || 'TK A');

      setFormData({
        nisn: '',
        nama_lengkap: '',
        nama_panggilan: '',
        kelompok: defaultKelompok,
        jenis_kelamin: 'L',
        tanggal_lahir: '',
        nama_orang_tua: '',
        kontak_orang_tua: '',
        alamat: '',
        catatan_khusus: '',
        status: 'aktif'
      });
    }
    setFormError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nama_lengkap.trim()) {
      setFormError('Nama lengkap murid wajib diisi.');
      return;
    }
    if (!formData.nama_panggilan.trim()) {
      setFormError('Nama panggilan murid wajib diisi.');
      return;
    }
    if (!formData.kelompok) {
      setFormError('Kelompok kelas wajib dipilih.');
      return;
    }

    setFormError('');
    onSubmit(formData);
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-orange-100 flex items-center justify-between bg-gradient-to-r from-orange-50/50 to-amber-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-xs">
              <UserPlus className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 font-brand">
                {initialData ? 'Ubah Data Murid' : 'Tambah Murid Baru'}
              </h3>
              <p className="text-xs text-slate-500">
                {initialData ? `Perbarui profil ${initialData.nama_panggilan || 'murid'}` : 'Entri dinamis murid kelompok kelas'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white/80 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl">
              {formError}
            </div>
          )}

          {/* Nama Lengkap & Panggilan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Nama Lengkap Murid <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.nama_lengkap}
                onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                placeholder="Contoh: Muhammad Azzam Alfatih"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Panggilan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.nama_panggilan}
                onChange={(e) => setFormData({ ...formData, nama_panggilan: e.target.value })}
                placeholder="Contoh: Azzam"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Kelompok & Jenis Kelamin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Kelompok Kelas <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.kelompok}
                onChange={(e) => setFormData({ ...formData, kelompok: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-orange-400 focus:outline-none"
              >
                {daftarKelompok.map((klp) => (
                  <option key={klp} value={klp}>{klp}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Jenis Kelamin <span className="text-rose-500">*</span>
              </label>
              <div className="flex space-x-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, jenis_kelamin: 'L' })}
                  className={`flex-1 py-2 rounded-2xl text-xs font-bold border transition ${
                    formData.jenis_kelamin === 'L'
                      ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  👦 Laki-laki
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, jenis_kelamin: 'P' })}
                  className={`flex-1 py-2 rounded-2xl text-xs font-bold border transition ${
                    formData.jenis_kelamin === 'P'
                      ? 'bg-pink-50 border-pink-300 text-pink-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  👧 Perempuan
                </button>
              </div>
            </div>
          </div>

          {/* Tanggal Lahir & NISN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Tanggal Lahir
              </label>
              <input
                type="date"
                value={formData.tanggal_lahir}
                onChange={(e) => setFormData({ ...formData, tanggal_lahir: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                NISN (Opsional)
              </label>
              <input
                type="text"
                value={formData.nisn}
                onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                placeholder="Nomor Induk Siswa Nasional"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Nama Orang Tua & Kontak WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Nama Orang Tua / Wali
              </label>
              <input
                type="text"
                value={formData.nama_orang_tua}
                onChange={(e) => setFormData({ ...formData, nama_orang_tua: e.target.value })}
                placeholder="Ibu Rina / Bpk. Hendra"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                No. WhatsApp Wali Murid
              </label>
              <input
                type="tel"
                value={formData.kontak_orang_tua}
                onChange={(e) => setFormData({ ...formData, kontak_orang_tua: e.target.value })}
                placeholder="Contoh: 081234567890"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Alamat Rumah */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              Alamat Tempat Tinggal
            </label>
            <input
              type="text"
              value={formData.alamat}
              onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
              placeholder="Jl. Melati No. 12, RT 02 / RW 03"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-400 focus:outline-none"
            />
          </div>

          {/* Catatan Khusus / Alergi */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Catatan Khusus / Alergi Anak</span>
              <span className="text-[10px] text-slate-400 font-normal">Penting untuk guru pendamping</span>
            </label>
            <textarea
              rows={2}
              value={formData.catatan_khusus}
              onChange={(e) => setFormData({ ...formData, catatan_khusus: e.target.value })}
              placeholder="Contoh: Alergi udang, mudah mimisan bila terpapar terik matahari, atau belum bisa tali sepatu sendiri."
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-400 focus:outline-none resize-none"
            />
          </div>

          {/* Status Murid (Jika Mengedit) */}
          {initialData && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Status Keaktifan Murid
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-orange-400 focus:outline-none"
              >
                <option value="aktif">🟢 Aktif Mengikuti KBM</option>
                <option value="lulus">🎓 Lulus / Melanjutkan ke SD</option>
                <option value="mutasi">🚚 Pindah Sekolah / Mutasi</option>
              </select>
            </div>
          )}

          {/* Tombol Simpan & Batal */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition flex items-center space-x-1.5"
            >
              {loading ? (
                <span>Menyimpan...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{initialData ? 'Simpan Perubahan' : 'Tambahkan Murid'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
