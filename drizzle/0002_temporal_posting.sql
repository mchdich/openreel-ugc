-- Generated through drizzle-kit generate --custom --name temporal_posting.
-- Custom JSON expression index; retained separately from the ORM column schema.
CREATE INDEX corpus_posted_day ON corpus_videos(substr(json_extract(record_json,'$.postedAt'),1,10));
