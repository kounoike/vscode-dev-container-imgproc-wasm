import { Form, Select } from 'antd'
import React from 'react'
import { useAsync } from 'react-use';
import Webcam from 'react-webcam'
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';

interface ExtendedHTMLVideoElement extends HTMLVideoElement {
  requestVideoFrameCallback(callback: () => void): number
}

export interface Wasm extends EmscriptenModule {
  _loadModel(): number

  _getInputImageBuffer(): number
  _getOutputImageBuffer(): number

  _getPreprocessDuration(): number
  _getInferenceDuration(): number
  _getPostprocessDuration(): number

  _exec(widht: number, height: number): number
  _showExceptionMsg(ex: number): void
  _setLogLevel(level: number): void
}

declare function createWasmModule(): Promise<Wasm>


const App = () => {
  const [deviceId, setDeviceId] = React.useState("")
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([])
  const webcamRef = React.useRef<Webcam>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [chartData, setChartData] = React.useState<Object[]>([])
  const [startTime, setStartTime] = React.useState<number>(0)

  const wasmModuleState = useAsync(async () => {
    const wasm = await createWasmModule()
    // wasm._setLogLevel(0)
    wasm._loadModel()
    setStartTime(Date.now())
    return wasm
  }, [createWasmModule])

  const handleSelectDevice = (selectedId: string) => {
    setDeviceId(selectedId)
  }

  const handleDevices = React.useCallback(
    (mediaDevices: MediaDeviceInfo[]) => {
      setDevices(mediaDevices.filter(({ kind }) => kind === "videoinput"))
    }, [setDevices]
  );

  React.useEffect(
    () => {
      navigator.mediaDevices.enumerateDevices().then(handleDevices);
    },
    [handleDevices]
  );

  const onStreamChanged = (stream: MediaStream) => {
    const tracks = stream.getVideoTracks()
    if (tracks.length > 0) {
      const id = tracks[0].getSettings().deviceId
      if (id) {
        setDeviceId(id)
      }
    }

    if(devices.length === 1 && devices[0].deviceId === "") {
      navigator.mediaDevices.enumerateDevices().then(handleDevices);
    }
  }

  const render = React.useCallback(() => {
    if (wasmModuleState.loading || wasmModuleState.error !== undefined) {
      return
    }

    const wasm = wasmModuleState.value!
    const video = webcamRef.current!.video!
    const width = video.videoWidth
    const height = video.videoHeight
    if (width > 0 && height > 0) {
      const startJs = performance.now()
      console.time()
      console.time('canvas')
      const inCanvas = new OffscreenCanvas(width, height)
      const outCanvas = canvasRef.current!
      outCanvas.width = width
      outCanvas.height = height
      console.timeEnd('canvas')
  
      console.time('drawImage')
      const inCtx = inCanvas.getContext('2d')!
      inCtx.drawImage(video, 0, 0)
      console.timeEnd('drawImage')
      console.time('getImageData')
      const inImageData = inCtx.getImageData(0, 0, width, height)
      console.timeEnd('getImageData')
      console.time('wasm_getPtr')
      const inputImageBufferOffset = wasm._getInputImageBuffer()
      console.timeEnd('wasm_getPtr')
      console.time('HEAP')
      wasm.HEAPU8.set(inImageData.data, inputImageBufferOffset)
      console.timeEnd('HEAP')
      console.timeEnd()
  
      const startWasm = performance.now()
      try{
        wasm._exec(width, height)
      } catch (ex) {
        wasm._showExceptionMsg(ex as number)
        throw ex
      }
      const endWasm = performance.now()
  
      const outCtx = outCanvas.getContext('2d')!

      outCtx.filter = 'blur(5px)'
      outCtx.drawImage(video, 0, 0)
      outCtx.filter = 'none'

      const outputImageBufferOffset = wasm._getOutputImageBuffer() 
      const outImageData = new ImageData(new Uint8ClampedArray(wasm.HEAPU8.slice(outputImageBufferOffset, outputImageBufferOffset + width * height * 4)), width, height)
      const maskedImageCanvas = new OffscreenCanvas(width, height)
      maskedImageCanvas.getContext('2d')!.putImageData(outImageData, 0, 0)
      outCtx.drawImage(maskedImageCanvas, 0, 0)

      const endJs = performance.now()
      const wasmDuration = endWasm - startWasm
      const jsDuration = endJs - startJs
      const data = {
        time: (Date.now() - startTime) / 1000,
        wasmDuration,
        jsDuration,
        jsPreprocessDuration: startWasm - startJs,
        jsPostprocessDuration: endJs - endWasm,
        preprocessDuration: wasm._getPreprocessDuration(),
        inferenceDuration: wasm._getInferenceDuration(),
        postprocessDuration: wasm._getPostprocessDuration()
      }
      setChartData(prev => [...(prev.length >= 500 ? prev.slice(1) : prev), data])
    }
    const cancelId = (webcamRef.current!.video as any).requestVideoFrameCallback(render)
    return () => (webcamRef.current!.video as any).cancelVideoFrameCallback(cancelId)
  }, [wasmModuleState, startTime])

  React.useEffect(
    () => {
      if (webcamRef.current && canvasRef.current) {
        const video = webcamRef.current.video! as ExtendedHTMLVideoElement
        video.requestVideoFrameCallback(render)
      }else{
        console.log("ref error", webcamRef.current, canvasRef.current)
      }
    }, [render]
  )

  return (
    <div className="App">
      <p>selected: {deviceId}</p>
      <Form>
        <Form.Item label="device">
          <Select onSelect={handleSelectDevice} value={deviceId}>
            {devices.map((device, key) => (
              <Select.Option key={device.deviceId} value={device.deviceId}>{device.label}</Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
      <Webcam
        videoConstraints={{deviceId: deviceId, width: 640, height: 480}}
        audio={false}
        onUserMedia={onStreamChanged}
        ref={webcamRef}
        className="input"
      ></Webcam>
      <canvas id="output" ref={canvasRef} className="output"></canvas>
      <LineChart width={800} height={400} data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time"/>
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="linear" dataKey="jsDuration" name="total time" stroke="#8884d8" />
          <Line type="linear" dataKey="wasmDuration" name="wasm time" stroke="#82ca9d" />
          <Line type="linear" dataKey="preprocessDuration" name="preproc time" stroke="#9d82ca" />
          <Line type="linear" dataKey="inferenceDuration" name="inference time" stroke="#829dca" />
          <Line type="linear" dataKey="postprocessDuration" name="postproc time" stroke="#ca9d82" />
          <Line type="linear" dataKey="jsPreprocessDuration" name="JSpreproc time" stroke="#9d82ca" />
          <Line type="linear" dataKey="jsPostprocessDuration" name="JSpostproc time" stroke="#9dca82" />
      </LineChart>
    </div>
  );
};
export default App
