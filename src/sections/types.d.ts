declare global {
  interface Document {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void>;
    mozFullScreenElement?: Element | null;
    mozCancelFullScreen?: () => Promise<void>;
    msFullscreenElement?: Element | null;
    msExitFullscreen?: () => Promise<void>;
  }
  
  interface HTMLElement {
    webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
    mozRequestFullScreen?: (options?: FullscreenOptions) => Promise<void>;
    msRequestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
  }

  type ExamData = {
    endTime: string | number | Date;
    score: {
      correctAnswers: number;
      totalQuestions: number;
      overallPercentage: number;
    };
    timeSpent: number;
    // Agrega aquí cualquier otro campo que uses de existingExamData
  };
}

export {};