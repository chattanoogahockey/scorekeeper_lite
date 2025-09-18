const isNode = typeof process !== 'undefined' && !!process.versions?.node;
const ZOD_VERSION = '4.1.8';
const CDN_URL = `https://cdn.jsdelivr.net/npm/zod@${ZOD_VERSION}/+esm`;

const modulePromise = isNode ? import('zod') : import(CDN_URL);
const { z } = await modulePromise;

export { z };
