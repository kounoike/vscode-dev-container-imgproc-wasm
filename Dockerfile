# [Choice] Debian / Ubuntu version: debian-11, debian-10, debian-9, ubuntu-20.04, ubuntu-18.04
ARG VARIANT=ubuntu-20.04

FROM mcr.microsoft.com/vscode/devcontainers/cpp:0-${VARIANT} AS base

RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    ca-certificates \
    gnupg \
    nodejs \
    python \
    python3-dev \
    python3-numpy \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ARG BAZEL_VERSION=3.7.2
## bazel sources.list
RUN curl -fsSL https://bazel.build/bazel-release.pub.gpg | gpg --dearmor > /etc/apt/trusted.gpg.d/bazel.gpg
RUN echo "deb [arch=amd64] https://storage.googleapis.com/bazel-apt stable jdk1.8" > /etc/apt/sources.list.d/bazel.list
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends bazel-${BAZEL_VERSION} \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/bazel-${BAZEL_VERSION} /usr/bin/bazel


# with 2.0.20, building opencv simd version failed...
ARG EMSCRIPTEN_VERSION=2.0.14

# ### EMSCRIPTEN for base
WORKDIR /
RUN git clone https://github.com/emscripten-core/emsdk.git --depth 1
WORKDIR /emsdk
RUN ./emsdk install ${EMSCRIPTEN_VERSION} && ./emsdk activate ${EMSCRIPTEN_VERSION}

### STAGE: tensorflow_setup
FROM base AS tensorflow_setup

### Tensorflow
WORKDIR /
RUN git clone https://github.com/tensorflow/tensorflow.git tensorflow_src
RUN git -C /tensorflow_src checkout 9d461da4cb0af2f737bbfc68cca3f6445f1ceb60  # May 15, 2021 latest

RUN sed -i 's/"crosstool_top": "\/\/external:android\/emscripten"/"crosstool_top": "\/\/emscripten_toolchain\/everything"/' /tensorflow_src/tensorflow/BUILD

### MediaPipe
ARG MEDIAPIPE_VERSION=v0.8.4
WORKDIR /
RUN git clone https://github.com/google/mediapipe.git -b ${MEDIAPIPE_VERSION} --depth 1


### STAGE: OpenCV_builder
FROM base AS opencv_builder
ARG OPENCV_VERSION=4.5.3

WORKDIR /
RUN git clone https://github.com/opencv/opencv.git -b ${OPENCV_VERSION} --depth 1
RUN git -C /opencv checkout -b ${OPENCV_VERSION}
RUN git clone https://github.com/kounoike/opencv_contrib.git -b 4.5.3-simd --depth 1
RUN git -C /opencv_contrib checkout 4.5.3-simd

ENV OPENCV_CONFIG_FLAG="\
    --config_only \
    --emscripten_dir=/emsdk/upstream/emscripten \
    --cmake_option=-DOPENCV_EXTRA_MODULES_PATH=/opencv_contrib/modules \
    --cmake_option=-DBUILD_LIST=core,imgproc,calib3d,video,ximgproc \
    --cmake_option=-DBUILD_opencv_imgcodecs=ON \
    --cmake_option=-DBUILD_opencv_js=OFF \
    --cmake_option=-DWITH_PNG=ON \
    --cmake_option=-DWITH_JPEG=ON \
    --cmake_option=-DWITH_TIFF=OFF \
    --cmake_option=-DWITH_WEBP=ON \
    --cmake_option=-DWITH_OPENJPEG=OFF \
    --cmake_option=-DWITH_JASPER=OFF \
    --cmake_option=-DWITH_OPENEXR=OFF \
"
WORKDIR /opencv
RUN python3  platforms/js/build_js.py build_wasm              ${OPENCV_CONFIG_FLAG} --cmake_option=-DCMAKE_INSTALL_PREFIX=/opencv_build/wasm
RUN python3  platforms/js/build_js.py build_wasm_simd         ${OPENCV_CONFIG_FLAG} --cmake_option=-DCMAKE_INSTALL_PREFIX=/opencv_build/wasm_simd --simd

ENV OPENCV_JS_WHITELIST /opencv/platforms/js/opencv_js.config.py

RUN /emsdk/upstream/emscripten/emmake cmake --build /opencv/build_wasm      --parallel $(nproc)
RUN /emsdk/upstream/emscripten/emmake cmake --build /opencv/build_wasm_simd --parallel $(nproc)

RUN mkdir -p /opencv_build/wasm      && /emsdk/upstream/emscripten/emmake cmake --install /opencv/build_wasm
RUN mkdir -p /opencv_build/wasm_simd && /emsdk/upstream/emscripten/emmake cmake --install /opencv/build_wasm_simd

# ### STAGE:onnx_builder
# FROM base AS onnx_builder
# ARG ONNXRT_VERSION=v1.8.2
# WORKDIR /
# RUN git clone https://github.com/microsoft/onnxruntime.git -b ${ONNXRT_VERSION} --depth 1
# WORKDIR /onnxruntime
# RUN python3 tools/ci_build/build.py --build_dir /onnxruntime/build/wasm --build_wasm --enable_wasm_threads --config Release --parallel --skip_tests


### STAGE: halide_builder
FROM base AS halide_builder
ENV HALIDE_RELEASE_PKG=https://github.com/halide/Halide/releases/download/v12.0.1/Halide-12.0.1-x86-64-linux-5dabcaa9effca1067f907f6c8ea212f3d2b1d99a.tar.gz
WORKDIR /
RUN wget -O halide.tar.gz ${HALIDE_RELEASE_PKG}
RUN tar zxvf halide.tar.gz
RUN mv Halide-* Halide

### STAGE: spdlog_builder
FROM base AS spdlog_builder
WORKDIR /
RUN git clone https://github.com/gabime/spdlog.git
WORKDIR /spdlog/build
RUN /emsdk/upstream/emscripten/emmake cmake -DCMAKE_INSTALL_PREFIX=/spdlog_build ..
RUN /emsdk/upstream/emscripten/emmake cmake --build .
RUN mkdir /spdlog_build && /emsdk/upstream/emscripten/emmake cmake --install .

###
FROM base AS wasm_builder
WORKDIR /
COPY --from=tensorflow_setup /tensorflow_src /tensorflow_src
COPY --from=tensorflow_setup /mediapipe /mediapipe

COPY --from=opencv_builder /opencv_build /opencv_build
# COPY --from=onnx_builder /onnxruntime /onnxruntime
COPY --from=halide_builder /Halide /Halide
COPY --from=spdlog_builder /spdlog_build /spdlog_build

