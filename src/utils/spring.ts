export interface SpringValue {
  current: number;
  target: number;
  velocity: number;
}

export function createSpring(val: number): SpringValue {
  return {
    current: val,
    target: val,
    velocity: 0
  };
}

export function updateSpring(
  spring: SpringValue,
  stiffness = 0.12,
  damping = 0.72
): SpringValue {
  const force = (spring.target - spring.current) * stiffness;
  const velocity = (spring.velocity + force) * damping;
  const current = spring.current + velocity;
  return {
    current,
    target: spring.target,
    velocity
  };
}

export interface SpringPoint {
  x: SpringValue;
  y: SpringValue;
}

export function createSpringPoint(x: number, y: number): SpringPoint {
  return {
    x: createSpring(x),
    y: createSpring(y)
  };
}

export function updateSpringPoint(
  point: SpringPoint,
  stiffness = 0.12,
  damping = 0.72
): SpringPoint {
  return {
    x: updateSpring(point.x, stiffness, damping),
    y: updateSpring(point.y, stiffness, damping)
  };
}
