/**
 * Servicio de persistencia de datos SCORM
 * Gestiona SCORMPackage y SCORMRuntimeData en Firebase RTDB
 */

import { database } from '@app/config/firebase';
import { ref, get, set, push, remove, query, orderByChild, equalTo } from 'firebase/database';
import type { SCORMPackage, SCORMRuntimeData, SCORMVersion } from '@shared/types/elearning-standards';

export class SCORMDataService {
  // =============================================
  // SCORM PACKAGES
  // =============================================

  async createPackage(data: Omit<SCORMPackage, 'id'>): Promise<SCORMPackage> {
    const packagesRef = ref(database, 'scormPackages');
    const newRef = push(packagesRef);
    const pkg: SCORMPackage = { id: newRef.key!, ...data };
    await set(newRef, pkg);
    return pkg;
  }

  async getPackageById(id: string): Promise<SCORMPackage | null> {
    const snapshot = await get(ref(database, `scormPackages/${id}`));
    return snapshot.exists() ? (snapshot.val() as SCORMPackage) : null;
  }

  async getPackageByLesson(lessonId: string): Promise<SCORMPackage | null> {
    const q = query(ref(database, 'scormPackages'), orderByChild('lessonId'), equalTo(lessonId));
    const snapshot = await get(q);
    if (!snapshot.exists()) return null;
    const data = snapshot.val();
    const key = Object.keys(data)[0];
    return data[key] as SCORMPackage;
  }

  async getPackagesByCourse(courseId: string): Promise<SCORMPackage[]> {
    const q = query(ref(database, 'scormPackages'), orderByChild('courseId'), equalTo(courseId));
    const snapshot = await get(q);
    if (!snapshot.exists()) return [];
    const data = snapshot.val();
    return Object.values(data) as SCORMPackage[];
  }

  async deletePackage(id: string): Promise<void> {
    await remove(ref(database, `scormPackages/${id}`));
  }

  // =============================================
  // SCORM RUNTIME DATA
  // =============================================

  async getOrCreateRuntimeData(
    userId: string,
    packageId: string,
    lessonId: string,
    courseId: string,
    version: SCORMVersion
  ): Promise<SCORMRuntimeData> {
    // Buscar runtime data existente
    const q = query(
      ref(database, 'scormRuntimeData'),
      orderByChild('packageId'),
      equalTo(packageId)
    );
    const snapshot = await get(q);

    if (snapshot.exists()) {
      const data = snapshot.val();
      for (const key of Object.keys(data)) {
        if (data[key].userId === userId) {
          return data[key] as SCORMRuntimeData;
        }
      }
    }

    // Crear nuevo runtime data
    const runtimeRef = push(ref(database, 'scormRuntimeData'));
    const now = Date.now();
    const runtimeData: SCORMRuntimeData = {
      id: runtimeRef.key!,
      userId,
      packageId,
      lessonId,
      courseId,
      version,
      cmiData: {},
      sessionTime: 0,
      totalTime: 0,
      completionStatus: 'not attempted',
      successStatus: 'unknown',
      attemptCount: 1,
      firstAccessedAt: now,
      lastAccessedAt: now,
      createdAt: now,
      updatedAt: now
    };

    await set(runtimeRef, runtimeData);
    return runtimeData;
  }

  async saveRuntimeData(data: SCORMRuntimeData): Promise<void> {
    data.updatedAt = Date.now();
    await set(ref(database, `scormRuntimeData/${data.id}`), data);
  }

  async getRuntimeDataByCourse(userId: string, courseId: string): Promise<SCORMRuntimeData[]> {
    const q = query(
      ref(database, 'scormRuntimeData'),
      orderByChild('courseId'),
      equalTo(courseId)
    );
    const snapshot = await get(q);
    if (!snapshot.exists()) return [];

    const data = snapshot.val();
    return (Object.values(data) as SCORMRuntimeData[]).filter(
      item => item.userId === userId
    );
  }

  async getRuntimeData(userId: string, packageId: string): Promise<SCORMRuntimeData | null> {
    const q = query(
      ref(database, 'scormRuntimeData'),
      orderByChild('packageId'),
      equalTo(packageId)
    );
    const snapshot = await get(q);
    if (!snapshot.exists()) return null;

    const data = snapshot.val();
    for (const key of Object.keys(data)) {
      if (data[key].userId === userId) {
        return data[key] as SCORMRuntimeData;
      }
    }
    return null;
  }
}

export const scormDataService = new SCORMDataService();
