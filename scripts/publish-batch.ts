#!/usr/bin/env bun
// Publish a batch of chapters from papers/published/ to aria-rooth.github.io

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const SITE_ROOT = import.meta.dir.replace("/scripts", "");
const STORIES_DIR = join(SITE_ROOT, "src/pages/works/aethermoor");

interface Batch {
  file: string;
  story: string;      // directory name
  storyPath: string;  // /works/aethermoor/...
  layout: string;
  totalAfter: number; // total chapters after this batch
}

const BATCHES: Batch[] = [
  {
    file: "/home/thoor/papers/writing/kiemhiep/published/2b-ch26-30-final.md",
    story: "trong-the",
    storyPath: "/works/aethermoor/trong-the",
    layout: "../../../../layouts/ChapterLayout.astro",
    totalAfter: 30,
  },
  {
    file: "/home/thoor/papers/writing/kiemhiep/published/europa-ch26-30-final.md",
    story: "mua-tren-canh-khong-nguoi",
    storyPath: "/works/aethermoor/mua-tren-canh-khong-nguoi",
    layout: "../../../../layouts/ChapterLayout.astro",
    totalAfter: 30,
  },
  {
    file: "/home/thoor/papers/writing/kiemhiep/published/eve-ch26-30-final.md",
    story: "tram-gac-buc-tuong-thu-tu",
    storyPath: "/works/aethermoor/tram-gac-buc-tuong-thu-tu",
    layout: "../../../../layouts/ChapterLayout.astro",
    totalAfter: 35, // will be updated again by ch31-35
  },
  {
    file: "/home/thoor/papers/writing/kiemhiep/published/eve-ch31-35-final.md",
    story: "tram-gac-buc-tuong-thu-tu",
    storyPath: "/works/aethermoor/tram-gac-buc-tuong-thu-tu",
    layout: "../../../../layouts/ChapterLayout.astro",
    totalAfter: 35,
  },
];

interface Chapter {
  num: number;
  title: string;
  content: string;
}

