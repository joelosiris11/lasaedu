import { useState, useEffect } from 'react';
import { sectionService } from '@shared/services/dataService';
import type { DBSection } from '@shared/services/dataService';

interface UseSectionsOptions {
  instructorId?: string;
}

interface UseSectionsReturn {
  sections: DBSection[];
  loading: boolean;
}

export function useSections(options: UseSectionsOptions = {}): UseSectionsReturn {
  const { instructorId } = options;
  const [sections, setSections] = useState<DBSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const data = instructorId
          ? await sectionService.getByInstructor(instructorId)
          : await sectionService.getAll();
        if (!cancelled) setSections(data);
      } catch (error) {
        console.error('useSections error:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [instructorId]);

  return { sections, loading };
}
