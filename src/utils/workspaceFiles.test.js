import { describe, expect, it, vi } from 'vitest';
import { updateRecentFilesList } from './workspaceFiles';

describe('workspaceFiles', () => {
  it('moves an existing file to the front of recent files', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    const next = updateRecentFilesList(
      [
        { name: 'A', timestamp: 1 },
        { name: 'B', timestamp: 2 },
      ],
      'B',
    );

    expect(next).toEqual([
      { name: 'B', timestamp: 1234 },
      { name: 'A', timestamp: 1 },
    ]);
  });

  it('limits the list to five entries', () => {
    vi.spyOn(Date, 'now').mockReturnValue(999);
    const next = updateRecentFilesList(
      [
        { name: 'A', timestamp: 1 },
        { name: 'B', timestamp: 2 },
        { name: 'C', timestamp: 3 },
        { name: 'D', timestamp: 4 },
        { name: 'E', timestamp: 5 },
      ],
      'F',
    );

    expect(next).toHaveLength(5);
    expect(next[0]).toEqual({ name: 'F', timestamp: 999 });
    expect(next.at(-1)?.name).toBe('D');
  });
});
