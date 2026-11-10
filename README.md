# Agentic-Workflow-Mini-Project

## Goal

Build a three agent workflow that takes a user query, researches it and stores the data in Supabase, turns that data into a branded KPI presentation, and delivers it to the team. **This is a practice run for the Boxsy agentic workflow project that starts next semester.** Every choice below should rehearse something Boxsy will require, not just produce a demo.

""" 
    flowchart LR
    U([User enters query]) --> UI[Vercel page<br/>query box and run status]
    UI --> O[Orchestrator]
    O -->|creates query_id| DB[(Supabase)]
    subgraph A1 [Agent 1: Data Extraction]
    A1a[Search free APIs and MCPs] --> A1b[Clean data and compute KPIs]
    end
    
    G1{{Gate 1: person approves data and KPIs}}
    
    subgraph A2 [Agent 2: Presentation]
    A2a[Read KPIs by query_id] --> A2b[Pick 3 to 5 KPIs and charts] --> A2c[Render PDF with taste.md]
    end
    
    G2{{Gate 2: person approves presentation before anything is sent}}
    
    subgraph A3 [Agent 3: Delivery]
    A3a[Draft email with summary] --> A3b[Send to test inboxes only, once]
    end
    
    DB --> A1a
    A1b -->|raw_data, kpis| DB
    DB --> G1
    G1 -->|approved| A2a
    G1 -->|rejected with comment| A1a
    T[/taste.md brand rules/] --> A2c
    A2c -->|presentation_url| DB
    DB --> G2
    G2 -->|approved| A3a
    G2 -->|rejected with comment| A2a
    A3b -->|meeting record, sent flag| DB
    
    UI <-->|approve or reject| DB
    DB -.status per agent.-> LOG[[agent_runs log<br/>pending, running, awaiting_approval, done, failed]]
    LOG -.failed.-> STOP{{Stop workflow and report error}}


## Environment Setup

1. Clone the repository.
2. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

3. Get the required API keys from the team's secure shared vault.
4. Add the credentials to your local `.env` file.
5. Never commit `.env` or share API keys publicly.

The `.gitignore` file prevents Git from tracking local `.env` files.

