# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:alpine AS base
RUN apk add --no-cache python3 py3-pip
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install

RUN python -m venv /temp/python/venv
ENV PATH="/temp/python/venv/bin:$PATH"
COPY requirements.txt /temp/python
RUN cd /temp/python && pip install -r requirements.txt  --break-system-packages

RUN mkdir -p /temp/dev
COPY ./patches /temp/dev/patches
COPY package.json bun.lockb  /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY ./patches /temp/prod/patches
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# [optional] tests & build
ENV NODE_ENV=production
# RUN bun test
RUN bun run build

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=install /temp/python/venv ./venv
ENV PATH="/usr/src/app/venv/bin:$PATH"
# COPY --from=prerelease /usr/src/app/src ./src
COPY --from=prerelease /usr/src/app/dist ./dist
COPY --from=prerelease /usr/src/app/package.json .
COPY --from=prerelease /usr/src/app/public ./public

# run the app
RUN  chown -R bun:bun ./dist/temp
USER bun
ARG PORT 
EXPOSE ${PORT}
ENTRYPOINT [ "bun", "run", "dist/index.js" ]