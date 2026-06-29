// Cloudflare Worker + D1 Todo App - Main Entry Point

import { handleRequest } from './api.js';

export default {
  fetch: handleRequest
};
