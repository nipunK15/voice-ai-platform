// src/hooks/useAgents.js
// Custom hook for agent data fetching and mutations.
//
// ARCHITECTURE: Hooks encapsulate all data-fetching logic for a domain.
// Components just call `useAgents()` and get data + actions back.
// This keeps components focused on rendering and UX, not API logic.
// In production: replace with TanStack Query for caching + deduplication.

import { useState, useEffect, useCallback } from "react";
import { agentsApi } from "../services/api";
import { useApp } from "../context/AppContext";

export function useAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { notifySuccess, notifyError } = useApp();

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await agentsApi.getAll();
      setAgents(response.data || []);
    } catch (err) {
      setError(err.message);
      notifyError("Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const createAgent = async (data) => {
    const response = await agentsApi.create(data);
    setAgents((prev) => [response.data, ...prev]);
    notifySuccess(`Agent "${response.data.name}" created!`);
    return response.data;
  };

  const updateAgent = async (id, data) => {
    const response = await agentsApi.update(id, data);
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? response.data : a))
    );
    notifySuccess("Agent updated successfully");
    return response.data;
  };

  const deleteAgent = async (id) => {
    await agentsApi.delete(id);
    setAgents((prev) => prev.filter((a) => a.id !== id));
    notifySuccess("Agent deleted");
  };

  return {
    agents,
    loading,
    error,
    refetch: fetchAgents,
    createAgent,
    updateAgent,
    deleteAgent,
  };
}

export function useAgent(id) {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      try {
        setLoading(true);
        const response = await agentsApi.getById(id);
        setAgent(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  return { agent, loading, error };
}
