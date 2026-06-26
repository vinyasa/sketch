export function collectSiTopTargets(selectedItemIds, boards, groups) {
  if (selectedItemIds.length === 0 || selectedItemIds.includes('Workspace')) {
    return boards;
  }

  const validBoards = new Set();

  const traverse = (parentId) => {
    boards
      .filter((board) => board.parentId === parentId)
      .forEach((board) => validBoards.add(board));

    Object.keys(groups)
      .filter((groupId) => groups[groupId].parentId === parentId)
      .forEach((groupId) => traverse(groupId));
  };

  selectedItemIds.forEach((id) => {
    if (Object.prototype.hasOwnProperty.call(groups, id)) {
      traverse(id);
    } else {
      const board = boards.find((candidate) => candidate.id.toString() === id);
      if (board) validBoards.add(board);
    }
  });

  return Array.from(validBoards);
}
