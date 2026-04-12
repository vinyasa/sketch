import * as THREE from 'three';

let lower = 'extend the top 1';

const val = 1;
const delta = 1;
let b = { size: [1.5, 12, 1.5], position: [0, 0, 0], rotation: [0, 0, 0] };

let anchorMultiplier = 0;
if (/(top|right|front)/.test(lower)) anchorMultiplier = 1;
if (/(bottom|left|back)/.test(lower)) anchorMultiplier = -1;

let targetIndex = 1; // Y axis
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

    let localOffset = new THREE.Vector3(0, 0, 0);
    localOffset.setComponent(targetIndex, (actualDelta / 2) * alignedMultiplier);
    localOffset.applyEuler(new THREE.Euler(...(b.rotation || [0, 0, 0]), 'XYZ'));

    newPos[0] += localOffset.x;
    newPos[1] += localOffset.y;
    newPos[2] += localOffset.z;
}

console.log("Original Center:", b.position[1]);
console.log("Original Top:", b.position[1] + b.size[1]/2);
console.log("Original Bottom:", b.position[1] - b.size[1]/2);

console.log("");
console.log("New Center:", newPos[1]);
console.log("New Size:", newSize[1]);
console.log("New Top:", newPos[1] + newSize[1]/2);
console.log("New Bottom:", newPos[1] - newSize[1]/2);
