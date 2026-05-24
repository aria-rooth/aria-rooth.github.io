#!/usr/bin/env python3
"""Publish updated batches from kiemhiep/published/ to aria-rooth.github.io"""

import os
import re
from pathlib import Path

SITE_ROOT = Path("/home/thoor/work/aria-rooth.github.io")
PUBLISHED_DIR = Path("/home/thoor/papers/writing/kiemhiep/published")
STORIES_DIR = SITE_ROOT / "src/pages/works/aethermoor"

STORY_MAP = {
    "2b": ("trong-the", "/works/aethermoor/trong-the", 60),
    "europa": ("mua-tren-canh-khong-nguoi", "/works/aethermoor/mua-tren-canh-khong-nguoi", 60),
    "eve": ("tram-gac-buc-tuong-thu-tu", "/works/aethermoor/tram-gac-buc-tuong-thu-tu", 60),
}

def parse_batch(file_path):
    """Parse batch markdown into individual chapters."""
    raw = file_path.read_text(encoding="utf-8")
    lines = raw.split("\n")
    chapters = []
    current = None
    content_lines = []
    
    for i, line in enumerate(lines):
        match = re.match(r"^#{1,2} Chương (\d+): (.+)$", line)
        if match:
            if current:
                current["content"] = "\n".join(content_lines).strip()
                chapters.append(current)
            current = {
                "num": int(match.group(1)),
                "title": f"Chương {match.group(1)}: {match.group(2)}",
                "content": ""
            }
            content_lines = []
        elif current:
            # Skip --- separators between chapters
            if line == "---" and i > 0:
                next_idx = i + 1
                while next_idx < len(lines) and lines[next_idx].strip() == "":
                    next_idx += 1
                if next_idx < len(lines) and re.match(r"^#{1,2} Chương \d+:", lines[next_idx]):
                    continue
            content_lines.append(line)
    
    if current:
        content = "\n".join(content_lines).strip()
        # Clean trailing nav
        content = re.sub(r"\n---\n\*→ .*\*\s*$", "", content).strip()
        current["content"] = content
        chapters.append(current)
    
    return chapters

def build_chapter_file(chapter, story_key, story_path, total):
    layout = "../../../../layouts/ChapterLayout.astro"
    return f"""---
layout: {layout}
chapter: {chapter['num']}
story: "{story_path}"
total: {total}
title: "{chapter['title']}"
---

{chapter['content']}
"""

def main():
    published = 0
    
    for batch_file in sorted(PUBLISHED_DIR.glob("*-ch*-final.md")):
        # Parse filename: 2b-ch36-40-final.md
        match = re.match(r"^(\w+)-ch(\d+)-(\d+)-final\.md$", batch_file.name)
        if not match:
            continue
        
        agent, start, end = match.group(1), int(match.group(2)), int(match.group(3))
        if agent not in STORY_MAP:
            continue
        
        story_key, story_path, total = STORY_MAP[agent]
        story_dir = STORIES_DIR / story_key
        story_dir.mkdir(parents=True, exist_ok=True)
        
        chapters = parse_batch(batch_file)
        print(f"\n{batch_file.name}: {len(chapters)} chapters")
        
        for ch in chapters:
            out_path = story_dir / f"chuong-{ch['num']}.md"
            file_content = build_chapter_file(ch, story_key, story_path, total)
            out_path.write_text(file_content, encoding="utf-8")
            print(f"  ✓ {story_key}/chuong-{ch['num']}.md")
            published += 1
    
    print(f"\nDone. Published/updated {published} chapters.")

if __name__ == "__main__":
    main()
