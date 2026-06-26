import { collectChildBoards } from './sceneGraph';

export function resolveTargetIds(target, boards, groups, selectedItemIds) {
  if (!target) return [];

  let rawTargetIds = [];

  if (target.scope === 'all') {
    rawTargetIds = boards.map((board) => board.id.toString());
  } else if (target.scope === 'selected') {
    rawTargetIds = selectedItemIds;
  } else if (target.scope === 'ids') {
    rawTargetIds = (target.ids || []).map(String);
  } else if (target.scope === 'name' && target.value) {
    const searchName = target.value.toLowerCase();
    const matchedBoards = boards
      .filter((board) => board.name?.toLowerCase().includes(searchName))
      .map((board) => board.id.toString());
    const matchedGroups = Object.entries(groups)
      .filter(([, group]) => group.name?.toLowerCase().includes(searchName))
      .map(([id]) => id);
    rawTargetIds = [...matchedBoards, ...matchedGroups];
  }

  const expandedSet = new Set();
  rawTargetIds.forEach((id) => {
    if (groups[id]) {
      const children = collectChildBoards(id, boards, groups);
      children.forEach((child) => expandedSet.add(child.id.toString()));
    } else {
      expandedSet.add(String(id));
    }
  });

  return Array.from(expandedSet);
}

export function resolveSelectionOrNamedTarget(selectedItemIds, boards, lower) {
  if (selectedItemIds.length > 0) {
    return { scope: 'selected' };
  }

  const namedBoards = boards.filter((board) =>
    lower.includes(board.name.toLowerCase()),
  );

  if (namedBoards.length > 0) {
    return {
      scope: 'ids',
      ids: namedBoards.map((board) => board.id.toString()),
    };
  }

  return null;
}

export function resolveLegacyAiTargetIds(target, boards, groups, selectedItemIds) {
  if (!target) return [];

  if (target === 'all') {
    return resolveTargetIds({ scope: 'all' }, boards, groups, selectedItemIds);
  }

  if (target === 'selected') {
    return resolveTargetIds(
      { scope: 'selected' },
      boards,
      groups,
      selectedItemIds,
    );
  }

  if (Array.isArray(target)) {
    return resolveTargetIds({ scope: 'ids', ids: target }, boards, groups, selectedItemIds);
  }

  if (typeof target === 'string') {
    return resolveTargetIds(
      { scope: 'name', value: target },
      boards,
      groups,
      selectedItemIds,
    );
  }

  return [];
}