function parseBatch(filePath: string): Chapter[] {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split("\n");

  const chapters: Chapter[] = [];
  let currentChapter: Chapter | null = null;
  let contentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const chapterMatch = line.match(/^## Chương (\d+): (.+)$/);

    if (chapterMatch) {
      // Save previous chapter
      if (currentChapter) {
        currentChapter.content = contentLines.join("\n").trim();
        chapters.push(currentChapter);
      }
      currentChapter = {
        num: parseInt(chapterMatch[1]),
        title: `Chương ${chapterMatch[1]}: ${chapterMatch[2]}`,
        content: "",
      };
      contentLines = [];
    } else if (currentChapter) {
      // Skip bare --- separators between chapters (they're dividers, not content)
      if (line === "---" && i > 0) {
        // Check if next non-empty line is a new chapter header
        let nextContentIdx = i + 1;
        while (nextContentIdx < lines.length && lines[nextContentIdx].trim() === "") {
          nextContentIdx++;
        }
        if (lines[nextContentIdx]?.match(/^## Chương \d+:/)) {
          continue; // skip this separator
        }
      }
      contentLines.push(line);
    }
    // Skip preamble lines before first chapter (navigation links, etc.)
  }

  // Save last chapter
  if (currentChapter) {
    currentChapter.content = contentLines.join("\n").trim();
    // Clean up trailing --- and navigation links
    currentChapter.content = currentChapter.content
      .replace(/\n---\n\*→ .*\*\s*$/, "")
      .trim();
    chapters.push(currentChapter);
  }

  return chapters;
}

function buildChapterFile(
  chapter: Chapter,
  batch: Batch,
  allChaptersInStory: number, // final total for story
): string {
  const { num, title, content } = chapter;
  const { layout, storyPath } = batch;

  const prevLink =
    num > 1
      ? `← [Chương ${num - 1}](chuong-${num - 1})`
      : "";
  const nav = prevLink
    ? `${prevLink}  **Chương ${num}/${allChaptersInStory}**`
    : `**Chương ${num}/${allChaptersInStory}**`;

  return `---
layout: ${layout}
chapter: ${num}
story: "${storyPath}"
total: ${allChaptersInStory}
title: "${title}"
---

${nav}

---

${content}

---

${nav}
`;
}

function updatePreviousLastChapter(
  story: string,
  prevLastNum: number,
  nextChapterNum: number,
  layout: string,
  storyPath: string,
  newTotal: number,
) {
  const filePath = join(STORIES_DIR, story, `chuong-${prevLastNum}.md`);
  let content = readFileSync(filePath, "utf-8");

  // Update total in frontmatter
  content = content.replace(/^total: \d+$/m, `total: ${newTotal}`);

  // Update nav lines (update **Chương N/OLD** → **Chương N/NEW**)
  content = content.replace(
    /\*\*Chương (\d+)\/\d+\*\*/g,
    `**Chương $1/${newTotal}**`,
  );

  // Add forward navigation if not already present
  if (!content.includes(`chuong-${nextChapterNum}`)) {
    const forwardLink = `→ [Chương ${nextChapterNum}](chuong-${nextChapterNum})`;
    // Replace the bottom nav to include forward link
    const bottomNavPattern = /(← \[Chương \d+\]\(chuong-\d+\)  \*\*Chương \d+\/\d+\*\*)(\s*)$/;
    if (bottomNavPattern.test(content)) {
      content = content.replace(
        bottomNavPattern,
        `$1  ${forwardLink}$2`,
      );
    }
    // Also update top nav
    const topNavPattern = /(← \[Chương \d+\]\(chuong-\d+\)  \*\*Chương \d+\/\d+\*\*)(\n\n---)/;
    if (topNavPattern.test(content)) {
      content = content.replace(
        topNavPattern,
        `$1  ${forwardLink}$2`,
      );
    }
  }

  writeFileSync(filePath, content, "utf-8");
  console.log(`  Updated ch${prevLastNum} navigation → ch${nextChapterNum}`);
}

// Final totals per story
const FINAL_TOTALS: Record<string, number> = {
  "trong-the": 30,
  "mua-tren-canh-khong-nguoi": 30,
  "tram-gac-buc-tuong-thu-tu": 35,
};

let publishedCount = 0;

for (const batch of BATCHES) {
  console.log(`\nProcessing: ${batch.file.split("/").pop()}`);
  const chapters = parseBatch(batch.file);
  console.log(`  Found ${chapters.length} chapters: ${chapters.map(c => c.num).join(", ")}`);

  const storyDir = join(STORIES_DIR, batch.story);
  mkdirSync(storyDir, { recursive: true });

  const finalTotal = FINAL_TOTALS[batch.story];
  const firstChapterNum = chapters[0].num;

  // Update the previous last chapter to add forward navigation
  if (firstChapterNum > 1) {
    const prevLastNum = firstChapterNum - 1;
    const prevFilePath = join(storyDir, `chuong-${prevLastNum}.md`);
    try {
      readFileSync(prevFilePath); // check exists
      updatePreviousLastChapter(
        batch.story,
        prevLastNum,
        firstChapterNum,
        batch.layout,
        batch.storyPath,
        finalTotal,
      );
    } catch {
      console.log(`  (ch${prevLastNum} not found, skipping nav update)`);
    }
  }

  // Write each chapter file
  for (const chapter of chapters) {
    const outPath = join(storyDir, `chuong-${chapter.num}.md`);
    const fileContent = buildChapterFile(chapter, batch, finalTotal);
    writeFileSync(outPath, fileContent, "utf-8");
    console.log(`  ✓ ${batch.story}/chuong-${chapter.num}.md: "${chapter.title}"`);
    publishedCount++;
  }
}

console.log(`\nDone. Published ${publishedCount} chapters.`);
