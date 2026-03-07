import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

const PROGRESS_PATH = join(__dirname, ".scrape-progress.json");
const OUTPUT_PATH = join(PROJECT_ROOT, "src", "data", "images.json");
const BASE_URL = "https://lostcity.rs";
const DELAY_MS = 500;

// --- Types ---

interface ImageRecord {
  id: string;
  url: string;
  topicId: number;
  topicTitle: string;
  username: string;
  postedAt: string;
}

interface ProgressData {
  completedTopicIds: number[];
  images: ImageRecord[];
}

interface TopicSummary {
  id: number;
  title: string;
}

interface Post {
  username: string;
  created_at: string;
  cooked: string;
}

// --- CLI args ---

function parseLimit(): number | null {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--limit");
  if (idx === -1 || idx + 1 >= args.length) return null;
  const val = parseInt(args[idx + 1], 10);
  if (isNaN(val) || val <= 0) {
    throw new Error(`Invalid --limit value: ${args[idx + 1]}`);
  }
  return val;
}

// --- Fetch with retry / rate-limit ---

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJSON(url: string): Promise<any> {
  let backoff = 5000;
  let networkRetries = 0;
  const MAX_NETWORK_RETRIES = 3;

  while (true) {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      networkRetries++;
      if (networkRetries > MAX_NETWORK_RETRIES) {
        throw new Error(
          `Network error fetching ${url} after ${MAX_NETWORK_RETRIES} retries: ${err}`
        );
      }
      console.log(
        `  Network error (attempt ${networkRetries}/${MAX_NETWORK_RETRIES}), retrying in 2s...`
      );
      await sleep(2000);
      continue;
    }

    if (response.status === 429) {
      console.log(`  Rate limited (429), backing off ${backoff / 1000}s...`);
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 60000);
      continue;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }

    // Reset backoff on success
    backoff = 5000;
    return response.json();
  }
}

// --- Progress ---

function loadProgress(): ProgressData {
  if (existsSync(PROGRESS_PATH)) {
    try {
      const raw = readFileSync(PROGRESS_PATH, "utf-8");
      const data = JSON.parse(raw);
      if (
        Array.isArray(data.completedTopicIds) &&
        Array.isArray(data.images)
      ) {
        return data as ProgressData;
      }
    } catch {
      console.log("Warning: Could not parse progress file, starting fresh.");
    }
  }
  return { completedTopicIds: [], images: [] };
}

function saveProgress(progress: ProgressData): void {
  writeFileSync(PROGRESS_PATH, JSON.stringify(progress), "utf-8");
}

// --- Image extraction ---

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex").substring(0, 12);
}

function extractImages(
  cooked: string,
  topicId: number,
  topicTitle: string,
  username: string,
  postedAt: string
): ImageRecord[] {
  const results: ImageRecord[] = [];
  // Match all <img ...> tags (including self-closing)
  const imgRegex = /<img\s[^>]*?>/gi;
  let match: RegExpExecArray | null;

  while ((match = imgRegex.exec(cooked)) !== null) {
    const tag = match[0];

    // Extract class attribute
    const classMatch = tag.match(/class\s*=\s*["']([^"']*)["']/i);
    const classes = classMatch ? classMatch[1] : "";

    // Exclude avatar and emoji images
    if (classes.includes("avatar") || classes.includes("emoji")) {
      continue;
    }

    // Extract src attribute
    const srcMatch = tag.match(/src\s*=\s*["']([^"']*)["']/i);
    if (!srcMatch) continue;
    const src = srcMatch[1];

    // Only include matching URLs
    if (
      src.includes("lostcity.rs/uploads/default/") ||
      src.includes("i.imgur.com/")
    ) {
      results.push({
        id: hashUrl(src),
        url: src,
        topicId,
        topicTitle,
        username,
        postedAt,
      });
    }
  }

  return results;
}

// --- Topic scraping ---

async function getAllTopicIds(limit: number | null): Promise<TopicSummary[]> {
  const topics: TopicSummary[] = [];
  let page = 0;

  console.log("Fetching topic list...");

  while (true) {
    const url = `${BASE_URL}/latest.json?page=${page}`;
    await sleep(DELAY_MS);
    const data = await fetchJSON(url);

    const topicList = data?.topic_list?.topics;
    if (!topicList || !Array.isArray(topicList) || topicList.length === 0) {
      break;
    }

    for (const t of topicList) {
      topics.push({ id: t.id, title: t.title });
    }

    console.log(`  Page ${page}: ${topicList.length} topics (total: ${topics.length})`);

    if (limit !== null && topics.length >= limit) {
      return topics.slice(0, limit);
    }

    page++;
  }

  console.log(`Found ${topics.length} topics total.`);
  return limit !== null ? topics.slice(0, limit) : topics;
}

async function fetchAllPostsForTopic(topicId: number): Promise<Post[]> {
  await sleep(DELAY_MS);
  const topicData = await fetchJSON(`${BASE_URL}/t/${topicId}.json`);

  const postStream = topicData?.post_stream;
  if (!postStream) {
    throw new Error(`No post_stream in topic ${topicId}`);
  }

  const allPostIds: number[] = postStream.stream || [];
  const loadedPosts: Post[] = postStream.posts || [];

  // Determine which post IDs we still need to fetch
  const loadedIds = new Set(loadedPosts.map((p: any) => p.id));
  const remainingIds = allPostIds.filter((id) => !loadedIds.has(id));

  // Fetch remaining posts in batches of 20
  for (let i = 0; i < remainingIds.length; i += 20) {
    const batch = remainingIds.slice(i, i + 20);
    const params = batch.map((id) => `post_ids[]=${id}`).join("&");
    const url = `${BASE_URL}/t/${topicId}/posts.json?${params}`;

    await sleep(DELAY_MS);
    const data = await fetchJSON(url);

    if (data?.post_stream?.posts) {
      loadedPosts.push(...data.post_stream.posts);
    }
  }

  return loadedPosts;
}

// --- Main ---

async function main(): Promise<void> {
  const limit = parseLimit();
  if (limit !== null) {
    console.log(`Running with --limit ${limit}`);
  }

  const progress = loadProgress();
  const completedSet = new Set(progress.completedTopicIds);
  const seenUrls = new Set(progress.images.map((img) => img.url));
  const images: ImageRecord[] = [...progress.images];

  console.log(
    `Loaded progress: ${completedSet.size} topics completed, ${images.length} images collected.`
  );

  const topics = await getAllTopicIds(limit);
  let processed = 0;

  for (const topic of topics) {
    processed++;

    if (completedSet.has(topic.id)) {
      console.log(
        `[${processed}/${topics.length}] Skipping topic ${topic.id} (already done)`
      );
      continue;
    }

    console.log(
      `[${processed}/${topics.length}] Scraping topic ${topic.id}: "${topic.title}"`
    );

    const posts = await fetchAllPostsForTopic(topic.id);
    let newImages = 0;

    for (const post of posts) {
      const extracted = extractImages(
        post.cooked || "",
        topic.id,
        topic.title,
        post.username,
        post.created_at
      );

      for (const img of extracted) {
        if (!seenUrls.has(img.url)) {
          seenUrls.add(img.url);
          images.push(img);
          newImages++;
        }
      }
    }

    console.log(
      `  Found ${newImages} new images (total: ${images.length})`
    );

    // Mark topic complete and save progress
    completedSet.add(topic.id);
    progress.completedTopicIds = Array.from(completedSet);
    progress.images = images;
    saveProgress(progress);
  }

  // Write final output
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(images, null, 2), "utf-8");

  console.log(`\nDone! Wrote ${images.length} images to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
