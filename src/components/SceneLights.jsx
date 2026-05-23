import React from 'react';

export function SceneLights({ lighting }) {
  if (!lighting?.lights) return null;
  return (
    <group>
      {lighting.lights.filter(l => l.enabled).map(l => {
        switch (l.type) {
          case 'ambient':
            return <ambientLight key={l.id} color={l.color} intensity={l.intensity} />;

          case 'hemisphere':
            return <hemisphereLight key={l.id} args={[l.color, l.groundColor ?? '#333333', l.intensity]} />;

          case 'directional': {
            return (
              <group key={l.id}>
                <directionalLight
                  color={l.color}
                  intensity={l.intensity}
                  position={l.position ?? [10, 20, 10]}
                  castShadow={lighting.shadows && l.castShadow}
                  shadow-mapSize-width={l.shadowMapSize ?? 1024}
                  shadow-mapSize-height={l.shadowMapSize ?? 1024}
                  shadow-camera-near={0.5}
                  shadow-camera-far={200}
                  shadow-camera-left={-40}
                  shadow-camera-right={40}
                  shadow-camera-top={40}
                  shadow-camera-bottom={-40}
                  shadow-bias={-0.0004}
                />
              </group>
            );
          }

          case 'point':
            return (
              <pointLight
                key={l.id}
                color={l.color}
                intensity={l.intensity}
                position={l.position ?? [0, 20, 0]}
                distance={l.distance ?? 0}
                decay={l.decay ?? 2}
              />
            );

          case 'spot': {
            return (
              <spotLight
                key={l.id}
                color={l.color}
                intensity={l.intensity}
                position={l.position ?? [10, 30, 10]}
                angle={l.angle ?? 0.4}
                penumbra={l.penumbra ?? 0.3}
                decay={l.decay ?? 1.5}
                castShadow={lighting.shadows && l.castShadow}
                shadow-mapSize-width={l.shadowMapSize ?? 1024}
                shadow-mapSize-height={l.shadowMapSize ?? 1024}
                shadow-bias={-0.0004}
              />
            );
          }

          case 'rectarea':
            return (
              <rectAreaLight
                key={l.id}
                color={l.color}
                intensity={l.intensity}
                position={l.position ?? [0, 20, 0]}
                width={l.width ?? 10}
                height={l.height ?? 10}
                rotation={[-Math.PI / 2, 0, 0]}
              />
            );

          default:
            return null;
        }
      })}
    </group>
  );
}
