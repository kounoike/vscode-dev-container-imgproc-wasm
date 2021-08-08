cc_library(
    name = "opencv_simd",
    srcs = glob(
        [
            "lib/libopencv_*.a",
            "lib/opencv4/3rdparty/*.a",
        ],
    ),
    hdrs = glob(["include/opencv4/opencv2/**/*.h*"]),
    includes = ["include/opencv4"],
    linkstatic = 1,
    visibility = ["//visibility:public"],
)
