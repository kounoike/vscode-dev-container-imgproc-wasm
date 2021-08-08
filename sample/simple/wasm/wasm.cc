#include <emscripten.h>

#include <algorithm>

#include <spdlog/spdlog.h>

namespace {
const int MAX_WIDTH = 640;
const int MAX_HEIGHT = 480;

std::uint8_t inputImageBuffer[4 * MAX_WIDTH * MAX_HEIGHT];
std::uint8_t outputImageBuffer[4 * MAX_WIDTH * MAX_HEIGHT];
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
int exec(int width, int height) {
  spdlog::trace("start exec");
  for (int i = 0; i < width * height; ++i) {
    outputImageBuffer[i * 4 + 0] = static_cast<unsigned char>(std::min(255, inputImageBuffer[i * 4 + 0] + 60));
    outputImageBuffer[i * 4 + 1] = static_cast<unsigned char>(std::max(0, inputImageBuffer[i * 4 + 1] - 10));
    outputImageBuffer[i * 4 + 2] = static_cast<unsigned char>(std::max(0, inputImageBuffer[i * 4 + 2] - 10));
    outputImageBuffer[i * 4 + 3] = inputImageBuffer[i * 4 + 3];
  }
  spdlog::trace("done.");
  return 0;
}

}
