import { PrismaClient } from '@/generated/prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';

export type MockPrismaClient = DeepMockProxy<PrismaClient>;

export const prismaMock = mockDeep<PrismaClient>();

/**
 * Setup the transaction mock to handle both array and callback styles.
 * Call this in beforeEach after mockReset.
 */
export function setupTransactionMock() {
  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: MockPrismaClient) => Promise<unknown>)(prismaMock);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
}

/**
 * Reset the Prisma mock and re-setup transaction handling.
 * Call this in beforeEach.
 */
export function resetPrismaMock() {
  mockReset(prismaMock);
  setupTransactionMock();
}

// Initial setup
setupTransactionMock();
