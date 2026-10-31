export const FILE_KINDS = ['image', 'document'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

/**
 * Allow-lists keyed by the type detected from the file's content (magic bytes),
 * never from the client-supplied name or Content-Type. SVG and HTML are
 * deliberately absent because they can carry scripts.
 */
export const IMAGE_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const DOCUMENT_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

/** Plain-text formats have no magic bytes: accepted by extension after a content sanity check. */
export const TEXT_EXTENSIONS: Record<string, string> = {
  txt: 'text/plain',
  csv: 'text/csv',
};
