cmake_minimum_required(VERSION 3.16)
project(wasm-cmake LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(JS_NAME ${PROJECT_NAME})
add_link_options(
  "SHELL:-s ALLOW_MEMORY_GROWTH=1"
  "SHELL:-s USE_PTHREADS=0"
  "SHELL:-s MODULARIZE=1"
  "SHELL:-s ASSERTIONS=1"
  "SHELL:-s EXPORT_NAME=createWasmModule"
  "SHELL:-s TOTAL_MEMORY=65536000"
  "SHELL:-s DISABLE_EXCEPTION_CATCHING=0"
  "SHELL:-s ERROR_ON_UNDEFINED_SYMBOLS=0"
  "SHELL:--embed-file ${CMAKE_CURRENT_SOURCE_DIR}/model/pinto/model_float32.tflite@/"
)
file(GLOB sources "*.cc")
add_executable(${JS_NAME} ${sources})
target_link_options(${JS_NAME} PRIVATE
  "SHELL:-s EXPORT_NAME=createWasmModule"
)

# OpenCV
include_directories(/build_wasm_simd/include/opencv4)
file(GLOB opencv_core "/build_wasm_simd/lib/libopencv*.a")
file(GLOB opencv_3rdparty "/build_wasm_simd/lib/opencv4/3rdparty/*.a")
target_link_libraries(${JS_NAME} ${opencv_core} ${opencv_3rdparty})

# TFLite
include_directories(/build_wasm_simd/include)
file(GLOB tflite_core "/build_wasm_simd/lib/libtensorflow*.a")
file(GLOB_RECURSE tflite_3rdparty "/build_wasm_simd/lib/tensorflow-lite/**/lib*.a")
target_link_libraries(${JS_NAME} ${tflite_core} ${tflite_3rdparty})

# SpdLog
include_directories("/build_wasm/include")
file(GLOB spdlog_core "/build_wasm/lib/libspdlog*.a")
