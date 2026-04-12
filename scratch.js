import * as THREE from 'three';

let eOrig = new THREE.Euler(Math.PI/2, 0, 0, 'XYZ');
let q = new THREE.Quaternion().setFromEuler(eOrig);
// Old code: r[1] += Math.PI/2
let eOld = new THREE.Euler(Math.PI/2, Math.PI/2, 0, 'XYZ');

// New code:
let qRotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI/2);
let qNew = q.clone().premultiply(qRotY);
let eNew = new THREE.Euler().setFromQuaternion(qNew, 'XYZ');

let pt = new THREE.Vector3(1, 2, 3);
console.log("Original: ", pt.clone().applyEuler(eOrig));
console.log("Old Code (r[1]+=90):", pt.clone().applyEuler(eOld));
console.log("New Code (premultiply Y):", pt.clone().applyEuler(eNew));

// Let's also test Z rotation
let qRotZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), Math.PI/2);
let qTestZ = q.clone().premultiply(qRotZ);
let eTestZ = new THREE.Euler().setFromQuaternion(qTestZ, 'XYZ');
console.log("Test True Z Rotation:", pt.clone().applyEuler(eTestZ));
