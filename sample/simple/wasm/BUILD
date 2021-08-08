cc_binary(
    name = "simple-wasm",
    srcs = ["wasm.cc"],
    linkopts = [
        "-s ALLOW_MEMORY_GROWTH=1",
        "-s USE_PTHREADS=0",
        "-s MODULARIZE=1",
        "-s ASSERTIONS=1",
        "-s EXPORT_NAME=createWasmModule",
        "-s TOTAL_MEMORY=65536000",
        "-s DISABLE_EXCEPTION_CATCHING=0",
        "-s ERROR_ON_UNDEFINED_SYMBOLS=0",
    ],
    deps = [
        "@spdlog",
    ],
)
