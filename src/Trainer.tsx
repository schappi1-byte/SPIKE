import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import type { AnimationId } from "./trainingPlan";

const MODEL = "/models/xbot.glb";
const CYCLE = 1.6;
const LOOK: [number, number, number] = [0, 1.12, 0];

const labels: Record<string, string> = {
  squat: "Squat demonstration",
  lunge: "Lunge demonstration",
  "calf-raise": "Calf raise demonstration",
  "squat-jump": "Squat jump demonstration",
  shuffle: "Lateral shuffle demonstration",
  "arm-raise": "Overhead arm raise demonstration",
  rest: "Standing rest",
  none: "Standing",
};

type Bend = [number, number, number];
type Pose = { bends: Record<string, Bend>; hips: Bend };

const bone = (name: string) => `mixamorig${name}`;

function stand(): Pose {
  return {
    bends: {
      [bone("LeftArm")]: [0, 0, -1.28],
      [bone("RightArm")]: [0, 0, 1.28],
    },
    hips: [0, 0, 0],
  };
}

function bend(pose: Pose, name: string, x: number, y: number, z: number) {
  const current = pose.bends[bone(name)] ?? [0, 0, 0];
  pose.bends[bone(name)] = [current[0] + x, current[1] + y, current[2] + z];
}

function squatLegs(pose: Pose, amount: number) {
  bend(pose, "LeftUpLeg", -1.35 * amount, 0, 0);
  bend(pose, "RightUpLeg", -1.35 * amount, 0, 0);
  bend(pose, "LeftLeg", 2.15 * amount, 0, 0);
  bend(pose, "RightLeg", 2.15 * amount, 0, 0);
  bend(pose, "Spine", 0.28 * amount, 0, 0);
  pose.hips[1] -= 52 * amount;
}

function sample(move: string, time: number): Pose {
  const pose = stand();
  const unit = (time % CYCLE) / CYCLE;
  const lift = Math.sin(Math.PI * unit);
  if (move === "squat") squatLegs(pose, lift);
  if (move === "lunge") {
    bend(pose, "LeftUpLeg", -1.25 * lift, 0, 0);
    bend(pose, "LeftLeg", 1.65 * lift, 0, 0);
    bend(pose, "RightUpLeg", 0.65 * lift, 0, 0);
    bend(pose, "RightLeg", -1.15 * lift, 0, 0);
    bend(pose, "Spine", 0.08 * lift, 0, 0);
    pose.hips[1] -= 22 * lift;
    pose.hips[2] += 6 * lift;
  }
  if (move === "calf-raise") {
    bend(pose, "LeftFoot", -0.95 * lift, 0, 0);
    bend(pose, "RightFoot", -0.95 * lift, 0, 0);
    pose.hips[1] += 16 * lift;
  }
  if (move === "squat-jump") {
    let dip = 0;
    let hop = 0;
    if (unit < 0.28) dip = Math.sin((unit / 0.28) * Math.PI * 0.5);
    else if (unit < 0.4) { dip = 1 - (unit - 0.28) / 0.12; hop = (unit - 0.28) / 0.12; }
    else if (unit < 0.62) hop = 1;
    else if (unit < 0.78) { dip = ((unit - 0.62) / 0.16) * 0.35; hop = 1 - (unit - 0.62) / 0.16; }
    squatLegs(pose, dip);
    pose.hips[1] += 48 * hop;
  }
  if (move === "shuffle") {
    const side = Math.sin(unit * Math.PI * 2);
    squatLegs(pose, 0.28);
    pose.hips[0] = side * 32;
    bend(pose, "Spine", 0, 0, -side * 0.18);
  }
  if (move === "arm-raise") {
    pose.bends[bone("LeftArm")] = [0, 0, -1.28 + 2.73 * lift];
    pose.bends[bone("RightArm")] = [0, 0, 1.28 - 2.73 * lift];
  }
  return pose;
}

type Rig = {
  root: THREE.Object3D;
  bones: Map<string, THREE.Bone>;
  rest: Map<string, { quaternion: THREE.Quaternion; position: THREE.Vector3 }>;
};

