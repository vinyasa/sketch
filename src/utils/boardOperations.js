export function appendOperationToBoards(boards, selectedItemIds, operation) {
  return boards.map((board) =>
    selectedItemIds.includes(board.id.toString())
      ? {
          ...board,
          operations: [...(board.operations || []), operation],
        }
      : board,
  );
}
