import { Point } from './Point';
import { Shape } from './Shape';

// Frames per second; 30fps will be enough for most use-cases.
const DEFAULT_FPS = 30;
const DEFAULT_RESOLUTION = 10;

interface SceneOptions {
  // This number sets the requested number of points from a perpendicular line drawn from one side of the projection to the other.
  // Decreasing this number will make drawing faster but less accurate, increasing will make it slower but more accurate.
  resolution?: number;
}

type TransformFn = (points: Point[]) => Point[];
type TransformMatrix = [[number, number, number],[number, number, number],[number, number, number]];
const idMatrix: TransformMatrix = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
]

export function applyProjectionMatrixTo(mat: TransformMatrix, {x, y, ...rest}: Point) {
    const [[a,b,c],[d,e,f],[g,h,_]] = mat;
    return {
        x: (a*x+b*y+c)/(g*x+h*y+1),
        y: (d*x+e*y+f)/(g*x+h*y+1),
        ...rest,
    };
}

export class Scene {
  points: Point[] = [];
  resolution: number;
  interval?: NodeJS.Timeout;
  pointPromise: Promise<Point[]>;
  pointResolve: (a: Point[]) => void = (_) => {};

  constructor(options?: SceneOptions) {
    this.resolution = (options && options.resolution) || DEFAULT_RESOLUTION;
    this.pointPromise = new Promise((resolve, _) => {
      this.pointResolve = resolve;
    });
  }

  add(shape: Shape, matrix: TransformMatrix = idMatrix, transformer?: TransformFn) {
    let points = shape.draw(this.resolution);
    for (let i = 0; i < points.length;i++)
    {
        //console.log(`points[${i}] x: ${points[i].x} y: ${points[i].y}`);
        points[i] = applyProjectionMatrixTo(matrix, points[i]);
        //console.log(`points[${i}] x: ${points[i].x} y: ${points[i].y}`);
    }
    if (transformer) {
      points = transformer(points);
    }
    this.points = this.points.concat(points);
  }

  // We need a way to get points after an update has been performed
  // without knowing when the update has been perform (because
  // it's ran in setInterval) so we return a promise that point will be provided
  // asynchronously
  async getPoints()
  {
    return this.pointPromise;
  }

  resolvePointPromise()
  {
    // After the point update has been performed
    // we resolve the point promise to the newly updated
    // points
    this.pointResolve(this.points);
    // We then schedule a call to create a new Promise for the next
    // point update
    setImmediate(() => {
      this.pointPromise = new Promise((resolve, _) => {
        this.pointResolve = resolve;
      });
    });
  }

  reset() {
    this.points = [];
  }

  start(renderFrame: () => void, fps: number = DEFAULT_FPS) {
    const ms = 1000 / fps;
    this.interval = setInterval(() => {
      this.reset();
      renderFrame();
      this.resolvePointPromise();
    }, ms);
  }

  stop() {
    this.pause();
    this.reset();
  }

  pause() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
}
