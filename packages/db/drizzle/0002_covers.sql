CREATE TABLE "book_covers" (
	"user_id" text NOT NULL,
	"md5" text NOT NULL,
	"file_path" text NOT NULL,
	"image" "bytea" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_covers_user_id_md5_file_path_pk" PRIMARY KEY("user_id","md5","file_path")
);
--> statement-breakpoint
ALTER TABLE "book_covers" ADD CONSTRAINT "book_covers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;