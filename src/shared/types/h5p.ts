/**
 * Tipos para contenido interactivo H5P
 */

export type H5PContentType =
  | 'H5P.MultiChoice'
  | 'H5P.TrueFalse'
  | 'H5P.Blanks'
  | 'H5P.DragQuestion'
  | 'H5P.DragText'
  | 'H5P.Flashcards'
  | 'H5P.CoursePresentation'
  | 'H5P.InteractiveVideo'
  | 'H5P.MarkTheWords'
  | 'H5P.MemoryGame'
  | 'H5P.QuestionSet'
  | 'H5P.Summary'
  | 'H5P.Timeline'
  | 'H5P.Accordion'
  | 'H5P.ImageHotspots'
  | string; // Permitir tipos custom

export interface H5PContentMeta {
  id: string;
  title: string;
  description?: string;
  mainLibrary: string;
  contentType: H5PContentType;
  storageBasePath: string;
  fileSize: number;
  previewImageUrl?: string;
  tags: string[];
  isPublished: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface H5PPackageInfo {
  title: string;
  mainLibrary: string;
  preloadedDependencies: {
    machineName: string;
    majorVersion: number;
    minorVersion: number;
  }[];
  language?: string;
  embedTypes?: string[];
}

// =============================================
// TIPOS PARA CREADOR SIMPLIFICADO
// =============================================

export interface H5PMultiChoiceParams {
  question: string;
  answers: { text: string; correct: boolean }[];
  singleAnswer?: boolean;
  tip?: string;
}

export interface H5PTrueFalseParams {
  question: string;
  correct: boolean;
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
}

export interface H5PFillBlanksParams {
  text: string; // Texto con *blancos* marcados con asteriscos: "La capital de Francia es *París*"
  overallFeedback?: string;
  caseSensitive?: boolean;
}

export interface H5PDragDropParams {
  taskDescription: string;
  items: { text: string; zone: string }[];
  zones: string[];
}

export interface H5PFlashcardsParams {
  description?: string;
  cards: { front: string; back: string }[];
}
