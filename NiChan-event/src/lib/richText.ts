import DOMPurify, { type Config } from "dompurify";

const richTextConfig: Config = {
  ALLOWED_TAGS: [
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "font",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "span",
    "strong",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
  ],
  ALLOWED_ATTR: [
    "alt",
    "class",
    "color",
    "colspan",
    "face",
    "height",
    "href",
    "rel",
    "rowspan",
    "size",
    "src",
    "style",
    "target",
    "title",
    "width",
  ],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|\/(?!\/)|#|data:image\/(?:png|gif|jpe?g|webp);base64,)/i,
  FORBID_TAGS: ["button", "embed", "form", "iframe", "input", "link", "meta", "object", "script", "select", "style", "textarea"],
};

const allowedStyleProperties = new Set([
  "background-color",
  "color",
  "font-family",
  "font-size",
  "text-align",
]);

const hasHtmlTag = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const plainTextToRichTextHtml = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");

const isSafeColorValue = (value: string) =>
  /^(?:#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-z]+|transparent)$/i.test(value.trim());

const isSafeStyleValue = (property: string, value: string) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || /(?:behavior|expression|javascript|url\(|@import)/i.test(normalized)) return false;

  if (property === "color" || property === "background-color") return isSafeColorValue(normalized);
  if (property === "text-align") return /^(?:left|center|right|justify)$/i.test(normalized);
  if (property === "font-family") return /^[\w\s"',.-]+$/.test(normalized);
  if (property === "font-size") {
    return /^(?:\d{1,3}(?:\.\d+)?(?:px|em|rem|%)|xx-small|x-small|small|medium|large|x-large|xx-large)$/i.test(normalized);
  }

  return false;
};

const cleanInlineStyles = (html: string) => {
  if (typeof document === "undefined") return html;

  const template = document.createElement("template");
  template.innerHTML = html;

  template.content.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const safeDeclarations = (element.getAttribute("style") ?? "")
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .reduce<string[]>((safe, declaration) => {
        const [rawProperty, ...rawValueParts] = declaration.split(":");
        const property = rawProperty?.trim().toLowerCase();
        const value = rawValueParts.join(":").trim();

        if (property && allowedStyleProperties.has(property) && isSafeStyleValue(property, value)) {
          safe.push(`${property}: ${value}`);
        }

        return safe;
      }, []);

    if (safeDeclarations.length > 0) {
      element.setAttribute("style", safeDeclarations.join("; "));
    } else {
      element.removeAttribute("style");
    }
  });

  template.content.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    if (link.target === "_blank") {
      link.rel = "noopener noreferrer";
    }
  });

  return template.innerHTML;
};

export const sanitizeRichTextHtml = (value: string) => {
  const clean = DOMPurify.sanitize(value, richTextConfig) as string;
  return cleanInlineStyles(clean).trim();
};

export const normalizeRichTextInput = (value: string) => {
  const source = value.trim();
  if (!source) return "";

  const html = hasHtmlTag(source) ? source : plainTextToRichTextHtml(source);
  return sanitizeRichTextHtml(html);
};

export const richTextToPlainText = (value: string) => {
  const html = normalizeRichTextInput(value);
  if (!html) return "";

  if (typeof document === "undefined") {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  return (template.content.textContent ?? "").replace(/\s+/g, " ").trim();
};

export const hasMeaningfulRichText = (value: string) => {
  const html = normalizeRichTextInput(value);
  if (!html) return false;
  if (/<(?:hr|img|table)\b/i.test(html)) return true;
  return richTextToPlainText(html).length > 0;
};
