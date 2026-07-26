import { withFirestoreRetry } from './firestore-retry.util';

describe('withFirestoreRetry', () => {
  it('returns on first success', async () => {
    const operation = jest.fn().mockResolvedValue('ok');

    await expect(withFirestoreRetry(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on transient Firestore errors then succeeds', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce({ code: 4, message: 'Deadline exceeded' })
      .mockResolvedValueOnce('ok');

    await expect(withFirestoreRetry(operation, { maxAttempts: 2 })).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('throws after max attempts on transient errors', async () => {
    const error = { code: 14, message: 'UNAVAILABLE' };
    const operation = jest.fn().mockRejectedValue(error);

    await expect(withFirestoreRetry(operation, { maxAttempts: 2 })).rejects.toEqual(error);
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
