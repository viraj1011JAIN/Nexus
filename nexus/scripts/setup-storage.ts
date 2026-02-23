/**
 * scripts/setup-storage.ts
 *
 * Provisions the Supabase Storage bucket required for card file attachments.
 * Run ONCE in any new environment (local dev or production) before uploading files.
 *
 * Usage:
 *   npx tsx scripts/setup-storage.ts
 *
 * Prerequisites:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local
 *
 * What it does:
 *   1. Creates the "card-attachments" bucket (public, 10 MB max per file)
 *   2. Skips creation silently if the bucket already exists
 *   3. Prints the public URL base so you can verify access
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local (Next.js convention)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const BUCKET_NAME = "card-attachments";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("❌  Missing env vars.");
    console.error("    NEXT_PUBLIC_SUPABASE_URL  :", url ? "✓" : "MISSING");
    console.error("    SUPABASE_SERVICE_ROLE_KEY :", serviceKey ? "✓" : "MISSING");
    console.error("\n    Add SUPABASE_SERVICE_ROLE_KEY to .env.local.");
    console.error("    Find it: Supabase Dashboard → Settings → API → service_role (secret)");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  console.log(`\nConnecting to Supabase project: ${url}\n`);

  // Check if bucket already exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("❌  Failed to list buckets:", listError.message);
    process.exit(1);
  }

  const exists = buckets?.some((b) => b.name === BUCKET_NAME);

  if (exists) {
    console.log(`✓  Bucket "${BUCKET_NAME}" already exists — nothing to do.`);
  } else {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE_BYTES,
      allowedMimeTypes: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "text/csv",
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/zip",
      ],
    });

    if (createError) {
      console.error(`❌  Failed to create bucket "${BUCKET_NAME}":`, createError.message);
      process.exit(1);
    }
    console.log(`✓  Bucket "${BUCKET_NAME}" created successfully.`);
  }

  const publicBase = `${url}/storage/v1/object/public/${BUCKET_NAME}`;
  console.log(`\n   Public URL base: ${publicBase}`);
  console.log("\n   File attachments are ready to use.\n");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
