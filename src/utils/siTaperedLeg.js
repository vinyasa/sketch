export function createTaperSpec(ax, az) {
  return {
    angleLeft: ax,
    angleRight: ax,
    angleFront: az,
    angleBack: az,
  };
}

export function createStandaloneTaperedLeg({ id, defaultMaterial, ax, az }) {
  return {
    id,
    name: 'Tapered Leg',
    parentId: 'Workspace',
    shape: 'taper',
    taper: createTaperSpec(ax, az),
    size: [1.5, 30, 1.5],
    position: [0, 15, 0],
    material: defaultMaterial,
    joint: 'None',
    operations: [],
  };
}

export function createPartialTaperedLegAssembly({
  groupId,
  upperId,
  lowerId,
  defaultMaterial,
  ax,
  az,
}) {
  const totalH = 30;
  const thickness = 1.5;
  const halfH = totalH / 2;

  return {
    group: {
      [groupId]: {
        parentId: 'Workspace',
        isExpanded: true,
        visible: true,
      },
    },
    boards: [
      {
        id: upperId,
        name: 'Leg Upper',
        parentId: groupId,
        size: [thickness, halfH, thickness],
        position: [0, halfH + halfH / 2, 0],
        material: defaultMaterial,
        joint: 'None',
        operations: [],
      },
      {
        id: lowerId,
        name: 'Leg Lower',
        parentId: groupId,
        shape: 'taper',
        taper: createTaperSpec(ax, az),
        size: [thickness, halfH, thickness],
        position: [0, halfH / 2, 0],
        material: defaultMaterial,
        joint: 'None',
        operations: [],
        note: `One piece; taper lower ${halfH}" only.`,
      },
    ],
    constraint: {
      type: 'Glue',
      boardAId: upperId.toString(),
      boardBId: lowerId.toString(),
      offset: [0, halfH, 0],
      enabled: true,
    },
    halfHeight: halfH,
  };
}
