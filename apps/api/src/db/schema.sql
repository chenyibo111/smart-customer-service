PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  status TEXT NOT NULL,
  controller TEXT,
  created_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  claimed_by TEXT,
  created_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_label TEXT NOT NULL,
  content TEXT NOT NULL,
  index_status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES knowledge_documents(id),
  content TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  trigger_message_id TEXT NOT NULL REFERENCES messages(id),
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  elapsed_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS retrieval_evidence (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_runs(id),
  chunk_id TEXT NOT NULL REFERENCES knowledge_chunks(id),
  score REAL NOT NULL,
  cited INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_runs(id),
  name TEXT NOT NULL,
  masked_arguments TEXT NOT NULL,
  result TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS demo_orders (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  summary TEXT NOT NULL
);
