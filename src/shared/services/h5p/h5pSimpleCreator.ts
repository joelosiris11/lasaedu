/**
 * Creador simplificado de contenido H5P
 * Genera paquetes .h5p para tipos básicos sin necesidad del editor H5P completo
 */

import JSZip from 'jszip';
import type {
  H5PMultiChoiceParams,
  H5PTrueFalseParams,
  H5PFillBlanksParams,
  H5PDragDropParams,
  H5PFlashcardsParams,
} from '@shared/types/h5p';

function buildH5PJson(mainLibrary: string, title: string): object {
  return {
    title,
    language: 'es',
    mainLibrary,
    embedTypes: ['div'],
    preloadedDependencies: [
      { machineName: mainLibrary, majorVersion: 1, minorVersion: 0 }
    ]
  };
}

async function buildPackage(contentJson: object, h5pJson: object): Promise<Blob> {
  const zip = new JSZip();
  zip.file('h5p.json', JSON.stringify(h5pJson, null, 2));
  const contentFolder = zip.folder('content')!;
  contentFolder.file('content.json', JSON.stringify(contentJson, null, 2));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
}

export class H5PSimpleCreator {
  async createMultipleChoice(title: string, params: H5PMultiChoiceParams): Promise<Blob> {
    const contentJson = {
      question: `<p>${params.question}</p>`,
      answers: params.answers.map(a => ({
        text: `<p>${a.text}</p>`,
        correct: a.correct,
        tpiAndFeedback: { tip: params.tip || '', chosenFeedback: '', notChosenFeedback: '' }
      })),
      behaviour: {
        singleAnswer: params.singleAnswer ?? true,
        enableRetry: true,
        enableSolutionsButton: true,
        showSolutionsRequiresInput: true,
        autoCheck: false,
        passPercentage: 100,
        randomAnswers: true,
      },
      UI: {
        checkAnswerButton: 'Verificar',
        submitAnswerButton: 'Enviar',
        showSolutionButton: 'Ver solución',
        tryAgainButton: 'Intentar de nuevo',
        tipsLabel: 'Mostrar pista',
        scoreBarLabel: 'Obtuviste :num de :total puntos',
        tipAvailable: 'Pista disponible',
        feedbackAvailable: 'Retroalimentación disponible',
        readFeedback: 'Leer retroalimentación',
        wrongAnswer: 'Respuesta incorrecta',
        correctAnswer: 'Respuesta correcta',
        shouldCheck: 'Debería haber sido marcada',
        shouldNotCheck: 'No debería haber sido marcada',
        noInput: 'Por favor responde antes de ver la solución',
      }
    };

    const h5pJson = buildH5PJson('H5P.MultiChoice', title);
    return buildPackage(contentJson, h5pJson);
  }

  async createTrueFalse(title: string, params: H5PTrueFalseParams): Promise<Blob> {
    const contentJson = {
      question: `<p>${params.question}</p>`,
      correct: params.correct ? 'true' : 'false',
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        confirmCheckDialog: false,
        confirmRetryDialog: false,
      },
      l10n: {
        trueText: 'Verdadero',
        falseText: 'Falso',
        checkAnswer: 'Verificar',
        showSolutionButton: 'Ver solución',
        tryAgain: 'Intentar de nuevo',
        score: 'Obtuviste @score de @total',
        correctAnswer: params.feedbackCorrect || 'Correcto!',
        wrongAnswer: params.feedbackIncorrect || 'Incorrecto.',
      }
    };

    const h5pJson = buildH5PJson('H5P.TrueFalse', title);
    return buildPackage(contentJson, h5pJson);
  }

  async createFillInBlanks(title: string, params: H5PFillBlanksParams): Promise<Blob> {
    const contentJson = {
      text: `<p>${params.text}</p>`,
      overallFeedback: [
        { from: 0, to: 100, feedback: params.overallFeedback || '' }
      ],
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        caseSensitive: params.caseSensitive ?? false,
        autoCheck: false,
        showSolutionsRequiresInput: true,
        acceptSpellingErrors: false,
      },
      l10n: {
        checkAnswer: 'Verificar',
        showSolution: 'Ver solución',
        tryAgain: 'Intentar de nuevo',
        notFilledOut: 'Por favor completa todos los espacios',
        answerIsCorrect: 'Correcto!',
        answerIsWrong: 'Incorrecto',
        answeredCorrectly: 'Respondido correctamente',
        answeredIncorrectly: 'Respondido incorrectamente',
        solutionLabel: 'Solución:',
        inputLabel: 'Espacio en blanco',
        inputHasTipLabel: 'Pista disponible',
        scoreBarLabel: 'Obtuviste :num de :total puntos',
      }
    };

    const h5pJson = buildH5PJson('H5P.Blanks', title);
    return buildPackage(contentJson, h5pJson);
  }

  async createDragAndDrop(title: string, params: H5PDragDropParams): Promise<Blob> {
    const contentJson = {
      taskDescription: `<p>${params.taskDescription}</p>`,
      draggables: params.items.map((item, i) => ({
        id: i,
        label: `<p>${item.text}</p>`,
        elements: [{ dropZone: params.zones.indexOf(item.zone).toString() }]
      })),
      dropZones: params.zones.map((zone, i) => ({
        id: i,
        label: `<p>${zone}</p>`,
        showLabel: true,
        correctElements: params.items
          .map((item, idx) => item.zone === zone ? idx.toString() : null)
          .filter(Boolean)
      })),
      behaviour: {
        enableRetry: true,
        enableCheckButton: true,
        showSolutionsRequiresInput: true,
        singlePoint: false,
        applyPenalties: false,
        enableScoreExplanation: true,
        dropZoneHighlighting: 'dragging',
        autoAlignSpacing: 2,
      },
      localize: {
        checkAnswer: 'Verificar',
        showSolution: 'Ver solución',
        tryAgain: 'Intentar de nuevo',
        scoreBarLabel: 'Obtuviste :num de :total puntos',
      }
    };

    const h5pJson = buildH5PJson('H5P.DragQuestion', title);
    return buildPackage(contentJson, h5pJson);
  }

  async createFlashcards(title: string, params: H5PFlashcardsParams): Promise<Blob> {
    const contentJson = {
      description: params.description || '',
      dialogs: params.cards.map(card => ({
        text: `<p>${card.front}</p>`,
        answer: `<p>${card.back}</p>`,
      })),
      behaviour: {
        caseSensitive: false,
        showSolutionsRequiresInput: true,
      },
      l10n: {
        checkAnswerButton: 'Verificar',
        showSolutionButton: 'Ver respuesta',
        nextButton: 'Siguiente',
        previousButton: 'Anterior',
        resultsMessage: 'Obtuviste :correct de :total',
      }
    };

    const h5pJson = buildH5PJson('H5P.Flashcards', title);
    return buildPackage(contentJson, h5pJson);
  }
}

export const h5pSimpleCreator = new H5PSimpleCreator();
