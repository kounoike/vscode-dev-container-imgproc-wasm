load("@org_tensorflow//tensorflow/lite:build_def.bzl", "tflite_linkopts")

cc_binary(
    name = "wasm",
    srcs = ["wasm.cc"],
    additional_linker_inputs = ["model/pinto/model_float32.tflite"],
    linkopts = tflite_linkopts() + [
        "-s ALLOW_MEMORY_GROWTH=1",
        "-s USE_PTHREADS=0",
        "-s MODULARIZE=1",
        "-s ASSERTIONS=1",
        "-s EXPORT_NAME=createWasmModule",
        "-s TOTAL_MEMORY=65536000",
        "-s DISABLE_EXCEPTION_CATCHING=0",
        "-s ERROR_ON_UNDEFINED_SYMBOLS=0",
        "--embed-file model/pinto/model_float32.tflite@/",
    ],
    deps = [
        "@opencv_simd//:opencv_simd",
        "@org_tensorflow//tensorflow/lite:framework",
        "@org_tensorflow//tensorflow/lite:tflite_with_xnnpack",
        "@org_tensorflow//tensorflow/lite/kernels:builtin_ops",
        "@spdlog",
    ],
)
