import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store/useStore';
import { formatUnit } from '../utils/units';

export function PrintCaptureHandler() {
  const { gl, scene, camera } = useThree();
  const printCapture = useStore(s => s.printCapture);
  const setPrintCapture = useStore(s => s.setPrintCapture);

  useEffect(() => {
    if (!printCapture) return;

    const doCapture = () => {
      const { resolution, framing, renderMode } = printCapture;
      const state = useStore.getState();
      const { boards, selectedItemIds } = state;

      // ── Framing ──
      let savedPos;
      if (framing === 'fitAll' || framing === 'fitSelection') {
        const targetBoards = framing === 'fitSelection' && selectedItemIds.length > 0
          ? boards.filter(b => selectedItemIds.includes(b.id.toString()) && b.shape !== 'plane')
          : boards.filter(b => b.visible !== false && b.shape !== 'plane');

        if (targetBoards.length > 0) {
          const bbox = new THREE.Box3();
          targetBoards.forEach(b => {
            const hx = b.size[0]/2, hy = b.size[1]/2, hz = b.size[2]/2;
            const p = b.position;
            bbox.expandByPoint(new THREE.Vector3(p[0]-hx, p[1]-hy, p[2]-hz));
            bbox.expandByPoint(new THREE.Vector3(p[0]+hx, p[1]+hy, p[2]+hz));
          });
          const center = new THREE.Vector3();
          bbox.getCenter(center);
          const size = new THREE.Vector3();
          bbox.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const dist = maxDim * 1.8;

          savedPos = camera.position.clone();
          const dir = camera.position.clone().sub(center).normalize();
          camera.position.copy(center.clone().add(dir.multiplyScalar(dist)));
          camera.lookAt(center);
          camera.updateProjectionMatrix();
        }
      }

      // ── Scene modifications for print ──
      const origBackground = scene.background;
      scene.background = new THREE.Color('#ffffff');

      // Hide grid helpers, gizmo, and other non-printable objects
      const hiddenObjects = [];
      scene.traverse(obj => {
        if (obj.isGridHelper || obj.type === 'GridHelper') {
          if (obj.visible) { hiddenObjects.push(obj); obj.visible = false; }
        }
      });
      scene.children.forEach(child => {
        const isGizmo = child.type === 'GizmoHelper' || child.isGizmoHelper ||
          (child.children && child.children.some(c => c.type === 'GizmoHelper' || c.isGizmoHelper));
        if (isGizmo && child.visible) {
          hiddenObjects.push(child);
          child.visible = false;
        }
      });

      // Strip selection emissive highlights
      const emissiveRestores = [];
      scene.traverse(obj => {
        if (obj.isMesh && obj.material && obj.material.emissiveIntensity > 0) {
          emissiveRestores.push({ mesh: obj, intensity: obj.material.emissiveIntensity });
          obj.material.emissiveIntensity = 0;
        }
      });

      // ── Render mode: wireframe / light (ink saver) ──
      const materialRestores = [];
      if (renderMode === 'wireframe' || renderMode === 'light') {
        scene.traverse(obj => {
          if (obj.isMesh && obj.material && !obj.material._isPrintHelper) {
            // Skip measurement overlay objects (lines + text)
            let prot = false;
            let p = obj;
            while (p) { if (p.userData?.printProtected) { prot = true; break; } p = p.parent; }
            if (prot) return;
            const mat = obj.material;
            const saved = {
              mesh: obj,
              wireframe: mat.wireframe,
              opacity: mat.opacity,
              transparent: mat.transparent,
              color: mat.color ? mat.color.clone() : null,
            };
            materialRestores.push(saved);

            if (renderMode === 'wireframe') {
              mat.wireframe = true;
              if (mat.color) mat.color.set('#333333');
              mat.opacity = 1;
              mat.transparent = false;
            } else if (renderMode === 'light') {
              mat.opacity = 0.15;
              mat.transparent = true;
            }
          }
        });
      }

      // ── Render to off-screen target ──
      const cssW = gl.domElement.clientWidth || gl.domElement.width;
      const cssH = gl.domElement.clientHeight || gl.domElement.height;
      const targetW = Math.floor(cssW * resolution);
      const targetH = Math.floor(cssH * resolution);

      const renderTarget = new THREE.WebGLRenderTarget(targetW, targetH, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
      });

      gl.setRenderTarget(renderTarget);
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Read pixels
      const pixels = new Uint8Array(targetW * targetH * 4);
      gl.readRenderTargetPixels(renderTarget, 0, 0, targetW, targetH, pixels);
      renderTarget.dispose();

      // Convert to canvas (flip Y — WebGL is bottom-up)
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.createImageData(targetW, targetH);
      for (let y = 0; y < targetH; y++) {
        const srcRow = (targetH - 1 - y) * targetW * 4;
        const dstRow = y * targetW * 4;
        for (let x = 0; x < targetW * 4; x++) {
          imageData.data[dstRow + x] = pixels[srcRow + x];
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // ── Restore scene ──
      scene.background = origBackground;
      hiddenObjects.forEach(obj => { obj.visible = true; });
      emissiveRestores.forEach(({ mesh, intensity }) => { mesh.material.emissiveIntensity = intensity; });
      materialRestores.forEach(({ mesh, wireframe, opacity, transparent, color }) => {
        mesh.material.wireframe = wireframe;
        mesh.material.opacity = opacity;
        mesh.material.transparent = transparent;
        if (color) mesh.material.color.copy(color);
      });
      if (savedPos) {
        camera.position.copy(savedPos);
        camera.updateProjectionMatrix();
      }

      // ── Output: open in new window ──
      const dataURL = canvas.toDataURL('image/png');
      const fileName = (state.currentFileName || 'woodcraft').replace(/[^a-zA-Z0-9]/g, '_');
      const isLandscape = targetW > targetH;
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`<!DOCTYPE html><html><head><title>Print — ${state.currentFileName || 'Woodcraft'}</title>
<style>
@page{size:${isLandscape ? 'landscape' : 'portrait'};margin:0.25in}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%}
body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0f0f0;padding:24px}
img{max-width:100%;height:auto;box-shadow:0 4px 20px rgba(0,0,0,.15);border-radius:4px}
.bar{position:fixed;top:16px;right:16px;display:flex;gap:8px;z-index:10}
.bar button{padding:10px 20px;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.p{background:#007aff;color:#fff}.d{background:#34c759;color:#fff}
.info{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);font:12px system-ui;color:#888}
@media print{
  .bar,.info{display:none!important}
  body{background:#fff;padding:0;display:block;min-height:auto}
  img{width:100%;height:auto;max-width:none;max-height:none;box-shadow:none;border-radius:0;display:block}
}
</style></head><body>
<img src="${dataURL}" />
<div class="bar">
<button class="p" onclick="window.print()">🖨️ Print</button>
<button class="d" onclick="var a=document.createElement('a');a.href=document.querySelector('img').src;a.download='${fileName}.png';a.click()">💾 Download PNG</button>
</div>
<div class="info">${targetW} × ${targetH} px · ${resolution}× · ${renderMode}</div>
</body></html>`);
        printWin.document.close();
      }

      setPrintCapture(null);
    };

    // Delay two frames so pending scene changes render first
    requestAnimationFrame(() => requestAnimationFrame(doCapture));
  }, [printCapture]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
