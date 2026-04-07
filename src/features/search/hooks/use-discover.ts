"use client";

import { useState, useEffect } from "react";
import type { DiscoverGenre, Recommendation } from "../lib/search-mappers";

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

interface DiscoverResponse {
  genres: DiscoverGenre[];
}

interface RecommendationsResponse {
  recommendations: Recommendation[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface DiscoverState {
  discoverGenres: DiscoverGenre[];
  isDiscoverLoading: boolean;
  recommendations: Recommendation[];
  isRecommendationsLoading: boolean;
}

/**
 * Fetches discover genres and recommendations on mount.
 */
export function useDiscover(): DiscoverState {
  const [discoverGenres, setDiscoverGenres] = useState<DiscoverGenre[]>([]);
  const [isDiscoverLoading, setIsDiscoverLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(true);

  // Load discover genres on mount
  useEffect(() => {
    setIsDiscoverLoading(true);
    void fetch("/api/discover/genres")
      .then((res) => (res.ok ? (res.json() as Promise<DiscoverResponse>) : Promise.resolve({ genres: [] })))
      .then((data) => setDiscoverGenres(data.genres))
      .catch(() => {})
      .finally(() => setIsDiscoverLoading(false));
  }, []);

  // Load recommendations on mount
  useEffect(() => {
    setIsRecommendationsLoading(true);
    void fetch("/api/recommendations")
      .then((res) => (res.ok ? (res.json() as Promise<RecommendationsResponse>) : Promise.resolve({ recommendations: [] })))
      .then((data) => setRecommendations(data.recommendations))
      .catch(() => {})
      .finally(() => setIsRecommendationsLoading(false));
  }, []);

  return {
    discoverGenres,
    isDiscoverLoading,
    recommendations,
    isRecommendationsLoading,
  };
}
