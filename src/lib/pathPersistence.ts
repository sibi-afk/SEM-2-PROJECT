import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { PathRecord, CustomMapRecord } from "../types/paths";

const LOCAL_STORAGE_PATHS_KEY = "stochastic_recent_paths_v1";
const LOCAL_STORAGE_MAPS_KEY = "stochastic_custom_maps_v1";

// Helper to get local paths
export const getLocalPaths = (): PathRecord[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PATHS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// Helper to save local path
export const saveLocalPath = (path: PathRecord): PathRecord[] => {
  try {
    const existing = getLocalPaths();
    const updated = [path, ...existing.filter((p) => p.id !== path.id)].slice(0, 10);
    localStorage.setItem(LOCAL_STORAGE_PATHS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
};

// Fetch last recent paths (from Firestore if user logged in, else localStorage)
export const fetchRecentPaths = async (userId?: string | null): Promise<PathRecord[]> => {
  if (!userId) {
    return getLocalPaths().slice(0, 5);
  }

  try {
    const pathsCol = collection(db, "users", userId, "recent_paths");
    const q = query(pathsCol, orderBy("timestamp", "desc"), limit(5));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Fallback to local
      return getLocalPaths().slice(0, 5);
    }

    const firestorePaths: PathRecord[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        sequence: data.sequence || [],
        pathCoordinates: data.pathCoordinates || [],
        startPos: data.startPos || [1, 1],
        targetPos: data.targetPos || [10, 10],
        gridDimension: data.gridDimension || 12,
        stepsCount: data.stepsCount || 0,
        slipsCount: data.slipsCount || 0,
        accumulatedReward: data.accumulatedReward || 0,
        reachedGoal: data.reachedGoal ?? true,
        slipProb: data.slipProb || 0.15,
        survivorName: data.survivorName || "Lost Beacon",
        timestamp: data.timestamp || new Date().toISOString(),
      };
    });

    return firestorePaths;
  } catch (err) {
    console.warn("Firestore read failed, using local storage:", err);
    return getLocalPaths().slice(0, 5);
  }
};

// Save a calculated path sequence
export const recordRecentPath = async (
  path: PathRecord,
  userId?: string | null
): Promise<void> => {
  // Always update local cache for instant UI
  saveLocalPath(path);

  if (!userId) return;

  try {
    const pathRef = doc(db, "users", userId, "recent_paths", path.id);
    await setDoc(pathRef, {
      ...path,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to persist path to Firestore:", err);
  }
};

// Custom Map Storage & Firestore Sync
export const getLocalMaps = (): CustomMapRecord[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MAPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveCustomMap = async (
  map: CustomMapRecord,
  userId?: string | null
): Promise<void> => {
  try {
    const existing = getLocalMaps();
    const updated = [map, ...existing.filter((m) => m.id !== map.id)];
    localStorage.setItem(LOCAL_STORAGE_MAPS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Local map save failed:", err);
  }

  if (!userId) return;

  try {
    const mapRef = doc(db, "users", userId, "custom_maps", map.id);
    await setDoc(mapRef, {
      ...map,
      savedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to save map to Firestore:", err);
  }
};

export const fetchCustomMaps = async (userId?: string | null): Promise<CustomMapRecord[]> => {
  const local = getLocalMaps();
  if (!userId) return local;

  try {
    const mapsCol = collection(db, "users", userId, "custom_maps");
    const snapshot = await getDocs(mapsCol);
    if (snapshot.empty) return local;

    const fromDb: CustomMapRecord[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name || "Custom Map",
        description: data.description,
        dimension: data.dimension || 12,
        grid: data.grid || [],
        startPos: data.startPos || [1, 1],
        targetPos: data.targetPos || [10, 10],
        createdAt: data.createdAt || new Date().toISOString(),
        source: data.source || "uploaded",
      };
    });

    // Merge without duplicates
    const combined = [...fromDb];
    for (const l of local) {
      if (!combined.some((c) => c.id === l.id)) {
        combined.push(l);
      }
    }
    return combined;
  } catch (err) {
    console.warn("Error loading maps from Firestore:", err);
    return local;
  }
};
