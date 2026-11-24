CREATE TABLE "annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"book_id" uuid NOT NULL,
	"text" text,
	"note" text,
	"chapter" text,
	"pageno" integer,
	"datetime" timestamp,
	"datetime_updated" timestamp,
	"color" text,
	"drawer" text,
	"pos0" text,
	"pos1" text
);
--> statement-breakpoint
ALTER TABLE "books" DROP CONSTRAINT "books_user_id_md5_unique";--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "series_index" real;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "keywords" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "identifiers" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "file_path" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "status_modified" date;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "percent_finished" real;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "rating" integer;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "review" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "library_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "annotations_book_id_idx" ON "annotations" USING btree ("book_id");--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_identity_unique" UNIQUE NULLS NOT DISTINCT("user_id","md5","title","authors");