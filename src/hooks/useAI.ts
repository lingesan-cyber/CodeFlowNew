import { useState, useCallback } from 'react';
import { AIRequest, AIResponse, AIFeature, ExecutionContext } from '../ai/types';
import { SupportedLanguage } from '../engine/types';

export function useAIExplanation() {
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExplanation = useCallback(async (
    context: ExecutionContext,
    language: SupportedLanguage,
    feature: AIFeature = 'explain_step'
  ) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, context, language } as AIRequest)
      });

      if (!res.ok) throw new Error(`AI service error: ${res.status}`);
      
      const data: AIResponse = await res.json();
      setResponse(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI unavailable';
      setError(message);
      setResponse(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResponse(null);
    setError(null);
  }, []);

  return { response, loading, error, fetchExplanation, clear };
}
