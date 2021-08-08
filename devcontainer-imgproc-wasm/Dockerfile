# [Choice] Debian / Ubuntu version: debian-11, debian-10, debian-9, ubuntu-20.04, ubuntu-18.04
ARG VARIANT=ubuntu-20.04
FROM mcr.microsoft.com/vscode/devcontainers/cpp:0-${VARIANT} AS base

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get -y install --no-install-recommends \
        ca-certificates \
        gnupg \
        python \
        python3-dev \
        python3-numpy \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ARG BAZEL_VERSION=3.7.2
## bazel sources.list
RUN curl -fsSL https://bazel.build/bazel-release.pub.gpg | gpg --dearmor > /etc/apt/trusted.gpg.d/bazel.gpg
RUN echo "deb [arch=amd64] https://storage.googleapis.com/bazel-apt stable jdk1.8" > /etc/apt/sources.list.d/bazel.list

## node.js sources.list
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -

## yarn sources.list
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" > /etc/apt/sources.list.d/yarn.list

RUN apt-get update && apt-get install -y --no-install-recommends nodejs yarn
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends \
        bazel-${BAZEL_VERSION} \
        nodejs \
        yarn \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/bazel-${BAZEL_VERSION} /usr/bin/bazel

# WORKDIR /tmp
RUN wget -O /usr/local/bin/buildifier https://github.com/bazelbuild/buildtools/releases/download/4.0.1/buildifier-linux-amd64 && \
    chmod +x /usr/local/bin/buildifier


FROM base AS emsdk
# with 2.0.20, building opencv simd version failed...
ARG EMSCRIPTEN_VERSION=2.0.26-lto
# ### EMSCRIPTEN for base
WORKDIR /
RUN git clone https://github.com/emscripten-core/emsdk.git --depth 1
WORKDIR /emsdk
RUN ./emsdk install ${EMSCRIPTEN_VERSION} && ./emsdk activate ${EMSCRIPTEN_VERSION}

### STAGE: tensorflow_setup
FROM base AS tensorflow_setup

### Tensorflow
WORKDIR /
RUN git clone https://github.com/tensorflow/tensorflow.git tensorflow_src -b v2.6.0-rc2
# RUN git -C /tensorflow_src checkout 9d461da4cb0af2f737bbfc68cca3f6445f1ceb60  # May 15, 2021 latest

RUN sed -i 's/"crosstool_top": "\/\/external:android\/emscripten"/"crosstool_top": "\/\/emscripten_toolchain\/everything"/' /tensorflow_src/tensorflow/BUILD

### MediaPipe
ARG MEDIAPIPE_VERSION=v0.8.6
WORKDIR /
RUN git clone https://github.com/google/mediapipe.git -b ${MEDIAPIPE_VERSION} --depth 1

### STAGE: halide_builder
FROM base AS halide_builder
ENV HALIDE_RELEASE_PKG=https://github.com/halide/Halide/releases/download/v12.0.1/Halide-12.0.1-x86-64-linux-5dabcaa9effca1067f907f6c8ea212f3d2b1d99a.tar.gz
WORKDIR /
RUN wget -O halide.tar.gz ${HALIDE_RELEASE_PKG}
RUN tar zxvf halide.tar.gz
RUN mv Halide-* Halide

### STAGE: OpenCV_builder
FROM emsdk AS opencv_builder
ARG OPENCV_VERSION=4.5.3

WORKDIR /
RUN git clone https://github.com/opencv/opencv.git -b ${OPENCV_VERSION} --depth 1
RUN git -C /opencv checkout -b ${OPENCV_VERSION}
RUN git clone https://github.com/kounoike/opencv_contrib.git -b 4.5.3-simd --depth 1
RUN git -C /opencv_contrib checkout 4.5.3-simd

ENV OPENCV_CMAKE_FLAGS="\
    -DOPENCV_EXTRA_MODULES_PATH=/opencv_contrib/modules \
    -DBUILD_LIST=core,imgproc,calib3d,video,ximgproc \
    -DBUILD_opencv_imgcodecs=ON \
    -DBUILD_opencv_js=OFF \
    -DWITH_PNG=ON \
    -DWITH_JPEG=ON \
    -DWITH_TIFF=OFF \
    -DWITH_WEBP=ON \
    -DWITH_OPENJPEG=OFF \
    -DWITH_JASPER=OFF \
    -DWITH_OPENEXR=OFF \
"

