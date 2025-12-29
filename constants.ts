
import { VoiceGender, VoiceType } from './types';
// No import from '@google/genai' for VoiceConfig, as the local definition was incorrect and the SDK expects a different structure.

export const GREETING_OCCASIONS = [
  'Happy Birthday',
  'Merry Christmas',
  'Happy Anniversary',
  'Happy New Years',
  'Congratulations on your Promotions',
  'Congratulations on your Graduation',
];

export const VOICE_OPTIONS = {
  [VoiceGender.Male]: [
    { label: 'Tenor (Zephyr)', value: VoiceType.Zephyr },
    { label: 'Bass (Charon)', value: VoiceType.Charon },
    { label: 'Fenrir', value: VoiceType.Fenrir }, // Another male option
  ],
  [VoiceGender.Female]: [
    { label: 'Kore', value: VoiceType.Kore },
    { label: 'Puck', value: VoiceType.Puck },
  ],
};

// Map VoiceType to actual voiceName for TTS API
// Returns the structure expected by the GenAI SDK's speechConfig for prebuilt voices.
export const getVoiceConfig = (gender: VoiceGender, type: VoiceType) => {
  let voiceName: string;
  switch (type) {
    case VoiceType.Zephyr:
      voiceName = 'Zephyr';
      break;
    case VoiceType.Charon:
      voiceName = 'Charon';
      break;
    case VoiceType.Fenrir:
      voiceName = 'Fenrir';
      break;
    case VoiceType.Kore:
      voiceName = 'Kore';
      break;
    case VoiceType.Puck:
      voiceName = 'Puck';
      break;
    default:
      // Default to a sensible fallback if type isn't recognized
      voiceName = gender === VoiceGender.Male ? 'Zephyr' : 'Kore';
      break;
  }
  return { prebuiltVoiceConfig: { voiceName } };
};


export const VIDEO_BACKGROUND_PROMPTS: { [key: string]: string } = {
  'Happy Birthday': 'Background video of colorful balloons dropping and confetti falling with festive lights.',
  'Merry Christmas': 'Background video of gentle snowfall, twinkling Christmas lights, and a cozy fireplace scene.',
  'Happy Anniversary': 'Background video of elegant rose petals falling, soft romantic lighting, and subtle sparkles.',
  'Happy New Years': 'Background video of vibrant fireworks exploding in the night sky, champagne popping, and noise makers.',
  'Congratulations on your Promotions': 'Background video of shimmering golden confetti, subtle celebratory lights, and a sophisticated atmosphere.',
  'Congratulations on your Graduation': 'Background video of graduation caps being thrown in the air, joyous crowds cheering, and bright sunshine.',
  'Default': 'A cheerful and celebratory background with dynamic lights and abstract shapes.', // Fallback for any unlisted occasion
};

export const MAX_MESSAGE_LENGTH = 1000;
export const AUDIO_SAMPLE_RATE = 16000;
export const OUTPUT_AUDIO_SAMPLE_RATE = 24000;