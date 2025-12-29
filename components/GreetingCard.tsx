
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
  const [showVideoPlayer, setShowVideoPlayer] = useState(false); // New state for video player visibility
  const [videoPlaybackLoading, setVideoPlaybackLoading] = useState(false); // New state for video loading spinner
  const audioRef = useRef<HTMLAudioElement | null>(null); // For native audio playback (not currently used for PCM)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoLoadTimeoutRef = useRef<number | null>(null);

  // Internal helper to play audio without managing `isPlayingAudio` state directly
  const _playAudioInternal = useCallback(async () => {
    if (!greeting.audioUrl) {
      console.warn("No audio URL available for playback.");
      return;
    }

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
        await playAudioBuffer(audioBuffer); // This manages global audio sources
      } catch (error) {
        console.error('Error playing PCM audio internally:', error);
        throw error;
      }
    } else {
      // Fallback for standard audio formats if ever generated (not current setup)
      if (audioRef.current) {
        audioRef.current.src = greeting.audioUrl;
        await audioRef.current.play().catch(e => {
          console.error("Error playing audio internally (native):", e);
          throw e;
        });
      }
    }
  }, [greeting.audioUrl]);

  // Function to play/pause audio (for standalone audio button)
  const handlePlayAudio = useCallback(async () => {
    stopAllAudio(); // Stop all existing audio, including any video-synced audio
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause(); // Pause video if playing
    }
    setVideoError(null); // Clear video error if playing audio separately
    setIsPlayingAudio(true);
    setShowVideoPlayer(false); // Hide video player if audio is played separately
    setVideoPlaybackLoading(false); // Ensure video loading is off

    try {
      await _playAudioInternal();
    } catch (e) {
      setIsPlayingAudio(false);
      console.error("Failed to play audio:", e);
    }
    // We don't set isPlayingAudio to false here on audio `ended` event.
    // This is handled by a global listener in `audioUtils.ts` or when another media starts/stops.
  }, [_playAudioInternal]);

  const handlePauseAudio = useCallback(() => {
    stopAllAudio(); // Stop custom PCM playback
    if (audioRef.current) {
      audioRef.current.pause(); // Stop native HTML audio
    }
    setIsPlayingAudio(false);
  }, []);

  // Function to play video and simultaneously start audio
  const handlePlayVideo = useCallback(async () => {
    stopAllAudio(); // Stop any standalone audio playback
    if (audioRef.current) {
      audioRef.current.pause(); // Stop native HTML audio
    }
    setIsPlayingAudio(false); // Reset audio state
    setVideoError(null); // Clear previous video error
    setShowVideoPlayer(true); // Show the video player
    setVideoPlaybackLoading(true); // Start video loading spinner

    // Clear any previous timeout
    if (videoLoadTimeoutRef.current) {
      clearTimeout(videoLoadTimeoutRef.current);
      videoLoadTimeoutRef.current = null;
    }

    // A small delay to ensure the video element is rendered before attempting to load
    setTimeout(() => {
      if (videoRef.current) {
        const videoElement = videoRef.current;
        videoElement.load(); // Ensure video is loaded

        const startBothPlayback = async () => {
          if (videoLoadTimeoutRef.current) {
            clearTimeout(videoLoadTimeoutRef.current);
            videoLoadTimeoutRef.current = null;
          }
          setVideoPlaybackLoading(false); // Hide loading spinner

          // Start audio first
          if (greeting.audioUrl) {
            try {
              await _playAudioInternal();
            } catch (e) {
              console.error("Error starting synchronized audio for video:", e);
              // Don't block video playback, but log the error
            }
          }

          // Then start video
          videoElement.play().catch(e => {
            console.error("Error playing video:", e);
            setVideoError(`Could not play video: ${e.message}. Ensure your browser allows autoplay or try clicking play manually. The AI-generated video does not include embedded audio; the audio plays alongside.`);
          });
          videoElement.requestFullscreen().catch(e => {
            console.warn("Could not enter fullscreen:", e);
          });
        };

        const onVideoCanPlayThrough = () => {
          videoElement.removeEventListener('canplaythrough', onVideoCanPlayThrough);
          startBothPlayback();
        };

        videoElement.addEventListener('canplaythrough', onVideoCanPlayThrough);

        // Fallback timeout in case 'canplaythrough' doesn't fire or takes too long
        videoLoadTimeoutRef.current = window.setTimeout(() => {
          videoElement.removeEventListener('canplaythrough', onVideoCanPlayThrough);
          console.warn("Video 'canplaythrough' timeout, attempting to play anyway.");
          startBothPlayback();
        }, 10000); // 10 seconds timeout
      }
    }, 50); // Small initial delay to ensure render
  }, [greeting.audioUrl, _playAudioInternal]);


  const handleCloseVideoPlayer = useCallback(() => {
    if (videoLoadTimeoutRef.current) {
      clearTimeout(videoLoadTimeoutRef.current);
      videoLoadTimeoutRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause(); // Pause video when closing
      // Ensure the 'canplaythrough' listener is removed if it was pending
      videoRef.current.removeEventListener('canplaythrough', () => {}); // Remove any pending listeners
      if (document.fullscreenElement === videoRef.current) {
        document.exitFullscreen().catch(e => console.warn("Could not exit fullscreen:", e));
      }
    }
    stopAllAudio(); // Stop any audio that was playing with the video
    if (audioRef.current) {
      audioRef.current.pause(); // Stop native HTML audio
    }
    setIsPlayingAudio(false); // Reset audio state
    setShowVideoPlayer(false);
    setVideoPlaybackLoading(false); // Reset video loading state
    setVideoError(null);
  }, []);

  useEffect(() => {
    // Event listener for native <audio> element to update state (if ever used)
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

    // Cleanup video player state if greeting changes or component unmounts
    return () => {
      handleCloseVideoPlayer(); // Ensure video is paused and hidden
    };
  }, [greeting.id, handleCloseVideoPlayer]); // Re-run effect if greeting ID changes

  const formattedDate = new Date(greeting.createdAt).toLocaleString();

  // Handle video loading errors
  const handleVideoError = useCallback((event: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Video element error:", event);
    setVideoError("Failed to load video. It might be unavailable or corrupt, or network issues prevented loading. The AI-generated video does not include embedded audio; the audio plays alongside.");
    setVideoPlaybackLoading(false); // Hide loading spinner on error
    setShowVideoPlayer(true); // Keep player visible to show error message
  }, []);

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
          <Button
            onClick={handlePlayVideo} // Use the new handler
            className="w-full sm:w-auto"
            aria-controls={`video-player-${greeting.id}`}
            disabled={videoPlaybackLoading} // Disable button while loading
          >
            {videoPlaybackLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg> Loading Video...
              </>
            ) : (
              <>
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 01-2 2h-4a2 2 0 01-2-2V6zM2 14a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2zM14 14a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2z" />
                </svg>
                Play Cinematic Video
              </>
            )}
          </Button>
        )}
      </div>

      {showVideoPlayer && greeting.videoUrl && (
        <div className="mt-4 p-4 bg-gray-900 rounded-lg relative min-h-[200px] flex items-center justify-center">
          {videoPlaybackLoading && (
            <div className="absolute inset-0 bg-gray-800 bg-opacity-90 flex flex-col items-center justify-center rounded-lg z-10">
              <svg className="animate-spin h-8 w-8 text-white mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-white text-lg">Buffering video for synchronized playback...</p>
              <p className="text-gray-400 text-sm mt-1">This ensures audio and video start together.</p>
            </div>
          )}
          {videoError && (
            <div className="absolute inset-0 bg-red-900 bg-opacity-90 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex flex-col items-center justify-center text-center z-10" role="alert">
              <strong className="font-bold">Video Error:</strong>
              <span className="block sm:inline ml-2">{videoError}</span>
              <p className="text-sm mt-2">The generated video from the AI does not include embedded audio. The audio plays simultaneously alongside the video. Please check your browser's console for more details.</p>
              <button
                onClick={handleCloseVideoPlayer}
                className="mt-4 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200"
                aria-label="Close error message"
              >
                Close Error
              </button>
            </div>
          )}
          <video
            ref={videoRef}
            id={`video-player-${greeting.id}`}
            src={greeting.videoUrl}
            controls
            className={`w-full max-w-lg mx-auto rounded-md shadow-lg ${videoPlaybackLoading || videoError ? 'invisible' : ''}`}
            aria-label="Cinematic greeting video player"
            onError={handleVideoError}
            preload="auto" // Suggest browser to preload video
          ></video>
          <div className="flex justify-center mt-4">
            <Button
              onClick={handleCloseVideoPlayer}
              variant="secondary"
              className="w-full sm:w-auto"
              aria-label="Close video player"
              disabled={videoPlaybackLoading}
            >
              Close Video
            </Button>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 text-gray-500 text-xs italic opacity-80">
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
      {/* Hidden audio element for browser's native controls (e.g., for non-PCM audio, not currently used) */}
      <audio ref={audioRef} className="hidden" onEnded={() => setIsPlayingAudio(false)}></audio>
    </div>
  );
};

export default GreetingCard;