ENV OPENCV_CONFIG_FLAG_EMSCRIPTEN="\
    --config_only \
    --emscripten_dir=/emsdk/upstream/emscripten \
"
WORKDIR /opencv
RUN python3  platforms/js/build_js.py build_wasm                               $OPENCV_CONFIG_FLAG_EMSCRIPTEN $(sh -c 'for x in "$@"; do echo "--cmake_option=$x"; done' "" ${OPENCV_CMAKE_FLAGS})
RUN python3  platforms/js/build_js.py build_wasm_simd --simd                   $OPENCV_CONFIG_FLAG_EMSCRIPTEN $(sh -c 'for x in "$@"; do echo "--cmake_option=$x"; done' "" ${OPENCV_CMAKE_FLAGS})
# RUN python3  platforms/js/build_js.py build_wasm_threads --threads             $OPENCV_CONFIG_FLAG_EMSCRIPTEN $(sh -c 'for x in "$@"; do echo "--cmake_option=$x"; done' "" ${OPENCV_CMAKE_FLAGS})
# RUN python3  platforms/js/build_js.py build_wasm_simd_threads --simd --threads $OPENCV_CONFIG_FLAG_EMSCRIPTEN $(sh -c 'for x in "$@"; do echo "--cmake_option=$x"; done' "" ${OPENCV_CMAKE_FLAGS})

ENV OPENCV_JS_WHITELIST /opencv/platforms/js/opencv_js.config.py

RUN cmake --build /opencv/build_wasm              --parallel $(nproc)
RUN cmake --build /opencv/build_wasm_simd         --parallel $(nproc)
# RUN cmake --build /opencv/build_wasm_threads      --parallel $(nproc)
# RUN cmake --build /opencv/build_wasm_simd_threads --parallel $(nproc)

RUN cmake --install /opencv/build_wasm              --prefix /build_wasm
RUN cmake --install /opencv/build_wasm_simd         --prefix /build_wasm_simd
# RUN cmake --install /opencv/build_wasm_threads      --prefix /build_wasm_threads
# RUN cmake --install /opencv/build_wasm_simd_threads --prefix /build_wasm_simd_threads

## build for host
WORKDIR /opencv/build_native
RUN cmake $(sh -c 'for x in "$@"; do echo "--cmake_option=$x"; done' "" ${OPENCV_CMAKE_FLAGS}) ..
RUN cmake --build . --parallel $(nproc)
# RUN cmake --install . --prefix /usr/local

# ### STAGE:onnx_builder
# FROM emsdk AS onnx_builder
# ARG ONNXRT_VERSION=v1.8.2
# WORKDIR /
# RUN git clone https://github.com/microsoft/onnxruntime.git -b ${ONNXRT_VERSION} --depth 1
# WORKDIR /onnxruntime
# RUN python3 tools/ci_build/build.py --build_dir /onnxruntime/build/wasm --build_wasm --enable_wasm_threads --config Release --parallel --skip_tests

### STAGE: spdlog_builder
FROM emsdk AS spdlog_builder
WORKDIR /
RUN git clone https://github.com/gabime/spdlog.git
WORKDIR /spdlog/build_wasm
RUN /emsdk/upstream/emscripten/emcmake cmake ..
RUN cmake --build .
RUN cmake --install . --prefix /build_wasm

## build for host
WORKDIR /spdlog/build_native
RUN cmake ..
RUN cmake --build .
# RUN cmake --install .

###
FROM emsdk AS wasm_builder
WORKDIR /
COPY --from=tensorflow_setup /tensorflow_src /tensorflow_src
COPY --from=tensorflow_setup /mediapipe /mediapipe

COPY --from=halide_builder /Halide /Halide

COPY --from=opencv_builder /build_wasm /build_wasm
COPY --from=opencv_builder /build_wasm_simd /build_wasm_simd
# COPY --from=opencv_builder /build_wasm_threads /build_wasm_threads
# COPY --from=opencv_builder /build_wasm_simd_threads /build_wasm_simd_threads
COPY --from=opencv_builder /opencv /opencv
RUN cmake --install /opencv/build_native --prefix /usr/local

# COPY --from=onnx_builder /onnxruntime /onnxruntime

COPY --from=spdlog_builder /build_wasm /build_wasm
COPY --from=spdlog_builder /spdlog /spdlog
RUN cmake --install /spdlog/build_native --prefix /usr/local
