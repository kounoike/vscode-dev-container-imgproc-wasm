import { Form, Select } from 'antd'
import React from 'react'
import { useAsync } from 'react-use';
import Webcam from 'react-webcam'

interface ExtendedHTMLVideoElement extends HTMLVideoElement {
  requestVideoFrameCallback(callback: () => void): number
}

export interface Wasm extends EmscriptenModule {
  _getInputImageBuffer(): number
  _getOutputImageBuffer(): number

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

  const wasmModuleState = useAsync(async () => {
    const wasm = await createWasmModule()
    // wasm._setLogLevel(0)
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
      const inCanvas = new OffscreenCanvas(width, height)
      const outCanvas = canvasRef.current!
      outCanvas.width = width
      outCanvas.height = height
  
      const inCtx = inCanvas.getContext('2d')!
      inCtx.drawImage(video, 0, 0)
      const inImageData = inCtx.getImageData(0, 0, width, height)
      const inputImageBufferOffset = wasm._getInputImageBuffer()
      wasm.HEAPU8.set(inImageData.data, inputImageBufferOffset)
  
      try{
        wasm._exec(width, height)
      } catch (ex) {
        wasm._showExceptionMsg(ex)
        throw ex
      }
  
      const outCtx = outCanvas.getContext('2d')!

      const outputImageBufferOffset = wasm._getOutputImageBuffer() 
      const outImageData = new ImageData(new Uint8ClampedArray(wasm.HEAPU8.slice(outputImageBufferOffset, outputImageBufferOffset + width * height * 4)), width, height)
      outCtx.putImageData(outImageData, 0, 0)
    }
    const cancelId = (webcamRef.current!.video as any).requestVideoFrameCallback(render)
    return () => (webcamRef.current!.video as any).cancelVideoFrameCallback(cancelId)
  }, [wasmModuleState])

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
    </div>
  );
};
export default App
