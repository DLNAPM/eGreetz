
export interface Greeting {
  id?: string;
  occasion: string;
  message: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  voiceGender: VoiceGender;
  voiceType: VoiceType;
  createdAt: number; // Timestamp
}

export enum VoiceGender {
  Male = 'Male',
  Female = 'Female',
}

export enum VoiceType {
  Tenor = 'Tenor',
  Bass = 'Bass',
  Kore = 'Kore', // Example female voice
  Puck = 'Puck', // Example female voice
  Zephyr = 'Zephyr', // Example neutral voice
  Charon = 'Charon', // Example male voice
  Fenrir = 'Fenrir', // Example male voice
}

// Global window object augmentation for AI Studio specific functions
export interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    aistudio?: AIStudio;
  }
}
// Ensures the file is treated as a module to avoid global declaration conflicts.
export {};