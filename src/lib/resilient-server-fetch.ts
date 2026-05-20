import https from 'node:https';

function shouldAllowInsecureTls() {
  return process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0';
}

function isTlsCertificateChainError(error: unknown) {
  return (
    error instanceof Error &&
    /self-signed certificate in certificate chain/i.test(error.message)
  );
}

async function nodeHttpsFetchOnce(
  input: string | URL | Request,
  init?: RequestInit,
  rejectUnauthorized = true
) {
  const requestUrl =
    input instanceof Request ? input.url : input instanceof URL ? input.toString() : String(input);
  const requestMethod = init?.method || (input instanceof Request ? input.method : 'GET');
  const requestHeaders = new Headers(input instanceof Request ? input.headers : init?.headers);
  const requestBody =
    init?.body ||
    (input instanceof Request && input.method !== 'GET' && input.method !== 'HEAD'
      ? await input.text()
      : undefined);

  return new Promise<Response>((resolve, reject) => {
    if (init?.signal?.aborted) {
      reject(init.signal.reason || new Error('Request aborted.'));
      return;
    }

    const request = https.request(
      requestUrl,
      {
        method: requestMethod,
        headers: Object.fromEntries(requestHeaders.entries()),
        rejectUnauthorized,
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        response.on('end', () => {
          const body = Buffer.concat(chunks);
          const headers = new Headers();

          Object.entries(response.headers).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              value.forEach((headerValue) => headers.append(key, headerValue));
              return;
            }

            if (typeof value === 'string') {
              headers.set(key, value);
            }
          });

          resolve(
            new Response(body, {
              status: response.statusCode || 500,
              statusText: response.statusMessage || '',
              headers,
            })
          );
        });
      }
    );

    const abortRequest = () => {
      request.destroy(init?.signal?.reason || new Error('Request aborted.'));
    };

    init?.signal?.addEventListener('abort', abortRequest, { once: true });
    request.setTimeout(8000, () => {
      request.destroy(new Error('Request timed out.'));
    });
    request.on('error', reject);
    request.on('close', () => {
      init?.signal?.removeEventListener('abort', abortRequest);
    });

    if (requestBody) {
      request.write(requestBody);
    }

    request.end();
  });
}

export async function resilientServerFetch(input: string | URL | Request, init?: RequestInit) {
  try {
    return await nodeHttpsFetchOnce(input, init, !shouldAllowInsecureTls());
  } catch (error) {
    if (!shouldAllowInsecureTls() && isTlsCertificateChainError(error)) {
      return nodeHttpsFetchOnce(input, init, false);
    }

    throw error;
  }
}
