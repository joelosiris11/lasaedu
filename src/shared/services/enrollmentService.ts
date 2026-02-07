import { database } from '@app/config/firebase';
import { ref, set, get, update, remove, query, orderByChild, equalTo } from 'firebase/database';
import type { Course, Enrollment } from '@shared/types';

export interface EnrollmentService {
  create: (enrollment: Enrollment) => Promise<void>;
  getAll: () => Promise<Enrollment[]>;
  getById: (id: string) => Promise<Enrollment | null>;
  getByUser: (userId: string) => Promise<Enrollment[]>;
  getByCourse: (courseId: string) => Promise<Enrollment[]>;
  update: (id: string, enrollment: Partial<Enrollment>) => Promise<void>;
  delete: (id: string) => Promise<void>;
  
  // Advanced enrollment operations
  enroll: (userId: string, courseId: string, metadata?: any) => Promise<Enrollment>;
  withdraw: (userId: string, courseId: string, reason?: string) => Promise<void>;
  bulkEnroll: (userIds: string[], courseId: string) => Promise<void>;
  checkPrerequisites: (userId: string, courseId: string) => Promise<{ canEnroll: boolean; missingPrereqs: string[] }>;
  getWaitlist: (courseId: string) => Promise<Enrollment[]>;
  processWaitlist: (courseId: string, spotsAvailable: number) => Promise<void>;
}

export class FirebaseEnrollmentService implements EnrollmentService {
  private enrollmentsRef = ref(database, 'enrollments');

  async create(enrollment: Enrollment): Promise<void> {
    try {
      await set(ref(database, `enrollments/${enrollment.id}`), {
        ...enrollment,
        createdAt: Date.now(),
        lastUpdated: Date.now()
      });
    } catch (error) {
      console.error('Error creating enrollment:', error);
      throw new Error('Failed to create enrollment');
    }
  }

  async getAll(): Promise<Enrollment[]> {
    try {
      const snapshot = await get(this.enrollmentsRef);
      if (!snapshot.exists()) return [];
      
      const enrollmentsData = snapshot.val();
      return Object.values(enrollmentsData) as Enrollment[];
    } catch (error) {
      console.error('Error getting enrollments:', error);
      return [];
    }
  }

  async getById(id: string): Promise<Enrollment | null> {
    try {
      const snapshot = await get(ref(database, `enrollments/${id}`));
      return snapshot.exists() ? snapshot.val() as Enrollment : null;
    } catch (error) {
      console.error('Error getting enrollment by ID:', error);
      return null;
    }
  }

  async getByUser(userId: string): Promise<Enrollment[]> {
    try {
      const userEnrollmentsQuery = query(
        this.enrollmentsRef,
        orderByChild('userId'),
        equalTo(userId)
      );
      const snapshot = await get(userEnrollmentsQuery);
      
      if (!snapshot.exists()) return [];
      
      const enrollmentsData = snapshot.val();
      return Object.values(enrollmentsData) as Enrollment[];
    } catch (error) {
      console.error('Error getting user enrollments:', error);
      return [];
    }
  }

  async getByCourse(courseId: string): Promise<Enrollment[]> {
    try {
      const courseEnrollmentsQuery = query(
        this.enrollmentsRef,
        orderByChild('courseId'),
        equalTo(courseId)
      );
      const snapshot = await get(courseEnrollmentsQuery);
      
      if (!snapshot.exists()) return [];
      
      const enrollmentsData = snapshot.val();
      return Object.values(enrollmentsData) as Enrollment[];
    } catch (error) {
      console.error('Error getting course enrollments:', error);
      return [];
    }
  }

  async update(id: string, enrollment: Partial<Enrollment>): Promise<void> {
    try {
      await update(ref(database, `enrollments/${id}`), {
        ...enrollment,
        lastUpdated: Date.now()
      });
    } catch (error) {
      console.error('Error updating enrollment:', error);
      throw new Error('Failed to update enrollment');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await remove(ref(database, `enrollments/${id}`));
    } catch (error) {
      console.error('Error deleting enrollment:', error);
      throw new Error('Failed to delete enrollment');
    }
  }

