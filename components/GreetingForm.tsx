
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Button from './Button';
import { Greeting, VoiceGender, VoiceType } from '../types';
import {
  GREETING_OCCASIONS,
  VOICE_OPTIONS,
  getVoiceConfig,
  VIDEO_BACKGROUND_PROMPTS,
  MAX_MESSAGE_LENGTH,
  AUDIO_SAMPLE_RATE,
  OUTPUT_AUDIO_SAMPLE_RATE,
} from '../constants';
import * as firebaseService from '../services/firebaseService';
import {
  GoogleGenAI,
  Modality,
  LiveServerMessage,
  VideoGenerationReferenceType,
} from '@google/genai';
import {
  encode,
  decode,
  decodeAudioData,
  createAudioBlob,
  getOutputAudioContext,
  playAudioBuffer,
  stopAllAudio,
} from '../utils/audioUtils';
import { fileToBase64 } from '../utils/imageUtils';

interface GreetingFormProps {
  onGreetingCreated: (greeting: Greeting) => void;
  getGenAIInstance: () => GoogleGenAI;
  onApiKeyPrompt: () => void;
}

const GreetingForm: React.FC<GreetingFormProps> = ({
  onGreetingCreated,
  getGenAIInstance,
  onApiKeyPrompt,
}) => {
  const [occasion, setOccasion] = useState(GREETING_OCCASIONS[0]);
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [voiceGender, setVoiceGender] = useState<VoiceGender>(VoiceGender.Male);
  const [voiceType, setVoiceType] = useState<VoiceType>(
    VOICE_OPTIONS[VoiceGender.Male][0].value
  );

  const [isRecording, setIsRecording] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioChunks, setAudioChunks] = useState<Float32Array[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const liveSessionRef = useRef<Promise<any> | null>(null); // To hold the promise of the live session

  const [loadingAudio, setLoadingAudio] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoGenerationMessage, setVideoGenerationMessage] = useState<string | null>(null);

  // AudioContext for microphone input
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const resetForm = useCallback(() => {
    setOccasion(GREETING_OCCASIONS[0]);
    setMessage('');
    setImageFile(null);
    setPreviewImageUrl(null);
    setVoiceGender(VoiceGender.Male);
    setVoiceType(VOICE_OPTIONS[VoiceGender.Male][0].value);
    setIsRecording(false);
    setAudioChunks([]);
    setError(null);
    setVideoGenerationMessage(null);
    stopAllAudio(); // Stop any playing audio
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
      setAudioStream(null);
    }
    if (liveSessionRef.current) {
      liveSessionRef.current.then((session: any) => session.close());
      liveSessionRef.current = null;
    }
  }, [audioStream]);

  // Handle voice type options changing with gender
  useEffect(() => {
    const defaultVoice = VOICE_OPTIONS[voiceGender][0].value;
    setVoiceType(defaultVoice);
  }, [voiceGender]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setPreviewImageUrl(URL.createObjectURL(file));
    } else {
      setImageFile(null);
      setPreviewImageUrl(null);
    }
  };

  const startRecording = async () => {
    setError(null);
    stopAllAudio(); // Stop any ongoing audio playback

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      setIsRecording(true);
      setAudioChunks([]); // Clear previous chunks

      // Initialize AudioContext and ScriptProcessor for real-time processing
      // Initializes a new AudioContext for input audio, ensuring deprecated `window.webkitAudioContext` is not used.
      inputAudioContextRef.current =
        inputAudioContextRef.current || new window.AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
      const input = inputAudioContextRef.current;

      const source = input.createMediaStreamSource(stream);
      scriptProcessorRef.current = input.createScriptProcessor(4096, 1, 1);

      scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        setAudioChunks((prev) => [...prev, new Float32Array(inputData)]);

        // Send to Live API if session is active
        if (liveSessionRef.current) {
          liveSessionRef.current.then((session) => {
            session.sendRealtimeInput({ media: createAudioBlob(inputData, AUDIO_SAMPLE_RATE) });
          });
        }
      };

      source.connect(scriptProcessorRef.current);
      scriptProcessorRef.current.connect(input.destination);

      // Start Live API session
      const ai = getGenAIInstance();
      const outputAudioContext = getOutputAudioContext();
      let nextStartTime = 0; // Local for this recording session

      liveSessionRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.debug('Live session opened');
            // If message is pre-filled, send it as initial input
            if (message) {
              liveSessionRef.current?.then((session) => {
                session.sendRealtimeInput({ text: message });
              });
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Process model's audio output
            const base64Audio =
              msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                outputAudioContext,
                OUTPUT_AUDIO_SAMPLE_RATE,
                1
              );
              // Use a local nextStartTime for sequential playback within this stream
              nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
              const source = outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputAudioContext.destination);
              source.start(nextStartTime);
              nextStartTime += audioBuffer.duration;
            }

            // Update transcription in the message input field (optional, but good for UX)
            if (msg.serverContent?.inputTranscription?.text) {
              setMessage(msg.serverContent.inputTranscription.text);
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Live session error:', e);
            setError(`Microphone error: ${e.message}`);
            stopRecording();
          },
          onclose: (e: CloseEvent) => {
            console.debug('Live session closed');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: getVoiceConfig(voiceGender, voiceType),
          },
          inputAudioTranscription: {}, // Enable transcription for user input
        },
      });
    } catch (err: any) {
      console.error('Error starting recording:', err);
      setError(`Failed to start microphone: ${err.message}. Please ensure microphone access is granted.`);
      setIsRecording(false);
    }
  };

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
      setAudioStream(null);
    }
    if (inputAudioContextRef.current) {
      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
      }
      // inputAudioContextRef.current.close(); // Don't close immediately to avoid issues if restarting quickly
      // inputAudioContextRef.current = null;
    }
    if (liveSessionRef.current) {
      liveSessionRef.current.then((session: any) => session.close());
      liveSessionRef.current = null;
    }
  }, [audioStream]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  const generateGreeting = async () => {
    setError(null);
    stopAllAudio();
    if (!message.trim()) {
      setError('Please type a message or speak into the microphone.');
      return;
    }

    try {
      setLoadingAudio(true);
      setLoadingVideo(true);
      const ai = getGenAIInstance();
      let uploadedImageUrl: string | undefined;

      if (imageFile) {
        setVideoGenerationMessage('Uploading image...');
        uploadedImageUrl = await firebaseService.uploadImage(imageFile);
      }

      setVideoGenerationMessage('Generating audio for your message...');
      // 1. Generate Audio (Text-to-Speech)
      const audioResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: message }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: getVoiceConfig(voiceGender, voiceType),
          },
        },
      });

      const base64Audio = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error('Could not generate audio from message.');
      }
      // Store as data URL for immediate playback in GreetingCard
      const audioUrl = `data:audio/pcm;base64,${base64Audio}`; 
      console.log(`Generated audio base64 string length: ${base64Audio.length}`);


      setLoadingAudio(false);
      setVideoGenerationMessage('Audio generated. Now generating cinematic video (this may take a few minutes)...');

      // 2. Generate Video
      await onApiKeyPrompt(); // Ensure API key is selected before generating video

      const videoPrompt = VIDEO_BACKGROUND_PROMPTS[occasion] || VIDEO_BACKGROUND_PROMPTS.Default;
      const veoModel = 'veo-3.1-fast-generate-preview'; // Default for general video generation
      let operation;

      const baseVideoPayload = {
        model: veoModel,
        prompt: videoPrompt,
        audio: { // Include the generated audio in the video payload
          audioBytes: base64Audio,
          mimeType: `audio/pcm;rate=${OUTPUT_AUDIO_SAMPLE_RATE}`, // Correct MIME type for the generated PCM audio
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9',
        },
      };

      let videoGenerationRequest;

      // For more complex scenarios, prompt can be combined with image
      if (uploadedImageUrl) {
        const imageBytes = (await fetch(uploadedImageUrl).then(res => res.blob()).then(blobToBase64)); // Convert back to base64 for API
        videoGenerationRequest = {
          ...baseVideoPayload,
          image: {
            imageBytes: imageBytes,
            mimeType: imageFile!.type,
          },
        };
      } else {
        videoGenerationRequest = baseVideoPayload;
      }

      console.log("Sending video generation request payload:", videoGenerationRequest);
      operation = await ai.models.generateVideos(videoGenerationRequest);


      while (!operation.done) {
        setVideoGenerationMessage(`Generating video... Please wait (status: ${operation.metadata?.state || 'in progress'}).`);
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Poll every 10 seconds
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) {
        throw new Error('Could not generate video.');
      }

      // The downloadLink needs the API key appended for fetching in a browser environment
      const videoUrl = `${downloadLink}&key=${process.env.API_KEY}`;

      setVideoGenerationMessage(null);
      setLoadingVideo(false);

      // 3. Save Greeting to Firebase
      const newGreeting: Omit<Greeting, 'id' | 'createdAt'> = {
        occasion,
        message,
        imageUrl: uploadedImageUrl,
        audioUrl,
        videoUrl,
        voiceGender,
        voiceType,
      };
      const savedGreeting = await firebaseService.addGreeting(newGreeting);
      onGreetingCreated(savedGreeting);
      resetForm(); // Clear the form after successful creation
    } catch (e: any) {
      console.error('Error generating greeting:', e);
      setError(`Failed to generate greeting: ${e.message}. If generating a video, ensure a paid API key is selected.`);
      // If "Requested entity was not found", it means API key might be invalid or not selected.
      if (e.message.includes("Requested entity was not found.")) {
        onApiKeyPrompt();
      }
    } finally {
      setLoadingAudio(false);
      setLoadingVideo(false);
      setVideoGenerationMessage(null);
    }
  };

  const isGenerating = loadingAudio || loadingVideo;

  return (
    <div className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-lg mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Occasion */}
        <div>
          <label htmlFor="occasion" className="block text-gray-300 text-sm font-bold mb-2">
            Occasion
          </label>
          <select
            id="occasion"
            className="shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 bg-gray-700 text-white leading-tight focus:outline-none focus:shadow-outline focus:border-indigo-500"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            disabled={isGenerating}
          >
            {GREETING_OCCASIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        {/* Voice Gender */}
        <div>
          <label htmlFor="voiceGender" className="block text-gray-300 text-sm font-bold mb-2">
            Voice Gender
          </label>
          <select
            id="voiceGender"
            className="shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 bg-gray-700 text-white leading-tight focus:outline-none focus:shadow-outline focus:border-indigo-500"
            value={voiceGender}
            onChange={(e) => setVoiceGender(e.target.value as VoiceGender)}
            disabled={isGenerating}
          >
            {Object.values(VoiceGender).map((gender) => (
              <option key={gender} value={gender}>
                {gender}
              </option>
            ))}
          </select>
        </div>

        {/* Voice Type */}
        <div>
          <label htmlFor="voiceType" className="block text-gray-300 text-sm font-bold mb-2">
            Voice Type
          </label>
          <select
            id="voiceType"
            className="shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 bg-gray-700 text-white leading-tight focus:outline-none focus:shadow-outline focus:border-indigo-500"
            value={voiceType}
            onChange={(e) => setVoiceType(e.target.value as VoiceType)}
            disabled={isGenerating}
          >
            {VOICE_OPTIONS[voiceGender].map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Image Upload */}
        <div>
          <label htmlFor="imageUpload" className="block text-gray-300 text-sm font-bold mb-2">
            Upload Image (Optional)
          </label>
          <input
            id="imageUpload"
            type="file"
            accept="image/*"
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 bg-gray-700 rounded-md cursor-pointer focus:outline-none"
            onChange={handleImageChange}
            disabled={isGenerating}
            aria-describedby="image-upload-description"
          />
          <p id="image-upload-description" className="text-xs text-gray-500 mt-1">
            Max file size: 5MB. The image will be incorporated into the video; it will not lip-sync.
          </p>
          {previewImageUrl && (
            <div className="mt-4">
              <img src={previewImageUrl} alt="Preview" className="max-w-xs h-auto rounded-md shadow-md mx-auto" />
            </div>
          )}
        </div>
      </div>

      {/* Message Input */}
      <div className="mt-6">
        <label htmlFor="message" className="block text-gray-300 text-sm font-bold mb-2">
          Your Message ({message.length}/{MAX_MESSAGE_LENGTH} words)
        </label>
        <textarea
          id="message"
          className="shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 bg-gray-700 text-white leading-tight focus:outline-none focus:shadow-outline focus:border-indigo-500 h-32 resize-y"
          placeholder="Type your heartfelt message here..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={isGenerating || isRecording}
          aria-describedby="message-help-text"
        ></textarea>
        <p id="message-help-text" className="text-xs text-gray-500 mt-1">
          You can type your message or use the microphone.
        </p>
      </div>

      {/* Microphone Input */}
      <div className="mt-4 flex flex-col sm:flex-row gap-4 justify-center items-center">
        <Button
          onClick={isRecording ? stopRecording : startRecording}
          variant={isRecording ? 'danger' : 'secondary'}
          disabled={isGenerating}
          className="flex items-center justify-center w-full sm:w-auto"
          aria-label={isRecording ? 'Stop recording message' : 'Start recording message'}
        >
          {isRecording ? (
            <>
              <svg className="animate-pulse h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="8" />
              </svg>
              Stop Recording
            </>
          ) : (
            <>
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                  clipRule="evenodd"
                />
              </svg>
              Record Message
            </>
          )}
        </Button>
      </div>

      {error && (
        <div
          className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded relative mt-6"
          role="alert"
        >
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline ml-2">{error}</span>
        </div>
      )}

      {videoGenerationMessage && (
        <div
          className="bg-blue-900 border border-blue-700 text-blue-200 px-4 py-3 rounded relative mt-6"
          role="status"
          aria-live="polite"
        >
          <strong className="font-bold">Processing:</strong>
          <span className="block sm:inline ml-2">{videoGenerationMessage}</span>
        </div>
      )}

      <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          onClick={generateGreeting}
          loading={isGenerating}
          disabled={message.length === 0}
          fullWidth
          aria-label="Generate greeting video and audio"
        >
          Generate Greeting
        </Button>
        <Button
          onClick={resetForm}
          variant="secondary"
          disabled={isGenerating}
          fullWidth
          aria-label="Refresh and start a new greeting"
        >
          Refresh/Restart
        </Button>
      </div>
    </div>
  );
};

export default GreetingForm;

// Helper to convert Blob to base64 for image upload to GenAI
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Extract base64 part
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};