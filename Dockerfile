# [Choice] Debian / Ubuntu version: debian-11, debian-10, debian-9, ubuntu-20.04, ubuntu-18.04
ARG VARIANT=debian-10
FROM mcr.microsoft.com/vscode/devcontainers/cpp:0-${VARIANT}

