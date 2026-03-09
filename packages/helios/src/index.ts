import { Device } from '@laser-dac/core';
import * as heliosLib from './HeliosLib';
import { relativeToPosition, relativeToColor } from './convert';

// This controls the intensity signal of points written to the DAC.
// For many laser projectors this won't make a difference, but some projectors map this to the shutter so the laser won't turn on if we don't pass the max value.
// const INTENSITY = 255;
const MAX_POINTS = 4094;

export class Helios extends Device {
    private interval: NodeJS.Timeout[] = [];
    count: number = 0;

    async start() {
        this.stop();
        this.count = heliosLib.openDevices();

        for (let i = 0; i < this.count; i++) {
            heliosLib.setShutter(i, true);
        }

        return this.count > 0;
    }

    getMaxFrameSize(deviceIndex: number = 0) {
        return heliosLib.GetMaxFrameSize(deviceIndex);
    }

    getMaxSampleRate(deviceIndex: number = 0) {
        return heliosLib.GetMaxSampleRate(deviceIndex);
    }

    getMinSampleRate(deviceIndex: number = 0) {
        return heliosLib.GetMinSampleRate(deviceIndex);
    }

    stop() {
        for (let i = 0; i < this.count; i++) {
            heliosLib.setShutter(i, false);
        }
        heliosLib.closeDevices();
        this.interval.forEach((interval) => {
            if (interval) {
                clearInterval(interval);
            }
        });
    }

    private convertPoint(p: heliosLib.IPoint) {
        return {
            x: relativeToPosition(p.x),
            y: relativeToPosition(p.y),
            r: relativeToColor(p.r),
            g: relativeToColor(p.g),
            b: relativeToColor(p.b),
            i: 1,
        };
    }

    stream(
        scene: { points: heliosLib.IPoint[] },
        pointsRate: number,
        fps: number,
        device: number = 0,
    ) {
        this.interval[device] = setInterval(() => {
            if (!scene.points.length) {
                return;
            }
            if (heliosLib.getStatus(device) !== 1) {
                return;
            }
            const points = scene.points
                .map(this.convertPoint)
                .slice(0, MAX_POINTS);
            heliosLib.writeFrame(device, pointsRate, 0, points, points.length);
        }, 1000 / fps);
    }

    getStatus(device: number = 0) {
        return heliosLib.getStatus(device);
    }

    stream_game(
        scene: {
            m_proj_scene_list: [
                {
                    m_draw_list: heliosLib.IPoint[];
                },
            ];
            m_context: { m_intensity: number };
        },
        pointsRate: number,
        fps: number,
    ) {
        const convertPoint = (p: heliosLib.IPoint) => {
            return {
                x: relativeToPosition(p.x),
                y: relativeToPosition(p.y),
                r: relativeToColor(p.r) * scene.m_context.m_intensity,
                g: relativeToColor(p.g) * scene.m_context.m_intensity,
                b: relativeToColor(p.b) * scene.m_context.m_intensity,
                i: scene.m_context.m_intensity,
            };
        };
        for (
            let device = 0;
            device < scene.m_proj_scene_list.length;
            device++
        ) {
            this.interval[device] = setInterval(() => {
                const proj_scene = scene.m_proj_scene_list[device];
                if (!proj_scene.m_draw_list.length) {
                    return;
                }
                if (heliosLib.getStatus(device) !== 1) {
                    return;
                }
                const points = proj_scene.m_draw_list
                    .map(convertPoint)
                    .slice(0, MAX_POINTS);
                heliosLib.writeFrame(
                    device,
                    pointsRate,
                    0,
                    points,
                    points.length,
                );
            }, 1000 / fps);
        }
    }
}
