import { describe, expect, it } from 'vitest';
import { generateCabinet } from './cabinetGenerator';

function makeWorkspaceGroup() {
  return {
    Workspace: {
      parentId: null,
      visible: true,
      isExpanded: true,
      name: 'Workspace',
    },
  };
}

describe('generateCabinet', () => {
  it('generates the standard 5 cabinet panels with expected dimensions', () => {
    const result = generateCabinet(
      {
        width: 24,
        height: 30,
        depth: 14,
        thicknessTB: 0.75,
        thicknessSide: 0.75,
        thicknessFront: 0.75,
        thicknessBack: 0.25,
        material: 'walnut',
        backStyle: 'flat',
      },
      [],
      makeWorkspaceGroup(),
    );

    expect(result.newBoards).toHaveLength(5);
    expect(result.groupId).toMatch(/^Cabinet /);
    expect(result.savedParams.width).toBe(24);
    expect(result.backStyle).toBe('flat');

    const bottom = result.newBoards.find((b) => b.name === 'Bottom');
    const top = result.newBoards.find((b) => b.name === 'Top');
    const left = result.newBoards.find((b) => b.name === 'Left Side');
    const right = result.newBoards.find((b) => b.name === 'Right Side');
    const back = result.newBoards.find((b) => b.name === 'Back');

    expect(bottom.size).toEqual([22.5, 0.75, 13.75]);
    expect(top.size).toEqual([22.5, 0.75, 13.75]);
    expect(left.size).toEqual([0.75, 30, 13.75]);
    expect(right.size).toEqual([0.75, 30, 13.75]);
    expect(back.size).toEqual([24, 30, 0.25]);

    expect(back.material).toBe('walnut');
    expect(back.lumberType).toBe('plywood');
  });

  it('shrinks the back panel for inset backs and adds dado operations to surrounding panels', () => {
    const result = generateCabinet(
      {
        width: 24,
        height: 30,
        depth: 14,
        thicknessTB: 0.75,
        thicknessSide: 0.75,
        thicknessFront: 0.75,
        thicknessBack: 0.25,
        backStyle: 'inset',
      },
      [],
      makeWorkspaceGroup(),
    );

    const back = result.newBoards.find((b) => b.name === 'Back');
    const top = result.newBoards.find((b) => b.name === 'Top');
    const bottom = result.newBoards.find((b) => b.name === 'Bottom');
    const left = result.newBoards.find((b) => b.name === 'Left Side');
    const right = result.newBoards.find((b) => b.name === 'Right Side');

    expect(back.size).toEqual([23.25, 29.25, 0.25]);
    expect(top.operations).toHaveLength(1);
    expect(bottom.operations).toHaveLength(1);
    expect(left.operations).toHaveLength(1);
    expect(right.operations).toHaveLength(1);

    expect(left.operations[0].type).toBe('dado');
    expect(left.operations[0].face).toBe('right');
    expect(right.operations[0].face).toBe('left');
    expect(bottom.operations[0].face).toBe('top');
    expect(top.operations[0].face).toBe('bottom');
  });

  it('preserves existing child board ids when editing an existing cabinet group', () => {
    const boards = [
      {
        id: 101,
        name: 'Bottom',
        parentId: 'Cabinet Existing',
        size: [22.5, 0.75, 13.75],
        position: [12, 0.375, 7],
      },
      {
        id: 102,
        name: 'Top',
        parentId: 'Cabinet Existing',
        size: [22.5, 0.75, 13.75],
        position: [12, 29.625, 7],
      },
      {
        id: 103,
        name: 'Left Side',
        parentId: 'Cabinet Existing',
        size: [0.75, 30, 13.75],
        position: [0.375, 15, 7],
      },
      {
        id: 104,
        name: 'Right Side',
        parentId: 'Cabinet Existing',
        size: [0.75, 30, 13.75],
        position: [23.625, 15, 7],
      },
      {
        id: 105,
        name: 'Back',
        parentId: 'Cabinet Existing',
        size: [24, 30, 0.25],
        position: [12, 15, 0.125],
      },
    ];

    const groups = {
      ...makeWorkspaceGroup(),
      'Cabinet Existing': {
        parentId: 'Workspace',
        visible: true,
        isExpanded: true,
        name: 'Cabinet Existing',
      },
    };

    const result = generateCabinet(
      {
        editGroupId: 'Cabinet Existing',
        width: 24,
        height: 30,
        depth: 14,
        thicknessTB: 0.75,
        thicknessSide: 0.75,
        thicknessFront: 0.75,
        thicknessBack: 0.25,
        backStyle: 'flat',
      },
      boards,
      groups,
    );

    expect(result.isEditing).toBe(true);
    expect(result.groupId).toBe('Cabinet Existing');

    const idsByName = Object.fromEntries(result.newBoards.map((b) => [b.name, b.id]));
    expect(idsByName.Bottom).toBe(101);
    expect(idsByName.Top).toBe(102);
    expect(idsByName['Left Side']).toBe(103);
    expect(idsByName['Right Side']).toBe(104);
    expect(idsByName.Back).toBe(105);
  });
});