  async enroll(userId: string, courseId: string, metadata?: any): Promise<Enrollment> {
    try {
      // Check if user is already enrolled
      const existingEnrollments = await this.getByUser(userId);
      const alreadyEnrolled = existingEnrollments.find(e => 
        e.courseId === courseId && e.status !== 'withdrawn'
      );
      
      if (alreadyEnrolled) {
        throw new Error('User is already enrolled in this course');
      }

      // Check prerequisites
      const prerequisiteCheck = await this.checkPrerequisites(userId, courseId);
      if (!prerequisiteCheck.canEnroll) {
        throw new Error(`Prerequisites not met: ${prerequisiteCheck.missingPrereqs.join(', ')}`);
      }

      // Get course info to check enrollment limits
      const courseSnapshot = await get(ref(database, `courses/${courseId}`));
      if (!courseSnapshot.exists()) {
        throw new Error('Course not found');
      }
      
      const course = courseSnapshot.val() as Course;
      const currentEnrollments = await this.getByCourse(courseId);
      const activeEnrollments = currentEnrollments.filter(e => 
        e.status === 'active' || e.status === 'pending'
      );

      // Create enrollment
      const enrollment: Enrollment = {
        id: `enrollment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        courseId,
        status: 'pending', // Will be activated after payment/approval if needed
        enrolledAt: Date.now(),
        lastUpdated: Date.now(),
        progress: 0,
        source: 'manual',
        ...metadata
      };

      // Check if course has enrollment limit
      if (course.maxStudents && activeEnrollments.length >= course.maxStudents) {
        // Add to waitlist
        enrollment.status = 'waitlisted';
        enrollment.waitlistPosition = await this.getWaitlistPosition(courseId);
      }

      await this.create(enrollment);
      
      // Update course enrollment count
      await this.updateCourseEnrollmentCount(courseId);
      
      return enrollment;
    } catch (error) {
      console.error('Error enrolling user:', error);
      throw error;
    }
  }

  async withdraw(userId: string, courseId: string, reason?: string): Promise<void> {
    try {
      const userEnrollments = await this.getByUser(userId);
      const enrollment = userEnrollments.find(e => 
        e.courseId === courseId && e.status !== 'withdrawn'
      );
      
      if (!enrollment) {
        throw new Error('Enrollment not found');
      }

      await this.update(enrollment.id, {
        status: 'withdrawn',
        withdrawnAt: Date.now(),
        withdrawReason: reason
      });

      // Update course enrollment count
      await this.updateCourseEnrollmentCount(courseId);
      
      // Process waitlist if applicable
      await this.processWaitlist(courseId, 1);
    } catch (error) {
      console.error('Error withdrawing enrollment:', error);
      throw error;
    }
  }

  async bulkEnroll(userIds: string[], courseId: string): Promise<void> {
    try {
      const enrollmentPromises = userIds.map(userId => 
        this.enroll(userId, courseId).catch(error => ({ error, userId }))
      );
      
      const results = await Promise.all(enrollmentPromises);
      const errors = results.filter(r => r && typeof r === 'object' && 'error' in r);
      
      if (errors.length > 0) {
        console.warn('Some bulk enrollments failed:', errors);
      }
      
      // Update course enrollment count once
      await this.updateCourseEnrollmentCount(courseId);
    } catch (error) {
      console.error('Error in bulk enrollment:', error);
      throw error;
    }
  }

  async checkPrerequisites(userId: string, courseId: string): Promise<{ canEnroll: boolean; missingPrereqs: string[] }> {
    try {
      // Get course prerequisites
      const courseSnapshot = await get(ref(database, `courses/${courseId}`));
      if (!courseSnapshot.exists()) {
        return { canEnroll: false, missingPrereqs: ['Course not found'] };
      }
      
      const course = courseSnapshot.val() as Course;
      if (!course.prerequisites || course.prerequisites.length === 0) {
        return { canEnroll: true, missingPrereqs: [] };
      }

      // Get user's completed courses
      const userEnrollments = await this.getByUser(userId);
      const completedCourseIds = userEnrollments
        .filter(e => e.status === 'completed')
        .map(e => e.courseId);

      // Check which prerequisites are missing
      const missingPrereqs: string[] = [];
      for (const prereqId of course.prerequisites) {
        if (!completedCourseIds.includes(prereqId)) {
          // Get prerequisite course name
          const prereqSnapshot = await get(ref(database, `courses/${prereqId}`));
          const prereqName = prereqSnapshot.exists() ? prereqSnapshot.val().title : prereqId;
          missingPrereqs.push(prereqName);
        }
      }

      return {
        canEnroll: missingPrereqs.length === 0,
        missingPrereqs
      };
    } catch (error) {
      console.error('Error checking prerequisites:', error);
      return { canEnroll: false, missingPrereqs: ['Error checking prerequisites'] };
    }
  }

  async getWaitlist(courseId: string): Promise<Enrollment[]> {
    try {
      const courseEnrollments = await this.getByCourse(courseId);
      return courseEnrollments
        .filter(e => e.status === 'waitlisted')
        .sort((a, b) => (a.waitlistPosition || 0) - (b.waitlistPosition || 0));
    } catch (error) {
      console.error('Error getting waitlist:', error);
      return [];
    }
  }

  async processWaitlist(courseId: string, spotsAvailable: number): Promise<void> {
    try {
      if (spotsAvailable <= 0) return;

      const waitlist = await this.getWaitlist(courseId);
      const toPromote = waitlist.slice(0, spotsAvailable);

      for (const enrollment of toPromote) {
        await this.update(enrollment.id, {
          status: 'pending',
          promotedFromWaitlistAt: Date.now()
        });
        
        // TODO: Send notification to user
        console.log(`Promoted user ${enrollment.userId} from waitlist for course ${courseId}`);
      }

      // Update waitlist positions for remaining users
      const remaining = waitlist.slice(spotsAvailable);
      for (let i = 0; i < remaining.length; i++) {
        await this.update(remaining[i].id, {
          waitlistPosition: i + 1
        });
      }
    } catch (error) {
      console.error('Error processing waitlist:', error);
      throw error;
    }
  }

  private async getWaitlistPosition(courseId: string): Promise<number> {
    const waitlist = await this.getWaitlist(courseId);
    return waitlist.length + 1;
  }

  private async updateCourseEnrollmentCount(courseId: string): Promise<void> {
    try {
      const enrollments = await this.getByCourse(courseId);
      const activeCount = enrollments.filter(e => 
        e.status === 'active' || e.status === 'pending'
      ).length;
      
      await update(ref(database, `courses/${courseId}`), {
        currentEnrollments: activeCount,
        lastEnrollmentUpdate: Date.now()
      });
    } catch (error) {
      console.error('Error updating course enrollment count:', error);
    }
  }

  // Enrollment Analytics
  async getEnrollmentStats(courseId?: string) {
    try {
      const enrollments = courseId ? await this.getByCourse(courseId) : await this.getAll();
      
      return {
        total: enrollments.length,
        active: enrollments.filter(e => e.status === 'active').length,
        pending: enrollments.filter(e => e.status === 'pending').length,
        completed: enrollments.filter(e => e.status === 'completed').length,
        withdrawn: enrollments.filter(e => e.status === 'withdrawn').length,
        waitlisted: enrollments.filter(e => e.status === 'waitlisted').length,
        byMonth: this.groupEnrollmentsByMonth(enrollments)
      };
    } catch (error) {
      console.error('Error getting enrollment stats:', error);
      return null;
    }
  }

  private groupEnrollmentsByMonth(enrollments: Enrollment[]) {
    const groups: Record<string, number> = {};
    
    enrollments.forEach(enrollment => {
      const date = new Date(enrollment.enrolledAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      groups[key] = (groups[key] || 0) + 1;
    });
    
    return groups;
  }
}

// Export singleton instance
export const enrollmentService = new FirebaseEnrollmentService();