// src/context/AppContext.jsx
// Global state context for the platform.
//
// ARCHITECTURE: We use React Context + useReducer instead of Redux for MVP.
// This gives us predictable state updates without the boilerplate of Redux.
// When the app grows, we can migrate to Zustand or Redux Toolkit by replacing
// this context — all components using `useApp()` stay unchanged.

import { createContext, useContext, useReducer } from "react";

const AppContext = createContext(null);

const initialState = {
  // The logged-in user (demo user for MVP)
  user: {
    id: "demo",
    name: "Demo Developer",
    email: "demo@voiceplatform.dev",
  },
  // Notification/toast system
  notifications: [],
};

function appReducer(state, action) {
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.payload };

    case "ADD_NOTIFICATION":
      return {
        ...state,
        notifications: [
          ...state.notifications,
          { id: Date.now(), ...action.payload },
        ],
      };

    case "REMOVE_NOTIFICATION":
      return {
        ...state,
        notifications: state.notifications.filter(
          (n) => n.id !== action.payload
        ),
      };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const notify = (message, type = "info") => {
    const id = Date.now();
    dispatch({
      type: "ADD_NOTIFICATION",
      payload: { message, type, id },
    });
    // Auto-remove after 4 seconds
    setTimeout(() => {
      dispatch({ type: "REMOVE_NOTIFICATION", payload: id });
    }, 4000);
  };

  const value = {
    user: state.user,
    notifications: state.notifications,
    notify,
    notifySuccess: (msg) => notify(msg, "success"),
    notifyError: (msg) => notify(msg, "error"),
    notifyInfo: (msg) => notify(msg, "info"),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}

export default AppContext;