function prepare(source: THREE.Object3D): Rig {
  const root = SkeletonUtils.clone(source) as THREE.Object3D;
  const surface = root.getObjectByName("Beta_Surface") as THREE.SkinnedMesh;
  const joints = root.getObjectByName("Beta_Joints");
  if (joints) joints.visible = false;
  surface.material = new THREE.MeshStandardMaterial({ color: "#162033", roughness: 0.78, metalness: 0.04 });
  surface.castShadow = true;
  const wire = new THREE.SkinnedMesh(
    surface.geometry,
    new THREE.MeshBasicMaterial({ color: "#d7e4f4", wireframe: true, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  wire.bind(surface.skeleton, surface.bindMatrix);
  wire.frustumCulled = false;
  surface.parent?.add(wire);
  const bones = new Map<string, THREE.Bone>();
  const rest = new Map<string, { quaternion: THREE.Quaternion; position: THREE.Vector3 }>();
  surface.skeleton.bones.forEach((item) => {
    bones.set(item.name, item);
    rest.set(item.name, { quaternion: item.quaternion.clone(), position: item.position.clone() });
  });
  const model = { root, bones, rest };
  applyPose(model, sample("rest", 0), 1);
  return model;
}

function applyPose(model: Rig, pose: Pose, blend: number) {
  const euler = new THREE.Euler(0, 0, 0, "XYZ");
  const target = new THREE.Quaternion();
  let delta = 0;
  model.bones.forEach((item, name) => {
    const saved = model.rest.get(name);
    if (!saved) return;
    const [x, y, z] = pose.bends[name] ?? [0, 0, 0];
    euler.set(x, y, z);
    target.setFromEuler(euler);
    target.premultiply(saved.quaternion);
    delta = Math.max(delta, item.quaternion.angleTo(target));
    item.quaternion.slerp(target, blend);
  });
  const hips = model.bones.get(bone("Hips"));
  const saved = hips && model.rest.get(hips.name);
  if (hips && saved) {
    const next = saved.position.clone();
    next.x += pose.hips[0];
    next.y += pose.hips[1];
    next.z += pose.hips[2];
    delta = Math.max(delta, hips.position.distanceTo(next));
    hips.position.lerp(next, blend);
  }
  return delta;
}

function Figure({ move, paused, shadow }: { move: string; paused: boolean; shadow: RefObject<THREE.Mesh | null> }) {
  const { scene } = useGLTF(MODEL);
  const model = useMemo(() => prepare(scene), [scene]);
  const clock = useRef(0);
  const shown = useRef(move);
  const reduce = useRef(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => { invalidate(); }, [move, paused, invalidate]);

  useFrame((_, dt) => {
    const changed = shown.current !== move;
    shown.current = move;
    const hips = model.bones.get(bone("Hips"));
    if (hips && shadow.current) {
      const world = hips.getWorldPosition(_ground);
      shadow.current.position.x = world.x;
      shadow.current.position.z = world.z;
    }
    if (paused) return;
    if (changed) clock.current = 0;
    const playing = move !== "rest" && move !== "none" && !reduce.current;
    if (playing) clock.current += Math.min(dt, 0.05);
    const delta = applyPose(model, sample(playing ? move : "rest", clock.current), 1 - Math.exp(-10 * Math.min(dt, 0.05)));
    if (playing || delta > 0.004) invalidate();
  });

  return <primitive object={model.root} />;
}

const _ground = new THREE.Vector3();

function Studio({ move, paused }: { move: string; paused: boolean }) {
  const shadow = useRef<THREE.Mesh>(null);
  return (
    <>
      <color attach="background" args={["#0c1422"]} />
      <hemisphereLight args={["#c5d4e8", "#182232", 1.05]} />
      <directionalLight position={[2.4, 4.2, 2.8]} intensity={1.35} />
      <directionalLight position={[-2.2, 2.2, -1.6]} intensity={0.45} color="#7eabff" />
      <Grid args={[8, 8]} cellSize={0.28} cellThickness={0.6} cellColor="#243348" sectionSize={1.4} sectionThickness={1.05} sectionColor="#3d5674" fadeDistance={7} position={[0, 0, 0]} />
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0.02]}>
        <circleGeometry args={[0.32, 40]} />
        <meshBasicMaterial color="#050910" transparent opacity={0.72} />
      </mesh>
      <Suspense fallback={null}>
        <Figure move={move} paused={paused} shadow={shadow} />
      </Suspense>
      <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minDistance={2.15} maxDistance={4.8} minPolarAngle={0.55} maxPolarAngle={1.4} target={LOOK} />
    </>
  );
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return <p className="px-4 py-8 text-center text-sm text-slate-300">The trainer model could not be loaded.</p>;
    return this.props.children;
  }
}

export default function Trainer({ move, paused }: { move: AnimationId | "rest"; paused: boolean }) {
  return (
    <Boundary>
      <div className="trainer-view relative h-64 w-full overflow-hidden bg-[#0c1422] sm:h-80 md:h-[42vh] md:max-h-[480px]" data-move={move} role="img" aria-label={labels[move] ?? "Standing"} style={{ touchAction: "none" }}>
        <Canvas camera={{ position: [1.35, 1.35, 3.55], fov: 38 }} dpr={[1, 1.5]} frameloop="demand" gl={{ antialias: true, powerPreference: "high-performance" }}>
          <Studio move={move} paused={paused} />
        </Canvas>
      </div>
    </Boundary>
  );
}

useGLTF.preload(MODEL);
