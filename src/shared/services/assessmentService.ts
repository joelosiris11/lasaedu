import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  addDoc
} from 'firebase/firestore';
import { db } from '@app/config/firebase';
import type { 
  Assessment, 
  Question, 
  QuestionBank, 
  AttemptResult, 
  AssessmentAnalytics 
} from '@shared/types/assessment';

class AssessmentService {
  // Assessment CRUD Operations
  async createAssessment(assessment: Omit<Assessment, 'id'>): Promise<Assessment> {
    const docRef = await addDoc(collection(db, 'assessments'), {
      ...assessment,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    return {
      id: docRef.id,
      ...assessment,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  async getAssessment(id: string): Promise<Assessment | null> {
    const docRef = doc(db, 'assessments', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Assessment;
    }
    return null;
  }

  async updateAssessment(id: string, updates: Partial<Assessment>): Promise<void> {
    const docRef = doc(db, 'assessments', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Date.now()
    });
  }

  async deleteAssessment(id: string): Promise<void> {
    const docRef = doc(db, 'assessments', id);
    await deleteDoc(docRef);
  }

  async getAssessmentsByCourse(courseId: string): Promise<Assessment[]> {
    const q = query(
      collection(db, 'assessments'),
      where('courseId', '==', courseId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Assessment));
  }

  async getAssessmentsByModule(moduleId: string): Promise<Assessment[]> {
    const q = query(
      collection(db, 'assessments'),
      where('moduleId', '==', moduleId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Assessment));
  }

  // Question Bank Operations
  async createQuestionBank(bank: Omit<QuestionBank, 'id'>): Promise<QuestionBank> {
    const docRef = await addDoc(collection(db, 'questionBanks'), {
      ...bank,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    return {
      id: docRef.id,
      ...bank,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  async getQuestionBank(id: string): Promise<QuestionBank | null> {
    const docRef = doc(db, 'questionBanks', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as QuestionBank;
    }
    return null;
  }

  async updateQuestionBank(id: string, updates: Partial<QuestionBank>): Promise<void> {
    const docRef = doc(db, 'questionBanks', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Date.now()
    });
  }

  async getQuestionBanksByUser(userId: string): Promise<QuestionBank[]> {
    const q = query(
      collection(db, 'questionBanks'),
      where('createdBy', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as QuestionBank));
  }

  async addQuestionToBank(bankId: string, question: Question): Promise<void> {
    const bank = await this.getQuestionBank(bankId);
    if (!bank) throw new Error('Question bank not found');

    const updatedQuestions = [...bank.questions, question];
    await this.updateQuestionBank(bankId, { 
      questions: updatedQuestions 
    });
  }

  async removeQuestionFromBank(bankId: string, questionId: string): Promise<void> {
    const bank = await this.getQuestionBank(bankId);
    if (!bank) throw new Error('Question bank not found');

    const updatedQuestions = bank.questions.filter(q => q.id !== questionId);
    await this.updateQuestionBank(bankId, { 
      questions: updatedQuestions 
    });
  }

  async updateQuestionInBank(bankId: string, question: Question): Promise<void> {
    const bank = await this.getQuestionBank(bankId);
    if (!bank) throw new Error('Question bank not found');

    const updatedQuestions = bank.questions.map(q => 
      q.id === question.id ? question : q
    );
    await this.updateQuestionBank(bankId, { 
      questions: updatedQuestions 
    });
  }

  // Assessment Attempt Operations
  async startAssessmentAttempt(
    assessmentId: string, 
    userId: string
  ): Promise<AttemptResult> {
    // Check if user can start new attempt
    const existingAttempts = await this.getUserAttempts(assessmentId, userId);
    const assessment = await this.getAssessment(assessmentId);
    
    if (!assessment) throw new Error('Assessment not found');
    
    if (assessment.settings.attempts && existingAttempts.length >= assessment.settings.attempts) {
      throw new Error('Maximum attempts reached');
    }

    const attempt: Omit<AttemptResult, 'id'> = {
      assessmentId,
      userId,
      attemptNumber: existingAttempts.length + 1,
      startedAt: Date.now(),
      timeSpent: 0,
      status: 'in_progress',
      answers: {},
      maxScore: assessment.questions.reduce((sum, q) => sum + q.points, 0)
    };

    const docRef = await addDoc(collection(db, 'assessmentAttempts'), attempt);
    
    return {
      id: docRef.id,
      ...attempt
    };
  }

  async submitAssessmentAttempt(
    attemptId: string, 
    answers: Record<string, any>
  ): Promise<AttemptResult> {
    const docRef = doc(db, 'assessmentAttempts', attemptId);
    const attemptDoc = await getDoc(docRef);
    
    if (!attemptDoc.exists()) {
      throw new Error('Attempt not found');
    }

    const attempt = attemptDoc.data() as AttemptResult;
    const assessment = await this.getAssessment(attempt.assessmentId);
    
    if (!assessment) throw new Error('Assessment not found');

    // Calculate score
    const { score, percentage, feedback } = this.calculateScore(assessment, answers);

    const updatedAttempt: Partial<AttemptResult> = {
      submittedAt: Date.now(),
      timeSpent: Date.now() - attempt.startedAt,
      status: 'submitted',
      answers,
      score,
      percentage,
      feedback
    };

    await updateDoc(docRef, updatedAttempt);
    
    return {
      ...attempt,
      ...updatedAttempt,
      id: attemptId
    } as AttemptResult;
  }

  async getAttemptResult(attemptId: string): Promise<AttemptResult | null> {
    const docRef = doc(db, 'assessmentAttempts', attemptId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as AttemptResult;
    }
    return null;
  }

  async getUserAttempts(assessmentId: string, userId: string): Promise<AttemptResult[]> {
    const q = query(
      collection(db, 'assessmentAttempts'),
      where('assessmentId', '==', assessmentId),
      where('userId', '==', userId),
      orderBy('attemptNumber', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AttemptResult));
  }

  async getAllAttempts(assessmentId: string): Promise<AttemptResult[]> {
    const q = query(
      collection(db, 'assessmentAttempts'),
      where('assessmentId', '==', assessmentId),
      orderBy('submittedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AttemptResult));
  }

  // Scoring and Grading
  private calculateScore(
    assessment: Assessment, 
    answers: Record<string, any>
  ): { score: number; percentage: number; feedback: string } {
    let totalScore = 0;
    let maxScore = 0;
    const feedback: string[] = [];

    // Get questions from assessment
    const questions = this.getQuestionsFromAssessment(assessment);

    for (const assessmentQuestion of assessment.questions) {
      const question = questions.find(q => q.id === assessmentQuestion.questionId);
      if (!question) continue;

      const userAnswer = answers[question.id];
      const questionPoints = assessmentQuestion.points;
      maxScore += questionPoints;

      const { points } = this.scoreQuestion(question, userAnswer);
      const earnedPoints = (points / question.points) * questionPoints;
      totalScore += earnedPoints;

      if (question.explanation) {
        feedback.push(`Pregunta ${assessmentQuestion.order}: ${question.explanation}`);
      }
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    return {
      score: Math.round(totalScore * 100) / 100,
      percentage,
      feedback: feedback.join('\n\n')
    };
  }

  private scoreQuestion(
    question: Question, 
    userAnswer: any
  ): { points: number; isCorrect: boolean } {
    switch (question.type) {
      case 'single_choice':
        const correctOption = question.options?.find(opt => opt.isCorrect);
        const isCorrect = userAnswer === correctOption?.id;
        return { 
          points: isCorrect ? question.points : 0, 
          isCorrect 
        };

      case 'multiple_choice':
        const correctIds = question.options?.filter(opt => opt.isCorrect).map(opt => opt.id) || [];
        const userAnswerArray = Array.isArray(userAnswer) ? userAnswer : [];
        
        const correctSelected = userAnswerArray.filter(id => correctIds.includes(id)).length;
        const incorrectSelected = userAnswerArray.filter(id => !correctIds.includes(id)).length;
        
        // Partial credit for multiple choice
        if (question.metadata?.partialCredit) {
          const maxPoints = correctIds.length;
          const earnedPoints = Math.max(0, correctSelected - incorrectSelected);
          const percentage = earnedPoints / maxPoints;
          return { 
            points: percentage * question.points, 
            isCorrect: percentage === 1 
          };
        } else {
          const allCorrect = correctSelected === correctIds.length && incorrectSelected === 0;
          return { 
            points: allCorrect ? question.points : 0, 
            isCorrect: allCorrect 
          };
        }

      case 'true_false':
        const isTrueFalseCorrect = userAnswer === question.correctAnswer;
        return { 
          points: isTrueFalseCorrect ? question.points : 0, 
          isCorrect: isTrueFalseCorrect 
        };

      case 'short_answer':
        const userText = (userAnswer || '').toString().trim();
        const correctText = (question.correctAnswer || '').toString().trim();
        
        let isTextCorrect;
        if (question.metadata?.caseSensitive) {
          isTextCorrect = userText === correctText;
        } else {
          isTextCorrect = userText.toLowerCase() === correctText.toLowerCase();
        }
        
        return { 
          points: isTextCorrect ? question.points : 0, 
          isCorrect: isTextCorrect 
        };

      case 'long_answer':
      case 'essay':
      case 'file_upload':
        // These require manual grading
        return { 
          points: 0, 
          isCorrect: false 
        };

      default:
        return { 
          points: 0, 
          isCorrect: false 
        };
    }
  }

  private getQuestionsFromAssessment(_assessment: Assessment): Question[] {
    // This would typically fetch from question banks
    // For now, return empty array - implement based on your data structure
    return [];
  }

  // Analytics
  async getAssessmentAnalytics(assessmentId: string): Promise<AssessmentAnalytics> {
    const attempts = await this.getAllAttempts(assessmentId);
    
    const totalAttempts = attempts.length;
    const completedAttempts = attempts.filter(a => a.status === 'submitted' || a.status === 'graded');
    
    const averageScore = completedAttempts.length > 0 
      ? completedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / completedAttempts.length
      : 0;

    const averageTimeSpent = completedAttempts.length > 0
      ? completedAttempts.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / completedAttempts.length
      : 0;

    const assessment = await this.getAssessment(assessmentId);
    const passingScore = assessment?.grading.passingScore || 70;
    const passedAttempts = completedAttempts.filter(a => (a.percentage || 0) >= passingScore);
    const passRate = completedAttempts.length > 0 ? (passedAttempts.length / completedAttempts.length) * 100 : 0;

    return {
      assessmentId,
      totalAttempts,
      averageScore,
      averageTimeSpent,
      passRate,
      questionAnalytics: [], // Implement detailed question analytics
      difficultyDistribution: {},
      submissionTrend: []
    };
  }
}

export const assessmentService = new AssessmentService();
export default assessmentService;