import {Point} from "../Point";

export type TransformFn = (points: Point[]) => Point[];

export function compositor(transformers: TransformFn[]): TransformFn {
  return function(points) {
    let transformedPoints = points;

    transformers.forEach(function(transformer) {
      transformedPoints = transformer(transformedPoints);
    });

    return transformedPoints;
  };
}

