import { sql } from "@vercel/postgres";

import { config } from "dotenv";
config();

await sql`DROP TABLE header_images;`;
await sql`DROP TABLE articles;`;

await sql`
  CREATE TABLE IF NOT EXISTS articles (
    "article_hash" TEXT,
    "article_title" TEXT,
    "category" TEXT,
    "publish_date" TIMESTAMP,
    "article_body" TEXT,
    "raw_content" TEXT,
    "source_entity" TEXT,
    "article_link" TEXT,

    "generated_summary" TEXT,
    "negative_score" NUMERIC,
    "importance_score" NUMERIC,

     PRIMARY KEY (article_hash)
   );
`;

await sql`
  CREATE TABLE IF NOT EXISTS header_images (
     "article_hash" TEXT,
     "image_hash" TEXT,
     "s3_link" TEXT,

     PRIMARY KEY (image_hash),
     FOREIGN KEY (article_hash) REFERENCES articles (article_hash)
  );
`;

const { rows } = await sql`SELECT * FROM articles`;

console.log(rows);

console.log("Done");
