# Voice AI Platform

Production-style Voice AI Platform inspired by modern conversational voice infrastructure platforms.

This platform enables users to create configurable voice agents, automatically provision voice assistants, run realtime conversations, orchestrate multi-stage flows, manage memory, execute tools, and build advanced conversational workflows.

---

# Overview

This project is designed as a full Voice AI Platform rather than a simple chatbot application.

Users can:

* Create configurable voice agents
* Automatically provision assistants
* Run realtime voice conversations
* Build multi-stage prompt orchestration workflows
* Add memory and context injection
* Execute tools and webhook integrations
* Store conversations and transcripts
* Create production-style conversational pipelines

---

# Tech Stack

## Frontend

* React
* Vite
* React Router
* Dark Dashboard UI
* React Flow (Prompt Orchestration UI)

## Backend

* Node.js
* Express
* CommonJS Architecture

## Database

* PostgreSQL
* Prisma ORM

## Voice Stack

* Vapi
* Deepgram
* OpenAI Voices
* ElevenLabs Voices

---

# Architecture

```text
Agent Configuration

↓

Prompt Layers

↓

Prompt Orchestration Engine

↓

Memory Layer

↓

Tool Layer

↓

Conversation Context

↓

Runtime Context Injection

↓

Voice Runtime
```

---

# Project Structure

```text
voice-platform/

├── frontend/
│
│   ├── src/
│   │
│   ├── components/
│   │   ├── AgentCard.jsx
│   │   ├── FlowDefinitionEditor.jsx
│   │   ├── Layout.jsx
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
│   ├── routes/
│   ├── services/
│   │
│   │   ├── agentService.js
│   │   ├── callStateStore.js
│   │   ├── conditionEvaluator.js
│   │   ├── contextService.js
│   │   ├── conversationService.js
│   │   ├── memoryService.js
│   │   ├── orchestrationService.js
│   │   ├── orchestrationSchema.js
│   │   ├── promptService.js
│   │   ├── toolExecutor.js
│   │   ├── toolRegistry.js
│   │   └── toolRouter.js
│
│   └── server.js
│
├── prisma/
│
└── frontend/
```

---

# Core Features

## Agent Management

* Create Agents
* Edit Agents
* Delete Agents
* Agent Dashboard
* Dynamic Routing
* Voice Provider Selection

## Voice Features

* Realtime Voice Calls
* Live Transcript UI
* Conversation Completion UI
* Automatic Assistant Provisioning
* Assistant Storage
* Voice Provider Integration

## Prompt Orchestration

* Multi Stage Flows
* Stage Based Conversation Management
* Dynamic Stage Advancement
* Flow Builder UI
* Runtime Prompt Injection

## Memory System

* Conversation State Store
* Transcript Storage
* Runtime Context Injection
* Collected Data Persistence During Calls

## Tool Calling

* Tool Registry
* Tool Router
* Webhook Execution
* Structured Tool Payloads
* Lead Collection Workflow

---

# Runtime Flow

```text
User Speaks

↓

Transcript Generated

↓

Conversation State Updated

↓

Memory Extraction

↓

Prompt Compilation

↓

Stage Evaluation

↓

Tool Detection

↓

Webhook Execution (Optional)

↓

Assistant Response

↓

Next Stage Evaluation
```

---

# Example Lead Collection Flow

```text
User:

"My name is John"

↓

Memory Stores:

name=John

↓

User:

"Company is Google"

↓

Memory Stores:

company=Google

↓

User:

"john at gmail dot com"

↓

Extracted:

john@gmail.com

↓

User:

"Save this lead"

↓

Tool Router Detects Tool

↓

Webhook Executes With:

{

 name:"John",

 company:"Google",

 email:"john@gmail.com"

}
```

---

# Environment Variables

## Backend

```env
DATABASE_URL=

VAPI_API_KEY=

OPENAI_API_KEY=

DEEPGRAM_API_KEY=
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

## Backend Setup

```bash
cd backend

npm install

npx prisma generate

npx prisma migrate dev

npm run dev
```

Backend:

```text
localhost:3001
```

## Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

Frontend:

```text
localhost:5173
```

---

# Current Capabilities

* Realtime Voice Conversations
* Multi Layer Prompting
* Prompt Orchestration
* Memory Systems
* Runtime Context Injection
* Conversation Context
* Tool Calling Framework
* Webhook Integrations
* Structured Data Extraction
* Sales Workflow Automation

---

# Roadmap

## Next Steps

* CRM Integrations
* RAG / Document Uploads
* Analytics Dashboard
* Authentication
* Multi User Support
* Production Deployment
* Scaling Infrastructure

---

# Vision

Build a production-style Voice AI Platform capable of supporting sophisticated conversational systems with orchestration, memory, tools, context injection, and realtime voice interactions.

The objective is not simply voice chat.

The objective is orchestration.
