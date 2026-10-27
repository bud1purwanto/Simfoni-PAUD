/**
 * Bank Template Kegiatan KBM Kurikulum Merdeka PAUD
 * Membantu guru PAUD mengisi jurnal kegiatan harian secara cepat dan terstandar.
 */
export const KBM_TEMPLATES = [
  {
    id: "upacara_pembiasaan",
    judul: "Upacara Bendera & Pembiasaan Karakter Pagi",
    kelompok: "Semua",
    topik: "Cinta Tanah Air & Pembiasaan Disiplin",
    capaian_pembelajaran: ["Nilai Agama & Budi Pekerti", "Jati Diri"],
    tujuan: "Anak dapat menunjukkan sikap hormat pada bendera merah putih, tertib berbaris, dan terbiasa berdoa sebelum memulai kegiatan.",
    kegiatan_pembuka: "Penyambutan anak dengan 5S (Senyum, Sapa, Salam, Sopan, Santun), berbaris di halaman, pengibaran bendera merah putih sederhana, dan menyanyikan lagu Indonesia Raya.",
    kegiatan_inti: "Latihan konsentrasi mendengarkan amanat pembina upacara, hafalan Pancasila bersama, doa pagi bersama di dalam kelas, dan bercerita tentang sikap saling menyayangi teman.",
    kegiatan_penutup: "Makan bekal bersama dengan adab mencuci tangan sebelum makan, refleksi perasaan pagi, dan istirahat bermain bebas.",
    refleksi: "Sebagian besar anak sudah mampu berdiri tegak dan tertib saat upacara. 2 anak masih butuh bimbingan guru saat berbaris rapi."
  },
  {
    id: "motorik_senam",
    judul: "Motorik Kasar & Senam Sehat Gembira",
    kelompok: "TK A",
    topik: "Kesehatanku & Tubuh yang Kuat",
    capaian_pembelajaran: ["Jati Diri"],
    tujuan: "Anak mampu menggerakkan anggota tubuh secara lincah, menjaga keseimbangan, dan mengekspresikan kegembiraan lewat gerakan musik.",
    kegiatan_pembuka: "Pemanasan ringan, peregangan tangan dan kaki, serta menyanyikan lagu 'Kepala Pundak Lutut Kaki'.",
    kegiatan_inti: "Senam Irama Ceria PAUD bersama di halaman, dilanjutkan permainan melompati simpai warna-warni dan berjalan seimbang di atas papan titian.",
    kegiatan_penutup: "Pendinginan, minum air putih bersama, duduk melingkar sambil menarik napas dalam, dan bersiap masuk kelas.",
    refleksi: "Anak-anak sangat antusias dan ceria. Koordinasi gerak kaki dan tangan anak berkembang sangat baik."
  },
  {
    id: "sains_eksperimen",
    judul: "Sentra Sains: Eksperimen Pencampuran Warna",
    kelompok: "TK B",
    topik: "Eksplorasi Warna Ciptaan Tuhan",
    capaian_pembelajaran: ["Dasar-dasar Literasi & STEAM", "Nilai Agama & Budi Pekerti"],
    tujuan: "Anak dapat mengamati perubahan warna saat warna primer dicampur dan berani mencoba eksperimen sederhana secara mandiri.",
    kegiatan_pembuka: "Mengenal warna-warna primer (Merah, Kuning, Biru) menggunakan gelas transparan berisi air dan pewarna makanan.",
    kegiatan_inti: "Anak secara bergiliran menggunakan pipet tetes mencampurkan warna merah + kuning menjadi jingga, kuning + biru menjadi hijau. Anak mencatat hasil warna di lembar observasi.",
    kegiatan_penutup: "Diskusi temuan warna baru, merapikan kembali peralatan sains, dan mengucap rasa syukur atas keindahan alam semesta.",
    refleksi: "Anak menunjukkan rasa ingin tahu yang tinggi. Mereka kagum saat melihat perubahan warna air."
  },
  {
    id: "seni_kreativitas",
    judul: "Sentra Seni: Kolase & Menggunting Pola",
    kelompok: "TK A",
    topik: "Kreativitas Tanganku yang Terampil",
    capaian_pembelajaran: ["Jati Diri", "Dasar-dasar Literasi & STEAM"],
    tujuan: "Melatih motorik halus anak dalam menggunakan gunting aman dan ketelitian menempelkan potongan kertas origami.",
    kegiatan_pembuka: "Mengenalkan bentuk geometri dasar (lingkaran, segitiga, persegi) dan cara memegang gunting anak yang benar.",
    kegiatan_inti: "Menggunting kertas origami warna-warni mengikuti garis putus-putus, kemudian menempelkannya (kolase) pada gambar pola buah apel.",
    kegiatan_penutup: "Mempresentasikan hasil karya kolase di depan kelas, saling memberikan tepuk tangan apresiasi, dan mencuci tangan.",
    refleksi: "Kekuatan jari-jemari anak semakin terlatih. Sebagian anak sudah mulai mahir menggunting lurus tanpa keluar garis."
  },
  {
    id: "literasi_awal",
    judul: "Dasar Literasi: Membaca Cerita Bergambar & Pengenalan Huruf",
    kelompok: "TK B",
    topik: "Gemar Membaca & Sahabat Alam",
    capaian_pembelajaran: ["Dasar-dasar Literasi & STEAM"],
    tujuan: "Anak mampu menyimak alur cerita, menceritakan kembali secara sederhana, dan mengenali simbol bunyi huruf vokal (A, I, U, E, O).",
    kegiatan_pembuka: "Guru membacakan buku cerita besar (Big Book) bertema 'Kelinci yang Suka Menolong', anak mengamati gambar sampul.",
    kegiatan_inti: "Tanya jawab tentang tokoh dalam cerita, permainan mencari kartu huruf vokal tersembunyi di karpet kelas, dan menyusun huruf membentuk kata sederhana.",
    kegiatan_penutup: "Menyimpulkan pesan moral dari cerita (suka menolong sesama), membaca doa penutup, dan pesan untuk belajar di rumah.",
    refleksi: "Kosa kata anak bertambah kaya. Anak-anak berani menjawab pertanyaan dan berani menceritakan pengalaman pribadinya."
  }
];

export const getKbmTemplates = () => KBM_TEMPLATES;

export const getTemplateById = (id) => KBM_TEMPLATES.find(t => t.id === id) || null;

