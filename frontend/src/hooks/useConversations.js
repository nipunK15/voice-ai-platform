// src/hooks/useConversations.js
// Custom hook for conversation data.

import { useState, useEffect, useCallback } from "react";
import { conversationsApi } from "../services/api";
import { useApp } from "../context/AppContext";

export function useConversations(filters = {}) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { notifyError } = useApp();

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await conversationsApi.getAll(filters);
      setConversations(response.data || []);
    } catch (err) {
      setError(err.message);
      notifyError("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [filters.agentId, filters.status]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return { conversations, loading, error, refetch: fetchConversations };
}

export function useConversation(id) {
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      try {
        setLoading(true);
        const response = await conversationsApi.getById(id);
        setConversation(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  return { conversation, loading, error };
}

export function useStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const response = await conversationsApi.getStats();
        setStats(response.data);
      } catch (err) {
        console.error("Stats fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { stats, loading };
}

export function useVapiCall(agentId) {
  const { notifyError, notifySuccess } = useApp();
  const [conversationId, setConversationId] = useState(null);
  const [isActive, setIsActive] = useState(false);

  const startConversation = async (vapiCallId = null) => {
    try {
      const response = await conversationsApi.create({ agentId, vapiCallId });
      setConversationId(response.data.id);
      setIsActive(true);
      return response.data;
    } catch (err) {
      notifyError("Failed to start conversation");
      throw err;
    }
  };

  const endConversation = async (duration) => {
    if (!conversationId) return;
    try {
      await conversationsApi.end(conversationId, { duration });
      setIsActive(false);
      notifySuccess("Conversation saved!");
    } catch (err) {
      notifyError("Failed to save conversation");
    }
  };

  const saveMessage = async (role, content) => {
    if (!conversationId) return;
    try {
      await conversationsApi.addMessage(conversationId, { role, content });
    } catch (err) {
      console.error("Failed to save message:", err);
    }
  };

  return {
    conversationId,
    isActive,
    startConversation,
    endConversation,
    saveMessage,
  };
}
