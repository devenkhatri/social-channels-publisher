/**
 * Content extractor service
 * Parses markdown titles and descriptions, natural slide sorting, and folder status.
 */

export interface ExtractedContent {
  title: string;
  body: string;
}

/**
 * Strips all markdown formatting characters and tokens from text,
 * producing clean plain text ready for social channels (LinkedIn, YouTube,
 * Instagram, Facebook, Skool, etc.).
 *
 * Preserves hashtags (#AI, #Tech), rank numbers (#1), emojis, and mentions (@name).
 */
export function stripMarkdown(text: string | null | undefined): string {
  if (!text) return "";

  let result = text;

  // 1. Remove HTML comments
  result = result.replace(/<!--[\s\S]*?-->/g, "");

  // 2. Normalize newlines
  result = result.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 3. Fenced code blocks: remove code fences (e.g. ```typescript ... ```) but keep content
  result = result.replace(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)^```$/gm, "$1");
  result = result.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, "$1");

  // 4. Footnotes
  result = result.replace(/\[\^[^\]]+\]/g, "");
  result = result.replace(/^[ \t]*\[\^[^\]]+\]:.*$/gm, "");

  // 5. Reference links definitions
  result = result.replace(/^[ \t]*\[[^\]]+\]:[ \t]*\S+.*$/gm, "");
  result = result.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1");

  // 6. Markdown table separator lines (e.g. |---|---|) and table outer pipes
  result = result.replace(/^[ \t]*\|?(?:[ \t]*:?-+:?[ \t]*\|)+[ \t]*:?-+:?[ \t]*\|?[ \t]*$/gm, "");
  result = result.replace(/^[ \t]*\|[ \t]*(.*?)[ \t]*\|[ \t]*$/gm, "$1");

  // 7. Horizontal rules (---, ***, ___) or setext underlines (===, ---) on their own line
  result = result.replace(/^[ \t]*([-*_])[ \t]*(?:\1[ \t]*){2,}[ \t]*$/gm, "");
  result = result.replace(/^[ \t]*={2,}[ \t]*$/gm, "");

  // 8. Headings: "# Heading" -> "Heading" (1 to 6 # followed by whitespace)
  // Preserves hashtags (#AI) and numbers (#1) because they do not have whitespace after #
  result = result.replace(/^[ \t]*#{1,6}[ \t]+(.*?)(?:[ \t]+#{1,6})?[ \t]*$/gm, "$1");

  // 9. Blockquotes: "> quote" -> "quote"
  result = result.replace(/^[ \t]*(?:>[ \t]?)+(.*)$/gm, "$1");

  // 10. Checkboxes: "- [ ] todo" -> "☐ todo", "- [x] done" -> "☑ done"
  result = result.replace(/^[ \t]*[-*+]\s+\[ \]\s+/gm, "☐ ");
  result = result.replace(/^[ \t]*[-*+]\s+\[[xX]\]\s+/gm, "☑ ");

  // 11. Asterisk/plus list markers at line start: "* item" or "+ item" -> "• item"
  result = result.replace(/^[ \t]*[*+][ \t]+/gm, "• ");

  // 12. Images: "![alt](url)" -> "alt"
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");

  // 13. Links: "[text](url)"
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText, url) => {
    const cleanText = linkText.trim();
    const cleanUrl = url.trim();
    if (!cleanText) return cleanUrl;
    if (!cleanUrl) return cleanText;
    if (cleanText.toLowerCase() === cleanUrl.toLowerCase()) return cleanUrl;
    if (cleanText.includes(cleanUrl)) return cleanText;
    if (/^(?:https?:\/\/|mailto:)/i.test(cleanUrl)) {
      return `${cleanText} (${cleanUrl})`;
    }
    return cleanText;
  });

  // 14. Inline code: `code`
  result = result.replace(/`([^`\n]+)`/g, "$1");

  // 15. Strikethrough: "~~text~~"
  result = result.replace(/~~([^~\n]+?)~~/g, "$1");

  // 16. Bold & Italic (asterisks)
  // Bold-italic: ***text***
  result = result.replace(/\*\*\*([^*\n]+?)\*\*\*/g, "$1");
  // Bold: **text**
  result = result.replace(/\*\*([^*\n]+?)\*\*/g, "$1");
  // Italic: *text* (must not be preceded or followed by asterisk, and no internal newlines)
  result = result.replace(/(?<!\*)\*([^*\n\s](?:[^*\n]*?[^*\n\s])?)\*(?!\*)/g, "$1");

  // 17. Bold & Italic (underscores) - only when bounded by whitespace/punctuation to preserve snake_case & handles
  // Bold-italic: ___text___
  result = result.replace(/(?<=^|[\s\p{P}])___([^_\n]+?)___(?=[\s\p{P}]|$)/gu, "$1");
  // Bold: __text__
  result = result.replace(/(?<=^|[\s\p{P}])__([^_\n]+?)__(?=[\s\p{P}]|$)/gu, "$1");
  // Italic: _text_
  result = result.replace(/(?<=^|[\s\p{P}])_([^_\n\s](?:[^_\n]*?[^_\n\s])?)_(?=[\s\p{P}]|$)/gu, "$1");

  // 18. HTML tags (like <b>, </i>, <br/>)
  result = result.replace(/<br\s*\/?>/gi, "\n");
  result = result.replace(/<hr\s*\/?>/gi, "");
  result = result.replace(/<\/?[a-zA-Z][^>]*>/g, "");

  // 19. Normalize consecutive blank lines (collapse 3+ newlines to 2)
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/**
 * Extracts title (first markdown heading) and description/body from markdown text,
 * stripping all markdown formatting characters from both.
 */
export function extractTitleAndBody(markdown: string): ExtractedContent {
  if (!markdown || !markdown.trim()) {
    return { title: "", body: "" };
  }

  const lines = markdown.split("\n");
  let rawTitle = "";
  let titleIndex = -1;

  // Look for first markdown heading (# Title or ## Title)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^#{1,6}\s+/.test(line)) {
      rawTitle = line.replace(/^#{1,6}\s+/, "").trim();
      titleIndex = i;
      break;
    }
  }

  // If no heading was found, use the first non-empty line as title
  if (!rawTitle) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length > 0) {
        rawTitle = line;
        titleIndex = i;
        break;
      }
    }
  }

  // The rest of the content (excluding the title line) is the body
  const bodyLines = lines.filter((_, idx) => idx !== titleIndex);
  const rawBody = bodyLines.join("\n").trim();

  return {
    title: stripMarkdown(rawTitle),
    body: stripMarkdown(rawBody),
  };
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

/**
 * Determines if a folder should be skipped from processing.
 * Rules:
 * 1. Skip if the folder name does not start with a number (0-9).
 * 2. Skip if the folder name ends with "Skip" or "Skipped" (case-insensitive).
 */
export function shouldSkipFolder(folderName: string): boolean {
  if (!folderName) return true;
  const trimmed = folderName.trim();

  // Rule 1: Folder name must start with a digit
  if (!/^\d/.test(trimmed)) {
    return true;
  }

  // Rule 2: Folder name must not end with "Skip" or "Skipped"
  if (/(?:skip|skipped)$/i.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Returns human-readable reason why a folder was skipped, or null if valid.
 */
export function getFolderSkipReason(folderName: string): string | null {
  if (!folderName) return "Empty folder name";
  const trimmed = folderName.trim();

  if (!/^\d/.test(trimmed)) {
    return "Folder name does not start with a number";
  }

  if (/(?:skip|skipped)$/i.test(trimmed)) {
    return "Folder name ends with Skip or Skipped";
  }

  return null;
}

