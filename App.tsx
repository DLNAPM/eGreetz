
import React, { useState, useEffect, useCallback } from 'react';
import GreetingForm from './components/GreetingForm';
import GreetingList from './components/GreetingList';
import { Greeting } from './types';
import * as firebaseService from './services/firebaseService';
import { GoogleGenAI } from '@google/genai';
import Modal from './components/Modal';
import SharedGreetingPlayer from './components/SharedGreetingPlayer'; // New import

function App() {
  const [greetings, setGreetings] = useState<Greeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [sharedGreetingId, setSharedGreetingId] = useState<string | null>(null);

  // Initialize Firebase on component mount
  useEffect(() => {
    firebaseService.initFirebase();
  }, []);

  // Check URL for shared greeting ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('greetingId');
    setSharedGreetingId(id);
  }, []);

  const fetchGreetings = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedGreetings = await firebaseService.getGreetings();
      setGreetings(fetchedGreetings);
    } catch (error) {
      console.error("Error fetching greetings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch greetings if not viewing a shared greeting
    if (!sharedGreetingId) {
      fetchGreetings();
    }
  }, [fetchGreetings, sharedGreetingId]);

  const handleGreetingCreated = useCallback((newGreeting: Greeting) => {
    setGreetings((prev) => [...prev, newGreeting]);
  }, []);

  const handleDeleteGreeting = useCallback(async (id: string) => {
    try {
      await firebaseService.deleteGreeting(id);
      setGreetings((prev) => prev.filter((greeting) => greeting.id !== id));
    } catch (error) {
      console.error("Error deleting greeting:", error);
    }
  }, []);

  const checkAndPromptApiKey = useCallback(async () => {
    if (typeof window.aistudio !== 'undefined' && typeof window.aistudio.hasSelectedApiKey === 'function') {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setApiKeyModalOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    checkAndPromptApiKey();
  }, [checkAndPromptApiKey]);

  const handleOpenApiKeySelection = useCallback(async () => {
    if (typeof window.aistudio !== 'undefined' && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      // Assume success and close modal
      setApiKeyModalOpen(false);
    }
  }, []);

  // Provide an instance of GoogleGenAI to components, created right before use
  const getGenAIInstance = useCallback(() => {
    // CRITICAL: Create new GoogleGenAI instance right before an API call
    // to ensure it uses the most up-to-date API key from the dialog.
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }, []);

  // Conditional rendering based on sharedGreetingId
  if (sharedGreetingId) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <SharedGreetingPlayer greetingId={sharedGreetingId} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-300">
        e-Greetz
      </h1>

      <GreetingForm
        onGreetingCreated={handleGreetingCreated}
        getGenAIInstance={getGenAIInstance}
        onApiKeyPrompt={checkAndPromptApiKey}
      />

      <hr className="my-10 border-t-2 border-gray-600" />

      <h2 className="text-3xl font-bold text-center mb-6 text-blue-300">Your Created Greetings</h2>
      {loading ? (
        <div className="text-center text-lg text-gray-400">Loading greetings...</div>
      ) : greetings.length === 0 ? (
        <div className="text-center text-lg text-gray-400">No greetings yet. Create one above!</div>
      ) : (
        <GreetingList greetings={greetings} onDelete={handleDeleteGreeting} />
      )}

      <Modal isOpen={apiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} title="API Key Required">
        <p className="text-gray-200 mb-4">
          To generate cinematic videos, a paid API key from a Google Cloud Project is required.
          Please select or create an API key with billing enabled.
        </p>
        <p className="text-gray-300 mb-4 text-sm">
          For more information on billing, visit{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            ai.google.dev/gemini-api/docs/billing
          </a>
        </p>
        <button
          onClick={handleOpenApiKeySelection}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200"
        >
          Select API Key
        </button>
      </Modal>
    </div>
  );
}

export default App;