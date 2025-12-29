
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Greeting } from '../types';
import Button from './Button';
import { getOutputAudioContext, playAudioBuffer, decodeAudioData, decode, stopAllAudio } from '../utils/audioUtils';
import { OUTPUT_AUDIO_SAMPLE_RATE } from '../constants';

interface GreetingCardProps {
  greeting: Greeting;
  onDelete: (id: string) => void;
}

const GreetingCard: React.FC<GreetingCardProps> = ({ greeting, onDelete }) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Function to play audio from base64 PCM data
  const handlePlayAudio = useCallback(async () => {
    if (!greeting.audioUrl) return;

    stopAllAudio(); // Stop any other playing audio
    setIsPlayingAudio(true);

    // If it's a data URL, decode and play as PCM
    if (greeting.audioUrl.startsWith('data:audio/pcm;base64,')) {
      const base64Audio = greeting.audioUrl.split(',')[1];
      try {
        const audioBuffer = await decodeAudioData(
          decode(base64Audio),
          getOutputAudioContext(),
          OUTPUT_AUDIO_SAMPLE_RATE,
          1
        );
        const source = getOutputAudioContext().createBufferSource();
        source.buffer = audioBuffer;
        source.connect(getOutputAudioContext().destination);
        source.onended = () => setIsPlayingAudio(false);
        source.start();
        // Add to global set for stopAllAudio functionality if needed
        // (This would require modifying stopAllAudio in audioUtils to accept specific sources or clear all)
      } catch (error) {
        console.error('Error playing PCM audio:', error);
        setIsPlayingAudio(false);
      }
    } else {
      // For standard audio formats if we ever generated them
      if (audioRef.current) {
        audioRef.current.src = greeting.audioUrl;
        audioRef.current.play().catch(e => console.error("Error playing audio:", e));
      }
    }
  }, [greeting.audioUrl]);

  const handlePauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    stopAllAudio(); // Stop custom PCM playback too
    setIsPlayingAudio(false);
  }, []);

  useEffect(() => {
    // Event listener for <audio> element to update state
    const audioEl = audioRef.current;
    if (audioEl) {
      const onEnded = () => setIsPlayingAudio(false);
      const onPlay = () => setIsPlayingAudio(true);
      const onPause = () => setIsPlayingAudio(false);
      audioEl.addEventListener('ended', onEnded);
      audioEl.addEventListener('play', onPlay);
      audioEl.addEventListener('pause', onPause);
      return () => {
        audioEl.removeEventListener('ended', onEnded);
        audioEl.removeEventListener('play', onPlay);
        audioEl.removeEventListener('pause', onPause);
      };
    }
  }, []);

  const formattedDate = new Date(greeting.createdAt).toLocaleString();

  return (
    <div className="relative bg-gray-800 rounded-lg shadow-xl p-6 mb-6 border border-gray-700 overflow-hidden">
      <h3 className="text-3xl font-bold text-center text-indigo-300 mb-4">{greeting.occasion}</h3>
      <p className="text-gray-300 text-center text-sm mb-2">Created: {formattedDate}</p>

      {greeting.imageUrl && (
        <div className="mb-4 flex justify-center">
          <img
            src={greeting.imageUrl}
            alt="User Upload"
            className="max-w-full h-auto max-h-64 object-cover rounded-md shadow-md border border-gray-600"
            loading="lazy"
          />
        </div>
      )}

      <p className="text-gray-200 text-lg mb-4 text-center">{greeting.message}</p>

      <div className="flex flex-col sm:flex-row justify-center gap-4 mt-4">
        {greeting.audioUrl && (
          <Button onClick={isPlayingAudio ? handlePauseAudio : handlePlayAudio} className="w-full sm:w-auto">
            {isPlayingAudio ? (
              <>
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg> Pause Audio
              </>
            ) : (
              <>
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg> Play Audio
              </>
            )}
          </Button>
        )}

        {greeting.videoUrl && (
          <>
            <Button
              onClick={() => {
                videoRef.current?.requestFullscreen();
                videoRef.current?.play();
              }}
              className="w-full sm:w-auto"
            >
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 01-2 2h-4a2 2 0 01-2-2V6zM2 14a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2zM14 14a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2z" />
              </svg>
              Play Cinematic Video
            </Button>
            <video ref={videoRef} src={greeting.videoUrl} controls className="hidden w-full max-w-lg mx-auto mt-4 rounded-md shadow-lg" aria-label="Cinematic greeting video"></video>
          </>
        )}
      </div>

      <div className="absolute bottom-2 right-2 text-gray-500 text-xs italic opacity-80">
        created by e-Greetz
      </div>

      <Button
        onClick={() => greeting.id && onDelete(greeting.id)}
        variant="danger"
        className="absolute top-4 right-4 p-2 rounded-full text-sm"
        aria-label={`Delete greeting for ${greeting.occasion}`}
        title="Delete Greeting"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z" clipRule="evenodd" />
        </svg>
      </Button>
      {/* Hidden audio element for browser's native controls if needed (e.g., for non-PCM audio) */}
      <audio ref={audioRef} className="hidden" onEnded={() => setIsPlayingAudio(false)}></audio>
    </div>
  );
};

export default GreetingCard;
