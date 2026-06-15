import * as THREE from 'three';

/**
 * Calculates the world space points for an edge given its local coordinates and its board.
 */
export function getWorldEdgePoints(edge, board) {
  const pivot = board.pivot || [0, 0, 0];
  const euler = new THREE.Euler(...(board.orientation || [0, 0, 0]), 'YXZ');
  
  // Local points relative to the mesh coordinate system.
  // Transform from mesh local space to group local space (apply pivot offset)
  const localStart = new THREE.Vector3(...edge.edgeStart).sub(new THREE.Vector3(...pivot));
  const localEnd = new THREE.Vector3(...edge.edgeEnd).sub(new THREE.Vector3(...pivot));
  
  // Transform from group local space to world space by applying rotation and position
  localStart.applyEuler(euler);
  localEnd.applyEuler(euler);
  
  const worldStart = localStart.add(new THREE.Vector3(...board.position));
  const worldEnd = localEnd.add(new THREE.Vector3(...board.position));
  
  return { worldStart, worldEnd };
}

/**
 * Calculates the acute and obtuse angles in degrees between two 3D vectors.
 */
export function calculateAngleBetweenVectors(v1, v2) {
  const norm1 = v1.clone().normalize();
  const norm2 = v2.clone().normalize();
  const dot = Math.max(-1, Math.min(1, norm1.dot(norm2)));
  const angleRad = Math.acos(dot);
  const angleDeg = angleRad * (180 / Math.PI);

  const acute = angleDeg > 90 ? 180 - angleDeg : angleDeg;
  const obtuse = 180 - acute;

  return {
    angle: parseFloat(angleDeg.toFixed(1)),
    acute: parseFloat(acute.toFixed(1)),
    obtuse: parseFloat(obtuse.toFixed(1)),
    isParallel: acute < 0.1,
    isPerpendicular: Math.abs(acute - 90) < 0.1
  };
}

/**
 * Computes the minimum distance between two 3D line segments.
 * Segments are defined by endpoints (p0, p1) and (q0, q1).
 * Uses Dan Sunday's segment-to-segment distance algorithm.
 */
export function getDistanceBetweenSegments(p0, p1, q0, q1) {
  const u = new THREE.Vector3().subVectors(p1, p0);
  const v = new THREE.Vector3().subVectors(q1, q0);
  const w = new THREE.Vector3().subVectors(p0, q0);
  
  const a = u.dot(u);
  const b = u.dot(v);
  const c = v.dot(v);
  const d = u.dot(w);
  const e = v.dot(w);
  
  const D = a * c - b * b;
  let sc, sN, sD = D;
  let tc, tN, tD = D;
  
  if (D < 0.000001) {
    sN = 0.0;
    sD = 1.0;
    tN = e;
    tD = c;
  } else {
    sN = (b * e - c * d);
    tN = (a * e - b * d);
    if (sN < 0.0) {
      sN = 0.0;
      tN = e;
      tD = c;
    } else if (sN > sD) {
      sN = sD;
      tN = e + b;
      tD = c;
    }
  }
  
  if (tN < 0.0) {
    tN = 0.0;
    if (-d < 0.0) {
      sN = 0.0;
    } else if (-d > a) {
      sN = sD;
    } else {
      sN = -d;
      sD = a;
    }
  } else if (tN > tD) {
    tN = tD;
    if ((-d + b) < 0.0) {
      sN = 0.0;
    } else if ((-d + b) > a) {
      sN = sD;
    } else {
      sN = (-d + b);
      sD = a;
    }
  }
  
  sc = (Math.abs(sN) < 0.000001 ? 0.0 : sN / sD);
  tc = (Math.abs(tN) < 0.000001 ? 0.0 : tN / tD);
  
  const dP = w.clone().addScaledVector(u, sc).addScaledVector(v, -tc);
  return dP.length();
}
