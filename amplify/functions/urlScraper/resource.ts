import { defineFunction, secret } from '@aws-amplify/backend';

export const urlScraperFunction = defineFunction({
  name: 'urlScraper',
  entry: './handler.ts',
  timeoutSeconds: 90,
  memoryMB: 256,
  environment: {
    BRIGHTDATA_API_KEY: secret('BRIGHTDATA_API_KEY'),
  },
});
