CREATE TYPE "public"."event_type" AS ENUM('service', 'rehearsal', 'special', 'conference', 'vigil', 'communion', 'other');--> statement-breakpoint
CREATE TYPE "public"."file_kind" AS ENUM('cover', 'photo', 'document', 'audio', 'other');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('leader', 'vocal', 'backing_vocal', 'acoustic_guitar', 'electric_guitar', 'bass', 'keys', 'drums', 'percussion', 'sound', 'media', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('repertoire', 'key_change', 'rehearsal', 'schedule', 'song', 'system');--> statement-breakpoint
CREATE TYPE "public"."preparation_status" AS ENUM('not_studied', 'studying', 'ready');--> statement-breakpoint
CREATE TYPE "public"."repertoire_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."song_link_type" AS ENUM('youtube', 'spotify', 'apple_music', 'cifraclub', 'deezer', 'other');--> statement-breakpoint
CREATE TYPE "public"."song_video_type" AS ENUM('official', 'study', 'rehearsal', 'live', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'leader', 'member');--> statement-breakpoint
CREATE TYPE "public"."voice_type" AS ENUM('soprano', 'mezzo', 'contralto', 'tenor', 'baritone', 'bass', 'none');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" "event_type" DEFAULT 'service' NOT NULL,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time,
	"location" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_song_unique" UNIQUE("user_id","song_id")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"pathname" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"kind" "file_kind" DEFAULT 'other' NOT NULL,
	"song_id" uuid,
	"member_id" uuid,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"photo_url" text,
	"roles" "member_role"[] DEFAULT '{}' NOT NULL,
	"instrument" text DEFAULT '' NOT NULL,
	"voice" "voice_type" DEFAULT 'none' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"type" "notification_type" DEFAULT 'system' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"read_by" uuid[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rehearsals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"repertoire_id" uuid,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rehearsals_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "repertoire_songs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repertoire_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"key" text NOT NULL,
	"lead_vocal_id" uuid,
	"instrumentation" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repertoires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" "repertoire_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repertoires_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "schedule_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	CONSTRAINT "schedule_members_unique" UNIQUE("schedule_id","member_id","role")
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedules_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "song_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" uuid NOT NULL,
	"type" "song_link_type" DEFAULT 'other' NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "song_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" uuid NOT NULL,
	"author_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "song_preparations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repertoire_song_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"video_watched" boolean DEFAULT false NOT NULL,
	"chords_studied" boolean DEFAULT false NOT NULL,
	"key_confirmed" boolean DEFAULT false NOT NULL,
	"rehearsed" boolean DEFAULT false NOT NULL,
	"status" "preparation_status" DEFAULT 'not_studied' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "song_preparations_unique" UNIQUE("repertoire_song_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "song_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" uuid NOT NULL,
	"type" "song_video_type" DEFAULT 'other' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "song_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"album" text DEFAULT '' NOT NULL,
	"composer" text DEFAULT '' NOT NULL,
	"original_key" text NOT NULL,
	"team_key" text NOT NULL,
	"bpm" smallint,
	"capo" smallint,
	"tuning" text DEFAULT '' NOT NULL,
	"time_signature" text DEFAULT '4/4' NOT NULL,
	"lyrics" text DEFAULT '' NOT NULL,
	"chords" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "songs_bpm_range" CHECK ("songs"."bpm" is null or "songs"."bpm" between 30 and 300),
	CONSTRAINT "songs_capo_range" CHECK ("songs"."capo" is null or "songs"."capo" between 0 and 12)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehearsals" ADD CONSTRAINT "rehearsals_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehearsals" ADD CONSTRAINT "rehearsals_repertoire_id_repertoires_id_fk" FOREIGN KEY ("repertoire_id") REFERENCES "public"."repertoires"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repertoire_songs" ADD CONSTRAINT "repertoire_songs_repertoire_id_repertoires_id_fk" FOREIGN KEY ("repertoire_id") REFERENCES "public"."repertoires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repertoire_songs" ADD CONSTRAINT "repertoire_songs_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repertoire_songs" ADD CONSTRAINT "repertoire_songs_lead_vocal_id_members_id_fk" FOREIGN KEY ("lead_vocal_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repertoires" ADD CONSTRAINT "repertoires_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repertoires" ADD CONSTRAINT "repertoires_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_members" ADD CONSTRAINT "schedule_members_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_members" ADD CONSTRAINT "schedule_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_links" ADD CONSTRAINT "song_links_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_notes" ADD CONSTRAINT "song_notes_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_notes" ADD CONSTRAINT "song_notes_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_preparations" ADD CONSTRAINT "song_preparations_repertoire_song_id_repertoire_songs_id_fk" FOREIGN KEY ("repertoire_song_id") REFERENCES "public"."repertoire_songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_preparations" ADD CONSTRAINT "song_preparations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_videos" ADD CONSTRAINT "song_videos_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_views" ADD CONSTRAINT "song_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_views" ADD CONSTRAINT "song_views_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_date_idx" ON "events" USING btree ("date","start_time");--> statement-breakpoint
CREATE INDEX "files_song_idx" ON "files" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "files_member_idx" ON "files" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "rehearsals_repertoire_idx" ON "rehearsals" USING btree ("repertoire_id");--> statement-breakpoint
CREATE INDEX "repertoire_songs_repertoire_idx" ON "repertoire_songs" USING btree ("repertoire_id","position");--> statement-breakpoint
CREATE INDEX "repertoire_songs_song_idx" ON "repertoire_songs" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "schedule_members_member_idx" ON "schedule_members" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "song_links_song_idx" ON "song_links" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "song_notes_song_idx" ON "song_notes" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "song_preparations_member_idx" ON "song_preparations" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "song_videos_song_idx" ON "song_videos" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "song_views_user_idx" ON "song_views" USING btree ("user_id","viewed_at");--> statement-breakpoint
CREATE INDEX "songs_title_idx" ON "songs" USING btree ("title");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_member_idx" ON "users" USING btree ("member_id");