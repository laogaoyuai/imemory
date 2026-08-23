ALTER TABLE "users" ADD COLUMN "bio" VARCHAR(160) NOT NULL DEFAULT '';
ALTER TABLE "projects" ADD COLUMN "avatar_url" TEXT;

CREATE TABLE "user_follows" (
    "follower_id" UUID NOT NULL,
    "following_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_follows_pkey" PRIMARY KEY ("follower_id", "following_id"),
    CONSTRAINT "user_follows_not_self" CHECK ("follower_id" <> "following_id")
);

CREATE INDEX "user_follows_following_id_created_at_idx" ON "user_follows"("following_id", "created_at");
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "content_projects" (
    "content_id" VARCHAR(128) NOT NULL,
    "project_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_projects_pkey" PRIMARY KEY ("content_id", "project_id")
);

CREATE INDEX "content_projects_project_id_created_at_idx" ON "content_projects"("project_id", "created_at");

ALTER TABLE "content_projects" ADD CONSTRAINT "content_projects_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_projects" ADD CONSTRAINT "content_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "project_members" ("project_id", "user_id", "role", "created_at", "updated_at")
SELECT "id", "owner_id", 'OWNER'::"ProjectRole", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "projects"
ON CONFLICT ("project_id", "user_id") DO UPDATE SET "role" = 'OWNER'::"ProjectRole", "updated_at" = CURRENT_TIMESTAMP;
