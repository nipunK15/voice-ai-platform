# Voice AI Platform

Production-style Voice AI Platform inspired by modern conversational voice infrastructure platforms.

This platform enables users to create configurable voice agents, automatically provision voice assistants, talk with them in realtime, manage conversations, and eventually support advanced orchestration, memory, tools, and prompt layering.

---

# Overview

This project is designed as a full Voice AI Platform rather than a simple chatbot application.

Users can:

* Create Voice Agents
* Configure prompts, voices, and behavior
* Automatically provision voice assistants
* Talk with agents in realtime
* View conversation history
* Build advanced orchestration workflows
* Support future memory, tools, RAG, analytics, and multi-user capabilities

---

# Current Architecture

## Frontend

* React
* Vite
* React Router
* Dark themed dashboard UI

## Backend

* Node.js
* Express
* CommonJS architecture

## Database

* PostgreSQL
* Prisma ORM

## Voice Stack

* Vapi
* Deepgram
* OpenAI Voices
* ElevenLabs Voices

---

# Project Structure

```text
voice-platform/

├── frontend/
│
│   ├── src/
│   │
│   ├── components/
│   │   ├── Layout.jsx
│   │   ├── AgentCard.jsx
│   │   ├── MessageBubble.jsx
│   │   └── NotificationToast.jsx
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── AgentsList.jsx
│   │   ├── AgentDetail.jsx
│   │   ├── CreateAgent.jsx
│   │   ├── TalkToAgent.jsx
│   │   ├── ConversationHistory.jsx
│   │   └── ConversationDetail.jsx
│
├── backend/
│
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── config/
│   └── server.js
│
└── prisma/
```

---

# Current Features

## Agent Management

* Create Agents
* Edit Agents
* Delete Agents
* Agent Dashboard
* Dynamic Routing
* Agent Detail Pages

## Voice Platform Features

* Realtime Voice Conversations
* Dedicated Voice Call Pages
* Live Transcript UI
* Conversation Completion UI
* Automatic Assistant Provisioning
* Assistant Storage
* Voice Provider Selection

## Supported Voice Providers

* OpenAI Voices
* ElevenLabs Voices

---

# Current Flow

## Agent Creation Flow

```text
Create Agent

↓

Backend Creates Voice Assistant Automatically

↓

Assistant ID Returned

↓

Stored In Database

↓

Agent Saved
```

Users never manually create assistants.

Platform handles provisioning automatically.

---

## Voice Runtime Flow

```text
User Clicks Talk To Agent

↓

Agent Configuration Retrieved

↓

Stored Assistant Loaded

↓

Realtime Voice Session Starts

↓

Transcript Generated

↓

Conversation Ends
```

---

# Environment Variables

## Backend

```env
VAPI_API_KEY=
DATABASE_URL=
```

## Frontend

```env
VITE_VAPI_PUBLIC_KEY=
```

---

# Installation

## Clone Repository

```bash
git clone <repo-url>

cd voice-platform
```

## Backend

```bash
cd backend

npm install

npx prisma generate

npx prisma migrate dev

npm run dev
```

Backend runs on:

```text
localhost:3001
```

## Frontend

```bash
cd frontend

npm install

npm run dev
```

Frontend runs on:

```text
localhost:5173
```

---

# Current Limitation

Current architecture primarily supports:

```text
Single Prompt

↓

Single Assistant Behavior

↓

Realtime Conversation
```

This is intentionally being evolved.

---

# Target Architecture

Goal is to support multi-layer conversational orchestration.

```text
Agent Config

↓

Prompt Layers

↓

Memory

↓

Tools

↓

Conversation Context

↓

Runtime Context Injection

↓

Voice Runtime
```

Target capabilities:

* Multi Layer Prompting
* Prompt Chaining
* Runtime Context Injection
* Dynamic Behavior Modification
* Tool Context
* Conversation Context
* Memory Layers
* Better Orchestration

---

# Planned Roadmap

## Phase 1

* Conversation Persistence
* Transcript Storage
* Conversation History

## Phase 2

* Multi Layer Prompting
* Memory Systems
* Context Injection
* Prompt Orchestration

## Phase 3

* RAG / Knowledge Uploads
* Analytics
* Authentication
* Multi User Support

## Phase 4

* Production Deployment
* Scaling
* Enterprise Features

---

# Vision

Build a production-style Voice AI Platform capable of supporting advanced conversational systems similar to modern voice infrastructure platforms.

The long-term objective is not simply voice chat.

The objective is orchestration.

```
```
