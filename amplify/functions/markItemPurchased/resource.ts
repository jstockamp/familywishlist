import { defineFunction } from '@aws-amplify/backend';

export const markItemPurchasedFunction = defineFunction({
  name: 'markItemPurchased',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 128,
});
