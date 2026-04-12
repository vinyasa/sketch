import * as THREE from 'three';

const lower = 'extend the top 1"';
const selectedItemIds = ['1'];
const boards = [
    { id: 1, name: 'leg1', parentId: 'Workspace', size: [1.5, 12, 1.5], position: [0, 0, 0], rotation: [0, 0, 0] }
];

const targetIds = ['1'];
const delta = 1;

let isLength = /(short|long|length|tall|top|bottom)/.test(lower);
let isWidth = /(wide|narrow|width|left|right)/.test(lower);

let anchorMultiplier = 0;
if (/(top|right|front)/.test(lower)) anchorMultiplier = 1;
if (/(bottom|left|back)/.test(lower)) anchorMultiplier = -1;

boards.map(b => {
    if (targetIds.includes(b.id.toString())) {
        let dims = [
            { idx: 0, val: b.size[0] },
            { idx: 1, val: b.size[1] },
            { idx: 2, val: b.size[2] }
        ];
        dims.sort((a, c) => c.val - a.val);

        let targetIndex = dims[0].idx; // Default to longest dimension
        if (isWidth) targetIndex = dims[1].idx;
        else if (!isLength && !isWidth) targetIndex = dims[2].idx;

        console.log("Chosen targetIndex:", targetIndex, " (size[", targetIndex, "]=", b.size[targetIndex], ")");

        let newSize = [...b.size];
        const actualDelta = Math.max(0.1 - newSize[targetIndex], delta);
        newSize[targetIndex] += actualDelta;

        let newPos = [...b.position];
        if (anchorMultiplier !== 0) {
            let localDir = new THREE.Vector3(0, 0, 0);
            localDir.setComponent(targetIndex, 1);
            localDir.applyEuler(new THREE.Euler(...(b.rotation || [0, 0, 0]), 'XYZ'));

            let alignedMultiplier = anchorMultiplier;
            if (/(top|bottom|up|down)/.test(lower)) {
                alignedMultiplier = anchorMultiplier * (localDir.y < -0.1 ? -1 : 1);
            } else if (/(right|left)/.test(lower)) {
                alignedMultiplier = anchorMultiplier * (localDir.x < -0.1 ? -1 : 1);
            } else if (/(front|back)/.test(lower)) {
                alignedMultiplier = anchorMultiplier * (localDir.z < -0.1 ? -1 : 1);
            }

            console.log("alignedMultiplier:", alignedMultiplier);

            let localOffset = new THREE.Vector3(0, 0, 0);
            localOffset.setComponent(targetIndex, (actualDelta / 2) * alignedMultiplier);
            localOffset.applyEuler(new THREE.Euler(...(b.rotation || [0, 0, 0]), 'XYZ'));

            newPos[0] += localOffset.x;
            newPos[1] += localOffset.y;
            newPos[2] += localOffset.z;
        }

        console.log("Old Y Extents:", b.position[1]-b.size[1]/2, "to", b.position[1]+b.size[1]/2);
        console.log("New Y Extents:", newPos[1]-newSize[1]/2, "to", newPos[1]+newSize[1]/2);
    }
});
