import * as THREE from 'three';

/**
 * Finds all triangle indices in geometry that match the plane defined by faceNormal and localPt.
 */
export function getFaceTriangles(geometry, faceNormal, localPt) {
  if (!geometry) return [];

  const positionAttr = geometry.getAttribute('position');
  if (!positionAttr) return [];

  const indexAttr = geometry.index;
  const indices = [];

  const normal = new THREE.Vector3(faceNormal.x, faceNormal.y, faceNormal.z).normalize();
  const dTarget = -normal.dot(localPt);

  const tempNormal = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();

  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i += 3) {
      const a = indexAttr.getX(i);
      const b = indexAttr.getX(i + 1);
      const c = indexAttr.getX(i + 2);

      vA.fromBufferAttribute(positionAttr, a);
      vB.fromBufferAttribute(positionAttr, b);
      vC.fromBufferAttribute(positionAttr, c);

      cb.subVectors(vC, vB);
      ab.subVectors(vA, vB);
      tempNormal.crossVectors(cb, ab);
      
      const len = tempNormal.length();
      if (len < 0.0001) continue;
      tempNormal.normalize();

      const d = -tempNormal.dot(vA);

      // Check if parallel and on the same plane
      const isParallel = Math.abs(tempNormal.dot(normal)) > 0.995;
      const isOnPlane = Math.abs(d - dTarget) < 0.05; // 0.05 inches tolerance

      if (isParallel && isOnPlane) {
        indices.push(a, b, c);
      }
    }
  } else {
    for (let i = 0; i < positionAttr.count; i += 3) {
      const a = i;
      const b = i + 1;
      const c = i + 2;

      vA.fromBufferAttribute(positionAttr, a);
      vB.fromBufferAttribute(positionAttr, b);
      vC.fromBufferAttribute(positionAttr, c);

      cb.subVectors(vC, vB);
      ab.subVectors(vA, vB);
      tempNormal.crossVectors(cb, ab);

      const len = tempNormal.length();
      if (len < 0.0001) continue;
      tempNormal.normalize();

      const d = -tempNormal.dot(vA);

      const isParallel = Math.abs(tempNormal.dot(normal)) > 0.995;
      const isOnPlane = Math.abs(d - dTarget) < 0.05;

      if (isParallel && isOnPlane) {
        indices.push(a, b, c);
      }
    }
  }

  return indices;
}

/**
 * Calculates the acute and obtuse angles in degrees between two normal vectors.
 */
export function calculateAngleBetweenNormals(n1, n2) {
  const v1 = new THREE.Vector3(n1[0], n1[1], n1[2]).normalize();
  const v2 = new THREE.Vector3(n2[0], n2[1], n2[2]).normalize();

  const dot = Math.max(-1, Math.min(1, v1.dot(v2)));
  const angleRad = Math.acos(dot);
  const angleDeg = angleRad * (180 / Math.PI);

  const acute = angleDeg > 90 ? 180 - angleDeg : angleDeg;
  const obtuse = 180 - acute;

  return {
    angle: parseFloat(angleDeg.toFixed(1)),
    acute: parseFloat(acute.toFixed(1)),
    obtuse: parseFloat(obtuse.toFixed(1))
  };
}

/**
 * Generates a human-friendly label for a local face normal.
 */
export function getFaceLabel(normal) {
  const [x, y, z] = normal;
  if (Math.abs(x - 1) < 0.05 && Math.abs(y) < 0.05 && Math.abs(z) < 0.05) return 'Right End (x+)';
  if (Math.abs(x + 1) < 0.05 && Math.abs(y) < 0.05 && Math.abs(z) < 0.05) return 'Left End (x-)';
  if (Math.abs(x) < 0.05 && Math.abs(y - 1) < 0.05 && Math.abs(z) < 0.05) return 'Top Face (y+)';
  if (Math.abs(x) < 0.05 && Math.abs(y + 1) < 0.05 && Math.abs(z) < 0.05) return 'Bottom Face (y-)';
  if (Math.abs(x) < 0.05 && Math.abs(y) < 0.05 && Math.abs(z - 1) < 0.05) return 'Front Face (z+)';
  if (Math.abs(x) < 0.05 && Math.abs(y) < 0.05 && Math.abs(z + 1) < 0.05) return 'Back Face (z-)';

  // Return a generic angle label
  return `Angled Cut Face (${(Math.abs(x) > 0.01 ? 'X-tilted' : '')} ${(Math.abs(y) > 0.01 ? 'Y-tilted' : '')} ${(Math.abs(z) > 0.01 ? 'Z-tilted' : '')}`.trim() + ')';
}
