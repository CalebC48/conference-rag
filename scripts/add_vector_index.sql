-- Add Vector Index for Fast Similarity Search
-- =============================================
-- This uses IVFFlat which builds faster than HNSW
-- Run this in Supabase SQL Editor or connect directly to the database

-- Create vector index using IVFFlat (faster to build than HNSW)
CREATE INDEX IF NOT EXISTS sentence_embeddings_embedding_idx
ON sentence_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Note: IVFFlat requires at least 100 rows to build. If you have fewer rows,
-- you can use a smaller lists value (e.g., lists = 10 for < 1000 rows)
