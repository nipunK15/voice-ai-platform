// src/App.jsx
// Root application component with routing configuration.
// React Router v6 with layout-based routing pattern.

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import AgentsList from "./pages/AgentsList";
import CreateAgent from "./pages/CreateAgent";
import AgentDetail from "./pages/AgentDetail";
import ConversationHistory from "./pages/ConversationHistory";
import ConversationDetail from "./pages/ConversationDetail";
import TalkToAgent from "./pages/TalkToAgent";
import NotificationToast from "./components/NotificationToast";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <NotificationToast />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="agents" element={<AgentsList />} />
            <Route path="agents/new" element={<CreateAgent />} />
            <Route path="agents/:id" element={<AgentDetail />} />
            <Route path="agents/:id/edit" element={<CreateAgent />} />
            <Route path="agents/:id/talk" element={<TalkToAgent />} />
            <Route path="conversations" element={<ConversationHistory />} />
            <Route path="conversations/:id" element={<ConversationDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
