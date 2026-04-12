const groups = {
    "Group1": { parentId: null },
    "Group2": { parentId: "Group1" }
};
const boards = [
    { id: 1, parentId: "Group1" },
    { id: 2, parentId: "Group2" },
    { id: 3, parentId: null }
];
const contextPanelItemId = "Group1";

let allGroupIdsToDel = new Set([contextPanelItemId]);
let allBoardIdsToDel = new Set();
const traverse = (pId) => {
    Object.keys(groups).forEach(k => { if (groups[k].parentId === pId && !allGroupIdsToDel.has(k)) { allGroupIdsToDel.add(k); traverse(k); } });
    boards.forEach(bd => { if (bd.parentId === pId) allBoardIdsToDel.add(bd.id); });
};
traverse(contextPanelItemId);

console.log("Groups to delete:", Array.from(allGroupIdsToDel));
console.log("Boards to delete:", Array.from(allBoardIdsToDel));

let nextGroups = { ...groups };
allGroupIdsToDel.forEach(id => delete nextGroups[id]);

let nextBoards = boards.filter(bd => !allBoardIdsToDel.has(bd.id));

console.log("Remaining Groups:", nextGroups);
console.log("Remaining Boards:", nextBoards);
