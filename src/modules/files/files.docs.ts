import {
  bearer,
  paginatedResponse,
  parametersOf,
  ref,
  responses,
  successResponse,
} from '../../docs/common';
import { idParamsSchema } from '../../utils/object-id';
import { FILE_KINDS } from './files.constants';
import { listFilesQuerySchema } from './files.schema';

const idParam = parametersOf(idParamsSchema, 'path');

const multipart = (field: string, description: string) => ({
  required: true,
  content: {
    'multipart/form-data': {
      schema: {
        type: 'object',
        required: [field],
        properties: {
          [field]: { type: 'array', items: { type: 'string', format: 'binary' }, description },
        },
      },
    },
  },
});

const binary = (description: string, contentType: string) => ({
  description,
  content: { [contentType]: { schema: { type: 'string', format: 'binary' } } },
});

const uploadErrors = {
  400: responses.badRequest,
  401: responses.unauthorized,
  413: { ...responses.badRequest, description: 'File too large' },
  415: { ...responses.badRequest, description: 'File type not allowed (checked from the file content)' },
};

export const filesDocs = {
  schemas: {
    File: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '665f1c2e8f1b2a0012a4b3c4' },
        owner: { type: 'string' },
        originalName: { type: 'string', example: 'invoice.pdf' },
        mimeType: { type: 'string', example: 'application/pdf', description: 'Detected from content' },
        extension: { type: 'string', example: 'pdf' },
        size: { type: 'integer', description: 'Bytes' },
        kind: { type: 'string', enum: [...FILE_KINDS] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  },
  paths: {
    '/files/images': {
      post: {
        tags: ['Files'],
        summary: 'Upload images (JPEG, PNG, WebP, GIF)',
        description: 'Send `multipart/form-data` with up to 5 files in the `images` field. All-or-nothing.',
        security: bearer,
        requestBody: multipart('images', 'Image files'),
        responses: { 201: successResponse('Images uploaded', { type: 'array', items: ref('File') }), ...uploadErrors },
      },
    },
    '/files': {
      post: {
        tags: ['Files'],
        summary: 'Upload files (images, PDF, DOCX, XLSX, PPTX, ZIP, TXT, CSV)',
        description:
          'Send `multipart/form-data` with files in the `files` field (limits come from `MAX_UPLOAD_FILES` / `MAX_UPLOAD_SIZE_MB`). The type is verified from the file content, not the extension or Content-Type.',
        security: bearer,
        requestBody: multipart('files', 'Files to upload'),
        responses: { 201: successResponse('Files uploaded', { type: 'array', items: ref('File') }), ...uploadErrors },
      },
      get: {
        tags: ['Files'],
        summary: 'List my files',
        description: 'Regular users see their own files; admins and managers see all.',
        security: bearer,
        parameters: parametersOf(listFilesQuerySchema, 'query'),
        responses: { 200: paginatedResponse('Files', 'File'), 400: responses.badRequest, 401: responses.unauthorized },
      },
    },
    '/files/{id}': {
      get: {
        tags: ['Files'],
        summary: 'Get file metadata',
        security: bearer,
        parameters: idParam,
        responses: { 200: successResponse('File', ref('File')), 401: responses.unauthorized, 404: responses.notFound },
      },
      delete: {
        tags: ['Files'],
        summary: 'Delete a file (record and content)',
        security: bearer,
        parameters: idParam,
        responses: { 200: successResponse('File deleted'), 401: responses.unauthorized, 404: responses.notFound },
      },
    },
    '/files/{id}/download': {
      get: {
        tags: ['Files'],
        summary: 'Download a file',
        description: 'Streams the content as an attachment with the original file name.',
        security: bearer,
        parameters: idParam,
        responses: {
          200: binary('File content', 'application/octet-stream'),
          401: responses.unauthorized,
          404: responses.notFound,
        },
      },
    },
    '/files/{id}/view': {
      get: {
        tags: ['Files'],
        summary: 'View an image inline',
        description: 'Images only. Fetch with the Authorization header and render the blob.',
        security: bearer,
        parameters: idParam,
        responses: {
          200: binary('Image content', 'image/*'),
          400: responses.badRequest,
          401: responses.unauthorized,
          404: responses.notFound,
        },
      },
    },
  },
};
