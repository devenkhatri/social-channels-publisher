/**
 * Content extractor service
 * Parses markdown titles and descriptions, natural slide sorting, and folder status.
 */

export interface ExtractedContent {
  title: string;
  body: string;
}

/**
 * Extracts title (first markdown heading) and description/body from markdown text
 */
export function extractTitleAndBody(markdown: string): ExtractedContent {
  if (!markdown || !markdown.trim()) {
    return { title: "", body: "" };
  }

  const lines = markdown.split("\n");
  let title = "";
  let titleIndex = -1;

  // Look for first markdown heading (# Title or ## Title)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#")) {
      title = line.replace(/^#+\s*/, "").trim();
      titleIndex = i;
      break;
    }
  }

  // If no heading was found, use the first non-empty line as title
  if (!title) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length > 0) {
        title = line;
        titleIndex = i;
        break;
      }
    }
  }

  // The rest of the content (excluding the title line) is the body
  const bodyLines = lines.filter((_, idx) => idx !== titleIndex);
  const body = bodyLines.join("\n").trim();

  return { title, body };
}

export interface SlideItem {
  id: string;
  name: string;
  slideNumber: number;
  downloadUrl?: string;
  size?: number;
}

/**
 * Sorts slide files naturally by their numeric index (e.g. slide-1, slide-2, ... slide-10, slide-16)
 * Prevents lexicographical sorting bugs where slide-10 precedes slide-2.
 */
export function sortSlidesNaturally(
  files: Array<{ id: string; name: string; downloadUrl?: string; size?: number }>
): SlideItem[] {
  const regex = /slide[-_]?(\d+)/i;

  const slides: SlideItem[] = files.map((f) => {
    const match = f.name.match(regex);
    const slideNumber = match ? parseInt(match[1], 10) : 9999;
    return {
      id: f.id,
      name: f.name,
      slideNumber,
      downloadUrl: f.downloadUrl,
      size: f.size,
    };
  });

  slides.sort((a, b) => {
    if (a.slideNumber !== b.slideNumber) {
      return a.slideNumber - b.slideNumber;
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });

  return slides;
}

/**
 * Detects whether a folder has the "-Done" suffix (indicating already published)
 */
export function parseFolderStatus(folderName: string): {
  isDone: boolean;
  originalName: string;
} {
  const isDone = folderName.toLowerCase().endsWith("-done");
  const originalName = isDone ? folderName.replace(/-done$/i, "") : folderName;
  return { isDone, originalName };
}
