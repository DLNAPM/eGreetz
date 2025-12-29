

import { Blob } from '@google/genai';
import { OUTPUT_AUDIO_SAMPLE_RATE } from '../constants';

/**
 * Encodes a Uint8Array to a base64 string.
 * This is a custom implementation required by the GenAI SDK, not js-base64.
 * @param bytes The Uint8Array to encode.
 * @returns Base64 encoded string.
 */
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a base64 string into a Uint8Array.
 * This is a custom implementation required by the GenAI SDK, not js-base64.
 * @param base64 The base64 string to decode.
 * @returns Decoded Uint8Array.
 */
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer suitable for Web Audio API playback.
 * This is a custom implementation required by the GenAI SDK for raw PCM.
 * @param data Raw PCM audio data as Uint8Array.
 * @param ctx AudioContext to create the buffer.
 * @param sampleRate Sample rate of the audio data.
 * @param numChannels Number of audio channels.
 * @returns Promise resolving to an AudioBuffer.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Creates a Blob object for audio input, encoding Float32Array to Int16Array PCM.
 * @param data Audio data as Float32Array.
 * @param sampleRate Sample rate of the audio (e.g., 16000 for Live API).
 * @returns Blob object with base64 encoded PCM data.
 */
export function createAudioBlob(data: Float32Array, sampleRate: number): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768; // Convert float to 16-bit signed integer
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: `audio/pcm;rate=${sampleRate}`,
  };
}

// Global variable to hold the output audio context
let outputAudioContext: AudioContext | null = null;

// Initialize and return the singleton output AudioContext
export function getOutputAudioContext(): AudioContext {
  if (!outputAudioContext) {
    // Initializes a new AudioContext for output audio, ensuring deprecated `window.webkitAudioContext` is not used.
    outputAudioContext = new window.AudioContext({
      sampleRate: OUTPUT_AUDIO_SAMPLE_RATE,
    });
  }
  return outputAudioContext;
}

// Function to stop all playing audio sources
let audioSources = new Set<AudioBufferSourceNode>();
export function stopAllAudio() {
  for (const source of audioSources.values()) {
    try {
      source.stop();
    } catch (error) {
      // console.warn('Error stopping audio source:', error);
    }
  }
  audioSources.clear();
}

// Function to play audio buffer
let nextStartTime = 0; // Global to ensure sequential playback
export async function playAudioBuffer(audioBuffer: AudioBuffer) {
  const ctx = getOutputAudioContext();
  nextStartTime = Math.max(nextStartTime, ctx.currentTime);

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination); // Connect directly to destination for playback

  source.addEventListener('ended', () => {
    audioSources.delete(source);
  });

  source.start(nextStartTime);
  nextStartTime += audioBuffer.duration;
  audioSources.add(source);
}