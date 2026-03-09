import fixPerspective, { QuadPoints } from "change-perspective";
import {Point} from '../Point';

type Coordinate = {
  x: number,
  y: number
};

export type Bounds = {
  xmin?: number;
  ymin?: number;
  xmax?: number;
  ymax?: number;
}

export type ConstBounds = {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export type MaskingBoundDistortTransformOptions = {
  masks: ConstBounds[],
  perspectiveCorners?: {
    topLeft: Coordinate,
    topRight: Coordinate,
    bottomRight: Coordinate,
    bottomLeft: Coordinate
  },
  bounds: Bounds,
  scale: number,
  colorIntensity?: number
};

const SOURCE_CORNERS : QuadPoints = [ 0,0, 1,0, 1,1, 0,1 ];
const WAIT_AMOUNT = 24;

export function boundMaskingDistort(options: MaskingBoundDistortTransformOptions) : (p: Point[]) => Point[] {
  //FIX(franz): remove perspective from masking
  options.perspectiveCorners = {
    topLeft: {x: 0, y: 0},
    topRight: {x: 1, y: 0},
    bottomRight: {x: 1, y: 1},
    bottomLeft: {x: 0, y: 1}
  };
  const destinationCorners : QuadPoints = [
    options.perspectiveCorners.topLeft.x,
    options.perspectiveCorners.topLeft.y,
    options.perspectiveCorners.topRight.x,
    options.perspectiveCorners.topRight.y,
    options.perspectiveCorners.bottomRight.x,
    options.perspectiveCorners.bottomRight.y,
    options.perspectiveCorners.bottomLeft.x,
    options.perspectiveCorners.bottomLeft.y
  ];
  const perspective = fixPerspective(SOURCE_CORNERS, destinationCorners);
  const scale = options.scale || 1.0;
  const colorIntensity = options.colorIntensity || 1.0;
  const xmin = options.bounds.xmin || 0.0;
  const xmax = options.bounds.xmax || 1.0;
  const ymin = options.bounds.ymin || 0.0;
  const ymax = options.bounds.ymax || 1.0;

  return (points) => {
    const { masks } = options;
    let blankedPrevious = false;
    let cmaskPrevious : ConstBounds | null = null;
    return points.reduce<Point[]>((acc, p, i) => {
      let { x, y, r, g, b } = p;
      // update the colors with color intensity
      r *= colorIntensity;
      g *= colorIntensity;
      b *= colorIntensity;

      // out of bound
      const outOfBounds = (x<xmin || x>xmax || y<ymin || y>ymax);
      // check if point is in mask
      let inMaskBounds = false;
      let cmask = null;
      for (let j=0; j<masks.length; j++) {
        if (x>masks[j].xmin && x<masks[j].xmax && y>masks[j].ymin && y<masks[j].ymax) {
          inMaskBounds = true;
          cmask = masks[j];
          break;
        }
      }

      // skip if already blanked previous and still in mask bounds
      if ((outOfBounds || inMaskBounds) && blankedPrevious) {
        // push a blank if all the points were skipped (fixes lots of issues)
        if (acc.length===0 && i===points.length-1) {
          [x, y] = applyPerspectiveAndScale(x, y, perspective, scale, xmin, xmax, ymin, ymax);
          acc.push({ x: Math.min(x,1), y: Math.min(y,1), r:0, g:0, b:0 });
          return acc;
        }
        return acc;
      }

      // if previous was blank but we're outside mask bounds
      if (cmaskPrevious!==null && blankedPrevious) {
        const [px, py] = [points[i-1].x, points[i-1].y];
        const pt = getIntersectPos({ x, y }, { x: px, y: py }, cmaskPrevious);
        if (pt)
          [x, y] = pt;
      }

      // if we're out-of-bounds
      if (outOfBounds) {
        x = Math.max(Math.min(x, xmax), xmin);
        y = Math.max(Math.min(y, ymax), ymin);
      // if we're going inside mask bounds
      } else if (inMaskBounds && cmask && i > 0) {
        const [px, py] = [points[i-1].x, points[i-1].y];
        const pt = getIntersectPos({ x, y }, { x: px, y: py }, cmask);
        if (pt)
          [x, y] = pt;
      // if we're still inside mask bounds, skip
      } else if (inMaskBounds && cmask) {
        cmaskPrevious = cmask;
        blankedPrevious = true;
        return acc;
      }

      // apply perspective and scale
      [x, y] = applyPerspectiveAndScale(x, y, perspective, scale, xmin, xmax, ymin, ymax);

      // add wait before laser goes off
      if (outOfBounds || inMaskBounds) {
        for (let index=0; index<8; index++) {
          acc.push({ x: Math.max(Math.min(x,xmax,1),xmin,0), y: Math.max(Math.min(y,ymax,1),ymin,0), r, g, b });
        }
        blankedPrevious = true;
        return acc;
      }

      // add blanking points on new coordinates
      if (blankedPrevious) {
        for (let index=0; index<WAIT_AMOUNT; index++) {
          acc.push({ x: Math.max(Math.min(x,xmax,1),xmin,0), y: Math.max(Math.min(y,ymax,1),ymin,0), r: 0, g: 0, b: 0 });
        }
      }

      acc.push({ x: Math.max(Math.min(x,xmax,1),xmin,0), y: Math.max(Math.min(y,ymax,1),ymin,0), r, g, b });
      blankedPrevious = false;
      cmaskPrevious = null;
      return acc;
    }, []);
  };
}

/**
 * Apply the perspective and scaling to the position
 * @param number x (the x component)
 * @param number y (the y component)
 * @param function perspective (the perspective transform)
 * @param number scale (the scale)
 * @returns the computed position as a [number, number]
 */
function applyPerspectiveAndScale(x : number, y : number, perspective : (x: number, y: number) => [number, number], scale : number, xmin : number, xmax : number, ymin : number, ymax : number) {
  const coordinates = perspective(x, y);
  x = Math.max(Math.min(coordinates[0], 1), 0);
  y = Math.max(Math.min(coordinates[1], 1), 0);
  return scalePos(x, y, scale);
}

/**
 * Scale a position from range [0;1] to [0;scale], centered in 0.5
 * @param number x (the x component)
 * @param number y (the y component)
 * @param number scale (the scale)
 * @returns the scaled position as a [number, number]
 */
function scalePos(x : number, y : number, scale : number) {
  return [
    (x - 0.5)*scale + 0.5,
    (y - 0.5)*scale + 0.5
  ];
}

/**
 * Converts a bounds to vertices coordinates
 * @param {xmin, xmax, ymin, ymax} mask (the mask to convert)
 * @returns a list of points
 */
function boundsToPts(mask : ConstBounds) {
  return [
    { x: mask.xmin, y: mask.ymin },
    { x: mask.xmax, y: mask.ymin },
    { x: mask.xmax, y: mask.ymax },
    { x: mask.xmin, y: mask.ymax }
  ];
}

/**
 * Returns the new position when inside a bounding mask
 * TODO: use all the intersection points instead of just the first one
 * @param vec2 pos (the current position)
 * @param vec2 prevPos (the previous position)
 * @param {xmin, xmax, ymin, ymax} mask (the bounding mask we're overlapping)
 * @returns the first intersection or null
 */
function getIntersectPos(pos: Coordinate, prevPos : Coordinate, mask: ConstBounds) {
  const maskpts = boundsToPts(mask);
  const pts = findMaskIntersections(pos, prevPos, maskpts);
  if (pts.length > 0)
    return [pts[0].x, pts[0].y]
  return null;
}

/**
 * Find the intersection points between a mask and a segment
 * @param vec2 p0 (the point A of the segment)
 * @param vec2 p1 (the point B of the segment)
 * @param vec2[] maskpts (the mask bbox points)
 * @returns a list of intersection points
 */
function findMaskIntersections(p0 : Coordinate, p1 : Coordinate, maskpts : Coordinate[]) {
  const pts = [];
  for (let s=1; s<5; s++) {
    const p = segmentsIntersection(
      p0,
      p1,
      { x: maskpts[s-1].x, y: maskpts[s-1].y },
      { x: maskpts[s%4].x, y: maskpts[s%4].y }
    );
    if (p!==null)
      pts.push(p);
  }
  return pts;
}

/**
 * Return the intersection point between two segments, null if they don't overlap
 * @param vec2 p0 (the point A for the first segment)
 * @param vec2 p1 (the point B for the first segment)
 * @param vec2 p2 (the point A for the second segment)
 * @param vec2 p3 (the point B for the second segment)
 * @returns an intersection point or null
 */
function segmentsIntersection(p0 : Coordinate, p1 : Coordinate, p2 : Coordinate, p3 : Coordinate) {
  const s1x = p1.x - p0.x;
  const s1y = p1.y - p0.y;
  const s2x = p3.x - p2.x;
  const s2y = p3.y - p2.y;
  const s = (-s1y * (p0.x - p2.x) + s1x * (p0.y - p2.y)) / (-s2x * s1y + s1x * s2y);
  const t = (s2x * (p0.y - p2.y) - s2y * (p0.x - p2.x)) / (-s2x * s1y + s1x * s2y);
  if (s >= 0 && s <= 1 && t >= 0 && t <= 1)
    return { x: p0.x + (t*s1x), y: p0.y + (t*s1y) };
  return null;
};
