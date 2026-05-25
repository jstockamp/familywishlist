import { defineFunction, secret } from '@aws-amplify/backend';

export const urlScraperFunction = defineFunction({
  name: 'urlScraper',
  entry: './handler.ts',
  timeoutSeconds: 180,
  memoryMB: 256,
  environment: {
    BRIGHTDATA_API_KEY: secret('BRIGHTDATA_API_KEY'),
  },
});
