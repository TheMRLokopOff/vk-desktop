import { promises as dns } from 'dns';
import https from 'https';
import { timer, isObject } from './utils';

interface RequestOptions {
  raw?: boolean
  timeout?: number
  body?: string
  multipart?: Record<string, {
    filename: string
    contentType: string
    value: NodeJS.ReadableStream
  }>
  pipe?: NodeJS.WritableStream
  progress?(options: {
    size: number
    downloaded: number
    progress: number
  }): void
}

interface RequestResult<ResponseType> {
  data: ResponseType
  headers: import('http').IncomingHttpHeaders
  statusCode: number
}

/**
 * 1. request(paramsOrUrl)
 * 2. request(paramsOrUrl, options)
 * 3. request(url, params, options)
 */
function request<ResponseType>(
  paramsOrUrl: https.RequestOptions | string,
  paramsOrOptions?: https.RequestOptions | RequestOptions,
  options?: RequestOptions
) {
  if (arguments.length < 3) {
    options = paramsOrOptions;
    paramsOrOptions = {} as https.RequestOptions;
  }

  return new Promise<RequestResult<ResponseType>>((resolve, reject) => {
    function handleRequest(res) {
      const chunks: Uint8Array[] = [];
      const MB = 1 << 20;
      const contentLength = +res.headers['content-length'];
      let loadedLength = 0;

      if (options.pipe) {
        res.pipe(options.pipe);
      }

      res.on('data', (chunk: Uint8Array) => {
        if (!options.pipe) {
          chunks.push(chunk);
        }

        if (options.progress) {
          loadedLength += chunk.length;

          options.progress({
            // Размер файла в МБ
            size: contentLength / MB,
            // Сколько МБ уже скачалось
            downloaded: loadedLength / MB,
            // Сколько МБ уже скачалось в процентах
            progress: (loadedLength / contentLength) * 100
          });
        }
      });

      res.on('end', () => {
        const raw = String(Buffer.concat(chunks));

        resolve({
          data: options.raw ? raw : JSON.parse(raw),
          headers: res.headers,
          statusCode: res.statusCode
        });
      });
    }

    const req = isObject(paramsOrUrl)
      ? https.request(paramsOrUrl, handleRequest)
      : https.request(paramsOrUrl, paramsOrOptions, handleRequest);

    req.on('error', reject);

    if (options.timeout) {
      req.setTimeout(options.timeout, req.abort);
    }

    if (options.multipart) {
      sendMultipart(req, options.multipart);
    } else {
      req.end(options.body || '');
    }
  });
}

// multipart: {
//   photo: {
//     value: fs.createReadStream(pathToFile),
//     filename: 'photo.png',
//     contentType: 'image/png'
//   }
// }
async function sendMultipart(req: import('http').ClientRequest, files: RequestOptions['multipart']) {
  const names = Object.keys(files);
  const boundary = Math.random().toString(16);

  req.setHeader('Content-Type', `multipart/form-data; boundary="${boundary}"`);

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const file = files[name];
    const body = `--${boundary}\r\n`
               + `Content-Type: ${file.contentType}\r\n`
               + `Content-Disposition: form-data; name="${name}"; filename="${file.filename}"\r\n`
               + 'Content-Transfer-Encoding: binary\r\n\r\n';

    req.write(`\r\n${body}`);

    await new Promise((resolve) => {
      file.value
        .pipe(req, { end: false })
        .on('end', () => {
          if (i === names.length - 1) {
            req.end(`\r\n--${boundary}--`);
          } else {
            req.write(`\r\n--${boundary}`);
          }

          resolve();
        });
    });
  }
}

// Промис сохраняется для того, чтобы при дальнейших вызовах request
// не создавался новый промис, а ожидалось завершение созданного ранее
let waitConnectionPromise: Promise<void>;

async function waitConnection() {
  while (true) {
    try {
      await dns.lookup('api.vk.com');
      waitConnectionPromise = null;
      break;
    } catch {
      if (navigator.onLine) {
        await timer(5000);
      } else {
        await new Promise((resolve) => {
          window.addEventListener('online', resolve, { once: true });
        });
      }
    }
  }
}

export default async function<ResponseType>(
  paramsOrUrl: https.RequestOptions | string,
  paramsOrOptions?: https.RequestOptions | RequestOptions,
  options?: RequestOptions
) {
  while (true) {
    try {
      return await request<ResponseType>(paramsOrUrl, paramsOrOptions, options);
    } catch (err) {
      // Если ошибка не относится к проблемам с сетью, то выкидываем ошибку
      if (!['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'].includes(err.code)) {
        throw err;
      }

      if (!waitConnectionPromise) {
        waitConnectionPromise = waitConnection();
      }

      await waitConnectionPromise;
    }
  }
}
