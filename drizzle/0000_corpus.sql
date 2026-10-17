CREATE TABLE `corpus_videos` (
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`verification` text NOT NULL,
	`source` text NOT NULL,
	`imported_at` text NOT NULL,
	`record_json` text NOT NULL,
	`handle` text NOT NULL,
	`caption` text NOT NULL,
	`transcript` text NOT NULL,
	`hook` text NOT NULL,
	`format` text NOT NULL,
	`niche` text NOT NULL,
	`bio` text NOT NULL,
	`school` text NOT NULL,
	`location` text NOT NULL,
	`school_key` text NOT NULL,
	`location_key` text NOT NULL,
	`email` text NOT NULL,
	`followers` integer,
	`views` integer,
	`likes` integer,
	`comments` integer,
	`shares` integer,
	CONSTRAINT "corpus_kind_check" CHECK("corpus_videos"."kind" IN ('real','example','synthetic','unverified'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `corpus_videos_id_unique` ON `corpus_videos` (`id`);--> statement-breakpoint
CREATE INDEX `corpus_kind` ON `corpus_videos` (`kind`);--> statement-breakpoint
CREATE INDEX `corpus_handle` ON `corpus_videos` (`handle`);--> statement-breakpoint
CREATE INDEX `corpus_followers` ON `corpus_videos` (`kind`,`followers`);--> statement-breakpoint
CREATE INDEX `corpus_school` ON `corpus_videos` (`school_key`);--> statement-breakpoint
CREATE INDEX `corpus_location` ON `corpus_videos` (`location_key`);
--> statement-breakpoint
-- Custom SQL appended to the genuinely generated Drizzle base migration.
-- FTS virtual tables and synchronization triggers are not represented by Drizzle's table snapshot.
CREATE VIRTUAL TABLE corpus_fts USING fts5(handle,caption,transcript,hook,format,niche,bio,school,location,content='corpus_videos',content_rowid='rowid',tokenize='porter unicode61');
--> statement-breakpoint
CREATE TRIGGER corpus_insert AFTER INSERT ON corpus_videos BEGIN
 INSERT INTO corpus_fts(rowid,handle,caption,transcript,hook,format,niche,bio,school,location)
 VALUES(new.rowid,new.handle,new.caption,new.transcript,new.hook,new.format,new.niche,new.bio,new.school,new.location);
END;
--> statement-breakpoint
CREATE TRIGGER corpus_delete AFTER DELETE ON corpus_videos BEGIN
 INSERT INTO corpus_fts(corpus_fts,rowid,handle,caption,transcript,hook,format,niche,bio,school,location)
 VALUES('delete',old.rowid,old.handle,old.caption,old.transcript,old.hook,old.format,old.niche,old.bio,old.school,old.location);
END;
--> statement-breakpoint
CREATE TRIGGER corpus_update AFTER UPDATE ON corpus_videos BEGIN
 INSERT INTO corpus_fts(corpus_fts,rowid,handle,caption,transcript,hook,format,niche,bio,school,location)
 VALUES('delete',old.rowid,old.handle,old.caption,old.transcript,old.hook,old.format,old.niche,old.bio,old.school,old.location);
 INSERT INTO corpus_fts(rowid,handle,caption,transcript,hook,format,niche,bio,school,location)
 VALUES(new.rowid,new.handle,new.caption,new.transcript,new.hook,new.format,new.niche,new.bio,new.school,new.location);
END;
--> statement-breakpoint
CREATE TRIGGER corpus_no_fictional_promotion BEFORE UPDATE OF kind ON corpus_videos
WHEN old.kind IN ('example','synthetic') AND new.kind='real'
BEGIN
 SELECT RAISE(ABORT,'Cannot promote an existing synthetic/example record ID into the real corpus.');
END;
