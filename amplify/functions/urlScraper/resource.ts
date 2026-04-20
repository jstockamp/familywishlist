import { defineFunction } from '@aws-amplify/backend';

export const urlScraperFunction = defineFunction({
  name: 'urlScraper',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256,
});
