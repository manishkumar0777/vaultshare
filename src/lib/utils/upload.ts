import { NextApiRequest } from 'next';
import multer from 'multer';
import { Readable } from 'stream';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '25') * 1024 * 1024 // Default 25MB
  }
});

// Middleware to handle file uploads in Next.js API routes
export function runMiddleware(req: NextApiRequest, res: any, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export function parseFormData(req: NextApiRequest) {
  return new Promise<{
    fields: Record<string, string>;
    file?: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    }
  }>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const busboy = require('busboy');
    const bb = busboy({ headers: req.headers });

    const fields: Record<string, string> = {};
    let file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    } | undefined;

    bb.on('file', (fieldname: string, fileStream: Readable, info: { filename: string, mimeType: string }) => {
      const chunks: Uint8Array[] = [];
      let size = 0;

      fileStream.on('data', (chunk: Uint8Array) => {
        chunks.push(chunk);
        size += chunk.length;
      });

      fileStream.on('end', () => {
        if (size > parseInt(process.env.MAX_FILE_SIZE_MB || '25') * 1024 * 1024) {
          reject(new Error('File size exceeds limit'));
          return;
        }

        file = {
          buffer: Buffer.concat(chunks),
          originalname: info.filename,
          mimetype: info.mimeType,
          size: size
        };
      });
    });

    bb.on('field', (fieldname: string, val: string) => {
      fields[fieldname] = val;
    });

    bb.on('finish', () => {
      resolve({ fields, file });
    });

    bb.on('error', (err: Error) => {
      reject(err);
    });

    if (req.body) {
      // If the body is already parsed, we need to convert it back to a stream
      const bodyStream = Readable.from(Buffer.from(JSON.stringify(req.body)));
      bodyStream.pipe(bb);
    } else {
      req.pipe(bb);
    }
  });
}

export default upload;