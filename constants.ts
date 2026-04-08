
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
  'Happy Birthday': 'Colorful balloons and confetti.',
  'Merry Christmas': 'Gentle snowfall and twinkling lights.',
  'Happy Anniversary': 'Elegant rose petals falling.',
  'Happy New Years': 'Vibrant fireworks in the night sky.',
  'Congratulations on your Promotions': 'Shimmering golden confetti.',
  'Congratulations on your Graduation': 'Graduation caps in the air.',
  'Default': 'A cheerful celebratory background.',
};

export const MAX_MESSAGE_LENGTH = 1000;
export const AUDIO_SAMPLE_RATE = 16000;
export const OUTPUT_AUDIO_SAMPLE_RATE = 24000;