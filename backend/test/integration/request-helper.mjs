import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';

class MockSocket extends Duplex {
  constructor() {
    super();
    this.remoteAddress = '127.0.0.1';
  }

  _read() {}

  _write(_chunk, _encoding, callback) {
    callback();
  }

  setTimeout() {}

  setNoDelay() {}

  setKeepAlive() {}

  ref() {}

  unref() {}
}

const toBuffer = (value) => {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return Buffer.from(value);
  }

  return Buffer.from(JSON.stringify(value));
};

const buildMultipartBody = (fields, attachments) => {
  const boundary = `----falconsfind-test-${Math.random().toString(16).slice(2)}`;
  const chunks = [];

  for (const [name, value] of fields) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(
      Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`),
    );
    chunks.push(Buffer.from(String(value)));
    chunks.push(Buffer.from('\r\n'));
  }

  for (const attachment of attachments) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(
      Buffer.from(
        `Content-Disposition: form-data; name="${attachment.name}"; filename="${attachment.filename}"\r\n`,
      ),
    );
    chunks.push(Buffer.from(`Content-Type: ${attachment.contentType}\r\n\r\n`));
    chunks.push(attachment.buffer);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
};

const invokeApp = async (app, { method, url, jsonBody, fields, attachments, headers: requestHeaders = [] }) => {
  let body = null;
  const headers = {
    host: 'localhost',
    ...Object.fromEntries(requestHeaders.map(([key, value]) => [key.toLowerCase(), value])),
  };

  if (attachments.length > 0 || fields.length > 0) {
    const multipart = buildMultipartBody(fields, attachments);
    body = multipart.body;
    headers['content-type'] = multipart.contentType;
  } else if (jsonBody !== undefined) {
    body = jsonBody === undefined ? null : toBuffer(jsonBody);
    if (body) {
      headers['content-type'] = 'application/json';
    }
  }

  if (body) {
    headers['content-length'] = String(body.length);
  }

  const socket = new MockSocket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = url;
  req.headers = headers;
  req.socket = socket;
  req.connection = socket;

  const res = new ServerResponse(req);
  res.assignSocket(socket);

  const chunks = [];
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  res.write = (chunk, encoding, callback) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined));
    }
    return originalWrite(chunk, encoding, callback);
  };

  res.end = (chunk, encoding, callback) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined));
    }
    return originalEnd(chunk, encoding, callback);
  };

  const responsePromise = new Promise((resolve, reject) => {
    res.on('finish', () => {
      const responseBuffer = Buffer.concat(chunks);
      const text = responseBuffer.toString('utf8');
      const contentType = res.getHeader('content-type');
      let parsedBody = undefined;

      if (typeof contentType === 'string' && contentType.includes('application/json')) {
        parsedBody = text.length > 0 ? JSON.parse(text) : undefined;
      }

      const rawHeaders = res.getHeaders();
      const normalizedHeaders = Object.fromEntries(
        Object.entries(rawHeaders).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value)]),
      );

      resolve({
        status: res.statusCode,
        body: parsedBody,
        text,
        headers: normalizedHeaders,
      });
    });
    res.on('error', reject);
  });

  app.handle(req, res, (error) => {
    if (error) {
      res.statusCode = 500;
      res.end(String(error));
    }
  });

  process.nextTick(() => {
    if (body) {
      req.emit('data', body);
    }
    req.complete = true;
    req.emit('end');
  });

  return responsePromise;
};

class TestRequest {
  constructor(app, method, url) {
    this.app = app;
    this.method = method;
    this.url = url;
    this.jsonBody = undefined;
    this.fields = [];
    this.attachments = [];
    this.headers = [];
  }

  send(body = undefined) {
    this.jsonBody = body;
    return this;
  }

  field(name, value) {
    this.fields.push([name, value]);
    return this;
  }

  attach(name, buffer, options = {}) {
    this.attachments.push({
      name,
      buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
      filename: options.filename ?? 'upload.bin',
      contentType: options.contentType ?? 'application/octet-stream',
    });
    return this;
  }

  set(name, value) {
    this.headers.push([name, value]);
    return this;
  }

  then(onFulfilled, onRejected) {
    return invokeApp(this.app, this).then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return invokeApp(this.app, this).catch(onRejected);
  }

  finally(onFinally) {
    return invokeApp(this.app, this).finally(onFinally);
  }
}

export default function request(app) {
  return {
    get: (url) => new TestRequest(app, 'GET', url),
    post: (url) => new TestRequest(app, 'POST', url),
    patch: (url) => new TestRequest(app, 'PATCH', url),
  };
}
