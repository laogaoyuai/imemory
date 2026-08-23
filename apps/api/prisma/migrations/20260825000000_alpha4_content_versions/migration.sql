ALTER TABLE "contents" ADD COLUMN "current_version_status" "ContentVersionStatus" NOT NULL DEFAULT 'APPROVED';

ALTER TABLE "content_versions" ADD COLUMN "reviewed_by_id" UUID;
ALTER TABLE "content_versions" ADD COLUMN "reviewed_at" TIMESTAMP(3);

CREATE INDEX "content_versions_status_created_at_idx" ON "content_versions"("status", "created_at");

ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
