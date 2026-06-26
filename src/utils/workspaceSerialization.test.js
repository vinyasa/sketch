import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceDocument,
  parseWorkspaceString,
  WORKSPACE_SCHEMA_VERSION,
} from './workspaceSerialization';

describe('workspaceSerialization', () => {
  it('parses a versioned workspace document', () => {
    const payload = {
      boards: [
        {
          id: 1,
          name: 'Board A',
          size: [12, 0.75, 8],
          position: [0, 0.375, 0],
          operations: [],
          shape: 'box',
          parentId: 'Workspace',
        },
      ],
      groups: {
        Workspace: {
          parentId: null,
          visible: true,
          isExpanded: true,
          name: 'Workspace',
        },
      },
      constraints: {},
    };

    const document = buildWorkspaceDocument(payload);
    expect(document.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);

    const parsed = parseWorkspaceString(JSON.stringify(document));

    expect(parsed.boards).toHaveLength(1);
    expect(parsed.boards[0].name).toBe('Board A');
    expect(parsed.groups.Workspace.name).toBe('Workspace');
  });
});
