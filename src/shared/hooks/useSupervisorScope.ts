import { useMemo } from 'react';
import { useAuthStore } from '@app/store/authStore';
import type { DBCourse, DBSection } from '@shared/services/firebaseDataService';
import type { SupervisorScope } from '@shared/types';

export interface SupervisorScopeInfo {
  /** true when the current user is a supervisor */
  isSupervisor: boolean;
  /** true when a supervisor is restricted to a subset of courses */
  restrictsCourses: boolean;
  /** true when a supervisor is restricted to a subset of sections */
  restrictsSections: boolean;
  /** explicitly allowed course ids (only meaningful if restrictsCourses) */
  allowedCourseIds: Set<string>;
  /** explicitly allowed section ids (only meaningful if restrictsSections) */
  allowedSectionIds: Set<string>;
  /** returns true if the current user may see this course */
  canSeeCourse: (courseId: string) => boolean;
  /** returns true if the current user may see this section */
  canSeeSection: (section: Pick<DBSection, 'id' | 'courseId'>) => boolean;
  /** filter helper for an array of courses */
  filterCourses: <T extends Pick<DBCourse, 'id'>>(list: T[]) => T[];
  /** filter helper for an array of sections */
  filterSections: <T extends Pick<DBSection, 'id' | 'courseId'>>(list: T[]) => T[];
}

function isSelected(scope: SupervisorScope['courses'] | SupervisorScope['sections'] | undefined) {
  return scope?.mode === 'selected';
}

export function useSupervisorScope(): SupervisorScopeInfo {
  const user = useAuthStore(state => state.user);

  return useMemo(() => {
    const isSupervisor = user?.role === 'supervisor';
    const scope = user?.supervisorScope;

    const restrictsCourses = isSupervisor && isSelected(scope?.courses);
    const restrictsSections = isSupervisor && isSelected(scope?.sections);

    const allowedCourseIds = new Set<string>(
      restrictsCourses && scope?.courses.mode === 'selected' ? scope.courses.ids : [],
    );
    const allowedSectionIds = new Set<string>(
      restrictsSections && scope?.sections.mode === 'selected' ? scope.sections.ids : [],
    );

    const canSeeCourse = (courseId: string): boolean => {
      if (!isSupervisor) return true;
      if (restrictsCourses && !allowedCourseIds.has(courseId)) return false;
      return true;
    };

    const canSeeSection = (section: Pick<DBSection, 'id' | 'courseId'>): boolean => {
      if (!isSupervisor) return true;
      if (restrictsCourses && !allowedCourseIds.has(section.courseId)) return false;
      if (restrictsSections && !allowedSectionIds.has(section.id)) return false;
      return true;
    };

    const filterCourses = <T extends Pick<DBCourse, 'id'>>(list: T[]): T[] =>
      isSupervisor && restrictsCourses ? list.filter(c => allowedCourseIds.has(c.id)) : list;

    const filterSections = <T extends Pick<DBSection, 'id' | 'courseId'>>(list: T[]): T[] => {
      if (!isSupervisor) return list;
      return list.filter(s => {
        if (restrictsCourses && !allowedCourseIds.has(s.courseId)) return false;
        if (restrictsSections && !allowedSectionIds.has(s.id)) return false;
        return true;
      });
    };

    return {
      isSupervisor,
      restrictsCourses,
      restrictsSections,
      allowedCourseIds,
      allowedSectionIds,
      canSeeCourse,
      canSeeSection,
      filterCourses,
      filterSections,
    };
  }, [user?.role, user?.supervisorScope]);
}
