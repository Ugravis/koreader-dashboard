CREATE TABLE "reading_goals" (
	"user_id" text PRIMARY KEY NOT NULL,
	"yearly_books" integer,
	"daily_minutes" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reading_goals" ADD CONSTRAINT "reading_goals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;