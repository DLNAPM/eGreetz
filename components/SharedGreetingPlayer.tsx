
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as firebaseService from '../services/firebaseService';
import { Greeting } from '../types';
import Button from './Button';
import { decode, decodeAudioData, getOutputAudioContext, playAudioBuffer, stopAllAudio, createWavBlobFromPCM } from '../utils/audioUtils';
import { OUTPUT_AUDIO_SAMPLE_RATE } from '../constants';

interface SharedGreetingPlayerProps {
  greetingId: string;
}

const SharedGreetingPlayer: React.FC<SharedGreetingPlayerProps> = ({ greetingId }) => {
  const [greeting, setGreeting] = useState<Greeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoPlaybackLoading, setVideoPlaybackLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false); // Controls combined playback
  const [autoplayAttempted, setAutoplayAttempted] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoLoadTimeoutRef = useRef<number | null>(null);

  const fetchGreeting = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedGreeting = await firebaseService.getGreetingById(greetingId);
      if (fetchedGreeting) {
        setGreeting(fetchedGreeting);
      } else {
        setError("Greeting not found.");
      }
    } catch (e: any) {
      console.error("Error fetching shared greeting:", e);
      setError(`Failed to load greeting: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [greetingId]);

  useEffect(() => {
    fetchGreeting();
  }, [fetchGreeting]);

  const _playAudioInternal = useCallback(async () => {
    if (!greeting?.audioUrl) {
      console.warn("No audio URL available for playback.");
      return;
    }

    if (greeting.audioUrl.startsWith('data:audio/pcm;base64,')) {
      const base64Audio = greeting.audioUrl.split(',')[1];
      try {
        const audioBuffer = await decodeAudioData(
          decode(base64Audio),
          getOutputAudioContext(),
          OUTPUT_AUDIO_SAMPLE_RATE,
          1
        );
        await playAudioBuffer(audioBuffer);
      } catch (error) {
        console.error('Error playing PCM audio internally:', error);
        throw error;
      }
    }
  }, [greeting?.audioUrl]);

  const startCombinedPlayback = useCallback(async () => {
    if (!greeting || !greeting.videoUrl || !greeting.audioUrl) {
      setError("Cannot play greeting: missing video or audio.");
      return;
    }

    stopAllAudio(); // Ensure no other audio is playing
    setVideoPlaybackLoading(true);
    setError(null);
    setIsPlaying(false); // Reset playing state initially

    if (videoLoadTimeoutRef.current) {
      clearTimeout(videoLoadTimeoutRef.current);
      videoLoadTimeoutRef.current = null;
    }

    // Small delay to ensure video element is fully rendered if it wasn't
    setTimeout(() => {
      if (videoRef.current) {
        const videoElement = videoRef.current;
        videoElement.load(); // Ensure video is loaded

        const finalizePlaybackStart = async () => {
          if (videoLoadTimeoutRef.current) {
            clearTimeout(videoLoadTimeoutRef.current);
            videoLoadTimeoutRef.current = null;
          }
          setVideoPlaybackLoading(false);

          try {
            await _playAudioInternal();
          } catch (e) {
            console.error("Error starting synchronized audio for video:", e);
          }

          videoElement.play().then(() => {
            setIsPlaying(true);
            videoElement.requestFullscreen().catch(e => console.warn("Could not enter fullscreen:", e));
          }).catch(e => {
            console.error("Error playing video:", e);
            setError(`Could not play video automatically: ${e.message}. Please click the 'Play Greeting' button below.`);
            setIsPlaying(false);
            setAutoplayAttempted(true); // Indicate autoplay failed, show manual play button
          });
        };

        const onVideoCanPlayThrough = () => {
          videoElement.removeEventListener('canplaythrough', onVideoCanPlayThrough);
          finalizePlaybackStart();
        };

        videoElement.addEventListener('canplaythrough', onVideoCanPlayThrough);

        videoLoadTimeoutRef.current = window.setTimeout(() => {
          videoElement.removeEventListener('canplaythrough', onVideoCanPlayThrough);
          console.warn("Video 'canplaythrough' timeout, attempting to play anyway.");
          finalizePlaybackStart();
        }, 10000); // 10 seconds timeout
      }
    }, 50);
  }, [greeting, _playAudioInternal]);

  // Attempt autoplay once greeting is loaded
  useEffect(() => {
    if (greeting && greeting.videoUrl && greeting.audioUrl && !autoplayAttempted && !isPlaying) {
      startCombinedPlayback();
    }
  }, [greeting, startCombinedPlayback, autoplayAttempted, isPlaying]);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    stopAllAudio();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(e => console.warn("Could not exit fullscreen:", e));
    }
  }, []);

  const handleVideoError = useCallback((event: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Video element error:", event);
    setError("Failed to load video. It might be unavailable or corrupt, or network issues prevented loading. The AI-generated video does not include embedded audio; the audio plays alongside.");
    setVideoPlaybackLoading(false);
    setIsPlaying(false);
  }, []);

  const handleBackToMainApp = useCallback(() => {
    window.location.href = window.location.origin + window.location.pathname; // Go back to main app
  }, []);


  if (loading) {
    return (
      <div className="text-center text-lg text-gray-400 p-8">
        <svg className="animate-spin mx-auto h-8 w-8 text-white mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading Greeting...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-400 p-8 bg-gray-800 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold mb-4">Error</h2>
        <p className="mb-6">{error}</p>
        <Button onClick={handleBackToMainApp} variant="secondary">Back to e-Greetz</Button>
      </div>
    );
  }

  if (!greeting) {
    return (
      <div className="text-center text-gray-400 p-8 bg-gray-800 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold mb-4">Greeting Not Found</h2>
        <p className="mb-6">The greeting you are looking for does not exist or the link is incorrect.</p>
        <Button onClick={handleBackToMainApp} variant="secondary">Back to e-Greetz</Button>
      </div>
    );
  }

  const formattedDate = new Date(greeting.createdAt).toLocaleString();

  return (
    <div className="relative bg-gray-800 rounded-lg shadow-xl p-6 mb-6 border border-gray-700 overflow-hidden">
      <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-300">
        e-Greetz
      </h1>
      <h3 className="text-3xl font-bold text-center text-indigo-300 mb-4">{greeting.occasion}</h3>
      <p className="text-gray-300 text-center text-sm mb-2">Created: {formattedDate}</p>

      {greeting.imageUrl && (
        <div className="mb-4 flex justify-center">
          <img
            src={greeting.imageUrl}
            alt="Greeting Visual"
            className="max-w-full h-auto max-h-64 object-cover rounded-md shadow-md border border-gray-600"
            loading="lazy"
          />
        </div>
      )}

      <p className="text-gray-200 text-lg mb-4 text-center">{greeting.message}</p>

      {/* Video Player Section */}
      <div className="mt-4 p-4 bg-gray-900 rounded-lg relative min-h-[200px] flex items-center justify-center">
        {(videoPlaybackLoading || !isPlaying) && (
          <div className="absolute inset-0 bg-gray-800 bg-opacity-90 flex flex-col items-center justify-center rounded-lg z-10">
            {videoPlaybackLoading && (
              <>
                <svg className="animate-spin h-8 w-8 text-white mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-white text-lg">Buffering video for synchronized playback...</p>
                <p className="text-gray-400 text-sm mt-1">This ensures audio and video start together. Note: The video itself does not contain embedded audio.</p>
              </>
            )}
            {!videoPlaybackLoading && !isPlaying && error && (
              <div className="text-red-200 text-center mb-4">{error}</div>
            )}
            {!videoPlaybackLoading && !isPlaying && (
              <Button onClick={startCombinedPlayback}>
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Play Greeting
              </Button>
            )}
          </div>
        )}
        <video
          ref={videoRef}
          src={greeting.videoUrl}
          controls={isPlaying} // Show controls only when playing, or after manual play is needed
          className={`w-full max-w-lg mx-auto rounded-md shadow-lg ${!isPlaying && !error ? 'invisible' : ''}`}
          aria-label="Cinematic greeting video player"
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          preload="auto"
          muted={!isPlaying} // Mute initially to allow autoplay, then unmute if `play()` succeeds without error
        ></video>
      </div>

      <div className="flex justify-center mt-6">
        <Button onClick={handleBackToMainApp} variant="secondary">Back to e-Greetz</Button>
      </div>

      <div className="absolute bottom-2 left-2 text-gray-500 text-xs italic opacity-80">
        created by e-Greetz
      </div>
    </div>
  );
};

export default SharedGreetingPlayer;