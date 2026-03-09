import * as path from 'node:path';
const koffi = require("koffi");

void koffi.struct('HeliosPoint', {
  x: 'uint16',
  y: 'uint16',
  r: 'uint8',
  g: 'uint8',
  b: 'uint8',
  i: 'uint8',
});

const libPath = path
  .join(__dirname, '../sdk/libHeliosDACAPI.so')
  // Super super dirty hack to make this work with Electron; native dependencies
  // dont'get placed inside the "app.asar" bundle, but instead get placed in a separate directory called "app.asar.unpacked"
  .replace('app.asar', 'app.asar.unpacked');

const helios = koffi.load(libPath);

const HeliosLib = {
  //initializes drivers, opens connection to all devices.
  //Returns number of available devices.
  //NB: To re-scan for newly connected DACs after this function has once been called before, you must first call CloseDevices()
  OpenDevices: helios.func('int OpenDevices()'),
  //Gets status from the specified dac.
  //Return 1 if ready to receive new frame, 0 if not, -1 if communcation failed
  GetStatus: helios.func('int GetStatus(int)'),
  //stops, blanks and centers output on the specified dac
  //returns 1 if successful
  Stop: helios.func('int Stop(int)'),
  //closes connection to all dacs and frees resources
  //should be called when library is no longer needed (program exit for example)
  CloseDevices: helios.func('void CloseDevices()'),
  //sets the shutter of the specified dac.
  //value 1 = shutter open, value 0 = shutter closed
  //returns 1 if successful
  SetShutter: helios.func('int SetShutter(uint, bool)'),
  //writes and outputs a frame to the speficied dac
  //dacNum: dac number (0 to n where n+1 is the return value from OpenDevices() )
  //pps: rate of output in points per second
  //flags: (default is 0)
  //	Bit 0 (LSB) = if true, start output immediately, instead of waiting for current frame (if there is one) to finish playing
  //	Bit 1 = if true, play frame only once, instead of repeating until another frame is written
  //	Bit 2-7 = reserved
  //points: pointer to point data. See point structure documentation in HeliosDac.h
  //numOfPoints: number of points in the frame
  //returns 1 if successful
  WriteFrame: helios.func('int WriteFrame(uint, uint, uint8_t, HeliosPoint *, uint)'),
  GetMaxSampleRate: helios.func('unsigned int GetMaxSampleRate(unsigned int devNum)'),
  GetMinSampleRate: helios.func('unsigned int GetMinSampleRate(unsigned int devNum)'),
  GetMaxFrameSize: helios.func('unsigned int GetMaxFrameSize(unsigned int devNum)'),
};

export function GetMaxSampleRate(dacNum: number): number {
  return HeliosLib.GetMaxSampleRate(dacNum);
}

export function GetMinSampleRate(dacNum: number): number {
  return HeliosLib.GetMinSampleRate(dacNum);
}

export function GetMaxFrameSize(dacNum: number): number {
  return HeliosLib.GetMaxFrameSize(dacNum);
}

export function openDevices(): number {
  return HeliosLib.OpenDevices();
}

export function getStatus(dacNum: number): number {
  return HeliosLib.GetStatus(dacNum);
}

export function closeDevices(): void {
  return HeliosLib.CloseDevices();
}

export function setShutter(dacNum: number, shutterValue: boolean): number {
  return HeliosLib.SetShutter(dacNum, shutterValue);
}

export function writeFrame(
  dacNum: number,
  pps: number,
  flags: 0 | 1,
  points: any[],
  numOfPoints: number
): number {
  return HeliosLib.WriteFrame(dacNum, pps, flags, points, numOfPoints);
}

export interface IPoint {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  i?: number;
}
