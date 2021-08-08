#include <emscripten.h>

#include <iostream>
#include <memory>
#include <cmath>
#include <chrono>

#include "opencv2/opencv.hpp"
#include "spdlog/spdlog.h"
#include "tensorflow/lite/kernels/register.h"
#include "tensorflow/lite/model.h"

#define CHECK_TFLITE_ERROR(x)                                                                                \
  if (!(x)) {                                                                                                \
    spdlog::error("Error at {}:{}", __FILE__, __LINE__);                                                     \
    return 1;                                                                                                \
  }

namespace {
std::unique_ptr<tflite::Interpreter> interpreter;

const int MAX_WIDTH = 640;
const int MAX_HEIGHT = 480;

std::uint8_t inputImageBuffer[4 * MAX_WIDTH * MAX_HEIGHT];
std::uint8_t outputImageBuffer[4 * MAX_WIDTH * MAX_HEIGHT];
float floatInputImageBuffer[3 * MAX_WIDTH * MAX_HEIGHT];

double preprocessDuration = 0.0;
double inferenceDuration = 0.0;
double postprocessDuration = 0.0;

} // namespace

extern "C" {
EMSCRIPTEN_KEEPALIVE
void setLogLevel(int lvl) { spdlog::set_level((spdlog::level::level_enum)lvl); }

EMSCRIPTEN_KEEPALIVE
void showExceptionMsg(intptr_t ptr) {
  auto e = reinterpret_cast<std::exception *>(ptr);
  spdlog::error("exception->what: {}", e->what());
}

EMSCRIPTEN_KEEPALIVE
std::uint8_t *getInputImageBuffer() { return inputImageBuffer; }

EMSCRIPTEN_KEEPALIVE
std::uint8_t *getOutputImageBuffer() { return outputImageBuffer; }

EMSCRIPTEN_KEEPALIVE
double getPreprocessDuration() { return preprocessDuration; }

EMSCRIPTEN_KEEPALIVE
double getInferenceDuration() { return inferenceDuration; }

EMSCRIPTEN_KEEPALIVE
double getPostprocessDuration() { return postprocessDuration; }

EMSCRIPTEN_KEEPALIVE
int loadModel() {
  spdlog::trace("loadModel");
  // Load model
  std::unique_ptr<tflite::FlatBufferModel> model = tflite::FlatBufferModel::BuildFromFile("/model_float32.tflite");
  CHECK_TFLITE_ERROR(model != nullptr);

  tflite::ops::builtin::BuiltinOpResolver resolver;
  tflite::InterpreterBuilder builder(*model, resolver);
  builder(&interpreter);
  CHECK_TFLITE_ERROR(interpreter != nullptr);
  interpreter->SetNumThreads(0);

  // Allocate tensor buffers.
  CHECK_TFLITE_ERROR(interpreter->AllocateTensors() == kTfLiteOk);

  spdlog::trace("Load Model Success");

  return 0;
}

EMSCRIPTEN_KEEPALIVE
int exec(int width, int height) {
  spdlog::trace("exec {0}x{1}", width, height);

  int tensorWidth = interpreter->input_tensor(0)->dims->data[2];
  int tensorHeight = interpreter->input_tensor(0)->dims->data[1];
  float *tfInput = interpreter->typed_input_tensor<float>(0);
  float *tfOutput = interpreter->typed_output_tensor<float>(0);

  // 前処理
  spdlog::trace("start preprocess");
  auto startPreprocess = std::chrono::system_clock::now();
  cv::Mat inputImageMat(height, width, CV_8UC4, inputImageBuffer);
  cv::Mat tfInputImageMat(tensorHeight, tensorWidth, CV_32FC3, tfInput);
  cv::Mat floatInputImageMat(height, width, CV_32FC3, floatInputImageBuffer);
  {
    // RGBA2RGB + 8U->32F by LUT
    cv::Mat inputImageRGBMat;
    cv::cvtColor(inputImageMat, inputImageRGBMat, cv::COLOR_RGBA2RGB);
    inputImageRGBMat.convertTo(floatInputImageMat, CV_32F, 1.0 / 255.0, 0.0);
    cv::resize(floatInputImageMat, tfInputImageMat, tfInputImageMat.size(), 0, 0, cv::INTER_LANCZOS4);
  }
  spdlog::trace("preprocessing done.");
  auto endPreprocess = std::chrono::system_clock::now();

  // 推論
  spdlog::trace("start inference");
  auto startInference = std::chrono::system_clock::now();
  int ret = interpreter->Invoke();
  if (ret != kTfLiteOk) {
    spdlog::error("inference error: {}", ret);
    return -1;
  }
  spdlog::trace("inference done.");
  auto endInference = std::chrono::system_clock::now();

  // 後処理
  spdlog::trace("start postprocess");
  auto startPostprocess = std::chrono::system_clock::now();
  cv::Mat tfOutputMaskMat(tensorHeight, tensorWidth, CV_32FC2, tfOutput);
  cv::Mat outputImageMat(height, width, CV_8UC4, outputImageBuffer);

  cv::Mat blurredMat;
  cv::GaussianBlur(inputImageMat, blurredMat, cv::Size(9, 9), 0.0);

  cv::Mat resizedOutputMaskMat(height, width, CV_32FC2);
  {
    std::vector<cv::Mat> inferenceOutputs;
    cv::split(tfOutputMaskMat, inferenceOutputs);
    cv::Mat floatMaskMat;
    // cv::threshold(inferenceOutputs[1], floatMaskMat, 0.5, 255, cv::THRESH_BINARY);
    inferenceOutputs[1].copyTo(floatMaskMat);
    cv::Mat maskMat;
    floatMaskMat.convertTo(maskMat, CV_8U, 255, 0);
    cv::resize(maskMat, maskMat, outputImageMat.size(), 0.0, 0.0, cv::INTER_CUBIC);

    blurredMat.copyTo(outputImageMat);
    inputImageMat.copyTo(outputImageMat, maskMat);
  }

  spdlog::trace("postprocess done.");
  auto endPostprocess = std::chrono::system_clock::now();
  preprocessDuration = std::chrono::duration_cast<std::chrono::nanoseconds>(endPreprocess - startPreprocess).count() / 1000000.0;
  inferenceDuration = std::chrono::duration_cast<std::chrono::nanoseconds>(endInference - startInference).count() / 1000000.0;
  postprocessDuration = std::chrono::duration_cast<std::chrono::nanoseconds>(endPostprocess - startPostprocess).count() / 1000000.0;

  return 0;
}

}
