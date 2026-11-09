import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  HardDrive, 
  AlertTriangle, 
  Plus, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  School, 
  Sparkles,
  ExternalLink,
  ChevronRight,
  Database,
  Search,
  Activity,
  Layers,
  GraduationCap,
  Calendar,
  CheckSquare,
  TrendingUp,
  Filter,
  RefreshCw,
  Award,
  BookOpen,
  HeartPulse,
  MessageCircle,
  Radio,
  Flame,
  PhoneCall,
  AlertCircle,
  Wallet,
  Coins,
  Receipt,
  CircleDollarSign,
  TrendingDown
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatTanggalIndo, formatJamMenit, getLocalDateString } from '../../utils/formatters';
import { runAutoRetentionIfDue } from '../../utils/logRetention';
import { syncGuruCounters } from '../../utils/quotaSync';
import { getPlan, formatRupiah, formatKuota } from '../../utils/planConfig';
import { sisaHariLangganan, isLanggananKedaluwarsa } from '../../utils/schoolConfig';

export default function DashboardSuperadmin() {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [schools, setSchools] = useState([]);
  const [users, setUsers] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [plansDb, setPlansDb] = useState({});
  const [loading, setLoading] = useState(true);

  // Filter & Search State untuk Guru, Radar, & Finansial
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'finance' | 'radar' | 'guru' | 'logs'
  const [searchGuru, setSearchGuru] = useState('');
  const [filterSchoolId, setFilterSchoolId] = useState('all');
  const [filterStatusAkun, setFilterStatusAkun] = useState('all');
  const [searchRadar, setSearchRadar] = useState('');
  const [filterHealthCategory, setFilterHealthCategory] = useState('all'); // 'all' | 'kritis' | 'waspada' | 'prima'
  const [searchBilling, setSearchBilling] = useState('');

  const todayStr = getLocalDateString();

  useEffect(() => {
    setLoading(true);

    // 1. Ambil Semua Sekolah Mitra (Tenants)
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSchools(list);
    });

    // 2. Ambil Semua Pengguna Global (Kepsek & Guru)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers(list);
      setLoading(false);
    });

    // 3. Ambil Koleksi Plans (Paket Langganan)
    const unsubPlans = onSnapshot(collection(db, 'plans'), (snap) => {
      const pMap = {};
      snap.docs.forEach((d) => { pMap[d.id] = { id: d.id, ...d.data() }; });
      setPlansDb(pMap);
    }, (err) => console.warn('Gagal memuat plans:', err));

    // 4. Ambil 15 Audit Log Terbaru (Live Activity Stream)
    const qLogs = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(15));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setRecentLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.warn('Gagal memuat audit logs:', err));

    // 5. Ambil Rekapitulasi Presensi Hari Ini Lintas Tenant
    const qAttend = query(collection(db, 'attendance'), where('tanggal', '==', todayStr));
    const unsubAttend = onSnapshot(qAttend, (snap) => {
      setTodayAttendance(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.warn('Gagal memuat presensi hari ini:', err));

    return () => {
      unsubSchools();
      unsubUsers();
      unsubPlans();
      unsubLogs();
      unsubAttend();
    };
  }, [todayStr]);

  // Selaraskan counter kuota guru (dipakai Security Rules untuk menegakkan kuota)
  useEffect(() => {
    if (!loading && schools.length > 0) syncGuruCounters(schools, users);
  }, [loading, schools, users]);

  // Periodic Retention Job audit_logs (maks. sekali per sesi, hanya jika sudah > 24 jam)
  useEffect(() => {
    if (userData?.uid) runAutoRetentionIfDue(userData);
  }, [userData?.uid]);

  // Mock Data otomatis HANYA jika berada di route /dev/preview tanpa login Firebase
  const isPreview = typeof window !== 'undefined' && window.location.pathname.includes('/dev/preview');

  const effectiveSchools = useMemo(() => {
    if (schools.length > 0) return schools;
    if (isPreview) {
      return [
        {
          id: 'mock-school-1',
          nama_sekolah: 'TK Ngabar Mandiri',
          kota: 'Pasuruan',
          npsn: '20512345',
          paket_langganan: 'sahabat',
          status_langganan: 'aktif',
          berlaku_hingga: '2027-11-06',
          kuota_guru: 6,
          kuota_murid: 60,
          jumlah_murid_aktif: 0,
          telepon: '081234567890'
        },
        {
          id: 'mock-school-2',
          nama_sekolah: 'PAUD Tunas Harapan Bangsa',
          kota: 'Surabaya',
          npsn: '20598765',
          paket_langganan: 'mandiri',
          status_langganan: 'aktif',
          berlaku_hingga: '2027-12-31',
          kuota_guru: 12,
          kuota_murid: 0,
          jumlah_murid_aktif: 35,
          telepon: '085712345678'
        },
        {
          id: 'mock-school-3',
          nama_sekolah: 'TK Melati Indah',
          kota: 'Malang',
          npsn: '20534567',
          paket_langganan: 'rintisan',
          status_langganan: 'aktif',
          berlaku_hingga: '2026-11-14',
          kuota_guru: 3,
          kuota_murid: 25,
          jumlah_murid_aktif: 8,
          telepon: ''
        }
      ];
    }
    return schools;
  }, [schools, isPreview]);

  const effectiveUsers = useMemo(() => {
    if (users.length > 0) return users;
    if (isPreview) {
      return [
        { id: 'u1', nama: 'Bunda Hj. Siti Khadijah', role: 'kepsek', school_id: 'mock-school-1', status_akun: 'aktif' },
        { id: 'u2', nama: 'Ibu Fatimah Zahra, S.Pd', role: 'guru', school_id: 'mock-school-1', status_akun: 'aktif', kelompok_kelas: 'Kelompok A' },
        { id: 'u3', nama: 'Bunda Rina Marlina, M.Pd', role: 'kepsek', school_id: 'mock-school-2', status_akun: 'aktif' },
        { id: 'u4', nama: 'Ibu Dewi Sartika, S.Pd', role: 'guru', school_id: 'mock-school-2', status_akun: 'aktif', kelompok_kelas: 'Kelompok B' },
        { id: 'u5', nama: 'Ibu R.A. Kartini, S.Pd', role: 'guru', school_id: 'mock-school-2', status_akun: 'aktif', kelompok_kelas: 'Kelompok Bermain' },
        { id: 'u6', nama: 'Bunda Nurul Hidayah', role: 'kepsek', school_id: 'mock-school-3', status_akun: 'aktif' },
        { id: 'u7', nama: 'Ibu Aisyah Humaira, S.Pd', role: 'guru', school_id: 'mock-school-3', status_akun: 'aktif', kelompok_kelas: 'Kelompok A' },
      ];
    }
    return users;
  }, [users, isPreview]);

  const effectiveAttendance = useMemo(() => {
    if (todayAttendance.length > 0) return todayAttendance;
    if (isPreview) {
      return [
        { id: 'a1', school_id: 'mock-school-2', status: 'hadir', tanggal: todayStr },
        { id: 'a2', school_id: 'mock-school-2', status: 'hadir', tanggal: todayStr },
      ];
    }
    return todayAttendance;
  }, [todayAttendance, isPreview, todayStr]);

  // Metrik Agregat Utama
  const totalSchools = effectiveSchools.length;
  const activeSchools = effectiveSchools.filter((s) => s.status_langganan !== 'nonaktif' && !isLanggananKedaluwarsa(s)).length;
  const suspendedSchools = effectiveSchools.length - activeSchools;
  const totalKepsek = effectiveUsers.filter((u) => u.role === 'kepsek').length;
  const totalGuru = effectiveUsers.filter((u) => u.role === 'guru').length;
  const activeGuru = effectiveUsers.filter((u) => u.role === 'guru' && u.status_akun === 'aktif').length;

  // Agregat Murid Nasional
  const totalMuridNasional = effectiveSchools.reduce((acc, s) => acc + (s.jumlah_murid_aktif || 0), 0);

  // Estimasi Presensi Hari Ini
  const totalHadirHariIni = effectiveAttendance.filter((a) => a.status === 'hadir').length;
  const totalTerlambatHariIni = effectiveAttendance.filter((a) => a.status === 'hadir' && a.terlambat).length;

  // Estimasi Storage (Akumulasi dari field estimasi_storage_mb atau total_foto_terunggah * 0.25 MB)
  const totalStorageMb = effectiveSchools.reduce((acc, s) => {
    const mb = s.estimasi_storage_mb || (s.total_foto_terunggah ? s.total_foto_terunggah * 0.25 : 0);
    return acc + mb;
  }, 0);

  // Spark Plan 5GB = 5120 MB
  const maxStorageMb = 5120;
  const storagePercentage = Math.min(100, Math.round((totalStorageMb / maxStorageMb) * 100));

  // Distribusi Paket Langganan
  const planDistribution = useMemo(() => {
    const dist = {};
    effectiveSchools.forEach((s) => {
      const pId = s.paket_langganan || 'trial';
      const pName = getPlan(pId, plansDb).nama;
      dist[pName] = (dist[pName] || 0) + 1;
    });
    return dist;
  }, [effectiveSchools, plansDb]);

  // Deteksi Sekolah yang Masa Langganannya Berakhir dalam 30 Hari
  const expiringSchools = effectiveSchools
    .filter((s) => {
      const sisa = sisaHariLangganan(s);
      return sisa !== null && sisa <= 30;
    })
    .sort((a, b) => (a.berlaku_hingga || '').localeCompare(b.berlaku_hingga || ''));

  // Filter Data Guru se-Nasional
  const filteredGuruList = useMemo(() => {
    const q = searchGuru.toLowerCase().trim();
    return effectiveUsers.filter((u) => {
      if (u.role !== 'guru') return false;
      if (filterSchoolId !== 'all' && u.school_id !== filterSchoolId) return false;
      if (filterStatusAkun !== 'all' && u.status_akun !== filterStatusAkun) return false;
      if (q) {
        const matchNama = (u.nama || '').toLowerCase().includes(q);
        const matchEmail = (u.email || '').toLowerCase().includes(q);
        const matchSekolah = (u.nama_sekolah || '').toLowerCase().includes(q);
        const matchKelompok = (u.kelompok_kelas || '').toLowerCase().includes(q);
        return matchNama || matchEmail || matchSekolah || matchKelompok;
      }
      return true;
    });
  }, [effectiveUsers, searchGuru, filterSchoolId, filterStatusAkun]);

  // Kalkulasi Finansial SaaS: MRR, ARR, Billing Forecast & Revenue per Tier (Prioritas 2)
  const financialStats = useMemo(() => {
    let mrrTotal = 0;
    const tierStats = {}; // { planId: { name, price, count, totalMrr } }

    effectiveSchools.forEach((s) => {
      const isSuspended = s.status_langganan === 'nonaktif';
      const isExpired = isLanggananKedaluwarsa(s);
      const planInfo = getPlan(s.paket_langganan, plansDb);
      const price = Number(planInfo.harga_bulanan) || 0;

      if (!tierStats[planInfo.id]) {
        tierStats[planInfo.id] = {
          id: planInfo.id,
          nama: planInfo.nama,
          harga_bulanan: price,
          sekolahCount: 0,
          totalMrr: 0,
          color: planInfo.id === 'mandiri' ? 'text-purple-600 bg-purple-50 border-purple-200' :
                 planInfo.id === 'sahabat' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                 planInfo.id === 'rintisan' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                 'text-slate-600 bg-slate-50 border-slate-200'
        };
      }

      tierStats[planInfo.id].sekolahCount += 1;

      // Hanya hitung MRR jika sekolah aktif dan belum kedaluwarsa
      if (!isSuspended && !isExpired && price > 0) {
        mrrTotal += price;
        tierStats[planInfo.id].totalMrr += price;
      }
    });

    const arrTotal = mrrTotal * 12;
    const payingSchools = effectiveSchools.filter((s) => {
      const isSuspended = s.status_langganan === 'nonaktif';
      const isExpired = isLanggananKedaluwarsa(s);
      const planInfo = getPlan(s.paket_langganan, plansDb);
      return !isSuspended && !isExpired && (Number(planInfo.harga_bulanan) || 0) > 0;
    }).length;

    const arpu = payingSchools > 0 ? Math.round(mrrTotal / payingSchools) : 0; // Average Revenue Per User

    // Daftar Jadwal Invoice & Perpanjangan (Next Billing)
    const billingList = effectiveSchools
      .filter((s) => s.status_langganan !== 'nonaktif')
      .map((s) => {
        const sisa = sisaHariLangganan(s);
        const planInfo = getPlan(s.paket_langganan, plansDb);
        const price = Number(planInfo.harga_bulanan) || 0;
        const kepsekUser = effectiveUsers.find((u) => u.school_id === s.id && u.role === 'kepsek');
        const phoneRaw = s.telepon || (kepsekUser ? kepsekUser.telepon || kepsekUser.no_hp : '');

        let waBillingLink = null;
        if (phoneRaw && price > 0) {
          let clean = phoneRaw.replace(/\D/g, '');
          if (clean.startsWith('0')) clean = '62' + clean.slice(1);
          else if (clean.startsWith('8')) clean = '62' + clean;

          const kepsekGreeting = kepsekUser?.nama ? `Bunda/Bapak ${kepsekUser.nama}` : 'Bunda/Bapak Kepala Sekolah';
          const tglJatuhTempo = s.berlaku_hingga ? formatTanggalIndo(s.berlaku_hingga) : 'Segera';
          const msg = `Halo ${kepsekGreeting} (${s.nama_sekolah}),\n\nSalam hangat dari Billing SIMFONI PAUD. 🌸\nKami menginformasikan bahwa masa aktif ${planInfo.nama} sekolah Bunda/Bapak akan jatuh tempo pada ${tglJatuhTempo}.\n\nNominal Perpanjangan: ${formatRupiah(price)} / bulan\n\nApakah ingin kami proseskan tagihan resmi (invoice) dan perpanjangan otomatisnya? Silakan konfirmasi ya Bunda/Bapak. Terima kasih! 🙏✨`;
          waBillingLink = `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
        }

        return {
          school: s,
          kepsekUser,
          planInfo,
          price,
          sisaHari: sisa,
          isExpired: isLanggananKedaluwarsa(s),
          waBillingLink,
          phoneRaw
        };
      })
      .sort((a, b) => {
        if (a.sisaHari === null) return 1;
        if (b.sisaHari === null) return -1;
        return a.sisaHari - b.sisaHari;
      });

    return {
      mrrTotal,
      arrTotal,
      payingSchools,
      arpu,
      tierStats: Object.values(tierStats),
      billingList
    };
  }, [effectiveSchools, plansDb, effectiveUsers]);

  // Kalkulasi Skor Kesehatan Tenant & Anti-Churn Health Score (Prioritas 1)
  const tenantHealthList = useMemo(() => {
    return effectiveSchools.map((s) => {
      const activeTeachers = effectiveUsers.filter(
        (u) => u.school_id === s.id && u.role === 'guru' && u.status_akun === 'aktif'
      );
      const kepsekUser = effectiveUsers.find(
        (u) => u.school_id === s.id && u.role === 'kepsek'
      );
      const hadirHariIni = effectiveAttendance.filter(
        (a) => a.school_id === s.id && a.status === 'hadir'
      ).length;

      const totalActiveGuru = activeTeachers.length;
      let attendanceScore = 0;
      if (totalActiveGuru > 0) {
        attendanceScore = Math.round(Math.min(1, hadirHariIni / totalActiveGuru) * 35);
      }

      let guruScore = 0;
      if (totalActiveGuru >= 2) guruScore = 25;
      else if (totalActiveGuru === 1) guruScore = 15;

      const muridAktif = s.jumlah_murid_aktif || 0;
      let muridScore = 0;
      if (muridAktif >= 15) muridScore = 25;
      else if (muridAktif > 0) muridScore = Math.min(25, Math.round((muridAktif / 15) * 20));

      const isSuspended = s.status_langganan === 'nonaktif';
      const isExpired = isLanggananKedaluwarsa(s);
      const sisa = sisaHariLangganan(s);

      let langgananScore = 0;
      if (isSuspended || isExpired) {
        langgananScore = 0;
      } else if (sisa !== null && sisa <= 7) {
        langgananScore = 5;
      } else if (sisa !== null && sisa <= 14) {
        langgananScore = 10;
      } else {
        langgananScore = 15;
      }

      const totalScore = Math.min(100, attendanceScore + guruScore + muridScore + langgananScore);

      let category = 'prima'; // 'prima' | 'waspada' | 'kritis'
      if (totalScore < 50) category = 'kritis';
      else if (totalScore < 80) category = 'waspada';

      const issues = [];
      if (totalActiveGuru === 0) issues.push('Belum ada guru aktif terdaftar');
      if (muridAktif === 0) issues.push('Belum ada murid aktif diinput');
      if (totalActiveGuru > 0 && hadirHariIni === 0) issues.push('Belum ada presensi guru hadir hari ini');
      if (isExpired) issues.push('Masa langganan kedaluwarsa');
      else if (sisa !== null && sisa <= 7) issues.push(`Langganan berakhir dalam ${sisa} hari`);
      if (isSuspended) issues.push('Tenant sekolah dinonaktifkan');

      // Siapkan tautan WhatsApp Kepala Sekolah
      const phoneRaw = s.telepon || (kepsekUser ? kepsekUser.telepon || kepsekUser.no_hp : '');
      let waLink = null;
      let cleanPhone = null;
      if (phoneRaw) {
        cleanPhone = phoneRaw.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
        else if (cleanPhone.startsWith('8')) cleanPhone = '62' + cleanPhone;

        const issuesStr = issues.length > 0 
          ? issues.map((i) => `• ${i}`).join('\n')
          : '• Evaluasi kesiapan operasional harian';

        const kepsekGreeting = kepsekUser?.nama ? `Bunda/Bapak ${kepsekUser.nama}` : 'Bunda/Bapak Kepala Sekolah';
        const templateWa = `Halo ${kepsekGreeting} (${s.nama_sekolah}),\n\nSalam hangat dari Tim Eksekutif SIMFONI PAUD. 🌸\nKami sedang memantau kelancaran operasional portal sekolah Bunda/Bapak.\n\nCatatan pendampingan sistem:\n${issuesStr}\n\nApakah ada kendala teknis atau pengoperasian aplikasi yang bisa kami bantu fasilitasi? Kami siap mendampingi. Terima kasih banyak! 🙏✨`;
        
        waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(templateWa)}`;
      }

      return {
        school: s,
        kepsekUser,
        score: totalScore,
        category,
        attendanceScore,
        guruScore,
        muridScore,
        langgananScore,
        totalActiveGuru,
        hadirHariIni,
        muridAktif,
        issues,
        sisaHari: sisa,
        isSuspended,
        isExpired,
        waLink,
        phoneRaw,
        cleanPhone
      };
    });
  }, [schools, users, todayAttendance]);

  // Ringkasan Agregat Radar Keaktifan
  const healthSummary = useMemo(() => {
    const prima = tenantHealthList.filter((t) => t.category === 'prima').length;
    const waspada = tenantHealthList.filter((t) => t.category === 'waspada').length;
    const kritis = tenantHealthList.filter((t) => t.category === 'kritis').length;
    const avgScore = tenantHealthList.length > 0 
      ? Math.round(tenantHealthList.reduce((acc, t) => acc + t.score, 0) / tenantHealthList.length)
      : 0;
    return { prima, waspada, kritis, avgScore };
  }, [tenantHealthList]);

  // Filter List untuk Tab Radar Anti-Churn
  const filteredRadarList = useMemo(() => {
    const q = searchRadar.toLowerCase().trim();
    return tenantHealthList.filter((item) => {
      if (filterHealthCategory !== 'all' && item.category !== filterHealthCategory) return false;
      if (q) {
        const matchNama = (item.school.nama_sekolah || '').toLowerCase().includes(q);
        const matchKota = (item.school.kota || '').toLowerCase().includes(q);
        const matchNpsn = (item.school.npsn || '').toLowerCase().includes(q);
        const matchKepsek = (item.kepsekUser?.nama || '').toLowerCase().includes(q);
        return matchNama || matchKota || matchNpsn || matchKepsek;
      }
      return true;
    }).sort((a, b) => a.score - b.score); // Prioritaskan skor terendah (kritis) paling atas
  }, [tenantHealthList, searchRadar, filterHealthCategory]);

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header Banner Eksekutif Superadmin */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-lg shadow-orange-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold text-amber-100 mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Pusat Kendali Eksekutif SaaS Multi-Tenant (Overkill Mode)</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold font-brand tracking-tight">
              Selamat Datang, {userData?.nama || 'Superadmin'}! 👑
            </h1>
            <p className="text-amber-100 text-sm mt-1 max-w-2xl font-medium">
              Pantau seluruh aktivitas live platform, master data guru & murid nasional, rekapitulasi kehadiran serentak, serta utilisasi kuota cloud.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/superadmin/paket')}
              className="px-3.5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-extrabold text-xs rounded-2xl shadow-sm transition flex items-center space-x-1.5 font-brand"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Kelola Paket</span>
            </button>
            <button
              onClick={() => navigate('/superadmin/sekolah')}
              className="px-4 py-2.5 bg-white text-orange-600 hover:bg-orange-50 active:scale-95 font-extrabold text-xs rounded-2xl shadow-sm transition flex items-center space-x-2 font-brand"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Tambah Sekolah</span>
            </button>
          </div>
        </div>
      </div>

      {/* METRIK GLOBAL SAAS (6 KARTU STATISTIK EKSEKUTIF) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {/* Estimasi MRR Finansial SaaS (Prioritas 2) */}
        <div 
          onClick={() => setActiveTab('finance')}
          className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-3xl p-4 shadow-sm shadow-emerald-500/20 flex flex-col justify-between cursor-pointer hover:scale-[1.02] transition active:scale-95"
        >
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center font-bold mb-2">
            <Coins className="w-5 h-5 text-emerald-100" />
          </div>
          <div>
            <div className="text-xl md:text-2xl font-black text-white font-brand">
              {formatRupiah(financialStats.mrrTotal)}
            </div>
            <div className="text-[11px] text-emerald-100 font-bold flex items-center justify-between">
              <span>MRR Bulanan</span>
              <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-md">Buka →</span>
            </div>
          </div>
        </div>

        {/* Total Sekolah Mitra */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold mb-2">
            <School className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 font-brand">
              {totalSchools}
            </div>
            <div className="text-[11px] text-slate-500 font-bold">
              Sekolah ({activeSchools} Aktif)
            </div>
          </div>
        </div>

        {/* Total Guru Terdaftar */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-2">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 font-brand">
              {totalGuru}
            </div>
            <div className="text-[11px] text-slate-500 font-bold">
              Guru ({activeGuru} Aktif)
            </div>
          </div>
        </div>

        {/* Total Murid Aktif Se-Nasional */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold mb-2">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 font-brand">
              {totalMuridNasional}
            </div>
            <div className="text-[11px] text-slate-500 font-bold">
              Murid Aktif Terdaftar
            </div>
          </div>
        </div>

        {/* Presensi Guru Hari Ini */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold mb-2">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 font-brand">
              {totalHadirHariIni} <span className="text-xs font-semibold text-teal-600">({totalTerlambatHariIni} t/l)</span>
            </div>
            <div className="text-[11px] text-slate-500 font-bold">
              Absen Hadir Hari Ini
            </div>
          </div>
        </div>

        {/* Estimasi Storage Cloud */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-2">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 font-brand">
              {totalStorageMb.toFixed(1)} <span className="text-[10px] font-bold text-slate-400">MB</span>
            </div>
            <div className="text-[11px] text-slate-500 font-bold">
              Storage Spark ({storagePercentage}%)
            </div>
          </div>
        </div>
      </div>

      {/* STORAGE & SEBARAN PAKET SAAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Storage Bar (2 Kolom) */}
        <div className="md:col-span-2 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-orange-500" />
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Firebase Cloud Storage Tracker (Spark Limit 5.0 GB)
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {totalStorageMb.toFixed(1)} MB / 5,120 MB ({storagePercentage}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  storagePercentage > 85
                    ? 'bg-rose-500'
                    : storagePercentage > 60
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500'
                }`}
                style={{ width: `${Math.max(2, storagePercentage)}%` }}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>💡 Kompresi foto otomatis di HP guru menjamin kapasitas tampung s.d 15.000+ dokumentasi KBM.</span>
            <span className="font-bold text-slate-600">{activeSchools} Tenant Online</span>
          </div>
        </div>

        {/* Distribusi Paket Langganan (1 Kolom) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Distribusi Paket Tenant
            </h3>
          </div>
          <div className="space-y-2">
            {Object.keys(planDistribution).length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada data paket.</p>
            ) : (
              Object.entries(planDistribution).map(([pName, count]) => (
                <div key={pName} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">{pName}</span>
                  <span className="px-2.5 py-0.5 rounded-full font-extrabold bg-amber-50 text-amber-800 border border-amber-200/60 text-[11px]">
                    {count} Sekolah
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PERINGATAN LANGGANAN JATUH TEMPO */}
      {expiringSchools.length > 0 && (
        <div className="bg-amber-50 rounded-3xl p-5 border border-amber-200/80 shadow-xs">
          <div className="flex items-center space-x-2.5 text-amber-900 font-extrabold text-sm mb-3 font-brand">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Pemberitahuan Langganan Sekolah Mendekati Jatuh Tempo ({expiringSchools.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {expiringSchools.map((s) => (
              <div
                key={s.id}
                className="bg-white p-3.5 rounded-2xl border border-amber-200/60 shadow-xs flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-800 line-clamp-1">{s.nama_sekolah}</div>
                  <div className="text-[11px] text-amber-700 font-semibold mt-0.5">
                    Berakhir: {s.berlaku_hingga ? formatTanggalIndo(s.berlaku_hingga) : 'Segera'}
                  </div>
                </div>
                <button
                  onClick={() => navigate('/superadmin/sekolah')}
                  className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg transition text-[11px]"
                >
                  Kelola
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RADAR KEAKTIFAN & HEALTH SCORE BANNER (ANTI-CHURN TRACKER) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-5 text-white border border-slate-700/80 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0">
              <HeartPulse className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-white text-base font-brand tracking-tight">
                  Radar Keaktifan Tenant & Skor Anti-Churn
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  AI Retention
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5 font-medium">
                Deteksi otomatis sekolah pasif, pantau utilisasi guru/murid, dan hubungi Bunda Kepsek via WhatsApp.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700 rounded-2xl px-3 py-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="font-bold text-slate-300">{healthSummary.prima} Prima</span>
            </div>
            <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700 rounded-2xl px-3 py-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span className="font-bold text-slate-300">{healthSummary.waspada} Waspada</span>
            </div>
            <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700 rounded-2xl px-3 py-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping"></span>
              <span className="font-bold text-rose-300">{healthSummary.kritis} Butuh Pendampingan</span>
            </div>

            <button
              onClick={() => setActiveTab('radar')}
              className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs rounded-2xl shadow-sm transition flex items-center space-x-1.5 font-brand active:scale-95"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Buka Radar Lengkap</span>
            </button>
          </div>
        </div>
      </div>

      {/* TABS KONTROL EKSEKUTIF (OVERKILL NAVIGATION) */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-thin">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition flex items-center space-x-2 shrink-0 ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <School className="w-4 h-4" />
          <span>Tenant & Presensi Hari Ini</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('finance')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition flex items-center space-x-2 shrink-0 ${
            activeTab === 'finance'
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Coins className="w-4 h-4 text-emerald-500" />
          <span>Finansial & MRR SaaS ({formatRupiah(financialStats.mrrTotal)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('radar')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition flex items-center space-x-2 shrink-0 ${
            activeTab === 'radar'
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <HeartPulse className="w-4 h-4 text-rose-500" />
          <span>Radar Keaktifan ({healthSummary.kritis > 0 ? `${healthSummary.kritis} Butuh Pendampingan` : 'KBM Sehat'})</span>
          {healthSummary.kritis > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('guru')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition flex items-center space-x-2 shrink-0 ${
            activeTab === 'guru'
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Direktori Master Data Guru ({totalGuru})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition flex items-center space-x-2 shrink-0 ${
            activeTab === 'logs'
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Activity Feed ({recentLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW TENANT & REKAPITULASI PRESENSI */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* DAFTAR TENANT SEKOLAH MITRA AKTIF */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <School className="w-5 h-5 text-orange-500" />
                <h3 className="font-extrabold text-slate-800 text-base font-brand">
                  Daftar Sekolah Mitra Terdaftar ({schools.length})
                </h3>
              </div>
              <button
                onClick={() => navigate('/superadmin/sekolah')}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center space-x-1"
              >
                <span>Kelola Sekolah</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Nama Sekolah</th>
                    <th className="py-3 px-4">Kota</th>
                    <th className="py-3 px-4 text-center">Paket</th>
                    <th className="py-3 px-4 text-center">Kuota Guru</th>
                    <th className="py-3 px-4 text-center">Kuota Murid</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Health Score</th>
                    <th className="py-3 px-4 text-center">Masa Berlaku</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(loading && !isPreview) ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Memuat data sekolah mitra...
                      </td>
                    </tr>
                  ) : effectiveSchools.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Belum ada sekolah mitra terdaftar.
                      </td>
                    </tr>
                  ) : (
                    effectiveSchools.slice(0, 8).map((s) => {
                      const teachersInSchool = effectiveUsers.filter(
                        (u) => u.school_id === s.id && u.role === 'guru' && u.status_akun === 'aktif'
                      );
                      const isSuspended = s.status_langganan === 'nonaktif';
                      const planInfo = getPlan(s.paket_langganan, plansDb);
                      const health = tenantHealthList.find((t) => t.school.id === s.id);

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4 font-bold text-slate-800">
                            <div className="flex items-center space-x-2.5">
                              {s.logo_url ? (
                                <img
                                  src={s.logo_url}
                                  alt="Logo"
                                  className="w-7 h-7 rounded-lg object-contain border border-slate-200"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                                  {s.nama_sekolah?.charAt(0) || 'S'}
                                </div>
                              )}
                              <div>
                                <div>{s.nama_sekolah}</div>
                                <div className="text-[10px] text-slate-400 font-normal">
                                  NPSN: {s.npsn || '-'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {s.kota || '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200/60">
                              {planInfo.nama}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                            {teachersInSchool.length} / {s.kuota_guru || 5}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                            {s.jumlah_murid_aktif ?? 0} / {formatKuota(s.kuota_murid !== undefined ? s.kuota_murid : planInfo.kuota_murid)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                isSuspended
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isSuspended ? 'NONAKTIF' : 'AKTIF'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {health ? (
                              <button
                                onClick={() => {
                                  setSearchRadar(s.nama_sekolah);
                                  setActiveTab('radar');
                                }}
                                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border transition shadow-2xs ${
                                  health.category === 'prima'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : health.category === 'waspada'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 animate-pulse'
                                }`}
                                title={health.issues.join(', ') || 'KBM Berjalan Lancar'}
                              >
                                <HeartPulse className="w-3 h-3" />
                                <span>{health.score}% {health.category.toUpperCase()}</span>
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-600">
                            {s.berlaku_hingga ? formatTanggalIndo(s.berlaku_hingga) : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {health?.waLink && (
                                <a
                                  href={health.waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition border border-emerald-200 shadow-2xs"
                                  title="Hubungi WhatsApp Kepala Sekolah"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                onClick={() => navigate('/superadmin/sekolah')}
                                className="px-3 py-1 bg-slate-100 hover:bg-orange-100 hover:text-orange-700 font-bold rounded-xl transition text-[11px]"
                              >
                                Kelola
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FINANSIAL & MRR SAAS (PRIORITAS 2) */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          {/* 4 Kartu KPI Keuangan SaaS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Monthly Recurring Revenue */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-3xl p-5 shadow-sm shadow-emerald-500/20 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Monthly Recurring Revenue</span>
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                  <Coins className="w-5 h-5 text-emerald-100" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black font-brand text-white">
                  {formatRupiah(financialStats.mrrTotal)}
                </div>
                <div className="text-[11px] text-emerald-100 font-medium mt-1">
                  Omset rutin bulanan dari tenant aktif berbayar
                </div>
              </div>
            </div>

            {/* Annual Run Rate */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Annual Run Rate (ARR)</span>
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black font-brand text-slate-800">
                  {formatRupiah(financialStats.arrTotal)}
                </div>
                <div className="text-[11px] text-slate-400 font-medium mt-1">
                  Proyeksi pendapatan tahunan platform (MRR × 12)
                </div>
              </div>
            </div>

            {/* Paying Schools / Tenant Berbayar */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Tenant Berbayar</span>
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black font-brand text-slate-800">
                  {financialStats.payingSchools} <span className="text-sm font-semibold text-slate-400">/ {effectiveSchools.length} Sekolah</span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium mt-1">
                  {effectiveSchools.length - financialStats.payingSchools} Sekolah Uji Coba (Trial)
                </div>
              </div>
            </div>

            {/* ARPU (Average Revenue Per User/School) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Rata-Rata per Tenant (ARPU)</span>
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black font-brand text-slate-800">
                  {formatRupiah(financialStats.arpu)}
                </div>
                <div className="text-[11px] text-slate-400 font-medium mt-1">
                  Rata-rata kontribusi per sekolah mitra aktif
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Revenue per Tier & Tindakan Perpanjangan Invoice */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Kolom Kiri: Breakdown Omset per Tier Paket (1 Kolom) */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 md:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CircleDollarSign className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-slate-800 text-base font-brand">
                    Omset per Tier Paket
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  {financialStats.tierStats.length} Tier
                </span>
              </div>

              <div className="space-y-3 pt-2">
                {financialStats.tierStats.map((tier) => {
                  const sharePct = financialStats.mrrTotal > 0
                    ? Math.round((tier.totalMrr / financialStats.mrrTotal) * 100)
                    : 0;
                  return (
                    <div key={tier.id} className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-extrabold text-slate-800 text-xs">
                            {tier.nama}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatRupiah(tier.harga_bulanan)} / bln • {tier.sekolahCount} Sekolah
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-slate-900 text-xs font-brand">
                            {formatRupiah(tier.totalMrr)}
                          </div>
                          <div className="text-[10px] font-bold text-emerald-600">
                            {sharePct}% Share
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.max(2, sharePct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/60 text-[11px] text-amber-800 font-medium">
                💡 <span className="font-bold">Potensi Upsell:</span> Meng-upgrade sekolah paket <em>Sahabat</em> ke paket <em>Mandiri Plus</em> akan mendongkrak MRR sebesar +Rp 124.000 per sekolah/bulan!
              </div>
            </div>

            {/* Kolom Kanan: Jadwal Tagihan & Kirim Invoice WA (2 Kolom) */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-5 md:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base font-brand flex items-center space-x-2">
                    <Receipt className="w-5 h-5 text-blue-600" />
                    <span>Jadwal Penagihan & Perpanjangan Langganan ({financialStats.billingList.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Pantau tanggal jatuh tempo dan kirimkan pengingat perpanjangan via WhatsApp dengan 1 klik.
                  </p>
                </div>

                {/* Search Box Tagihan */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari sekolah, kepsek..."
                    value={searchBilling}
                    onChange={(e) => setSearchBilling(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              {/* Tabel Jadwal Invoice */}
              <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Nama Sekolah</th>
                      <th className="py-3 px-4">Paket</th>
                      <th className="py-3 px-4 text-right">Tarif / Bln</th>
                      <th className="py-3 px-4 text-center">Jatuh Tempo</th>
                      <th className="py-3 px-4 text-center">Sisa Hari</th>
                      <th className="py-3 px-4 text-right">Aksi Penagihan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {financialStats.billingList
                      .filter((b) => {
                        if (!searchBilling.trim()) return true;
                        const q = searchBilling.toLowerCase();
                        return (
                          (b.school.nama_sekolah || '').toLowerCase().includes(q) ||
                          (b.kepsekUser?.nama || '').toLowerCase().includes(q)
                        );
                      })
                      .map((b) => {
                        const isDueSoon = b.sisaHari !== null && b.sisaHari <= 14;
                        const isExpired = b.isExpired;

                        return (
                          <tr key={b.school.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 px-4 font-bold text-slate-800">
                              <div>{b.school.nama_sekolah}</div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                Kepsek: {b.kepsekUser?.nama || 'Belum Ada'} {b.phoneRaw ? `(${b.phoneRaw})` : ''}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200/60">
                                {b.planInfo.nama}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-mono">
                              {b.price > 0 ? formatRupiah(b.price) : <span className="text-slate-400">Gratis (Trial)</span>}
                            </td>
                            <td className="py-3.5 px-4 text-center text-slate-600">
                              {b.school.berlaku_hingga ? formatTanggalIndo(b.school.berlaku_hingga) : '-'}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                  isExpired
                                    ? 'bg-rose-100 text-rose-800 animate-pulse'
                                    : isDueSoon
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {isExpired ? 'KEDALUWARSA' : b.sisaHari !== null ? `${b.sisaHari} Hari Lagi` : 'Aktif'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {b.waBillingLink ? (
                                <a
                                  href={b.waBillingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-xl shadow-xs transition active:scale-95"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>Kirim Invoice WA</span>
                                </a>
                              ) : (
                                <button
                                  onClick={() => navigate('/superadmin/sekolah')}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-orange-100 hover:text-orange-700 font-bold rounded-xl transition text-[11px]"
                                >
                                  Kelola
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB RADAR KEAKTIFAN TENANT & ANTI-CHURN SCORE (PRIORITAS 1) */}
      {activeTab === 'radar' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base font-brand flex items-center space-x-2">
                  <HeartPulse className="w-5 h-5 text-rose-500" />
                  <span>Radar Keaktifan & Health Score Tenant ({filteredRadarList.length} Sekolah)</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Sistem monitoring proaktif untuk mendeteksi dini sekolah yang butuh pendampingan KBM dan mencegah churn.
                </p>
              </div>

              {/* Bilah Pencarian Sekolah */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari sekolah, kota, NPSN, kepsek..."
                  value={searchRadar}
                  onChange={(e) => setSearchRadar(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
                />
              </div>
            </div>

            {/* Filter Kategori Kesehatan */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="font-bold text-slate-500 text-[11px]">Filter Kategori:</span>
              <button
                type="button"
                onClick={() => setFilterHealthCategory('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${
                  filterHealthCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua ({tenantHealthList.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterHealthCategory('kritis')}
                className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center space-x-1.5 ${
                  filterHealthCategory === 'kritis'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>
                <span>Butuh Pendampingan ({healthSummary.kritis})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterHealthCategory('waspada')}
                className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center space-x-1.5 ${
                  filterHealthCategory === 'waspada'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Perlu Dipantau ({healthSummary.waspada})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterHealthCategory('prima')}
                className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center space-x-1.5 ${
                  filterHealthCategory === 'prima'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Prima & Aktif ({healthSummary.prima})</span>
              </button>
            </div>
          </div>

          {/* Grid Kartu Radar Tenant */}
          {filteredRadarList.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-400">
              <HeartPulse className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold">Tidak ada tenant sekolah pada kategori ini.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRadarList.map((item) => {
                const { school: s, kepsekUser, score, category, issues, attendanceScore, guruScore, muridScore, langgananScore, totalActiveGuru, hadirHariIni, muridAktif, sisaHari, isExpired, isSuspended, waLink, phoneRaw } = item;
                const planInfo = getPlan(s.paket_langganan, plansDb);

                return (
                  <div
                    key={s.id}
                    className={`bg-white rounded-3xl border p-5 shadow-xs transition hover:shadow-md flex flex-col justify-between space-y-4 ${
                      category === 'kritis'
                        ? 'border-rose-200 bg-gradient-to-b from-white to-rose-50/20'
                        : category === 'waspada'
                        ? 'border-amber-200 bg-gradient-to-b from-white to-amber-50/20'
                        : 'border-emerald-200 bg-gradient-to-b from-white to-emerald-50/20'
                    }`}
                  >
                    {/* Header Kartu */}
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center space-x-3">
                          {s.logo_url ? (
                            <img
                              src={s.logo_url}
                              alt="Logo"
                              className="w-12 h-12 rounded-2xl object-contain border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-base shrink-0">
                              {s.nama_sekolah?.charAt(0) || 'S'}
                            </div>
                          )}
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm font-brand leading-snug">
                              {s.nama_sekolah}
                            </h4>
                            <div className="text-[11px] text-slate-500 font-medium flex items-center space-x-2 mt-0.5">
                              <span>{s.kota || 'Indonesia'}</span>
                              <span>•</span>
                              <span className="font-mono text-[10px]">NPSN: {s.npsn || '-'}</span>
                            </div>
                            <div className="mt-1 flex items-center space-x-1.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200/60">
                                {planInfo.nama}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  isSuspended
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isSuspended ? 'NONAKTIF' : 'AKTIF'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Health Score Pill */}
                        <div
                          className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center shrink-0 min-w-[76px] ${
                            category === 'prima'
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : category === 'waspada'
                              ? 'bg-amber-50 border-amber-300 text-amber-800'
                              : 'bg-rose-50 border-rose-300 text-rose-800 animate-pulse'
                          }`}
                        >
                          <span className="text-xl font-black font-brand leading-none">{score}%</span>
                          <span className="text-[9px] font-extrabold uppercase tracking-wider mt-1">
                            {category === 'prima' ? 'PRIMA' : category === 'waspada' ? 'WASPADA' : 'KRITIS'}
                          </span>
                        </div>
                      </div>

                      {/* 4 Pilar Evaluasi KBM */}
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                        <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                            <span>Presensi Guru</span>
                            <span className="font-extrabold text-slate-800">{hadirHariIni}/{totalActiveGuru}</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-teal-500 h-full rounded-full transition-all"
                              style={{ width: `${(attendanceScore / 35) * 100}%` }}
                            />
                          </div>
                        </div>

                        <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                            <span>Guru Aktif</span>
                            <span className="font-extrabold text-slate-800">{totalActiveGuru} Guru</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all"
                              style={{ width: `${(guruScore / 25) * 100}%` }}
                            />
                          </div>
                        </div>

                        <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                            <span>Murid Aktif</span>
                            <span className="font-extrabold text-slate-800">{muridAktif} Anak</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-orange-500 h-full rounded-full transition-all"
                              style={{ width: `${(muridScore / 25) * 100}%` }}
                            />
                          </div>
                        </div>

                        <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                            <span>Masa Aktif</span>
                            <span className="font-extrabold text-slate-800">
                              {sisaHari !== null ? `${sisaHari} hr` : 'Aktif'}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-500 h-full rounded-full transition-all"
                              style={{ width: `${(langgananScore / 15) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Catatan Isu / Diagnosa Otomatis */}
                      <div className="mt-3">
                        {issues.length > 0 ? (
                          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-800 text-[11px] space-y-1">
                            <div className="font-bold flex items-center space-x-1">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>Catatan Pendampingan Sistem:</span>
                            </div>
                            <ul className="list-disc list-inside font-medium pl-1 text-[10px] space-y-0.5">
                              {issues.map((iss, idx) => (
                                <li key={idx}>{iss}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[11px] font-bold flex items-center space-x-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>KBM dan data sekolah berjalan lancar tanpa kendala.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Kartu & Tombol Aksi Cepat */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-500 font-medium">
                        Kepsek: <strong className="text-slate-800">{kepsekUser?.nama || 'Belum Dibuat'}</strong>
                        {phoneRaw && <span className="ml-1 text-slate-400">({phoneRaw})</span>}
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        {waLink ? (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-xl shadow-xs transition flex items-center space-x-1.5"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Hubungi Kepsek (WA)</span>
                          </a>
                        ) : (
                          <button
                            onClick={() => navigate('/superadmin/sekolah')}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] rounded-xl transition flex items-center space-x-1"
                            title="Lengkapi nomor kontak sekolah"
                          >
                            <PhoneCall className="w-3 h-3 text-slate-400" />
                            <span>Input No. HP</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setFilterSchoolId(s.id);
                            setActiveTab('guru');
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-xl transition"
                        >
                          Guru ({totalActiveGuru})
                        </button>

                        <button
                          onClick={() => navigate('/superadmin/sekolah')}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-orange-100 hover:text-orange-700 font-bold text-[11px] rounded-xl transition"
                        >
                          Kelola
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DIREKTORI MASTER DATA GURU SE-NASIONAL */}
      {activeTab === 'guru' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base font-brand flex items-center space-x-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <span>Direktori Master Data Guru PAUD ({filteredGuruList.length} Ditemukan)</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Pencarian dan monitoring seluruh akun tenaga pendidik dari seluruh sekolah mitra.
              </p>
            </div>

            {/* Bilah Pencarian Cepat */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari guru, email, sekolah..."
                value={searchGuru}
                onChange={(e) => setSearchGuru(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
              />
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="font-bold text-slate-500 text-[11px]">Filter Sekolah:</span>
            <select
              value={filterSchoolId}
              onChange={(e) => setFilterSchoolId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Sekolah ({schools.length})</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.nama_sekolah}</option>
              ))}
            </select>

            <span className="font-bold text-slate-500 text-[11px] ml-2">Status:</span>
            <select
              value={filterStatusAkun}
              onChange={(e) => setFilterStatusAkun(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="aktif">Hanya Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </div>

          {/* Tabel Master Guru */}
          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Nama Lengkap Guru</th>
                  <th className="py-3 px-4">Email Login</th>
                  <th className="py-3 px-4">Asal Sekolah</th>
                  <th className="py-3 px-4 text-center">Kelompok</th>
                  <th className="py-3 px-4 text-center">Status Akun</th>
                  <th className="py-3 px-4 text-center">Wajib Ganti Sandi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredGuruList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Tidak ada data guru yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredGuruList.map((g) => {
                    const isAktif = g.status_akun === 'aktif';
                    return (
                      <tr key={g.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-bold text-slate-800">
                          <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                              {g.nama?.charAt(0) || 'G'}
                            </div>
                            <span>{g.nama || '-'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                          {g.email}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-semibold">
                          {g.nama_sekolah || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            {g.kelompok_kelas || 'Umum'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              isAktif
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isAktif ? 'AKTIF' : 'NONAKTIF'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {g.wajib_ganti_password ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Ya (Default)
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LIVE ACTIVITY STREAM (AUDIT FEED REALTIME) */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-orange-500" />
              <h3 className="font-extrabold text-slate-800 text-base font-brand">
                Live Audit Trail & Stream Aktivitas Realtime
              </h3>
            </div>
            <button
              onClick={() => navigate('/superadmin/logs')}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center space-x-1"
            >
              <span>Manajemen Log Lengkap</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Belum ada rekaman audit log aktivitas.
              </p>
            ) : (
              recentLogs.map((log) => {
                const dateStr = log.timestamp?.toDate
                  ? formatTanggalIndo(log.timestamp.toDate()) + ' ' + formatJamMenit(log.timestamp.toDate())
                  : 'Baru saja';
                return (
                  <div key={log.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold shrink-0 mt-0.5">
                        ⚡
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">
                          {log.actorNama || 'Pengguna'} <span className="font-normal text-slate-400">•</span> <span className="font-semibold text-orange-600">{log.action || 'ACTIVITY'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Tipe: <span className="font-mono">{log.recordType || 'system'}</span> {log.detail ? `(${JSON.stringify(log.detail)})` : ''}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      {dateStr}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
