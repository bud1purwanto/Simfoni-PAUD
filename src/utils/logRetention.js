import {
  collection,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  getCountFromServer,
  writeBatch,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { logActivity } from "./auditLogger";

const CONFIG_REF = () => doc(db, "system_settings", "general_config");
const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 400;

const cutoffTimestamp = (days) => Timestamp.fromMillis(Date.now() - Number(days) * DAY_MS);

const olderThanQuery = (days) =>
  query(collection(db, "audit_logs"), where("timestamp", "<", cutoffTimestamp(days)));

/**
 * Hitung jumlah log yang lebih tua dari `days` hari (agregasi server, 1 read per 1000 dokumen).
 */
export const countLogsOlderThan = async (days) => {
  const snap = await getCountFromServer(olderThanQuery(days));
  return snap.data().count;
};

/**
 * Hapus log yang lebih tua dari `days` hari secara bertahap (batch ≤ 400 dokumen).
 * @returns {Promise<number>} jumlah dokumen terhapus
 */
export const purgeLogsOlderThan = async (days) => {
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await getDocs(query(olderThanQuery(days), limit(BATCH_SIZE)));
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < BATCH_SIZE) break;
  }
  return total;
};

/**
 * Catat hasil pembersihan ke system_settings dan audit log.
 */
export const recordCleanup = async ({ deletedCount, days, actor, mode }) => {
  await updateDoc(CONFIG_REF(), {
    last_cleanup_timestamp: serverTimestamp(),
    last_cleanup_deleted_count: deletedCount,
    updated_at: serverTimestamp(),
  });
  logActivity({
    schoolId: null,
    actorId: actor.uid,
    actorNama: actor.nama,
    action: mode === "auto" ? "AUTO_PURGE_LOGS" : "PURGE_LOGS",
    recordType: "audit_logs",
    recordId: `${deletedCount}_DOCS`,
    detail: { hari: Number(days), jumlah: deletedCount },
  });
};

let autoRunStarted = false;

/**
 * Periodic Retention Job (sisi klien): dijalankan maksimal sekali per sesi Superadmin
 * dan hanya jika siklus terakhir sudah lebih dari 24 jam. Tanpa Cloud Functions/Blaze.
 * @returns {Promise<number|null>} jumlah terhapus, atau null jika tidak dijalankan
 */
export const runAutoRetentionIfDue = async (actor) => {
  if (autoRunStarted || !actor?.uid) return null;
  autoRunStarted = true;

  try {
    const snap = await getDoc(CONFIG_REF());
    if (!snap.exists()) return null;
    const config = snap.data();
    if (!config.auto_cleanup_enabled) return null;

    const lastMs = config.last_cleanup_timestamp?.toMillis?.() || 0;
    if (Date.now() - lastMs < DAY_MS) return null;

    const days = Number(config.log_retention_days) || 60;
    const deletedCount = await purgeLogsOlderThan(days);
    await recordCleanup({ deletedCount, days, actor, mode: "auto" });
    return deletedCount;
  } catch (err) {
    console.warn("Job retensi log otomatis gagal:", err);
    autoRunStarted = false;
    return null;
  }
};
